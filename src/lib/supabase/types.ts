// YouVo: Database TypeScript types
// Generated from the database schema in 002_core_schema.sql
// Provides full type safety for all Supabase operations

// ============================================================
// ENUMS
// ============================================================

export type ToolStatus =
  | 'discovered'
  | 'processing'
  | 'verified'
  | 'ranked'
  | 'recommended'
  | 'needs_review'
  | 'insufficient_data'
  | 'low_quality'
  | 'high_risk'
  | 'dead'
  | 'discontinued'
  | 'stale';

export type RiskLevel =
  | 'low'
  | 'moderate'
  | 'elevated'
  | 'insufficient_evidence';

export type SourceType =
  | 'official'
  | 'documentation'
  | 'pricing'
  | 'directory'
  | 'reddit'
  | 'youtube'
  | 'github'
  | 'review'
  | 'news'
  | 'community'
  | 'search'
  | 'user_feedback';

export type BillingPeriod =
  | 'free'
  | 'monthly'
  | 'yearly'
  | 'one_time'
  | 'pay_as_you_go'
  | 'custom';

export type ClaimType =
  | 'pricing'
  | 'feature'
  | 'limit'
  | 'quality'
  | 'complaint'
  | 'review'
  | 'availability'
  | 'company'
  | 'security'
  | 'integration';

export type ClaimState = 'VERIFIED' | 'CONTRADICTED' | 'UNKNOWN' | 'CONFLICTED';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export type JobType =
  | 'discover'
  | 'fetch'
  | 'extract'
  | 'verify'
  | 'reviews'
  | 'risk_analysis'
  | 'categorize'
  | 'score'
  | 'embed'
  | 'dead_link_check'
  | 'reindex';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type FeedbackType =
  | 'incorrect_price'
  | 'wrong_free_limit'
  | 'outdated_info'
  | 'wrong_recommendation'
  | 'tool_dead'
  | 'bad_recommendation'
  | 'other';

// ============================================================
// TABLE TYPES
// ============================================================

export interface Tool {
  id: string;
  name: string;
  slug: string;
  official_url: string | null;
  domain: string | null;
  description: string | null;
  short_description: string | null;
  company_name: string | null;
  developer: string | null;
  country: string | null;
  launch_date: string | null;
  logo_url: string | null;
  status: ToolStatus;
  primary_category_id: string | null;
  risk_level: RiskLevel;
  quality_score: number;
  confidence_score: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
  last_seen_at: string | null;
}

export interface ToolCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCategoryAssignment {
  id: string;
  tool_id: string;
  category_id: string;
  confidence: number;
  source: string | null;
  created_at: string;
}

export interface ToolFeature {
  id: string;
  tool_id: string;
  feature_name: string;
  feature_value: string | null;
  normalized_value: string | null;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  source_type: SourceType;
  domain: string | null;
  url: string | null;
  title: string | null;
  publisher: string | null;
  trust_level: number;
  published_at: string | null;
  discovered_at: string;
  last_checked_at: string | null;
  content_hash: string | null;
  status: string;
  metadata: Record<string, unknown>;
}

