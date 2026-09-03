import { createAdminClient } from '../supabase/server';
import type { AutomationJob, JobType, JobStatus } from '../supabase/types';

export class JobQueue {
  /**
   * Enqueues a new job with an idempotency key.
   * If a job with the same idempotency key is already pending/running, it silently returns the existing job.
   */
  static async enqueue(
    jobType: JobType,
    payload: Record<string, any>,
    idempotencyKey: string,
    priority: number = 5,
    maxAttempts: number = 5
  ): Promise<AutomationJob> {
    const supabase = createAdminClient();

    // The database has a unique index on idempotency_key for active jobs.
    // We try to insert, and if there's a conflict, we just select the existing one.
    const { data: inserted, error: insertError } = await supabase
      .from('automation_jobs')
      .insert({
        job_type: jobType,
        payload,
        priority,
        max_attempts: maxAttempts,
        idempotency_key: idempotencyKey,
        status: 'pending' as JobStatus,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      if (insertError.code === '23505') { // unique violation
        // Fetch the existing active job
        const { data: existing, error: selectError } = await supabase
          .from('automation_jobs')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .in('status', ['pending', 'running'])
          .single();
        
        if (selectError || !existing) {
          throw new Error(`Failed to enqueue job and failed to fetch existing job: ${selectError?.message}`);
        }
        return existing as AutomationJob;
      }
      throw new Error(`Failed to enqueue job: ${insertError.message}`);
    }

    if (!inserted) {
        throw new Error('Failed to enqueue job: No data returned');
    }

    return inserted as AutomationJob;
  }

  /**
   * Atomically claims up to `limit` jobs for the given job types.
   */
  static async claim(
    jobTypes: JobType[],
    workerId: string,
    leaseDurationMinutes: number = 10,
    limit: number = 1
  ): Promise<AutomationJob[]> {
    const supabase = createAdminClient();

    // Call the RPC we created in the migration
    const { data, error } = await supabase.rpc('claim_automation_jobs', {
      p_job_types: jobTypes,
      p_worker_id: workerId,
      p_lease_duration: `${leaseDurationMinutes} minutes`,
      p_limit: limit
    });

    if (error) {
      console.error(`[JobQueue] Claim error:`, error);
      throw new Error(`Failed to claim jobs: ${error.message}`);
    }

    return (data || []) as AutomationJob[];
  }

  /**
   * Heartbeats a running job to extend its lease using the secure DB clock.
   */
  static async heartbeat(jobId: string, leaseDurationMinutes: number = 10): Promise<void> {
    const supabase = createAdminClient();
    
    const { error } = await supabase.rpc('heartbeat_automation_job', {
      p_job_id: jobId,
      p_lease_duration: `${leaseDurationMinutes} minutes`
    });

    if (error) {
      console.error(`[JobQueue] Heartbeat failed for ${jobId}:`, error);
    }
  }

  /**
   * Marks a job as successfully completed.
   */
  static async complete(jobId: string, result?: Record<string, any>): Promise<void> {
    const supabase = createAdminClient();
    await supabase
      .from('automation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: result || {}
      })
      .eq('id', jobId);
  }

  /**
   * Marks a job as failed, either permanently or transiently.
   */
  static async fail(
    job: AutomationJob,
    errorMsg: string,
    isTransient: boolean = false,
    providerCooldownMs?: number
  ): Promise<void> {
    const supabase = createAdminClient();
    const newAttemptCount = job.attempt_count + 1;
    
    if (!isTransient || newAttemptCount >= job.max_attempts) {
      // Permanent failure
      await supabase
        .from('automation_jobs')
        .update({
          status: 'failed',
          error: errorMsg,
          attempt_count: newAttemptCount
        })
        .eq('id', job.id);
    } else {
      // Transient failure -> Exponential backoff
      // 1min, 2min, 4min, 8min... or Provider Cooldown
      let delayMs = Math.pow(2, job.attempt_count) * 60 * 1000;
      if (providerCooldownMs && providerCooldownMs > delayMs) {
        delayMs = providerCooldownMs;
      }

      const nextRetry = new Date(Date.now() + delayMs);

      await supabase
        .from('automation_jobs')
        .update({
          status: 'pending',
          error: errorMsg,
          attempt_count: newAttemptCount,
          next_retry_at: nextRetry.toISOString(),
          locked_by: null,
          lease_expires_at: null,
          heartbeat_at: null
        })
        .eq('id', job.id);
    }
  }
}
