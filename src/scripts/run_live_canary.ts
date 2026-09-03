import { LiveDiscoveryOrchestrator } from '../lib/discovery/live-discovery-orchestrator';
import { processQuery } from '../lib/search/query-processor';
import { FinalRankingEngine } from '../lib/ranking/final-ranking-engine';
import { createAdminClient } from '../lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// 20 focused queries prioritizing the requested failure classes
const CANARY_QUERIES = [
  // Publisher/article false positives
  "best AI video editor for beginners", // High risk of listicles
  "top 10 design tools in 2026", // High risk of aggregators
  "what is the best open source crm", // High risk of articles

  // Aggregator results
  "tools like zapier", // G2 / Capterra usually rank high
  "alternative to photoshop", // AlternativeTo usually ranks high

  // Specific-tool queries
  "Does Lumen5 Is this a real tool named Lumen5??",
  "Zapier vs Make for simple automations", // Comparison
  "who acquired figma in 2026", // Factual about a tool
  "current pricing of X Premium", // Specific factual

  // General/factual questions (Should short circuit)
  "is there any AI tool that creates full feature films automatically from a single prompt",
  "make things happen automatically", // Super broad
  "how to edit a video on a mac", // Instructional, not tool search

  // Free-plan constraints
  "free tool that generates infinite money", // Non-existent + free
  "Can you use Claude 3 Opus for free?", // Factual + free constraint
  "open source game engine for 2d pixel art", // open source constraint
  
  // Platform constraints
  "finance app that connects to European banks via open banking", // European banking constraint
  "free open source CRM that runs on linux and has an android app", // Multi-platform + open source

  // Multiple hard constraints
  "accounting software for UK with VAT support, multi-currency, and stripe integration",
  "CRM that integrates with WhatsApp business API",

  // Nonexistent / Poison tools
  "XYZFakishToolThatDoesNotExist123", // Nonexistent
  "AI that can read my mind and write code", // Impossible
];

const results: any[] = [];

async function runCanary() {
  console.log(`Starting Live Canary Evaluation with ${CANARY_QUERIES.length} queries...`);

  let totalLatency = 0;
  let successCount = 0;
  let partialCount = 0;
  let noMatchCount = 0;
  let failureCount = 0;
  let unsupportedIntentCount = 0;

  for (let i = 0; i < CANARY_QUERIES.length; i++) {
    const rawQuery = CANARY_QUERIES[i];
    console.log(`\n[${i + 1}/${CANARY_QUERIES.length}] Query: "${rawQuery}"`);
    
    const startTime = Date.now();
    try {
      const q = await processQuery(rawQuery);
      
      const orchestrator = new LiveDiscoveryOrchestrator(q.corrected_query);
      const discoveryResult = await orchestrator.discoverInline(q);
      
      const ranked = await FinalRankingEngine.rankTools(discoveryResult.discovered_tools as any, q);
      
      const latency = Date.now() - startTime;
      totalLatency += latency;

      let status = 'SUCCESS';
      if (q.intent.type === 'general_question') {
          status = 'CORRECT_UNSUPPORTED';
          unsupportedIntentCount++;
      } else if (discoveryResult.discovered_tools.length === 0) {
        status = 'NO_MATCHES';
        noMatchCount++;
      } else if (ranked.alternatives.length === 0 && !ranked.best_match) {
         status = 'NO_MATCHES';
         noMatchCount++;
      } else {
        successCount++;
      }

      console.log(`Status: ${status} | Latency: ${latency}ms | Tools found: ${discoveryResult.discovered_tools.length}`);

      results.push({
        query: rawQuery,
        processed_query: q,
        status,
        latency_ms: latency,
        metrics: discoveryResult.metrics,
        ranked_results: ranked,
      });

    } catch (e: any) {
      console.error(`Error processing query: ${e.message}`);
      failureCount++;
      results.push({
        query: rawQuery,
        status: 'DISCOVERY_FAILED',
        error: e.message,
        latency_ms: Date.now() - startTime
      });
    }

    if (i < CANARY_QUERIES.length - 1) {
      console.log('Waiting 15s to avoid rate limits...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  const latencies = results.map(r => r.latency_ms || 0).filter(l => l > 0);
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);

  const report = {
    metrics: {
      total: CANARY_QUERIES.length,
      successCount,
      unsupportedIntentCount,
      noMatchCount,
      failureCount,
      p50_latency_ms: p50,
      p95_latency_ms: p95,
      avg_latency_ms: latencies.length ? totalLatency / latencies.length : 0
    },
    results
  };

  fs.writeFileSync('live_canary_results.json', JSON.stringify(report, null, 2));
  console.log('\nCanary Evaluation Complete. Results saved to live_canary_results.json');
}

function calculatePercentile(arr: number[], p: number) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

runCanary().catch(console.error);
