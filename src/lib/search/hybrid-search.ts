// YouVo: Hybrid Search Engine
// PRD §5: Intelligent Search & Discovery
// Merges results from all stages with configurable weights
// NOW WIRED TO LIVE DISCOVERY ORCHESTRATOR — "source: live_discovery"
// is NO LONGER just a flag. It actually executes the discovery pipeline.

import { createAdminClient } from '@/lib/supabase/server';
import { getAIRouter } from '@/lib/providers/router';
import type { ProcessedQuery } from './query-processor';
import type { Tool, ToolWithDetails, ToolScore, PricingPlan, ToolFeature, ToolCategory } from '@/lib/supabase/types';
import { LiveDiscoveryOrchestrator } from '@/lib/discovery/live-discovery-orchestrator';
import type { DiscoveryMetrics, DiscoveryProvider } from '@/lib/discovery/types';

// ============================================================
// TYPES
// ============================================================

export interface SearchCandidate {
  tool_id: string;
  tool_name: string;
  tool_slug: string;
  fts_score: number;
  fuzzy_score: number;
  semantic_score: number;
  combined_score: number;
  source: 'fts' | 'fuzzy' | 'semantic' | 'live_discovery';
}

export interface HybridSearchResult {
  candidates: SearchCandidate[];
  tools: ToolWithDetails[];
  source: 'cache' | 'database' | 'live_discovery';
  processing_time_ms: number;
  discovery_job_id: string | null;
  discovery_metrics: DiscoveryMetrics | null;
  is_discovering: boolean;
  cache_state?: string;
}

// ============================================================
// SEARCH WEIGHTS
// ============================================================

const SEARCH_WEIGHTS = {
  fts: 0.35,
  fuzzy: 0.25,
  semantic: 0.40,
};

// ============================================================
// SMART TRIGGER THRESHOLDS
// ============================================================

const TRIGGER_CONFIG = {
  /** Minimum candidates needed to skip live discovery. */
  min_candidates: 3,
  /** Minimum relevance score for a candidate to count as "good". */
  min_relevance_score: 0.15,
  /** Max age (hours) before a candidate is considered stale. */
  max_staleness_hours: 720, // 30 days
  /** Minimum constraint satisfaction ratio to skip discovery. */
  min_constraint_satisfaction: 0.5,
};

// ============================================================
// MAIN SEARCH
// ============================================================

