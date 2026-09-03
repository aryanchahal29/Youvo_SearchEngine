-- YouVo: Core database schema
-- All tables per TDA specification §5-§17

-- ============================================================
-- TOOL CATEGORIES (dynamic, unlimited depth)
-- ============================================================
CREATE TABLE tool_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES tool_categories(id) ON DELETE SET NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_categories_parent ON tool_categories(parent_id);
CREATE INDEX idx_tool_categories_slug ON tool_categories(slug);

-- ============================================================
-- TOOLS (core entity)
-- ============================================================
CREATE TYPE tool_status AS ENUM (
  'discovered',
  'processing',
  'verified',
  'ranked',
  'recommended',
  'needs_review',
  'insufficient_data',
  'low_quality',
  'high_risk',
  'dead',
  'discontinued',
  'stale'
);

CREATE TYPE risk_level AS ENUM (
  'low',
  'moderate',
  'elevated',
  'insufficient_evidence'
);

CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  official_url TEXT,
  domain TEXT,
  description TEXT,
  short_description TEXT,
  company_name TEXT,
  developer TEXT,
  country TEXT,
  launch_date DATE,
  logo_url TEXT,
  status tool_status NOT NULL DEFAULT 'discovered',
  primary_category_id UUID REFERENCES tool_categories(id) ON DELETE SET NULL,
  risk_level risk_level NOT NULL DEFAULT 'insufficient_evidence',
  quality_score NUMERIC(5,2) DEFAULT 0,
  confidence_score NUMERIC(5,4) DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  search_vector tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tools_slug ON tools(slug);
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_tools_domain ON tools(domain);
CREATE INDEX idx_tools_primary_category ON tools(primary_category_id);
CREATE INDEX idx_tools_quality_score ON tools(quality_score DESC);
CREATE INDEX idx_tools_created_at ON tools(created_at DESC);
CREATE INDEX idx_tools_updated_at ON tools(updated_at DESC);

-- Full-text search index
CREATE INDEX idx_tools_search_vector ON tools USING GIN(search_vector);

-- Trigram indexes for fuzzy matching
CREATE INDEX idx_tools_name_trgm ON tools USING GIN(name gin_trgm_ops);
CREATE INDEX idx_tools_slug_trgm ON tools USING GIN(slug gin_trgm_ops);

-- Function to auto-update search_vector
CREATE OR REPLACE FUNCTION tools_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'D');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tools_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, short_description, description, company_name
  ON tools
  FOR EACH ROW
  EXECUTE FUNCTION tools_search_vector_update();

-- ============================================================
-- TOOL CATEGORY ASSIGNMENTS (many-to-many)
-- ============================================================
CREATE TABLE tool_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tool_categories(id) ON DELETE CASCADE,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tool_id, category_id)
);

CREATE INDEX idx_tca_tool ON tool_category_assignments(tool_id);
CREATE INDEX idx_tca_category ON tool_category_assignments(category_id);

-- ============================================================
-- TOOL FEATURES
-- ============================================================
CREATE TABLE tool_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  feature_value TEXT,
  normalized_value TEXT,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_features_tool ON tool_features(tool_id);
CREATE INDEX idx_tool_features_name ON tool_features(feature_name);

-- ============================================================
-- SOURCES (where information comes from)
-- ============================================================
CREATE TYPE source_type AS ENUM (
  'official',
  'documentation',
  'pricing',
  'directory',
  'reddit',
  'youtube',
  'github',
  'review',
  'news',
  'community',
  'search',
  'user_feedback'
);

CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type source_type NOT NULL,
  domain TEXT,
  url TEXT,
  title TEXT,
  publisher TEXT,
  trust_level INTEGER NOT NULL DEFAULT 5 CHECK (trust_level BETWEEN 1 AND 10),
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sources_type ON sources(source_type);
CREATE INDEX idx_sources_domain ON sources(domain);
CREATE INDEX idx_sources_url ON sources(url);
CREATE INDEX idx_sources_status ON sources(status);

