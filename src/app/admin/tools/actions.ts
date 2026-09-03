'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function enqueueToolJob(toolId: string, jobType: string, reason: string) {
  const supabase = createAdminClient();

  // Create the job
  const { error: jobErr } = await supabase.from('automation_jobs').insert({
    job_type: jobType,
    payload: { tool_id: toolId },
    priority: 5,
    status: 'pending',
  });

  if (jobErr) {
    console.error(`Failed to enqueue ${jobType} job for tool ${toolId}:`, jobErr);
    throw new Error('Failed to enqueue job');
  }

  // Record manual action in audit log
  const { error: auditErr } = await supabase.from('admin_audit_logs').insert({
    admin_id: '00000000-0000-0000-0000-000000000000', // System/Dev Admin
    action: `manual_enqueue_${jobType}`,
    entity: 'automation_jobs',
    entity_id: toolId,
    new_value: { reason },
  });

  if (auditErr) {
    console.error('Failed to write audit log:', auditErr);
  }

  revalidatePath('/admin/tools');
  revalidatePath('/admin/jobs');
}
