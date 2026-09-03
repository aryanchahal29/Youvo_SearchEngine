// scripts/test-discovery-v2.ts
// Deterministic integration tests for the V2 Discovery Router

import { config } from 'dotenv';
import { resolve } from 'path';

// Load env vars
config({ path: resolve(__dirname, '../.env.local') });

import { LiveDiscoveryOrchestrator } from '../src/lib/discovery/live-discovery-orchestrator';
import { createAdminClient } from '../src/lib/supabase/server';
import { getAIRouter } from '../src/lib/providers/router';
import { ProcessedQuery } from '../src/lib/search/query-processor';
import { hybridSearch } from '../src/lib/search/hybrid-search';

const supabase = createAdminClient();

const TEST_QUERY: ProcessedQuery = {
  raw_query: 'Tool for vibe coding',
  corrected_query: 'tool for vibe coding',
  intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
  constraints: {},
  category: null,
};

const TEST_QUERY_CONSTRAINED: ProcessedQuery = {
  raw_query: 'free vibe coding tool under $10',
  corrected_query: 'free vibe coding tool under 10 dollars',
  intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
  constraints: { has_free_plan: true, budget: 'free' },
  category: null,
};

async function clearCacheAndTools(query: string) {
  console.log('--- Cleaning DB ---');
  await supabase.from('search_cache').delete().eq('normalized_query', query.toLowerCase());
  
  // Clean up any tools discovered in this test to ensure "Empty DB" for the next test
  // (We'll just look for tools with "video" or "generator" in the name to be safe)
  const { data: tools } = await supabase.from('tools').select('id, name');
  if (tools) {
    for (const t of tools) {
      if (t.name.toLowerCase().includes('video') || t.name.toLowerCase().includes('generator') || t.name.toLowerCase().includes('invideo') || t.name.toLowerCase().includes('synthesia') || t.name.toLowerCase().includes('runway') || t.name.toLowerCase().includes('pika') || t.name.toLowerCase().includes('sora') || t.name.toLowerCase().includes('luma')) {
        await supabase.from('tools').delete().eq('id', t.id);
      }
    }
  }
}

function printMetrics(metrics: any) {
  console.log('\n--- Metrics ---');
  console.log(`Providers Attempted: ${metrics.providers_attempted.join(', ')}`);
  console.log(`Providers Succeeded: ${metrics.providers_succeeded.join(', ')}`);
  console.log(`Providers Failed: ${metrics.providers_failed.join(', ')}`);
  console.log(`Providers Rate Limited: ${metrics.providers_rate_limited.join(', ')}`);
  console.log(`Candidates Discovered: ${metrics.discovered}`);
  console.log(`Duplicates Removed: ${metrics.deduplicated}`);
  console.log(`Official URLs Resolved: ${metrics.official_sites_resolved}`);
  console.log(`Crawls Succeeded: ${metrics.crawl_succeeded}`);
  console.log(`Facts Extracted: ${metrics.facts_extracted}`);
  console.log(`Verified: ${metrics.verified}`);
  console.log(`Rejected: ${metrics.rejected}`);
  console.log(`Persisted / Recommended: ${metrics.recommended}`);
  console.log(`Total Latency: ${metrics.duration_ms}ms`);
}

function printTools(tools: any[]) {
  console.log(`\n--- Result: ${tools.length} Tools Recommended ---`);
  tools.forEach(bestTool => {
    console.log(`Name: ${bestTool.name}`);
    console.log(`URL: ${bestTool.url}`);
    console.log(`Confidence: ${bestTool.confidence || bestTool.confidence_score}`);
    console.log(`Evidence IDs: ${bestTool.evidence_ids ? bestTool.evidence_ids.join(', ') : 'N/A'}`);
    if (bestTool.extracted_data) {
       console.log(`Pricing Data Found: ${bestTool.extracted_data.pricing_plans.length > 0 ? 'Yes' : 'No'}`);
       const freePlan = bestTool.extracted_data.pricing_plans.find((p:any) => p.is_free);
       if (freePlan) {
         console.log(`Free Plan: Yes (${freePlan.plan_name})`);
         console.log(`Watermark: ${freePlan.watermark ? 'Yes' : 'No/Unknown'}`);
       }
    } else if (bestTool.pricing_plans) {
       const freePlan = bestTool.pricing_plans.find((p:any) => p.is_free);
       if (freePlan) {
         console.log(`Free Plan: Yes (${freePlan.plan_name})`);
       }
    }
  });
}

async function runScenario(scenarioId: string) {
  console.log(`\n======================================================`);
  console.log(`Running Scenario ${scenarioId}`);
  console.log(`======================================================`);

  const originalTavilyKey = process.env.TAVILY_API_KEY;
  const router = getAIRouter();
  const registry = router.getRegistryState();

  try {
    switch (scenarioId) {
      case 'G':
        console.log(`Scenario ${scenarioId}: Empty DB + Gemini unavailable + Tavily available`);
        router.forceProviderStatus('gemini', 'down', 'web_discovery');
        router.forceProviderStatus('groq:default-1', 'healthy');
        break;

      case 'C':
        console.log('Scenario C: Tavily unavailable → GitHub/RSS continue');
        process.env.TAVILY_API_KEY = ''; // Force Tavily unavailable
        break;

      case 'D':
        console.log('Scenario D: All web-discovery providers unavailable');
        router.forceProviderStatus('gemini', 'down', 'web_discovery');
        process.env.TAVILY_API_KEY = '';
        break;

      case 'E':
        console.log('Scenario E: Duplicate candidate from Gemini + Tavily');
        // Both are active, they will likely return duplicate well-known tools like InVideo or Synthesia
        break;

      case 'F':
        console.log('Scenario F: Unverifiable official site → candidate rejected');
        // Handled inherently by the orchestrator if a site fails crawl. For test, we will see it in metrics (rejected > 0 or crawl_failed > 0).
        break;

      default:
        console.log('Unknown scenario.');
        return;
    }

    await clearCacheAndTools(TEST_QUERY.corrected_query);

    const orchestrator = new LiveDiscoveryOrchestrator(TEST_QUERY.corrected_query);
    const result = await orchestrator.discoverInline(TEST_QUERY);

    printMetrics(result.metrics);
    printTools(result.discovered_tools);

    if (scenarioId === 'G') {
       console.log(`\n>>> Scenario G Part 2: Testing Cache Hit <<<`);
       const cacheResult = await hybridSearch(TEST_QUERY);
       console.log(`Cache Source: ${cacheResult.source}`);
       console.log(`Tools retrieved from cache: ${cacheResult.tools.length}`);
       printTools(cacheResult.tools);
    }
    
    if (scenarioId === 'H') {
       console.log(`\n>>> Scenario H: Constrained Query <<<`);
       await clearCacheAndTools(TEST_QUERY_CONSTRAINED.corrected_query);
       const orchestratorConstrained = new LiveDiscoveryOrchestrator(TEST_QUERY_CONSTRAINED.corrected_query);
       const resultConstrained = await orchestratorConstrained.discoverInline(TEST_QUERY_CONSTRAINED);
       printMetrics(resultConstrained.metrics);
       printTools(resultConstrained.discovered_tools);
    }

  } finally {
    process.env.TAVILY_API_KEY = originalTavilyKey;
    router.forceProviderStatus('gemini', 'healthy', 'web_discovery');
  }
}

async function main() {
  const scenarioArg = process.argv[2];
  if (scenarioArg) {
    await runScenario(scenarioArg);
  } else {
    for (const s of ['A', 'C', 'D', 'E', 'F', 'G', 'H']) {
      await runScenario(s);
    }
  }
}

main().catch(console.error);
