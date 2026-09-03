import { LiveDiscoveryOrchestrator } from '../lib/discovery/live-discovery-orchestrator';
import { getAIRouter } from '../lib/providers/router';
import { processQuery } from '../lib/search/query-processor';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T, latency: number }> {
  const start = Date.now();
  const result = await fn();
  const latency = Date.now() - start;
  return { result, latency };
}

async function prepareQuery(text: string) {
  return processQuery(text);
}

async function runPerfTests() {
  console.log('=== Real-Provider Performance Validation ===\n');
  const results: any[] = [];

  // 1. Uncached Discovery Only (Stop before verification)
  console.log('1. Testing Uncached Discovery Only...');
  const q1 = await prepareQuery('Best AI video generators for marketing');
  const orchestrator1 = new LiveDiscoveryOrchestrator(q1.corrected_query);
  // Passing dummy abort controller as second arg, and config as third arg
  const { latency: lat1 } = await measure('Uncached Discovery', () => orchestrator1.discoverInline(q1, undefined, { max_candidates: 3 }));
  results.push({ test: 'Uncached Discovery', latency: lat1 });
  console.log(`Latency: ${lat1}ms\n`);

  // 2. Uncached Discovery + Verification
  console.log('2. Testing Uncached Discovery + Verification...');
  const q2 = await prepareQuery('Best AI video generators for marketing with a free plan');
  const orchestrator2 = new LiveDiscoveryOrchestrator(q2.corrected_query);
  const { latency: lat2 } = await measure('Discovery + Verification', () => orchestrator2.discoverInline(q2));
  results.push({ test: 'Discovery + Verification', latency: lat2 });
  console.log(`Latency: ${lat2}ms\n`);

  // 3. Tavily Fallback
  console.log('3. Testing Tavily Fallback (Niche Query)...');
  const q3 = await prepareQuery('Does Pictory AI support 4k export on the free plan?');
  const orchestrator3 = new LiveDiscoveryOrchestrator(q3.corrected_query);
  const { latency: lat3 } = await measure('Tavily Fallback', () => orchestrator3.discoverInline(q3));
  results.push({ test: 'Tavily Fallback', latency: lat3 });
  console.log(`Latency: ${lat3}ms\n`);

  // 4. Degraded Provider Scenario
  console.log('4. Testing Degraded Provider Scenario (Forced 429)...');
  const router = getAIRouter();
  const registry = (router as any).registry as Map<string, any>;
  // Force the primary Gemini provider into cooldown to trigger fallback
  for (const [id, state] of registry.entries()) {
    if (id.includes('gemini') && !id.includes('flash')) {
      state.health = 'rate_limited';
      state.circuitBreakerOpen = true;
      state.resetTime = new Date(Date.now() + 60000);
      console.log(`Forced provider ${id} into rate_limited state.`);
    }
  }
  
  const q4 = await prepareQuery('AI voice generators');
  const orchestrator4 = new LiveDiscoveryOrchestrator(q4.corrected_query);
  const { latency: lat4 } = await measure('Degraded Provider', () => orchestrator4.discoverInline(q4));
  results.push({ test: 'Degraded Provider', latency: lat4 });
  console.log(`Latency: ${lat4}ms\n`);

  // Reset providers
  for (const state of registry.values()) {
    state.health = 'healthy';
    state.circuitBreakerOpen = false;
  }

  // 5. Cached Request
  console.log('5. Testing Cached Request...');
  const text5 = 'Best open source LLM';
  const q5 = await prepareQuery(text5);
  const orchestrator5a = new LiveDiscoveryOrchestrator(q5.corrected_query);
  await orchestrator5a.discoverInline(q5); // seed cache
  const orchestrator5b = new LiveDiscoveryOrchestrator(q5.corrected_query);
  const { latency: lat5 } = await measure('Cached Request', () => orchestrator5b.discoverInline(q5));
  results.push({ test: 'Cached Request', latency: lat5 });
  console.log(`Latency: ${lat5}ms\n`);

  console.log('=== Performance Results Summary ===');
  console.table(results);
}

runPerfTests().catch(console.error);
