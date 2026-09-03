-- YouVo: Migration 010 - Rate Limiting & Account Delete Fix
-- 1. Fix RPC from migration 009 (ip_hash instead of ip_address)
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the ID of the user executing the function
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Create audit log BEFORE deleting the user role
  INSERT INTO admin_audit_logs (
    admin_id, 
    action, 
    entity, 
    entity_id, 
    old_value, 
    new_value, 
    reason, 
    ip_hash
  ) VALUES (
    v_user_id,
    'delete',
    'account',
    v_user_id, -- It's a UUID column
    null,
    null,
    'User self-initiated account deletion',
    'internal'
  );

  -- 2. Delete the user from auth.users. 
  DELETE FROM auth.users WHERE id = v_user_id;
  
  RETURN true;
END;
$$;

-- 2. Rate Limiting Table (Unlogged for speed)
CREATE UNLOGGED TABLE rate_limits (
    ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    tokens INTEGER NOT NULL,
    last_refill TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ip, endpoint)
);

-- Index for auto cleanup
CREATE INDEX idx_rate_limits_refill ON rate_limits(last_refill);

-- Atomic rate limiter check using PostgreSQL advisory locks and atomic updates
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_ip TEXT, 
    p_endpoint TEXT, 
    p_limit INTEGER, 
    p_window_ms INTEGER
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_tokens INTEGER;
    v_last_refill TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_window_interval INTERVAL := (p_window_ms || ' milliseconds')::INTERVAL;
BEGIN
    -- Select for update to lock the row and prevent race conditions
    SELECT tokens, last_refill INTO v_tokens, v_last_refill
    FROM rate_limits
    WHERE ip = p_ip AND endpoint = p_endpoint
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Insert new record (first request)
        INSERT INTO rate_limits (ip, endpoint, tokens, last_refill)
        VALUES (p_ip, p_endpoint, p_limit - 1, v_now);
        RETURN true;
    END IF;

    IF v_now - v_last_refill >= v_window_interval THEN
        -- Refill window has passed, reset tokens
        UPDATE rate_limits 
        SET tokens = p_limit - 1, last_refill = v_now
        WHERE ip = p_ip AND endpoint = p_endpoint;
        RETURN true;
    ELSIF v_tokens > 0 THEN
        -- Consume one token
        UPDATE rate_limits 
        SET tokens = v_tokens - 1
        WHERE ip = p_ip AND endpoint = p_endpoint;
        RETURN true;
    ELSE
        -- Rate limit exceeded
        RETURN false;
    END IF;
END;
$$;

-- 3. Cleanup function for old rate limits
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete records older than 24 hours to prevent table bloat
    DELETE FROM rate_limits WHERE last_refill < NOW() - INTERVAL '24 hours';
END;
$$;
