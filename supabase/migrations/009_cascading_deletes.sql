-- YouVo: Migration 009 - Account Deletion
-- Ensures user data is securely scrubbed when an account is deleted.

-- 1. Ensure user_feedback references auth.users with ON DELETE SET NULL or CASCADE.
-- We want to keep feedback for product improvements but anonymize it.
ALTER TABLE user_feedback 
  DROP CONSTRAINT IF EXISTS user_feedback_user_id_fkey,
  ADD CONSTRAINT user_feedback_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 2. Create RPC for secure account deletion
-- Must be security definer to bypass RLS and delete from auth.users
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
    v_user_id::text,
    null,
    null,
    'User self-initiated account deletion',
    'internal'
  );

  -- 2. Delete the user from auth.users. 
  -- Due to ON DELETE CASCADE on user_roles and ON DELETE SET NULL on user_feedback,
  -- this will automatically clean up related records.
  DELETE FROM auth.users WHERE id = v_user_id;
  
  RETURN true;
END;
$$;
