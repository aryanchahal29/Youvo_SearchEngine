import * as fs from 'fs';
import * as path from 'path';
import { LiveDiscoveryOrchestrator } from '../lib/discovery/live-discovery-orchestrator';
import { AIProviderRouter } from '../lib/providers/router';
import { GeminiSearchAdapter } from '../lib/discovery/gemini-search-adapter';
import { ProcessedQuery, QualityPolicy } from '../lib/search/query-processor';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Configuration
const args = process.argv.slice(2);
const modeArg = args.indexOf('--mode');
const mode = modeArg !== -1 ? args[modeArg + 1] : 'after';

const inputArg = args.indexOf('--input');
const inputFile = inputArg !== -1 ? args[inputArg + 1] : 'beta_queries_beta01.json';

const isBefore = mode === 'before';
const outputFile = isBefore ? 'controlled_before_results.json' : 'controlled_after_results.json';

console.log(`Running Controlled Evaluation in ${mode.toUpperCase()} mode...`);

// Load fixtures
const fixturesPath = path.join(process.cwd(), 'src/tests/fixtures/controlled_eval_fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

// Policy setup
const currentProductionPolicy: QualityPolicy = {
  enablePublisherFiltering: true,
  enableAggregatorFiltering: true,
  enableArticleFiltering: true,
  enableIdentityValidation: true,
  enableSnippetConstraintEvidence: true,
  enableUnknownConstraintPenalty: true,
  enableTargetEntityFiltering: true,
  enableUnsupportedIntentHandling: true
};

const beforePolicy: QualityPolicy = {
  enablePublisherFiltering: false,      // weaker publisher/aggregator filtering
  enableAggregatorFiltering: false,     // weaker publisher/aggregator filtering
  enableArticleFiltering: false,        // weaker article filtering
  enableIdentityValidation: false,      // weaker identity validation
  enableSnippetConstraintEvidence: false, // no snippet-based constraint evidence
  enableUnknownConstraintPenalty: false, // no unknown-constraint ranking penalty
  enableTargetEntityFiltering: false,    // no target-entity enforcement
  enableUnsupportedIntentHandling: false // no UNSUPPORTED_INTENT handling
};

const activePolicy = isBefore ? beforePolicy : currentProductionPolicy;

// Monkey patching provider boundaries
const originalGenerate = AIProviderRouter.prototype.generateStructuredOutput;
AIProviderRouter.prototype.generateStructuredOutput = async function(prompt, system, schema, options) {
  if (options?.task_type === 'extraction' || prompt.includes('FactExtractor')) {
     return {
       name: "Mocked Tool",
       description: "Mocked description",
       short_description: "Mocked",
       company_name: "Mocked Inc",
       pricing_plans: [ { plan_name: "Free", is_free: true, billing_period: "free", watermark: false, commercial_use: true } ],
       features: [ { name: "test", value: "yes" } ],
       limitations: [],
       confidence: 90
     } as any;
  }

  let matchedQid = null;
  for (const [qid, fix] of Object.entries(fixtures)) {
    if (prompt.toLowerCase().includes((fix as any).query.toLowerCase())) {
      matchedQid = qid;
      break;
    }
  }
  
  if (matchedQid) {
     const resp = Object.values((fixtures as any)[matchedQid].llm_responses)[0];
     if (resp) return { tools: resp };
  }
  
  return { tools: [] };
};

const originalGenerateText = AIProviderRouter.prototype.generateText;
AIProviderRouter.prototype.generateText = async function(prompt, system, options) {
  return "[]";
};

const originalDiscoverForQuery = GeminiSearchAdapter.prototype.discoverForQuery;
GeminiSearchAdapter.prototype.discoverForQuery = async function(query: string, limit: number) {
  // Mock identity check query
  if (query.includes('real tool named')) {
    const match = query.match(/named (.+)\?\?/);
    const toolName = match ? match[1] : 'Tool';
    return [{
      title: toolName,
      url: `https://${toolName.toLowerCase().replace(/\s+/g, '')}.com`,
      snippet: `Yes, ${toolName} is a popular software.`,
      content: `Yes, ${toolName} is a real tool.`,
      source: 'TavilySearch'
    }];
  }

  for (const [qid, fix] of Object.entries(fixtures)) {
    if (query.toLowerCase().includes((fix as any).query.toLowerCase())) {
      return (fix as any).tavily_responses || [];
    }
  }
  return [];
};

import { RiskEngine } from '../lib/reputation/risk-engine';
const originalAnalyzeRisk = RiskEngine.analyzeRisk;
RiskEngine.analyzeRisk = async function(toolId: string) {
  return {
    risk_level: 'low',
    risk_penalty: 0,
    reasons: []
  };
};

// Metrics tracking
const metrics = {
  total_queries: 0,
  unsupported_intent_correct: 0,
  unsupported_intent_missed: 0,
  target_entity_correct: 0,
  target_entity_missed: 0,
  tools_evaluated: 0,
  publishers_filtered: 0,
  aggregators_filtered: 0,
  articles_filtered: 0,
  invalid_urls_filtered: 0,
  duplicates_filtered: 0,
  valid_tools_survived: 0,
  hard_constraints_enforced: 0,
  false_positives_survived: 0 // Poison tools that made it through
};

const results: any[] = [];

async function evaluate() {
  const queryKeys = Object.keys(fixtures);
  metrics.total_queries = queryKeys.length;

  for (const qid of queryKeys) {
    const fix = fixtures[qid];
    const q: ProcessedQuery = {
      raw_query: fix.query,
      corrected_query: fix.query,
      was_corrected: false,
      intent: fix.intent || { type: 'find_tool', confidence: 0.9 },
      category: 'productivity',
      constraints: { 
        budget: null, skill_level: null, watermark: null, commercial_use: null, no_code: null, api_access: null, open_source: null, has_free_plan: null, has_free_trial: null 
      },
      priorities: [],
      language: 'english',
      search_terms: [fix.query],
      target_entity: fix.target_entity,
      quality_policy: activePolicy
    };

    // Apply expected hard constraints to the query object
    if (fix.expected_hard_constraints) {
      if (fix.expected_hard_constraints.includes('free')) {
        q.constraints.budget = 'free';
        q.constraints.has_free_plan = true;
      }
      if (fix.expected_hard_constraints.includes('open_source')) {
        q.constraints.open_source = true;
      }
      if (fix.expected_hard_constraints.includes('no_watermark')) {
        q.constraints.watermark = false;
      }
      if (fix.expected_hard_constraints.includes('commercial_use')) {
        q.constraints.commercial_use = true;
      }
      if (fix.expected_hard_constraints.includes('api')) {
        q.constraints.api_access = true;
      }
      if (fix.expected_hard_constraints.includes('no_code')) {
         q.constraints.no_code = true;
      }
    }

    const orchestrator = new LiveDiscoveryOrchestrator(q.corrected_query);
    (orchestrator as any).persistVerifiedTools = async function(verifiedCandidates: any[], query: any, supabase: any) {
       return verifiedCandidates.map(c => ({ ...c, id: 'mocked-id', status: 'verified' }));
    };
    
    const res = await orchestrator.discoverInline(q);

    // Track Intent Metric
    const isExpectedUnsupported = fix.intent.type === 'general_question' || fix.intent.type === 'compare_tools';
    if (isExpectedUnsupported) {
       if (res.status === 'UNSUPPORTED_INTENT') {
          metrics.unsupported_intent_correct++;
       } else {
          metrics.unsupported_intent_missed++;
       }
    }

    // Track Target Entity Metric
    if (fix.target_entity) {
       const topTool = res.discovered_tools?.[0];
       if (topTool && topTool.name.toLowerCase().includes(fix.target_entity.toLowerCase())) {
          metrics.target_entity_correct++;
       } else {
          metrics.target_entity_missed++;
       }
    }

    // Analyze tool results
    const finalTools = res.discovered_tools || [];
    metrics.valid_tools_survived += finalTools.length;

    // Track false positives (poison)
    const poisonPatterns = ['G2', 'Article', 'Review', 'List', 'Awesome', 'Fake', 'TechCrunch', 'Wikipedia', 'Capterra', 'YouTube'];
    for (const t of finalTools) {
       metrics.tools_evaluated++;
       if (poisonPatterns.some(p => t.name.toLowerCase().includes(p.toLowerCase()))) {
           metrics.false_positives_survived++;
       }
    }

    results.push({
      qid,
      query: fix.query,
      status: res.status,
      survived_tools: finalTools.map(t => t.name),
      isExpectedUnsupported
    });
  }

  // Restore mocks
  AIProviderRouter.prototype.generateStructuredOutput = originalGenerate;
  AIProviderRouter.prototype.generateText = originalGenerateText;
  GeminiSearchAdapter.prototype.discoverForQuery = originalDiscoverForQuery;

  // Save results
  const report = {
    mode,
    metrics,
    results
  };

  fs.writeFileSync(path.join(process.cwd(), outputFile), JSON.stringify(report, null, 2));
  console.log(`✅ Evaluation complete. Saved to ${outputFile}`);
  console.log('Metrics:', metrics);
}

evaluate().catch(console.error);
