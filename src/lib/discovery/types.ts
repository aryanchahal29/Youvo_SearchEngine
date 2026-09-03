// YouVo: Discovery Types
// Shared types for the live discovery pipeline

// ============================================================
// SEARCH RESULT (raw adapter output before entity extraction)
// ============================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  source: string;
}

// ============================================================
// CANDIDATE TOOL (after entity extraction)
// ============================================================

export type RejectionReason =
  | 'INVALID_SCHEMA'
  | 'MISSING_NAME'
  | 'INVALID_IDENTITY'
  | 'INVALID_URL'
  | 'NOT_A_TOOL'
  | 'LOW_RELEVANCE'
  | 'DUPLICATE'
  | 'UNSUPPORTED_TYPE';

export interface CandidateSource {
  provider_id: string;
  model_id: string;
  discovered_at: Date;
}

export interface CandidateTool {
  name: string;
  url: string;
  description: string;
  source: string;
  sources?: CandidateSource[];
  discovered_at: Date;
  providers_identifying?: number;
  successful_providers?: number;
  providers_attempted?: number;
  consensus_ratio?: number;
  provider_coverage?: number;
  metadata?: Record<string, any>;
  validation_reason?: RejectionReason;
  quality_reason?: RejectionReason;
  deduplication_action?: 'MERGED' | null;
  eligibility_status?: 'ELIGIBLE' | 'INELIGIBLE';
  matched_constraints?: string[];
  failed_constraints?: string[];
  unknown_constraints?: string[];
  eligibility_reason?: string;
  preliminary_score?: number;
  score_breakdown?: Record<string, number>;
  ranking_reasons?: string[];
}

// ============================================================
// SOURCE HEALTH
// ============================================================

export interface SourceHealth {
  status: 'healthy' | 'degraded' | 'down' | 'unconfigured';
  last_checked: Date;
  error?: string;
  reset_time?: Date | null;
}

// ============================================================
// DISCOVERY PROVIDER INTERFACE (V2)
// ============================================================

export type DiscoveryCapability = 'web_discovery' | 'open_source' | 'launch_discovery' | 'background';

export type DiscoveryFailureSemantics = 
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'RATE_LIMITED'
  | 'DISABLED'
  | 'UNCONFIGURED'
  | 'TIMEOUT'
  | 'FAILED';

export interface RateLimitState {
  isRateLimited: boolean;
  resetTime: Date | null;
}

export interface DiscoveryProvider {
  id: string;
  name: string;
  capabilities: DiscoveryCapability[];
  rateLimitState: RateLimitState;

  isEnabled(): boolean;
  
  /** Generic batch discovery (background/cron use). */
  discover(): Promise<SearchResult[]>;

  /** Query-specific discovery for live search flow. */
  discoverForQuery(query: string, limit?: number): Promise<SearchResult[]>;

  healthCheck(): Promise<SourceHealth>;
}

// ============================================================
// DISCOVERY METRICS (observability)
// ============================================================

export interface DiscoveryMetrics {
  query: string;
  db_candidates: number;
  eligible_db_candidates: number;
  live_discovery: boolean;
  providers_attempted: string[];
  providers_succeeded: string[];
  providers_partial: string[];
  providers_rate_limited: string[];
  providers_disabled: string[];
  providers_unconfigured: string[];
  providers_failed: string[];
  providers_timed_out: string[];
  providers_cancelled: string[];
  search_results_received: number;
  tool_entities_extracted: number;
  discovered: number;
  deduplicated: number;
  official_sites_resolved: number;
  crawl_succeeded: number;
  crawl_failed: number;
  facts_extracted: number;
  evidence_created: number;
  verified: number;
  rejected: number;
  eligible: number;
  recommended: number;
  duration_ms: number;
  ttfu_ms?: number;
  ttfu_status?: 'MEASURED' | 'NOT_AVAILABLE';
  errors: string[];
}

export function createEmptyMetrics(query: string): DiscoveryMetrics {
  return {
    query,
    db_candidates: 0,
    eligible_db_candidates: 0,
    live_discovery: false,
    providers_attempted: [],
    providers_succeeded: [],
    providers_partial: [],
    providers_rate_limited: [],
    providers_disabled: [],
    providers_unconfigured: [],
    providers_failed: [],
    providers_timed_out: [],
    providers_cancelled: [],
    search_results_received: 0,
    tool_entities_extracted: 0,
    discovered: 0,
    deduplicated: 0,
    official_sites_resolved: 0,
    crawl_succeeded: 0,
    crawl_failed: 0,
    facts_extracted: 0,
    evidence_created: 0,
    verified: 0,
    rejected: 0,
    eligible: 0,
    recommended: 0,
    duration_ms: 0,
    errors: [],
  };
}

// ============================================================
// EXTRACTED TOOL DATA (structured output from fact extraction)
// ============================================================

export interface ExtractedPricingPlan {
  plan_name: string;
  price: number | null;
  billing_period: string;
  is_free: boolean;
  free_credits: number | null;
  credit_period: string | null;
  watermark: boolean | null;
  commercial_use: boolean | null;
  usage_limit: string | null;
  export_limitations: string | null;
  api_access: boolean | null;
}

export interface ExtractedFeature {
  name: string;
  value: string | null;
}

export interface ExtractedToolData {
  name: string;
  description: string;
  short_description: string | null;
  company_name: string | null;
  pricing_plans: ExtractedPricingPlan[];
  features: ExtractedFeature[];
  limitations: string[];
  confidence: number;
}

// ============================================================
// DISCOVERY RESULT (orchestrator output)
// ============================================================

export interface DiscoveredTool {
  /** The persisted tool ID (after insert into `tools` table). */
  tool_id: string;
  name: string;
  slug: string;
  url: string;
  domain: string;
  description: string;
  extracted_data: ExtractedToolData;
  evidence_ids: string[];
  source_id: string;
  verification_passed: boolean;
  confidence: number;
}

export type DiscoveryJobState =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'NO_MATCHES'
  | 'DISCOVERY_FAILED'
  | 'UNSUPPORTED_INTENT';

export interface DiscoveryResult {
  discovered_tools: DiscoveredTool[];
  metrics: DiscoveryMetrics;
  job_id: string | null;
  status: DiscoveryJobState;
  is_complete: boolean;
}