export async function hybridSearch(
  query: ProcessedQuery,
  limit: number = 10,
  customAdapters?: DiscoveryProvider[]
): Promise<HybridSearchResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  // Check cache first (PRD §23)
  const cached = await checkCache(query.corrected_query);
  if (cached) {
    return {
      ...cached,
      source: 'cache',
      processing_time_ms: Date.now() - startTime,
      discovery_job_id: null,
      discovery_metrics: null,
      is_discovering: false,
    };
  }

  // Stage 1 & 2: Lexical + Fuzzy (combined in one DB call)
  const textResults = await textSearch(supabase, query.corrected_query, limit);

  // Stage 3: Semantic search via pgvector
  let semanticResults: SearchCandidate[] = [];
  try {
    semanticResults = await semanticSearch(supabase, query.corrected_query, limit);
  } catch (error) {
    console.warn('Semantic search failed, continuing with text results:', error);
  }

  // Merge and deduplicate results
  let candidates = mergeResults(textResults, semanticResults, limit);

  // Stage 4: Category fallback (if strict text/semantic search yields too few results)
  if (candidates.length < TRIGGER_CONFIG.min_candidates && query.category) {
    const { data: catAssignments } = await supabase
      .from('tool_categories')
      .select('id, name, slug, tool_category_assignments(tool_id, tools!inner(id, name, slug, status))')
      .or(`slug.eq.${query.category},name.ilike.%${query.category}%`)
      .limit(1)
      .maybeSingle();

    if (catAssignments && catAssignments.tool_category_assignments) {
      const existingIds = new Set(candidates.map(c => c.tool_id));
      for (const assignment of catAssignments.tool_category_assignments) {
        const tool = (assignment as any).tools;
        if (tool && tool.status === 'verified' && !existingIds.has(tool.id)) {
          candidates.push({
            tool_id: tool.id,
            tool_name: tool.name,
            tool_slug: tool.slug,
            fts_score: 0.1,
            fuzzy_score: 0.1,
            semantic_score: 0.1,
            combined_score: 0.2,
            source: 'fts',
          });
        }
      }
    }
  }

  // ============================================================
  // SMART TRIGGER: Should we run live discovery?
  // NOT just "candidates.length < 3" — multi-factor evaluation.
  // ============================================================

  const triggerDecision = evaluateDiscoveryTrigger(candidates, query);

  let source: 'database' | 'live_discovery' = 'database';
  let discoveryJobId: string | null = null;
  let discoveryMetrics: DiscoveryMetrics | null = null;
  let isDiscovering = false;

  if (triggerDecision.shouldDiscover) {
    console.log(
      `[HybridSearch] Live discovery triggered. Reason: ${triggerDecision.reason}`
    );

    source = 'live_discovery';

    // ── ACTUALLY RUN LIVE DISCOVERY ──
    const orchestrator = new LiveDiscoveryOrchestrator(query.corrected_query, customAdapters);
    const discoveryResult = await orchestrator.discoverInline(query);

    discoveryMetrics = discoveryResult.metrics;
    discoveryJobId = discoveryResult.job_id;
    isDiscovering = !discoveryResult.is_complete;

    // Log complete discovery metrics
    console.log('[HybridSearch] Discovery metrics:', JSON.stringify(discoveryMetrics, null, 2));

    // Merge discovered tool IDs into candidates
    for (const discovered of discoveryResult.discovered_tools) {
      const alreadyPresent = candidates.some(c => c.tool_id === discovered.tool_id);
      if (!alreadyPresent) {
        candidates.push({
          tool_id: discovered.tool_id,
          tool_name: discovered.name,
          tool_slug: discovered.slug,
          fts_score: 0,
          fuzzy_score: 0,
          semantic_score: 0,
          combined_score: (discovered.confidence / 100) * 0.8, // Scale confidence to score
          source: 'live_discovery',
        });
      }
    }
  }

  // Fetch full tool details for top candidates
  const toolIds = candidates.map(c => c.tool_id);
  const tools = await fetchToolDetails(supabase, toolIds);

  // Determine Cache State
  let cacheState: 'SUCCESS_RESULT' | 'DISCOVERY_COMPLETED_NO_MATCH' | 'DISCOVERY_IN_PROGRESS' | 'PROVIDER_FAILURE' = 'SUCCESS_RESULT';

  if (candidates.length === 0) {
    let allProvidersFailed = false;
    
    if (discoveryMetrics) {
      const attempted = discoveryMetrics.providers_attempted.length;
      const succeeded = discoveryMetrics.providers_succeeded.length;
      if (attempted > 0 && succeeded === 0) {
        allProvidersFailed = true;
      }
    }

    if (allProvidersFailed) {
      cacheState = 'PROVIDER_FAILURE';
    } else if (isDiscovering) {
      cacheState = 'DISCOVERY_IN_PROGRESS';
    } else {
      cacheState = 'DISCOVERY_COMPLETED_NO_MATCH';
    }
  }

  console.log(`[HybridSearch] Saving cache for "${query.corrected_query}" with state: ${cacheState}`);

  // Cache the results
  await cacheResults(query.corrected_query, candidates, tools, cacheState);

  return {
    candidates,
    tools,
    source,
    processing_time_ms: Date.now() - startTime,
    discovery_job_id: discoveryJobId,
    discovery_metrics: discoveryMetrics,
    is_discovering: isDiscovering,
    cache_state: cacheState,
  };
}

// ============================================================
// SMART TRIGGER EVALUATION
// ============================================================

interface TriggerDecision {
  shouldDiscover: boolean;
  reason: string;
}

function evaluateDiscoveryTrigger(
  candidates: SearchCandidate[],
  query: ProcessedQuery
): TriggerDecision {
  // Factor 1: Candidate count
  if (candidates.length === 0) {
    return { shouldDiscover: true, reason: 'zero_candidates' };
  }

  // Factor 2: Relevance quality — are the candidates actually good?
  const goodCandidates = candidates.filter(
    c => c.combined_score >= TRIGGER_CONFIG.min_relevance_score
  );
  if (goodCandidates.length < TRIGGER_CONFIG.min_candidates) {
    return {
      shouldDiscover: true,
      reason: `insufficient_quality: ${goodCandidates.length} good of ${candidates.length} total`,
    };
  }

  // Factor 3: Category novelty — is this category even in our DB?
  // If the query targets a category and zero candidates matched it,
  // we need to discover tools for this category.
  if (query.category && candidates.length < TRIGGER_CONFIG.min_candidates) {
    return {
      shouldDiscover: true,
      reason: `category_novelty: "${query.category}" has < ${TRIGGER_CONFIG.min_candidates} candidates`,
    };
  }

  // Factor 4: Query novelty — "find_tool" intent with very few results
  if (
    query.intent.type === 'find_tool' &&
    query.intent.confidence > 0.7 &&
    candidates.length < TRIGGER_CONFIG.min_candidates
  ) {
    return {
      shouldDiscover: true,
      reason: `high_confidence_find_tool_with_few_results`,
    };
  }

  // Sufficient candidates exist
  return { shouldDiscover: false, reason: 'sufficient_candidates' };
}