export interface PricingPlan {
  id: string;
  tool_id: string;
  plan_name: string;
  billing_period: BillingPeriod;
  price: number | null;
  currency: string;
  is_free: boolean;
  free_credits: number | null;
  credit_period: string | null;
  trial_days: number | null;
  watermark: boolean | null;
  commercial_use: boolean | null;
  usage_limit: string | null;
  export_limitations: string | null;
  hidden_restrictions: string | null;
  api_access: boolean | null;
  team_limit: number | null;
  raw_description: string | null;
  confidence: number;
  last_verified_at: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolClaim {
  id: string;
  tool_id: string;
  claim_type: string;
  claim_value: Record<string, unknown> | null;
  claim_state: ClaimState;
  verification_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  tool_id: string;
  source_id: string | null;
  claim: string;
  claim_type: ClaimType;
  evidence_text: string | null;
  confidence: number;
  published_at: string | null;
  collected_at: string;
  valid_until: string | null;
  hash: string | null;
  is_verified: boolean;
  metadata: Record<string, unknown>;
  tool_claim_id: string | null;
  observed_value: Record<string, unknown> | null;
  verification_run_id: string | null;
}

export interface Review {
  id: string;
  tool_id: string;
  source_id: string | null;
  rating: number | null;
  review_text: string | null;
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  complaint_category: string | null;
  author: string | null;
  published_at: string | null;
  collected_at: string;
}

export interface ToolScore {
  id: string;
  tool_id: string;
  category_id: string | null;
  overall_score: number;
  relevance_score: number;
  value_score: number;
  ease_score: number;
  quality_score: number;
  reputation_score: number;
  freshness_score: number;
  transparency_score: number;
  risk_penalty: number;
  confidence: number;
  calculated_at: string;
  ranking_version: number;
  metadata: Record<string, unknown>;
}

export interface ToolEmbedding {
  id: string;
  tool_id: string;
  embedding: number[];
  embedding_model: string;
  embedding_dimensions: number;
  content_hash: string | null;
  created_at: string;
}

export interface SearchQuery {
  id: string;
  anonymous_session_id: string | null;
  raw_query: string;
  corrected_query: string | null;
  intent: string | null;
  detected_category: string | null;
  constraints: Record<string, unknown>;
  result_count: number;
  had_live_discovery: boolean;
  created_at: string;
}

export interface Recommendation {
  id: string;
  search_query_id: string | null;
  tool_id: string;
  rank: number;
  score: number | null;
  confidence: number | null;
  reason: string | null;
  created_at: string;
}

export interface AutomationJob {
  id: string;
  job_type: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  attempt_count: number;
  max_attempts: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  next_retry_at?: string;
  error?: string;
  created_at: string;
  locked_by?: string;
  lease_expires_at?: string;
  heartbeat_at?: string;
  idempotency_key?: string;
}

export interface ToolChange {
  id: string;
  tool_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  source_id: string | null;
  detected_at: string;
  confidence: number;
}

export interface AIProvider {
  id: string;
  provider_name: string;
  display_name: string;
  enabled: boolean;
  priority: number;
  model: string | null;
  embedding_model: string | null;
  task_types: string[];
  free_limit: number | null;
  requests_used: number;
  tokens_used: number;
  reset_time: string | null;
  health_status: string;
  last_health_check: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  timestamp: string;
  reason: string | null;
  ip_hash: string | null;
}

export interface RankingConfig {
  id: string;
  category_id: string | null;
  name: string;
  weight_relevance: number;
  weight_value: number;
  weight_ease: number;
  weight_capability: number;
  weight_reputation: number;
  weight_freshness: number;
  weight_transparency: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserFeedback {
  id: string;
  tool_id: string | null;
  feedback_type: FeedbackType;
  description: string | null;
  anonymous_session_id: string | null;
  user_id: string | null;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

export interface SearchCache {
  id: string;
  normalized_query: string;
  intent: string | null;
  category: string | null;
  constraints: Record<string, unknown> | null;
  result_tool_ids: string[];
  result_data: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  hit_count: number;
  cache_state: 'SUCCESS_RESULT' | 'NEGATIVE_RESULT' | 'DISCOVERY_IN_PROGRESS' | 'PROVIDER_FAILURE';
}

// ============================================================
// SUPABASE DATABASE TYPE (for createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      tools: {
        Row: Tool;
        Insert: Partial<Tool> & Pick<Tool, 'name' | 'slug'>;
        Update: Partial<Tool>;
      };
      tool_categories: {
        Row: ToolCategory;
        Insert: Partial<ToolCategory> & Pick<ToolCategory, 'name' | 'slug'>;
        Update: Partial<ToolCategory>;
      };
      tool_category_assignments: {
        Row: ToolCategoryAssignment;
        Insert: Partial<ToolCategoryAssignment> & Pick<ToolCategoryAssignment, 'tool_id' | 'category_id'>;
        Update: Partial<ToolCategoryAssignment>;
      };
      tool_features: {
        Row: ToolFeature;
        Insert: Partial<ToolFeature> & Pick<ToolFeature, 'tool_id' | 'feature_name'>;
        Update: Partial<ToolFeature>;
      };
      sources: {
        Row: Source;
        Insert: Partial<Source> & Pick<Source, 'source_type'>;
        Update: Partial<Source>;
      };
      pricing_plans: {
        Row: PricingPlan;
        Insert: Partial<PricingPlan> & Pick<PricingPlan, 'tool_id' | 'plan_name'>;
        Update: Partial<PricingPlan>;
      };
      evidence: {
        Row: Evidence;
        Insert: Partial<Evidence> & Pick<Evidence, 'tool_id' | 'claim' | 'claim_type'>;
        Update: Partial<Evidence>;
      };
      tool_claims: {
        Row: ToolClaim;
        Insert: Partial<ToolClaim> & Pick<ToolClaim, 'tool_id' | 'claim_type'>;
        Update: Partial<ToolClaim>;
      };
      reviews: {
        Row: Review;
        Insert: Partial<Review> & Pick<Review, 'tool_id'>;
        Update: Partial<Review>;
      };
      tool_scores: {
        Row: ToolScore;
        Insert: Partial<ToolScore> & Pick<ToolScore, 'tool_id'>;
        Update: Partial<ToolScore>;
      };
      tool_embeddings: {
        Row: ToolEmbedding;
        Insert: Partial<ToolEmbedding> & Pick<ToolEmbedding, 'tool_id'>;
        Update: Partial<ToolEmbedding>;
      };
      search_queries: {
        Row: SearchQuery;
        Insert: Partial<SearchQuery> & Pick<SearchQuery, 'raw_query'>;
        Update: Partial<SearchQuery>;
      };
      recommendations: {
        Row: Recommendation;
        Insert: Partial<Recommendation> & Pick<Recommendation, 'tool_id' | 'rank'>;
        Update: Partial<Recommendation>;
      };
      automation_jobs: {
        Row: AutomationJob;
        Insert: Partial<AutomationJob> & Pick<AutomationJob, 'job_type'>;
        Update: Partial<AutomationJob>;
      };
      tool_changes: {
        Row: ToolChange;
        Insert: Partial<ToolChange> & Pick<ToolChange, 'tool_id' | 'field_name'>;
        Update: Partial<ToolChange>;
      };
      ai_providers: {
        Row: AIProvider;
        Insert: Partial<AIProvider> & Pick<AIProvider, 'provider_name' | 'display_name'>;
        Update: Partial<AIProvider>;
      };
      admin_audit_logs: {
        Row: AdminAuditLog;
        Insert: Partial<AdminAuditLog> & Pick<AdminAuditLog, 'admin_id' | 'action' | 'entity'>;
        Update: Partial<AdminAuditLog>;
      };
      ranking_config: {
        Row: RankingConfig;
        Insert: Partial<RankingConfig>;
        Update: Partial<RankingConfig>;
      };
      category_weight_overrides: {
        Row: { id: string; category_id: string; weight_name: string; weight_value: number; description: string | null; created_at: string };
        Insert: { category_id: string; weight_name: string; weight_value: number; description?: string };
        Update: Partial<{ weight_value: number; description: string }>;
      };
      user_feedback: {
        Row: UserFeedback;
        Insert: Partial<UserFeedback> & Pick<UserFeedback, 'feedback_type'>;
        Update: Partial<UserFeedback>;
      };
      search_cache: {
        Row: SearchCache;
        Insert: Partial<SearchCache> & Pick<SearchCache, 'normalized_query'>;
        Update: Partial<SearchCache>;
      };
    };
    Functions: {
      fuzzy_search_tools: {
        Args: { search_term: string; min_similarity?: number };
        Returns: { tool_id: string; tool_name: string; similarity: number }[];
      };
      hybrid_search_tools: {
        Args: { search_term: string; match_limit?: number };
        Returns: { tool_id: string; tool_name: string; tool_slug: string; fts_rank: number; fuzzy_similarity: number; combined_score: number }[];
      };
      semantic_search_tools: {
        Args: { query_embedding: number[]; match_limit?: number; min_similarity?: number };
        Returns: { tool_id: string; tool_name: string; tool_slug: string; similarity: number }[];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ============================================================
// COMPOSITE / VIEW TYPES (for API responses)
// ============================================================

export interface ToolWithDetails extends Tool {
  categories: ToolCategory[];
  pricing_plans: PricingPlan[];
  latest_score: ToolScore | null;
  features: ToolFeature[];
  evidence_count: number;
  primary_category: ToolCategory | null;
  matched_constraints?: string[];
}

export interface SearchResult {
  query: {
    raw: string;
    corrected: string | null;
    intent: string | null;
    category: string | null;
    constraints: Record<string, unknown>;
  };
  results: ToolWithDetails[];
  recommendation: {
    best_match: ToolWithDetails | null;
    alternatives: ToolWithDetails[];
    explanation: string | null;
  };
  confidence: number;
  source: 'cache' | 'database' | 'live_discovery';
  processing_time_ms: number;
  is_discovering?: boolean;
  discovery_job_id?: string | null;
  discovery_metrics?: any;
  cache_state?: string;
}

export interface ComparisonResult {
  tools: ToolWithDetails[];
  features: {
    feature_name: string;
    values: Record<string, string | boolean | null>;
  }[];
  recommendation: {
    best_for_requirements: string | null;
    explanation: string | null;
  };
}

export interface CategoryTree extends ToolCategory {
  children: CategoryTree[];
  tool_count: number;
}
