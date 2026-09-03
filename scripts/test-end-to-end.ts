import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env.local') });

import { createAdminClient } from '../src/lib/supabase/server';
import { getAIRouter } from '../src/lib/providers/router';
import { hybridSearch } from '../src/lib/search/hybrid-search';
import { DiscoveryHandler } from '../src/lib/jobs/handlers/discovery';
import { VerificationDispatcherHandler } from '../src/lib/jobs/handlers/verification';
import { MaintenanceDispatcherHandler } from '../src/lib/jobs/handlers/maintenance';

const supabase = createAdminClient();

async function runEndToEnd() {
  console.log('--- Cleaning DB for "tool for vibe coding" ---');
  await supabase.from('search_cache').delete().eq('normalized_query', 'tool for vibe coding');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('tools').delete().gt('created_at', yesterday);
  await supabase.from('automation_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const router = getAIRouter();
  router.forceProviderStatus('gemini:proj-proj-1', 'invalid_request');
  router.forceProviderStatus('gemini:proj-proj-2', 'invalid_request');
  router.forceProviderStatus('gemini:proj-proj-3', 'invalid_request');
  router.forceProviderStatus('groq:default-1', 'healthy');

  console.log('\n--- Step 1: First Run (Cache Cleared) ---');
  const result1 = await hybridSearch({
    raw_query: 'Tool for vibe coding',
    corrected_query: 'tool for vibe coding',
    intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
    constraints: {},
    category: null,
  });

  console.log(`Source: ${result1.source}`);
  console.log(`Is Discovering: ${result1.is_discovering}`);
  console.log(`Candidates returned: ${result1.candidates.length}`);
  console.log(`Job ID: ${result1.discovery_job_id}`);

  if (result1.discovery_job_id) {
    console.log('\n--- Step 1.5: Waiting 130s for Groq TPM Rate Limit and Cooldown to Reset ---');
    await new Promise(r => setTimeout(r, 130000));
    // Also reset router's rate limit memory manually
    router.forceProviderStatus('groq:default-1', 'healthy');

    console.log('\n--- Step 2: Processing Background Jobs ---');
    const discHandler = new DiscoveryHandler();
    await discHandler.dispatch('test-worker-disc', 5, 5);
    
    const verHandler = new VerificationDispatcherHandler();
    await verHandler.dispatch('test-worker-ver', 5, 5);

    const mainHandler = new MaintenanceDispatcherHandler();
    await mainHandler.dispatch('test-worker-main', 5, 5);
    console.log('Finished background jobs.');
  }

  console.log('\n--- Step 3: Second Run (Cache Hit) ---');
  const result2 = await hybridSearch({
    raw_query: 'Tool for vibe coding',
    corrected_query: 'tool for vibe coding',
    intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
    constraints: {},
    category: null,
  });

  console.log(`Source: ${result2.source}`);
  console.log(`Is Discovering: ${result2.is_discovering}`);
  console.log(`Candidates returned: ${result2.candidates.length}`);
  console.log(`Cache State: ${result2.cache_state}`);
  
  if (result2.tools.length > 0) {
    console.log(`\nTool Persisted: ${result2.tools[0].name} (${result2.tools[0].url})`);
  } else {
    console.log('\nNo tools were recommended or persisted.');
  }
}

runEndToEnd().catch(console.error);