-- ============================================================
-- PRICING PLANS
-- ============================================================
CREATE TYPE billing_period AS ENUM (
  'free',
  'monthly',
  'yearly',
  'one_time',
  'pay_as_you_go',
  'custom'
);

CREATE TABLE pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  billing_period billing_period NOT NULL DEFAULT 'free',
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  is_free BOOLEAN NOT NULL DEFAULT false,
  free_credits INTEGER,
  credit_period TEXT,
  trial_days INTEGER,
  watermark BOOLEAN,
  commercial_use BOOLEAN,
  usage_limit TEXT,
  export_limitations TEXT,
  hidden_restrictions TEXT,
  api_access BOOLEAN,
  team_limit INTEGER,
  raw_description TEXT,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  last_verified_at TIMESTAMPTZ,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_tool ON pricing_plans(tool_id);
CREATE INDEX idx_pricing_is_free ON pricing_plans(is_free);
CREATE INDEX idx_pricing_price ON pricing_plans(price);

-- ============================================================
-- EVIDENCE
-- ============================================================
CREATE TYPE claim_type AS ENUM (
  'pricing',
  'feature',
  'limit',
  'quality',
  'complaint',
  'review',
  'availability',
  'company',
  'security',
  'integration'
);

CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  claim TEXT NOT NULL,
  claim_type claim_type NOT NULL,
  evidence_text TEXT,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  hash TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_evidence_tool ON evidence(tool_id);
CREATE INDEX idx_evidence_source ON evidence(source_id);
CREATE INDEX idx_evidence_claim_type ON evidence(claim_type);
CREATE INDEX idx_evidence_confidence ON evidence(confidence DESC);
CREATE INDEX idx_evidence_collected_at ON evidence(collected_at DESC);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TYPE sentiment AS ENUM ('positive', 'neutral', 'negative', 'mixed');

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  rating NUMERIC(3,1),
  review_text TEXT,
  sentiment sentiment,
  sentiment_score NUMERIC(5,4),
  complaint_category TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_tool ON reviews(tool_id);
CREATE INDEX idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX idx_reviews_published ON reviews(published_at DESC);

-- ============================================================
-- TOOL SCORES (never overwrite — keep history)
-- ============================================================
CREATE TABLE tool_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_id UUID REFERENCES tool_categories(id) ON DELETE SET NULL,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  relevance_score NUMERIC(5,2) DEFAULT 0,
  value_score NUMERIC(5,2) DEFAULT 0,
  ease_score NUMERIC(5,2) DEFAULT 0,
  quality_score NUMERIC(5,2) DEFAULT 0,
  reputation_score NUMERIC(5,2) DEFAULT 0,
  freshness_score NUMERIC(5,2) DEFAULT 0,
  transparency_score NUMERIC(5,2) DEFAULT 0,
  risk_penalty NUMERIC(5,2) DEFAULT 0,
  confidence NUMERIC(5,4) DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ranking_version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tool_scores_tool ON tool_scores(tool_id);
CREATE INDEX idx_tool_scores_category ON tool_scores(category_id);
CREATE INDEX idx_tool_scores_overall ON tool_scores(overall_score DESC);
CREATE INDEX idx_tool_scores_calculated ON tool_scores(calculated_at DESC);
-- Composite index for latest score per tool
CREATE INDEX idx_tool_scores_tool_calculated ON tool_scores(tool_id, calculated_at DESC);

-- ============================================================
-- TOOL EMBEDDINGS (pgvector)
-- ============================================================
CREATE TABLE tool_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  embedding vector(768),
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-004',
  embedding_dimensions INTEGER NOT NULL DEFAULT 768,
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_embeddings_tool ON tool_embeddings(tool_id);
-- IVFFlat index for approximate nearest neighbor search
-- NOTE: This index requires at least some data to be present before creation.
-- For initial empty database, we'll create it after seeding.
-- CREATE INDEX idx_tool_embeddings_vector ON tool_embeddings 
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Use HNSW index instead (works on empty tables)
CREATE INDEX idx_tool_embeddings_vector ON tool_embeddings 
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- SEARCH QUERIES (analytics, privacy-conscious)
-- ============================================================
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_session_id TEXT,
  raw_query TEXT NOT NULL,
  corrected_query TEXT,
  intent TEXT,
  detected_category TEXT,
  constraints JSONB DEFAULT '{}'::jsonb,
  result_count INTEGER DEFAULT 0,
  had_live_discovery BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_queries_created ON search_queries(created_at DESC);
