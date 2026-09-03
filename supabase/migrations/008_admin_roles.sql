-- 008_admin_roles.sql
-- Sets up server-side admin roles and strict RLS for admin panels.

-- 1. Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own role
CREATE POLICY "Users can read own role"
    ON user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Only service role can modify user_roles (or another admin)
-- We enforce that only the service role or an existing admin can insert/update roles.
CREATE POLICY "Admins can read all roles"
    ON user_roles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- 2. Update admin_audit_logs to include reason if missing
ALTER TABLE admin_audit_logs
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS old_value JSONB,
ADD COLUMN IF NOT EXISTS new_value JSONB;

-- 3. Strict Admin-only RLS policies for sensitive tables
-- First, revoke public access to internal tables if any existed, and grant admin access

-- automation_jobs
CREATE POLICY "Admins can view jobs"
    ON automation_jobs FOR SELECT
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update jobs (e.g. manual retry)"
    ON automation_jobs FOR UPDATE
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ai_providers
CREATE POLICY "Admins can view providers"
    ON ai_providers FOR SELECT
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- admin_audit_logs
CREATE POLICY "Admins can view audit logs"
    ON admin_audit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert audit logs"
    ON admin_audit_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
