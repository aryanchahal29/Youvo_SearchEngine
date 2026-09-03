-- Migration: Phase 5 - Job Concurrency & Leases

-- 1. Add fields for Lease Management and Idempotency
ALTER TABLE automation_jobs 
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Prevent duplicate enqueuing of the exact same task
-- Only enforce uniqueness for active jobs (pending or running).
DROP INDEX IF EXISTS idx_jobs_idempotency;
CREATE UNIQUE INDEX idx_jobs_idempotency 
  ON automation_jobs(idempotency_key) 
  WHERE status IN ('pending', 'running') AND idempotency_key IS NOT NULL;

-- 3. High-performance polling index
DROP INDEX IF EXISTS idx_jobs_polling;
CREATE INDEX idx_jobs_polling 
  ON automation_jobs(job_type, status, priority DESC) 
  WHERE status IN ('pending', 'running');

-- 4. Atomic Claim RPC (PostgreSQL SKIP LOCKED)
-- We need to pass job_type as an array of text and cast it.
CREATE OR REPLACE FUNCTION claim_automation_jobs(
  p_job_types TEXT[],
  p_worker_id TEXT,
  p_lease_duration INTERVAL,
  p_limit INTEGER
) RETURNS SETOF automation_jobs AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM automation_jobs
    WHERE job_type::text = ANY(p_job_types)
      AND (
        status = 'pending' 
        OR (status = 'running' AND lease_expires_at < now())
      )
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE automation_jobs aj
  SET 
    status = 'running',
    locked_by = p_worker_id,
    started_at = COALESCE(aj.started_at, now()),
    heartbeat_at = now(),
    lease_expires_at = now() + p_lease_duration
  FROM claimed
  WHERE aj.id = claimed.id
  RETURNING aj.*;
END;
$$ LANGUAGE plpgsql;
