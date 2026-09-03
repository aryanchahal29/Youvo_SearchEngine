import { JobHandler } from '../handler';
import { JobQueue } from '../queue';
import { createAdminClient } from '../../supabase/server';
import type { AutomationJob, JobType } from '../../supabase/types';

export class DeadLinkCheckHandler extends JobHandler {
  jobTypes: JobType[] = ['dead_link_check'];

  async process(job: AutomationJob): Promise<Record<string, any>> {
    const payload = job.payload as any;
    if (!payload.tool_id) throw new Error('Missing tool_id');

    const supabase = createAdminClient();

    // 1. Fetch official URL
    const { data: tool } = await supabase.from('tools').select('id, official_url, status').eq('id', payload.tool_id).single();
    if (!tool || !tool.official_url) return { skipped: true, reason: 'no_official_url' };

    // 2. Perform real URL check
    let isDead = false;
    let statusCode = 0;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(tool.official_url, { 
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'YouVoBot/1.0 (+https://youvo.com/bot)'
        }
      });
      clearTimeout(timeout);
      statusCode = res.status;
      if (res.status >= 400 && res.status !== 401 && res.status !== 403) {
        // Some sites block HEAD/Bots with 401/403, we only count 404, 5xx as potentially dead
        isDead = true;
      }
    } catch (e) {
      isDead = true;
      statusCode = -1;
    }

    // 3. Update health state (distinguish temp from perm in real app via history, here we simulate)
    if (isDead) {
      // Don't mark completely dead on first try, mark high_risk or trigger manual review
      if (tool.status !== 'dead') {
        await supabase.from('tools').update({ status: 'needs_review' }).eq('id', tool.id);
      }
      return { is_dead: true, status_code: statusCode, updated_status: 'needs_review' };
    } else {
      // 4. Trigger re-verification if it recovered
      if (tool.status === 'dead' || tool.status === 'needs_review') {
        await supabase.from('tools').update({ status: 'processing' }).eq('id', tool.id);
        await JobQueue.enqueue('verify', { tool_id: tool.id }, `verify:${tool.id}`);
      }
      return { is_dead: false, status_code: statusCode };
    }
  }
}

export class HealthDispatcherHandler extends JobHandler {
  jobTypes: JobType[] = ['dead_link_check'];

  async process(job: AutomationJob): Promise<Record<string, any> | void> {
    return new DeadLinkCheckHandler().process(job);
  }
}
