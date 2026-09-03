import { config } from 'dotenv';
config({ path: '.env.local' });

import { hybridSearch } from '../src/lib/search/hybrid-search';
import { DiscoveryHandler } from '../src/lib/jobs/handlers/discovery';
import { VerificationDispatcherHandler } from '../src/lib/jobs/handlers/verification';
import { MaintenanceDispatcherHandler } from '../src/lib/jobs/handlers/maintenance';
import { getAIRouter } from '../src/lib/providers/router';
import { createAdminClient } from '../src/lib/supabase/server';

async function runTest1() {
  console.log('\n========================================');
  console.log('TEST 1: "Tool for vibe coding" (no constraints)');
  console.log('========================================\n');

  const result1 = await hybridSearch({
    raw_query: 'Tool for vibe coding',
    corrected_query: 'tool for vibe coding',
    intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
    constraints: {
      budget: null,
      has_free_plan: null,
      watermark: null,
      commercial_use: null,
      no_code: null,
      api_access: null,
      open_source: null,
      skill_level: null,
      has_free_trial: null,
    },
    category: null,
  });

  console.log(`\nStep 1 Result:`);
  console.log(`  Source: ${result1.source}`);
  console.log(`  Is Discovering: ${result1.is_discovering}`);
  console.log(`  Candidates: ${result1.candidates.length}`);
  console.log(`  Cache State: ${result1.cache_state}`);
  console.log(`  Job ID: ${result1.discovery_job_id}`);

  if (result1.discovery_job_id) {
    console.log('\n--- Waiting 140s for Groq TPM Rate Limit and Cooldown to Reset ---');
    await new Promise(r => setTimeout(r, 140000));
    
    const router = getAIRouter();
    router.forceProviderStatus('groq:default-1', 'healthy');

    console.log('\n--- Processing Background Jobs ---');
    const discHandler = new DiscoveryHandler();
    await discHandler.dispatch('test-worker-disc', 5, 5);
    
    const verHandler = new VerificationDispatcherHandler();
    await verHandler.dispatch('test-worker-ver', 5, 5);

    const mainHandler = new MaintenanceDispatcherHandler();
    await mainHandler.dispatch('test-worker-main', 5, 5);
    console.log('Finished background jobs.');
  }

  // Check what's in the DB now
  const supabase = createAdminClient();
  const { data: tools } = await supabase.from('tools').select('name, status, confidence_score, official_url');
  console.log(`\nTools in DB after background jobs: ${tools?.length || 0}`);
  for (const t of (tools || [])) {
    console.log(`  - ${t.name} | status=${t.status} | confidence=${t.confidence_score} | url=${t.official_url}`);
  }

  // Second run — should be cache hit
  console.log('\n--- Second Run (Cache Hit Expected) ---');
  const result2 = await hybridSearch({
    raw_query: 'Tool for vibe coding',
    corrected_query: 'tool for vibe coding',
    intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
    constraints: {
      budget: null,
      has_free_plan: null,
      watermark: null,
      commercial_use: null,
      no_code: null,
      api_access: null,
      open_source: null,
      skill_level: null,
      has_free_trial: null,
    },
    category: null,
  });

  console.log(`\nStep 2 Result:`);
  console.log(`  Source: ${result2.source}`);
  console.log(`  Is Discovering: ${result2.is_discovering}`);
  console.log(`  Candidates: ${result2.candidates.length}`);
  console.log(`  Tools: ${result2.tools.length}`);
  console.log(`  Cache State: ${result2.cache_state}`);

  if (result2.tools.length > 0) {
    console.log(`  Best Match: ${result2.tools[0].name} (${result2.tools[0].official_url})`);
  }

  console.log('\n========================================');
  console.log('\n========================================');
  console.log('TEST 2: "Free vibe coding tool" (explicit free constraint)');
  console.log('========================================\n');

  const result3 = await hybridSearch({
    raw_query: 'Free vibe coding tool',
    corrected_query: 'free vibe coding tool',
    intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
    constraints: {
      budget: 'free',
      has_free_plan: true,
      watermark: null,
      commercial_use: null,
      no_code: null,
      api_access: null,
      open_source: null,
      skill_level: null,
      has_free_trial: null,
    },
    category: null,
  });

  console.log(`\nStep 3 Result:`);
  console.log(`  Tools: ${result3.tools.length}`);
  if (result3.tools.length > 0) {
    console.log(`  Best Match: ${result3.tools[0].name} (${result3.tools[0].official_url})`);
  }

  console.log('\n========================================');
  console.log('TEST 2 VERDICT:');
  console.log(`  Eligible free tools remain: ${result3.tools.length > 0 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('========================================');
}

runTest1().catch(console.error);
