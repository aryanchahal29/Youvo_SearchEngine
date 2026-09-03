import * as fs from 'fs';
import * as path from 'path';
import { processQuery } from '../lib/search/query-processor';
import { LiveDiscoveryOrchestrator } from '../lib/discovery/live-discovery-orchestrator';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

interface BetaQuery {
  id: string;
  query: string;
  category?: string;
  expected_constraints?: string[];
  notes?: string;
}

async function runBetaEvaluation() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  let inputFilename = 'beta_queries.example.json';
  if (inputIndex !== -1 && args[inputIndex + 1]) {
    inputFilename = args[inputIndex + 1];
  }

  const sampleIndex = args.indexOf('--sample');
  let limit = Infinity;
  if (sampleIndex !== -1 && args[sampleIndex + 1]) {
    limit = parseInt(args[sampleIndex + 1], 10);
  }

  const queriesPath = path.join(process.cwd(), inputFilename);
  if (!fs.existsSync(queriesPath)) {
    console.error(`${inputFilename} not found!`);
    process.exit(1);
  }

  const queries: BetaQuery[] = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));
  const queriesToRun = limit < Infinity ? queries.slice(0, limit) : queries;

  console.log(`Starting Beta Evaluation for ${queriesToRun.length} queries...\n`);

  const results: any[] = [];
  const metrics = {
    total_queries: queriesToRun.length,
    successful_queries: 0,
    partial_queries: 0,
    failed_queries: 0,
    provider_failures: 0,
    tavily_fallbacks: 0,
    ttfu_measured_count: 0,
    ttfu_latencies: [] as number[],
    final_latencies: [] as number[]
  };

  for (const q of queriesToRun) {
    console.log(`[${q.id}] Query: "${q.query}"`);
    const startTime = Date.now();
    let totalLatency = 0;
    let executionError = null;
    let discoveryResult: any = null;

    try {
      const processed = await processQuery(q.query);
      const orchestrator = new LiveDiscoveryOrchestrator(processed.corrected_query);
      discoveryResult = await orchestrator.discoverInline(processed);
    } catch (e) {
      executionError = e instanceof Error ? e.message : 'Unknown execution error';
    } finally {
      totalLatency = Date.now() - startTime;
    }

    metrics.final_latencies.push(totalLatency);

    const m = discoveryResult?.metrics || {};
    const status = discoveryResult?.status || 'DISCOVERY_FAILED';
    const isSuccess = status === 'SUCCESS';
    const isPartial = status === 'PARTIAL_SUCCESS';
    
    if (isSuccess) metrics.successful_queries++;
    else if (isPartial) metrics.partial_queries++;
    else metrics.failed_queries++;

    if (m.providers_failed?.length > 0 || m.providers_timed_out?.length > 0) metrics.provider_failures++;
    if (m.tavily_call_count > 0 || status === 'PARTIAL_SUCCESS') metrics.tavily_fallbacks++; // fallback used

    const topTools = (discoveryResult?.discovered_tools || []).map((t: any) => t.name);
    
    const record = {
      query_id: q.id,
      query: q.query,
      category: q.category || '',
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(startTime + totalLatency).toISOString(),
      total_latency_ms: totalLatency,
      ttfu_ms: m.ttfu_ms || null,
      ttfu_status: m.ttfu_status || 'NOT_AVAILABLE',
      cache_hit: false, // The orchestrator bypasses full cache by default in discoverInline unless cached. In production, we'd check actual cache hit. We will mark false for live discovery here.
      discovery_status: status,
      verification_status: m.verified > 0 ? 'VERIFIED' : 'UNVERIFIED',
      result_count: discoveryResult?.discovered_tools?.length || 0,
      top_1_tool: topTools[0] || '',
      top_3_tools: topTools.slice(0, 3).join(', '),
      provider_attempts: (m.providers_attempted || []).length,
      provider_successes: (m.providers_succeeded || []).length,
      provider_failures: (m.providers_failed || []).length + (m.providers_timed_out || []).length,
      tavily_fallback_used: (m.discovered === 0 && (m.providers_attempted || []).length > 0) || false,
      tavily_call_count: m.tavily_call_count || 0,
      verification_batches: m.verified > 0 ? 1 : 0,
      final_result_count: discoveryResult?.discovered_tools?.length || 0,
      eligibility_failures: m.rejected || 0,
      unknown_constraints: '',
      execution_error: executionError || (m.errors && m.errors.length > 0 ? m.errors.join('; ') : ''),
      relevance_score: 'pending_human_review',
      constraint_score: 'pending_human_review',
      verification_score: 'pending_human_review',
      ranking_score: 'pending_human_review',
      explanation_score: 'pending_human_review',
      human_notes: 'pending_human_review'
    };

    if (record.ttfu_status === 'MEASURED' && record.ttfu_ms) {
      metrics.ttfu_measured_count++;
      metrics.ttfu_latencies.push(record.ttfu_ms);
    }
    
    // We check if it fell back to Tavily accurately:
    if (record.tavily_fallback_used) metrics.tavily_fallbacks++;

    results.push(record);
    console.log(`  -> Status: ${status} | Latency: ${totalLatency}ms | TTFU: ${record.ttfu_status === 'MEASURED' ? record.ttfu_ms + 'ms' : 'N/A'}`);
  }

  // Write JSON
  fs.writeFileSync(path.join(process.cwd(), 'beta_evaluation_results.json'), JSON.stringify(results, null, 2));

  // Write CSV
  if (results.length > 0) {
    const headers = Object.keys(results[0]);
    const csvRows = [headers.join(',')];
    for (const r of results) {
      const row = headers.map(h => {
        let val = r[h as keyof typeof r];
        if (val === null || val === undefined) val = '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(row.join(','));
    }
    fs.writeFileSync(path.join(process.cwd(), 'beta_evaluation_results.csv'), csvRows.join('\n'));
  }

  // Helper for percentiles
  const p = (arr: number[], percentile: number) => {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const index = (percentile / 100) * (arr.length - 1);
    if (Math.floor(index) === index) return arr[index];
    const i = Math.floor(index);
    const fraction = index - i;
    return arr[i] + (arr[i + 1] - arr[i]) * fraction;
  };

  // Generate Markdown Report
  const mdReport = `# Real-World Evaluation Report
  
## Execution Summary
- **Dataset Size**: ${metrics.total_queries} queries
- **Execution Period**: ${new Date().toISOString()}
- **Query Categories**: ${[...new Set(results.map(r => r.category))].join(', ')}

## Reliability Statistics
- **Total Queries**: ${metrics.total_queries}
- **Successful**: ${metrics.successful_queries} (${((metrics.successful_queries/metrics.total_queries)*100).toFixed(1)}%)
- **Partial Success**: ${metrics.partial_queries} (${((metrics.partial_queries/metrics.total_queries)*100).toFixed(1)}%)
- **Failed**: ${metrics.failed_queries} (${((metrics.failed_queries/metrics.total_queries)*100).toFixed(1)}%)
- **Provider Failures**: ${metrics.provider_failures}
- **Tavily Fallbacks**: ${metrics.tavily_fallbacks}

## Performance Statistics
- **TTFU Status**: ${metrics.ttfu_measured_count} measured, ${metrics.total_queries - metrics.ttfu_measured_count} not available.
- **TTFU p50**: ${p(metrics.ttfu_latencies, 50).toFixed(0)} ms
- **TTFU p95**: ${p(metrics.ttfu_latencies, 95).toFixed(0)} ms
- **TTFU p99**: ${p(metrics.ttfu_latencies, 99).toFixed(0)} ms
- **Final Latency p50**: ${p(metrics.final_latencies, 50).toFixed(0)} ms
- **Final Latency p95**: ${p(metrics.final_latencies, 95).toFixed(0)} ms
- **Final Latency p99**: ${p(metrics.final_latencies, 99).toFixed(0)} ms

*(Note: TTFU distinguishes the time to the first usable candidate from the Final Result Latency.)*

## Quality Statistics (Pending Human Review)
*All human review fields are currently marked \`pending_human_review\`.*

- Top-1 relevance: Pending
- Top-3 relevance: Pending
- False-positive rate: Pending
- Hard-constraint satisfaction: Pending
- Verification accuracy: Pending

## Warnings & Recommended Fixes
${p(metrics.final_latencies, 95) > 8000 ? '⚠️ **WARNING**: Final latency p95 exceeds 8s provisional target.' : '✅ Final latency p95 within bounds.'}
${metrics.failed_queries > (metrics.total_queries * 0.1) ? '⚠️ **WARNING**: High failure rate detected (>10%).' : '✅ Failure rate within acceptable bounds.'}

## Final Beta-Readiness Assessment
This report covers automated extraction from the existing frozen production pipeline. A final human review of the generated CSV is required to grade relevance, constraint satisfaction, and ranking accuracy.
`;

  fs.writeFileSync(path.join(process.cwd(), 'real_world_evaluation_report.md'), mdReport);
  console.log('\nEvaluation Complete. Generated:');
  console.log(' - beta_evaluation_results.json');
  console.log(' - beta_evaluation_results.csv');
  console.log(' - real_world_evaluation_report.md');
}

runBetaEvaluation().catch(console.error);
