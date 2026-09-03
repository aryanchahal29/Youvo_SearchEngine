import * as fs from 'fs';
import * as path from 'path';
import { ProcessedQuery, QualityPolicy } from '../lib/search/query-processor';
import { LiveDiscoveryOrchestrator } from '../lib/discovery/live-discovery-orchestrator';
import { AIProviderRouter } from '../lib/providers/router';
import { GeminiSearchAdapter } from '../lib/discovery/gemini-search-adapter';
import { RiskEngine } from '../lib/reputation/risk-engine';
import { CandidateTool } from '../lib/discovery/types';
import * as dotenv from 'dotenv';
import { QualityGate } from '../lib/discovery/quality-gate';
import { EligibilityEngine } from '../lib/ranking/eligibility-engine';
import { PreliminaryRankingEngine } from '../lib/ranking/preliminary-ranking-engine';
import { createAdminClient } from '../lib/supabase/server';
dotenv.config({ path: '.env.local' });

async function runGates() {
  console.log('Running Deterministic Quality Gates (A-P)...');
  const fixturesPath = path.join(process.cwd(), 'src/tests/fixtures/controlled_eval_fixtures.json');
  const mockedFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

  const qualityPolicy: QualityPolicy = {
    enablePublisherFiltering: true,
    enableAggregatorFiltering: true,
    enableArticleFiltering: true,
    enableIdentityValidation: true,
    enableSnippetConstraintEvidence: true,
    enableUnknownConstraintPenalty: true,
    enableTargetEntityFiltering: true,
    enableUnsupportedIntentHandling: true
  };

  // Monkey patch AIProviderRouter
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
    for (const [qid, fix] of Object.entries(mockedFixtures)) {
      if (prompt.toLowerCase().includes((fix as any).query.toLowerCase())) {
        matchedQid = qid;
        break;
      }
    }
    
    if (matchedQid) {
       const resp = Object.values((mockedFixtures as any)[matchedQid].llm_responses)[0];
       if (resp) return { tools: resp };
    }
    
    // For bespoke gate queries that aren't in fixtures
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('crm software for small business')) {
        return { tools: [
            { name: "Capterra List", canonical_domain: "capterra.com", official_url: "https://capterra.com/crm", description: "Top CRMs on Capterra", why_match: "List" },
            { name: "Salesforce", canonical_domain: "salesforce.com", official_url: "https://salesforce.com", description: "CRM software for small business", why_match: "Best CRM" }
        ]};
    } else if (lowerPrompt.includes('pictory')) {
        return { tools: [{ name: "Pictory AI", canonical_domain: "pictory.ai", official_url: "https://pictory.ai", description: "Pictory AI video generator.", why_match: "Tool", capabilities: [], pricing: {type: 'unknown', known: false}, skill_level: 'unknown', confidence: 0.9 }] };
    } else if (lowerPrompt.includes('xyzfakishtoolthatdoesnotexist123')) {
        return { tools: [] }; // No fabricated tool
    }

    return { tools: [] };
  };

  const originalGenerateText = AIProviderRouter.prototype.generateText;
  AIProviderRouter.prototype.generateText = async function(prompt, system, options) {
    return "[]";
  };

  // Monkey patch Tavily
  const originalDiscoverForQuery = GeminiSearchAdapter.prototype.discoverForQuery;
  GeminiSearchAdapter.prototype.discoverForQuery = async function(query: string, limit: number) {
    // If the query is an identity check like "Does Salesforce Is this a real tool named Salesforce??"
    // just return a positive mock response so the identity verification passes
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

    for (const [qid, fix] of Object.entries(mockedFixtures)) {
      if (query.toLowerCase().includes((fix as any).query.toLowerCase())) {
        return (fix as any).tavily_responses || [];
      }
    }
    return [];
  };

  // Monkey patch RiskEngine
  const originalAnalyzeRisk = RiskEngine.analyzeRisk;
  RiskEngine.analyzeRisk = async function(toolId: string) {
    return {
      risk_level: 'low',
      risk_penalty: 0,
      reasons: []
    };
  };

  // Monkey patch createAdminClient to avoid DB insertions
  // We can just intercept the orchestrator's persistVerifiedTools directly, or just let it fail silently if it fails.
  // Actually, we'll monkey patch persistVerifiedTools on the orchestrator instance to just return the candidates without saving.

  let allPassed = true;
  
  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ ${msg}`);
    } else {
      console.error(`❌ ${msg}`);
      allPassed = false;
    }
  }

  const runDiscovery = async (queryOverrides: Partial<ProcessedQuery>) => {
    const q: ProcessedQuery = {
      raw_query: 'test', corrected_query: 'test', was_corrected: false,
      intent: { type: 'find_tool', confidence: 0.9 }, category: 'test',
      constraints: { budget: null, skill_level: null, watermark: null, commercial_use: null, no_code: null, api_access: null, open_source: null, has_free_plan: null, has_free_trial: null },
      priorities: [], language: 'english', search_terms: ['test'], target_entity: null, quality_policy: qualityPolicy,
      ...queryOverrides
    };
    const orchestrator = new LiveDiscoveryOrchestrator(q.corrected_query);
    (orchestrator as any).persistVerifiedTools = async function(verifiedCandidates: any[], query: any, supabase: any) {
       // Mock persistence - just convert to DiscoveredTool shape
       return verifiedCandidates.map(c => ({
          ...c,
          id: 'mocked-id',
          status: 'verified'
       }));
    };
    return await orchestrator.discoverInline(q);
  };

  try {
    // Gate A: CRM software for small business -> publisher/organization pages must not outrank valid CRM products
    const resA = await runDiscovery({ raw_query: 'CRM software for small business', corrected_query: 'CRM software for small business', search_terms: ['CRM software for small business'] });
    assert(!resA.discovered_tools?.some(t => t.name.toLowerCase().includes('capterra')), 'Gate A: Capterra is rejected for CRM query');
    assert(resA.discovered_tools?.some(t => t.name.toLowerCase().includes('salesforce')), 'Gate A: Legitimate CRM survives');

    // Gate B: Completely free screen recorder for Windows -> dictionary/article pages must be rejected
    const candB = { name: "Wikipedia Definition", url: "https://en.wikipedia.org/wiki/Screen_recording", description: "Wikipedia article about Screen recording", source: "gemini", discovered_at: new Date() };
    const rejB = QualityGate.evaluateQuality(candB, qualityPolicy);
    assert(rejB === 'NOT_A_TOOL', 'Gate B: Wikipedia article rejected as NOT_A_TOOL');

    // Gate C: Does Pictory AI support 4K export on the free plan? -> target entity must resolve to Pictory
    const resC = await runDiscovery({ raw_query: 'Does Pictory AI support 4k export', corrected_query: 'Does Pictory AI support 4k export', intent: { type: 'specific_tool', confidence: 0.9 }, target_entity: 'Pictory', search_terms: ['Pictory AI'] });
    assert(resC.discovered_tools?.some(t => t.name.toLowerCase().includes('pictory')), 'Gate C: Target entity Pictory is recognized and kept');

    // Gate D: What is the difference between CRM and ERP? -> UNSUPPORTED_INTENT
    const resD = await runDiscovery({ raw_query: 'What is the difference between CRM and ERP?', corrected_query: 'What is the difference between CRM and ERP?', intent: { type: 'general_question', confidence: 0.9 } });
    assert(resD.status === 'UNSUPPORTED_INTENT', 'Gate D: UNSUPPORTED_INTENT correctly applied to general question');

    // Gate E: Is ChatGPT Plus $20 or $25? -> factual/general question path
    const resE = await runDiscovery({ raw_query: 'Is ChatGPT Plus $20 or $25?', corrected_query: 'Is ChatGPT Plus $20 or $25?', intent: { type: 'general_question', confidence: 0.9 } });
    assert(resE.status === 'UNSUPPORTED_INTENT', 'Gate E: Factual question treated as UNSUPPORTED_INTENT');

    // Gate F: XYZFakishToolThatDoesNotExist123 -> no fabricated tool
    const resF = await runDiscovery({ raw_query: 'XYZFakishToolThatDoesNotExist123', corrected_query: 'XYZFakishToolThatDoesNotExist123', search_terms: ['XYZFakishToolThatDoesNotExist123'] });
    assert(resF.discovered_tools?.length === 0, 'Gate F: No fabricated tools discovered');

    // Gate G: Tool article/listicle -> rejected
    const candG = { name: "TechCrunch Article", url: "https://techcrunch.com/article/best-crm", description: "News article", source: "gemini", discovered_at: new Date() };
    assert(QualityGate.evaluateQuality(candG, qualityPolicy) === 'NOT_A_TOOL', 'Gate G: Article rejected');

    // Gate H: Aggregator result -> rejected
    const candH = { name: "G2 Reviews", url: "https://www.g2.com/categories/crm", description: "Top CRMs", source: "gemini", discovered_at: new Date() };
    assert(QualityGate.evaluateQuality(candH, qualityPolicy) === 'NOT_A_TOOL', 'Gate H: Aggregator rejected');

    // Gate I: Valid product page hosted on a publisher/company domain -> accepted when identity is strong
    const candI = { name: "Google Workspace", url: "https://workspace.google.com/products/docs/", description: "Word processing tool by Google", source: "gemini", discovered_at: new Date() };
    assert(QualityGate.evaluateQuality(candI, qualityPolicy) === null, 'Gate I: Valid product page on broad domain accepted');

    // Gate J: "free plan available" -> MATCH
    const candJ = { name: "Tool J", url: "https://toolj.com", description: "Tool with free plan available.", source: "gemini", discovered_at: new Date() };
    const qJ: ProcessedQuery = { raw_query: '', corrected_query: '', was_corrected: false, intent: { type: 'find_tool', confidence: 0.9 }, category: '', constraints: { budget: 'free', skill_level: null, watermark: null, commercial_use: null, no_code: null, api_access: null, open_source: null, has_free_plan: true, has_free_trial: null }, priorities: [], language: 'english', search_terms: [], target_entity: null, quality_policy: qualityPolicy };
    const evalJ = EligibilityEngine.evaluateCandidate(candJ, qJ);
    assert((evalJ.matched_constraints?.includes('budget') || evalJ.matched_constraints?.includes('has_free_plan')) ?? false, 'Gate J: Snippet "free plan available" yields MATCH');

    // Gate K: "not free" -> NO_MATCH
    const candK = { name: "Tool K", url: "https://toolk.com", description: "Premium tool, not free.", source: "gemini", discovered_at: new Date() };
    const evalK = EligibilityEngine.evaluateCandidate(candK, qJ);
    assert(evalK.eligibility_status === 'INELIGIBLE' && (evalK.failed_constraints?.includes('budget') ?? false), 'Gate K: Snippet "not free" yields NO_MATCH');

    // Gate L: "free trial" -> UNKNOWN for a free-plan requirement
    const candL = { name: "Tool L", url: "https://tooll.com", description: "Has a free trial for 14 days.", source: "gemini", discovered_at: new Date() };
    const evalL = EligibilityEngine.evaluateCandidate(candL, qJ);
    assert(evalL.unknown_constraints?.includes('budget') ?? false, 'Gate L: Snippet "free trial" yields UNKNOWN for budget=free constraint');

    // Gate M: Hard constraint NO_MATCH -> INELIGIBLE
    assert(evalK.eligibility_status === 'INELIGIBLE', 'Gate M: Hard constraint NO_MATCH makes candidate INELIGIBLE');

    // Gate N: Hard constraint UNKNOWN -> remains unresolved, not false (Eligible)
    assert(evalL.eligibility_status === 'ELIGIBLE', 'Gate N: Hard constraint UNKNOWN keeps candidate ELIGIBLE (pending verification)');

    // Gate O: Unknown-constraint penalty -> affects ranking only, never eligibility
    const rankedL = PreliminaryRankingEngine.rankCandidates([evalL], qJ);
    assert(rankedL[0].score_breakdown?.constraints !== undefined && (rankedL[0].ranking_reasons?.some(r => r.includes('Penalized')) ?? false), 'Gate O: Unknown constraint penalty applied in ranking');

    // Gate P: Specific-tool query with alternate title -> accepted when entity/domain matches
    const candP = { name: "Adobe Premiere Pro CC", url: "https://adobe.com/premiere", description: "Video editor", source: "gemini", discovered_at: new Date() };
    const qP: ProcessedQuery = { raw_query: 'Premiere Pro', corrected_query: 'Premiere Pro', was_corrected: false, intent: { type: 'specific_tool', confidence: 0.9 }, category: '', constraints: { budget: null, skill_level: null, watermark: null, commercial_use: null, no_code: null, api_access: null, open_source: null, has_free_plan: null, has_free_trial: null }, priorities: [], language: 'english', search_terms: [], target_entity: 'Premiere Pro', quality_policy: qualityPolicy };
    const evalP = EligibilityEngine.evaluateCandidate(candP, qP);
    assert(evalP.matched_constraints?.includes('target_entity') ?? false, 'Gate P: Alternate title accepted if entity matches');

  } catch (error) {
    console.error('Error running gates:', error);
    allPassed = false;
  }

  // Restore mocks
  AIProviderRouter.prototype.generateStructuredOutput = originalGenerate;
  AIProviderRouter.prototype.generateText = originalGenerateText;
  GeminiSearchAdapter.prototype.discoverForQuery = originalDiscoverForQuery;
  RiskEngine.analyzeRisk = originalAnalyzeRisk;

  if (!allPassed) {
    console.error('\n❌ SOME QUALITY GATES FAILED. DO NOT PROCEED TO EVALUATION.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL QUALITY GATES PASSED.');
  }
}

runGates().catch(console.error);
