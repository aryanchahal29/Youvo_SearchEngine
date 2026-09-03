'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

export async function retryJob(jobId: string, reason: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  // 1. Fetch job
  const { data: job } = await supabase.from('automation_jobs').select('*').eq('id', jobId).single();
  if (!job) throw new Error('Job not found');

  // 2. Set to pending
  await supabase.from('automation_jobs').update({
    status: 'pending',
    retry_count: 0,
    scheduled_at: new Date().toISOString()
  }).eq('id', jobId);

  // 3. Log Audit Event
  await supabase.from('admin_audit_logs').insert({
    admin_id: user.id,
    action: 'RETRY_JOB',
    target_type: 'automation_jobs',
    target_id: jobId,
    old_value: { status: job.status },
    new_value: { status: 'pending' },
    reason: reason
  });

  revalidatePath('/admin/jobs');
}
