'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { headers } from 'next/headers';

export async function updateRankingConfig(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') || '127.0.0.1';
  if (!(await checkRateLimit(ip, 5, 60000))) {
    throw new Error('Rate limit exceeded for ranking config changes.');
  }

  const user = await requireAdmin();
  const supabase = await createClient();

  const relevanceWeight = parseFloat(formData.get('relevance_weight') as string);
  const valueWeight = parseFloat(formData.get('value_weight') as string);
  const easeWeight = parseFloat(formData.get('ease_weight') as string);
  const reputationWeight = parseFloat(formData.get('reputation_weight') as string);
  const reason = formData.get('reason') as string;

  if (!reason || reason.trim().length < 10) {
    throw new Error('A detailed reason is required for ranking changes.');
  }

  // 1. Fetch old config
  const { data: oldConfig } = await supabase.from('ranking_config').select('*').single();

  // 2. Update config
  const newConfig = {
    relevance_weight: relevanceWeight,
    value_weight: valueWeight,
    ease_weight: easeWeight,
    reputation_weight: reputationWeight,
    updated_at: new Date().toISOString()
  };

  await supabase.from('ranking_config').update(newConfig).eq('id', oldConfig.id);

  // 3. Log Audit Event
  await supabase.from('admin_audit_logs').insert({
    admin_id: user.id,
    action: 'UPDATE_RANKING_CONFIG',
    entity: 'ranking_config',
    entity_id: oldConfig?.id,
    old_value: oldConfig || {},
    new_value: newConfig,
    reason: reason
  });

  revalidatePath('/admin/rankings');
}
