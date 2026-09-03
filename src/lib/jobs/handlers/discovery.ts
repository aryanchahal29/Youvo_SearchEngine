import { JobHandler } from '../handler';
import { LiveDiscoveryOrchestrator } from '../../discovery/live-discovery-orchestrator';
import { createAdminClient } from '../../supabase/server';
import type { AutomationJob, JobType } from '../../supabase/types';

export class DiscoveryHandler extends JobHandler {
  jobTypes: JobType[] = ['discover', 'fetch'];

  async process(job: AutomationJob): Promise<Record<string, any>> {
    const supabase = createAdminClient();

    if (job.job_type === 'discover') {
      const payload = job.payload as any;
      if (!payload || !payload.query) {
        throw new Error('Invalid payload for discover job: missing query');
      }

      const query = {
        corrected_query: payload.query,
        raw_query: payload.raw_query,
        intent: { type: payload.intent, confidence: 1, requires_live_discovery: true, specific_requirements: [] },
        category: payload.category,
        constraints: payload.constraints,
      };

      const orchestrator = new LiveDiscoveryOrchestrator(payload.query);

      // Create an abort controller with a strict timeout of 8 minutes (leaving 2 minutes for cleanup out of 10m lease)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000);

      try {
        // Run full discovery with extended timeout and candidate limits
        const result = await orchestrator.discoverInline(
          query as any, 
          controller.signal, 
          { timeout_ms: 8 * 60 * 1000, max_candidates: 10 }
        );

        // Update search_cache
        const discoveredCount = result.discovered_tools.length;
        if (discoveredCount > 0 || result.status !== 'DISCOVERY_FAILED') {
          const cacheState = discoveredCount > 0 ? 'SUCCESS_RESULT' : 'DISCOVERY_COMPLETED_NO_MATCH';
          // Set appropriate TTL: SUCCESS = 7 days, NO_MATCH = 2 hours
          const ttlSeconds = discoveredCount > 0 ? 60 * 60 * 24 * 7 : 60 * 60 * 2;
          console.log(`[DiscoveryHandler] Updating cache for "${payload.query.toLowerCase().trim()}" to ${cacheState}`);
          const { error: cacheUpdateError } = await supabase.from('search_cache')
            .update({ 
               cache_state: cacheState, 
               result_tool_ids: result.discovered_tools.map(t => t.tool_id),
               expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
            })
            .eq('normalized_query', payload.query.toLowerCase().trim());
          if (cacheUpdateError) console.error('[DiscoveryHandler] Cache update error:', cacheUpdateError);
        }

        if (result.status === 'DISCOVERY_FAILED') {
            throw new Error(`Discovery failed: ${JSON.stringify(result.metrics.errors)}`);
        }

        return {
          discovered: result.metrics.discovered,
          new_unique: result.metrics.discovered - result.metrics.deduplicated,
          persisted: result.discovered_tools.length,
          metrics: result.metrics
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new Error(`Job type ${job.job_type} is not yet fully implemented in DiscoveryHandler`);
  }
}
