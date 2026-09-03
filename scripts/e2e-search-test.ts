import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/server';
import { processQuery } from '../src/lib/search/query-processor';
import { hybridSearch } from '../src/lib/search/hybrid-search';
import { rankTools } from '../src/lib/ranking/ranking-engine';
import { getAIRouter } from '../src/lib/providers/router';

async function cleanupDatabase() {
  const supabase = createAdminClient();
  console.log('Cleaning up database (removing AI video generator tools and query cache)...');
  
  // 1. Delete search_cache
  const { error: err1 } = await supabase
    .from('search_cache')
    .delete()
    .ilike('normalized_query', '%video%');
  if (err1) console.error('Error clearing search cache:', err1);

  // 2. Find and delete video tools
  const { data: tools } = await supabase
    .from('tools')
    .select('id, name');
    
  if (tools && tools.length > 0) {
    const ids = tools.map(t => t.id);
    await supabase.from('tools').delete().in('id', ids);
    console.log(`Deleted ${tools.length} old tools:`, tools.map(t => t.name).join(', '));
  } else {
    console.log('No existing tools found in DB.');
  }
}

async function runTest() {
  console.log('\n======================================================');
  console.log('E2E TEST 1: LIVE DISCOVERY WITH ONE RATE-LIMITED PROVIDER');
  console.log('======================================================\n');
  
  // Dump router state before starting
  const router = getAIRouter();
  console.log('Provider Registry State before run:');
  console.log(JSON.stringify(router.getRegistryState(), null, 2));

  const queryStr = 'Best free AI video generator';
  
  const start1 = Date.now();
  console.log(`\nExecuting Search for query: "${queryStr}"...`);
  const processedQuery = await processQuery(queryStr);
  const searchResults1 = await hybridSearch(processedQuery, 20);
  const rankedResults1 = await rankTools(searchResults1.tools, processedQuery);
  const latency1 = Date.now() - start1;

  console.log('\n--- SEQUENCE & METRICS (TEST 1) ---');
  console.log(`Total Latency: ${latency1}ms`);
  console.log('Discovery Triggered:', searchResults1.source === 'live_discovery');
  
  if (searchResults1.discovery_metrics) {
    const m = searchResults1.discovery_metrics;
    console.log(`Providers Attempted: ${m.sources_attempted.join(', ')}`);
    console.log(`Providers Succeeded: ${m.sources_succeeded.join(', ')}`);
    console.log(`Providers Failed: ${m.sources_failed.join(', ')}`);
    console.log(`Candidates Discovered: ${m.discovered}`);
    console.log(`Deduplicated (skipped): ${m.deduplicated}`);
    console.log(`Official URLs Resolved: ${m.official_sites_resolved}`);
    console.log(`Crawled Successfully: ${m.crawl_succeeded}`);
    console.log(`Facts Extracted: ${m.facts_extracted}`);
    console.log(`Evidence Verified: ${m.verified}`);
    console.log(`Rejected (low quality/constraints): ${m.rejected}`);
    console.log(`Final Recommendations (Persisted): ${m.recommended}`);
    if (m.errors.length > 0) {
      console.log(`Errors encountered:\n  - ${m.errors.join('\n  - ')}`);
    }
  }

  console.log('\n--- 3 REAL RETURNED RECOMMENDATIONS ---');
  const top3 = rankedResults1.alternatives.slice(0, 3);
  if (rankedResults1.best_match && !top3.find(t => t.id === rankedResults1.best_match!.id)) {
    top3.unshift(rankedResults1.best_match);
  }
  
  top3.slice(0, 3).forEach((t, i) => {
    console.log(`\nRecommendation ${i + 1}: ${t.name}`);
    console.log(`  URL: ${t.official_url}`);
    console.log(`  Description: ${t.description.substring(0, 80)}...`);
    console.log(`  Score: ${t.relevance_score?.toFixed(2) || 0} / Confidence: ${t.confidence_score}`);
    console.log(`  Free Plan: ${t.pricing_plans?.some((p: any) => p.is_free) ? 'Yes' : 'No'}`);
    console.log(`  Watermark: ${t.pricing_plans?.some((p: any) => p.is_free && p.watermark) ? 'Yes' : 'No/Unknown'}`);
    if (t.evidence && t.evidence.length > 0) {
      console.log(`  Evidence claims: ${t.evidence.map((e: any) => e.claim).slice(0, 2).join(' | ')}`);
    }
  });

  console.log('\nProvider Registry State after Test 1:');
  console.log(JSON.stringify(router.getRegistryState(), null, 2));

  console.log('\n======================================================');
  console.log('E2E TEST 2: CACHE INVALIDATION ON PROVIDER RECOVERY');
  console.log('======================================================\n');
  
  // Artificially recover the provider health
  console.log('Restoring provider health to test cache invalidation...');
  router.forceResetAll();
  console.log(JSON.stringify(router.getRegistryState(), null, 2));

  const start2 = Date.now();
  const searchResults2 = await hybridSearch(processedQuery, 20);
  const latency2 = Date.now() - start2;

  console.log(`\nTotal Latency: ${latency2}ms`);
  console.log(`Total Results Returned: ${searchResults2.candidates.length}`);
  console.log(`Discovery Triggered: ${searchResults2.source === 'live_discovery'}`);
  
  if (searchResults2.source === 'live_discovery') {
    console.log('✅ PASS: Negative result cache was successfully bypassed/invalidated because provider recovered.');
  } else {
    console.log('❌ FAIL: Live discovery was NOT triggered again. Cache invalidation failed.');
  }

  process.exit(0);
}

async function run() {
  await cleanupDatabase();
  await runTest();
}

run().catch(console.error);
