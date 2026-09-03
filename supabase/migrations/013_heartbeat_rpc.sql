-- Add heartbeat RPC to use DB clock securely
CREATE OR REPLACE FUNCTION heartbeat_automation_job(
  p_job_id UUID,
  p_lease_duration INTERVAL
) RETURNS void AS $$
BEGIN
  UPDATE automation_jobs
  SET 
    heartbeat_at = now(),
    lease_expires_at = now() + p_lease_duration
  WHERE id = p_job_id AND status = 'running';
END;
$$ LANGUAGE plpgsql;