// ============================================================
// SEARCH STAGES
// ============================================================

async function textSearch(
  supabase: ReturnType<typeof createAdminClient>,
  query: string,
  limit: number
): Promise<SearchCandidate[]> {
  const { data, error } = await supabase.rpc('hybrid_search_tools', {
    search_term: query,
    match_limit: limit,
  });

  if (error) {
    console.error('Text search error:', error);
    return [];
  }

  return (data || []).map((row: { tool_id: string; tool_name: string; tool_slug: string; fts_rank: number; fuzzy_similarity: number; combined_score: number }) => ({
    tool_id: row.tool_id,
    tool_name: row.tool_name,
    tool_slug: row.tool_slug,
    fts_score: row.fts_rank,
    fuzzy_score: row.fuzzy_similarity,
    semantic_score: 0,
    combined_score: row.combined_score,
    source: 'fts' as const,
  }));
}

async function semanticSearch(
  supabase: ReturnType<typeof createAdminClient>,
  query: string,
  limit: number
): Promise<SearchCandidate[]> {
  const router = getAIRouter();
  const embedding = await router.generateEmbedding(query);

  const { data, error } = await supabase.rpc('semantic_search_tools', {
    query_embedding: embedding as unknown as string,
    match_limit: limit,
    min_similarity: 0.3,
  });

  if (error) {
    console.error('Semantic search error:', error);
    return [];
  }

  return (data || []).map((row: { tool_id: string; tool_name: string; tool_slug: string; similarity: number }) => ({
    tool_id: row.tool_id,
    tool_name: row.tool_name,
    tool_slug: row.tool_slug,
    fts_score: 0,
    fuzzy_score: 0,
    semantic_score: row.similarity,
    combined_score: row.similarity,
    source: 'semantic' as const,
  }));
}

// ============================================================
// RESULT MERGING
// ============================================================

