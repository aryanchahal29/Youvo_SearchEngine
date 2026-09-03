import type { AutomationJob, JobType } from '../supabase/types';
import { JobQueue } from './queue';
import { getAIRouter } from '../providers/router';
import { ProviderRateLimitError, AllProvidersUnavailableError } from '../providers/types';

export abstract class JobHandler {
  abstract jobTypes: JobType[];
  
  /**
   * Process a single job. Must be strictly idempotent.
   */
  abstract process(job: AutomationJob): Promise<Record<string, any> | void>;

  /**
   * Dispatches and processes all available jobs for this handler up to the limit.
   */
  async dispatch(workerId: string, limit: number = 5, leaseMinutes: number = 10): Promise<{ processed: number, errors: number }> {
    const jobs = await JobQueue.claim(this.jobTypes, workerId, leaseMinutes, limit);
    let processedCount = 0;
    let errorCount = 0;

    for (const job of jobs) {
      // Start heartbeat timer
      const heartbeatInterval = setInterval(() => {
        JobQueue.heartbeat(job.id, leaseMinutes).catch(console.error);
      }, (leaseMinutes * 60 * 1000) / 2); // Ping halfway through lease

      try {
        const result = await this.process(job);
        await JobQueue.complete(job.id, result || {});
        processedCount++;
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : 'Unknown job error';
        
        let isTransient = false;
        let cooldownMs: number | undefined;

        // Check if error is provider rate limit
        if (error instanceof ProviderRateLimitError || error instanceof AllProvidersUnavailableError) {
          isTransient = true;
          // Defer to the exact provider cooldown if available
          const registry = getAIRouter().getRegistryState();
          // Find the provider that was rate limited (if we can infer it, or just take max cooldown)
          const coolingProviders = registry.filter(p => p.health === 'rate_limited' && p.resetTime);
          if (coolingProviders.length > 0) {
            const maxReset = Math.max(...coolingProviders.map(p => new Date(p.resetTime!).getTime()));
            cooldownMs = Math.max(0, maxReset - Date.now());
          }
        } else if (msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
          isTransient = true;
        }

        console.error(`[JobHandler] Job ${job.id} failed:`, error);
        await JobQueue.fail(job, msg, isTransient, cooldownMs);
      } finally {
        clearInterval(heartbeatInterval);
      }
    }

    return { processed: processedCount, errors: errorCount };
  }
}