CREATE INDEX idx_search_queries_session ON search_queries(anonymous_session_id);

-- ============================================================
-- RECOMMENDATIONS
-- ============================================================
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query_id UUID REFERENCES search_queries(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score NUMERIC(5,2),
  confidence NUMERIC(5,4),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_query ON recommendations(search_query_id);
CREATE INDEX idx_recommendations_tool ON recommendations(tool_id);

-- ============================================================
-- AUTOMATION JOBS
-- ============================================================
CREATE TYPE job_type AS ENUM (
  'discover',
  'fetch',
  'extract',
  'verify',
  'reviews',
  'risk_analysis',
  'categorize',
  'score',
  'embed',
  'dead_link_check',
  'reindex'
);

CREATE TYPE job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status ON automation_jobs(status);
CREATE INDEX idx_jobs_type ON automation_jobs(job_type);
CREATE INDEX idx_jobs_priority ON automation_jobs(priority DESC);
CREATE INDEX idx_jobs_scheduled ON automation_jobs(scheduled_at);
CREATE INDEX idx_jobs_status_priority ON automation_jobs(status, priority DESC, scheduled_at);

-- ============================================================
-- TOOL CHANGES (change detection history)
-- ============================================================
CREATE TABLE tool_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC(5,4) DEFAULT 1.0
);

CREATE INDEX idx_tool_changes_tool ON tool_changes(tool_id);
CREATE INDEX idx_tool_changes_detected ON tool_changes(detected_at DESC);

-- ============================================================
-- AI PROVIDERS REGISTRY
-- ============================================================
CREATE TABLE ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5,
  model TEXT,
  embedding_model TEXT,
  task_types JSONB DEFAULT '[]'::jsonb,
  free_limit INTEGER,
  requests_used INTEGER NOT NULL DEFAULT 0,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  reset_time TIMESTAMPTZ,
  health_status TEXT NOT NULL DEFAULT 'healthy',
  last_health_check TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ADMIN AUDIT LOGS
-- ============================================================
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT
);

CREATE INDEX idx_audit_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_entity ON admin_audit_logs(entity, entity_id);
CREATE INDEX idx_audit_timestamp ON admin_audit_logs(timestamp DESC);

-- ============================================================
-- RANKING CONFIGURATION
-- ============================================================
CREATE TABLE ranking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES tool_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  weight_relevance NUMERIC(4,3) NOT NULL DEFAULT 0.30,
  weight_value NUMERIC(4,3) NOT NULL DEFAULT 0.20,
  weight_ease NUMERIC(4,3) NOT NULL DEFAULT 0.15,
  weight_capability NUMERIC(4,3) NOT NULL DEFAULT 0.15,
  weight_reputation NUMERIC(4,3) NOT NULL DEFAULT 0.10,
  weight_freshness NUMERIC(4,3) NOT NULL DEFAULT 0.05,
  weight_transparency NUMERIC(4,3) NOT NULL DEFAULT 0.05,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

-- ============================================================
-- CATEGORY WEIGHT OVERRIDES (per-category custom criteria)
-- ============================================================
CREATE TABLE category_weight_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES tool_categories(id) ON DELETE CASCADE,
  weight_name TEXT NOT NULL,
  weight_value NUMERIC(4,3) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, weight_name)
);

-- ============================================================
-- USER FEEDBACK
-- ============================================================
CREATE TYPE feedback_type AS ENUM (
  'incorrect_price',
  'wrong_free_limit',
  'outdated_info',
  'wrong_recommendation',
  'tool_dead',
  'bad_recommendation',
  'other'
);

CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  feedback_type feedback_type NOT NULL,
  description TEXT,
  anonymous_session_id TEXT,
  user_id UUID,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_tool ON user_feedback(tool_id);
CREATE INDEX idx_feedback_processed ON user_feedback(processed);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);

-- ============================================================
-- SEARCH CACHE
-- ============================================================
CREATE TABLE search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_query TEXT NOT NULL UNIQUE,
  intent TEXT,
  category TEXT,
  constraints JSONB,
  result_tool_ids UUID[] NOT NULL DEFAULT '{}',
  result_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  hit_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_search_cache_query ON search_cache(normalized_query);
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get latest score for a tool
CREATE OR REPLACE FUNCTION get_latest_tool_score(p_tool_id UUID)
RETURNS tool_scores AS $$
  SELECT * FROM tool_scores 
  WHERE tool_id = p_tool_id 
  ORDER BY calculated_at DESC 
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function to calculate fuzzy similarity
CREATE OR REPLACE FUNCTION fuzzy_search_tools(search_term TEXT, min_similarity REAL DEFAULT 0.3)
RETURNS TABLE(tool_id UUID, tool_name TEXT, similarity REAL) AS $$
  SELECT id, name, similarity(name, search_term) AS sim
  FROM tools
  WHERE status IN ('verified', 'ranked', 'recommended')
    AND similarity(name, search_term) > min_similarity
  ORDER BY sim DESC
  LIMIT 20;
$$ LANGUAGE sql STABLE;

-- Function for hybrid search combining FTS and fuzzy
CREATE OR REPLACE FUNCTION hybrid_search_tools(
  search_term TEXT,
  match_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  tool_id UUID,
  tool_name TEXT,
  tool_slug TEXT,
  fts_rank REAL,
  fuzzy_similarity REAL,
  combined_score REAL
) AS $$
  WITH fts_results AS (
    SELECT 
      id,
      name,
      slug,
      ts_rank(search_vector, websearch_to_tsquery('english', search_term)) AS rank
    FROM tools
    WHERE status IN ('verified', 'ranked', 'recommended')
      AND search_vector @@ websearch_to_tsquery('english', search_term)
  ),
  fuzzy_results AS (
    SELECT 
      id,
      name,
      slug,
      similarity(name, search_term) AS sim
    FROM tools
    WHERE status IN ('verified', 'ranked', 'recommended')
      AND similarity(name, search_term) > 0.2
  ),
  combined AS (
    SELECT 
      COALESCE(f.id, z.id) AS id,
      COALESCE(f.name, z.name) AS name,
      COALESCE(f.slug, z.slug) AS slug,
      COALESCE(f.rank, 0) AS fts_rank,
      COALESCE(z.sim, 0) AS fuzzy_sim,
      (COALESCE(f.rank, 0) * 0.6 + COALESCE(z.sim, 0) * 0.4) AS combined
    FROM fts_results f
    FULL OUTER JOIN fuzzy_results z ON f.id = z.id
  )
  SELECT id, name, slug, fts_rank, fuzzy_sim, combined
  FROM combined
  ORDER BY combined DESC
  LIMIT match_limit;
$$ LANGUAGE sql STABLE;

-- Function for semantic (vector) search
CREATE OR REPLACE FUNCTION semantic_search_tools(
  query_embedding vector(768),
  match_limit INTEGER DEFAULT 20,
  min_similarity REAL DEFAULT 0.5
)
RETURNS TABLE(
  tool_id UUID,
  tool_name TEXT,
  tool_slug TEXT,
  similarity REAL
) AS $$
  SELECT 
    t.id,
    t.name,
    t.slug,
    1 - (te.embedding <=> query_embedding) AS similarity
  FROM tool_embeddings te
  JOIN tools t ON t.id = te.tool_id
  WHERE t.status IN ('verified', 'ranked', 'recommended')
    AND 1 - (te.embedding <=> query_embedding) > min_similarity
  ORDER BY te.embedding <=> query_embedding
  LIMIT match_limit;
$$ LANGUAGE sql STABLE;