function mergeResults(
  textResults: SearchCandidate[],
  semanticResults: SearchCandidate[],
  limit: number
): SearchCandidate[] {
  const merged = new Map<string, SearchCandidate>();

  for (const result of textResults) {
    merged.set(result.tool_id, {
      ...result,
      combined_score: result.fts_score * SEARCH_WEIGHTS.fts + result.fuzzy_score * SEARCH_WEIGHTS.fuzzy,
    });
  }

  for (const result of semanticResults) {
    const existing = merged.get(result.tool_id);
    if (existing) {
      existing.semantic_score = result.semantic_score;
      existing.combined_score += result.semantic_score * SEARCH_WEIGHTS.semantic;
    } else {
      merged.set(result.tool_id, {
        ...result,
        combined_score: result.semantic_score * SEARCH_WEIGHTS.semantic,
      });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.combined_score - a.combined_score)
    .slice(0, limit);
}

// ============================================================
// FETCH TOOL DETAILS
// ============================================================

async function fetchToolDetails(
  supabase: ReturnType<typeof createAdminClient>,
  toolIds: string[]
): Promise<ToolWithDetails[]> {
  if (toolIds.length === 0) return [];

  const { data: tools } = await supabase
    .from('tools')
    .select('*')
    .in('id', toolIds);

  if (!tools || tools.length === 0) return [];

  const [
    { data: categories },
    { data: assignments },
    { data: pricing },
    { data: scores },
    { data: features },
    { data: evidenceCounts },
  ] = await Promise.all([
    supabase.from('tool_categories').select('*'),
    supabase.from('tool_category_assignments').select('*').in('tool_id', toolIds),
    supabase.from('pricing_plans').select('*').in('tool_id', toolIds),
    supabase.from('tool_scores').select('*').in('tool_id', toolIds).order('calculated_at', { ascending: false }),
    supabase.from('tool_features').select('*').in('tool_id', toolIds),
    supabase.from('evidence').select('tool_id').in('tool_id', toolIds),
  ]);

  const categoryMap = new Map<string, ToolCategory>();
  for (const cat of (categories || [])) {
    categoryMap.set(cat.id, cat as ToolCategory);
  }

  return (tools as Tool[]).map(tool => {
    const toolAssignments = (assignments || []).filter(a => a.tool_id === tool.id);
    const toolCategories = toolAssignments
      .map(a => categoryMap.get(a.category_id))
      .filter(Boolean) as ToolCategory[];

    const toolPricing = (pricing || []).filter(p => p.tool_id === tool.id) as PricingPlan[];
    const toolScores = (scores || []).filter(s => s.tool_id === tool.id) as ToolScore[];
    const latestScore = toolScores.length > 0 ? toolScores[0] : null;
    const toolFeatures = (features || []).filter(f => f.tool_id === tool.id) as ToolFeature[];
    const toolEvidenceCount = (evidenceCounts || []).filter(e => e.tool_id === tool.id).length;

    return {
      ...tool,
      categories: toolCategories,
      pricing_plans: toolPricing,
      latest_score: latestScore,
      features: toolFeatures,
      evidence_count: toolEvidenceCount,
      primary_category: tool.primary_category_id ? categoryMap.get(tool.primary_category_id) || null : null,
    };
  });
}

// ============================================================
// CACHING (PRD §23)
// ============================================================

async function checkCache(query: string): Promise<HybridSearchResult | null> {
  const supabase = createAdminClient();
  const normalized = query.toLowerCase().trim();

  const { data } = await supabase
    .from('search_cache')
    .select('*')
    .eq('normalized_query', normalized)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!data) {
    console.log(`[HybridSearch] Cache MISS for "${normalized}"`);
    return null;
  }

  console.log(`[HybridSearch] Cache HIT for "${normalized}". State: ${data.cache_state}`);

  // PRD Resilience: If the cache was a provider failure, aggressively invalidate if a provider has recovered.
  if (data.cache_state === 'PROVIDER_FAILURE') {
    const registry = getAIRouter().getRegistryState();
    const hasHealthyGemini = registry.some(p => p.enabled && p.health === 'healthy');
    const hasBrave = !!process.env.BRAVE_API_KEY;
    const hasTavily = !!process.env.TAVILY_API_KEY;
    
    // In V2, we have multiple independent web discovery providers.
    if (hasHealthyGemini || hasBrave || hasTavily) {
      console.log(`[HybridSearch] Invalidating PROVIDER_FAILURE cache to retry discovery (independent providers exist).`);
      await supabase.from('search_cache').delete().eq('id', data.id);
      return null;
    }
  }

  await supabase
    .from('search_cache')
    .update({ hit_count: (data.hit_count || 0) + 1 })
    .eq('id', data.id);

  if (data.cache_state === 'DISCOVERY_IN_PROGRESS') {
    const idempotencyKey = `discover:${query.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const { data: job } = await supabase
      .from('automation_jobs')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .in('status', ['pending', 'running'])
      .maybeSingle();

    if (!job) {
      console.log(`[HybridSearch] Stale DISCOVERY_IN_PROGRESS cache (no active job). Invalidating.`);
      await supabase.from('search_cache').delete().eq('id', data.id);
      return null;
    }

    return {
      candidates: [],
      tools: [],
      source: 'cache',
      processing_time_ms: 0,
      discovery_job_id: job.id,
      discovery_metrics: null,
      is_discovering: true,
      cache_state: data.cache_state,
    };
  }

  const tools = await fetchToolDetails(supabase, data.result_tool_ids || []);

  return {
    candidates: [],
    tools,
    source: 'cache',
    processing_time_ms: 0,
    discovery_job_id: null,
    discovery_metrics: null,
    is_discovering: false,
    cache_state: data.cache_state,
  };
}

async function cacheResults(
  query: string,
  candidates: SearchCandidate[],
  tools: ToolWithDetails[],
  cacheState: 'SUCCESS_RESULT' | 'DISCOVERY_COMPLETED_NO_MATCH' | 'DISCOVERY_IN_PROGRESS' | 'PROVIDER_FAILURE'
): Promise<void> {
  const supabase = createAdminClient();
  const normalized = query.toLowerCase().trim();

  let ttlSeconds = 60 * 60 * 24 * 7; // SUCCESS: 7 days
  if (cacheState === 'PROVIDER_FAILURE') ttlSeconds = 60 * 5; // 5 mins
  else if (cacheState === 'DISCOVERY_COMPLETED_NO_MATCH') ttlSeconds = 60 * 60 * 2; // 2 hours
  else if (cacheState === 'DISCOVERY_IN_PROGRESS') ttlSeconds = 60; // 1 min

  await supabase
    .from('search_cache')
    .upsert({
      normalized_query: normalized,
      result_tool_ids: candidates.map(c => c.tool_id),
      result_data: { candidate_count: candidates.length },
      cache_state: cacheState,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }, { onConflict: 'normalized_query' });
}
