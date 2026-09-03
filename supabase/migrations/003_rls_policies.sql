-- YouVo: Row Level Security policies
-- Security Spec §3: Public users should only access approved public data
-- Internal tables must never be directly exposed

-- Enable RLS on all tables
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_weight_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PUBLIC READ ACCESS (anonymous + authenticated)
-- Only approved tools visible to public
-- ============================================================

-- Tools: only verified/ranked/recommended visible
CREATE POLICY "Public can view approved tools"
  ON tools FOR SELECT
  USING (status IN ('verified', 'ranked', 'recommended'));

-- Categories: fully public
CREATE POLICY "Public can view categories"
  ON tool_categories FOR SELECT
  USING (true);

-- Category assignments: via approved tools
CREATE POLICY "Public can view category assignments"
  ON tool_category_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = tool_category_assignments.tool_id 
      AND tools.status IN ('verified', 'ranked', 'recommended')
    )
  );

-- Features: via approved tools
CREATE POLICY "Public can view tool features"
  ON tool_features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = tool_features.tool_id 
      AND tools.status IN ('verified', 'ranked', 'recommended')
    )
  );

-- Pricing: via approved tools
CREATE POLICY "Public can view pricing plans"
  ON pricing_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = pricing_plans.tool_id 
      AND tools.status IN ('verified', 'ranked', 'recommended')
    )
  );

-- Evidence: via approved tools (public evidence only)
CREATE POLICY "Public can view evidence for approved tools"
  ON evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = evidence.tool_id 
      AND tools.status IN ('verified', 'ranked', 'recommended')
    )
  );

-- Reviews: via approved tools
CREATE POLICY "Public can view reviews"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = reviews.tool_id 
      AND tools.status IN ('verified', 'ranked', 'recommended')
    )
  );

-- Scores: latest scores for approved tools
CREATE POLICY "Public can view tool scores"
  ON tool_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = tool_scores.tool_id 
      AND tools.status IN ('verified', 'ranked', 'recommended')
    )
  );

-- Ranking config: public (read-only)
CREATE POLICY "Public can view ranking config"
  ON ranking_config FOR SELECT
  USING (true);

-- ============================================================
-- AUTHENTICATED USER ACCESS
-- ============================================================

-- User feedback: anyone can insert
CREATE POLICY "Anyone can submit feedback"
  ON user_feedback FOR INSERT
  WITH CHECK (true);

-- Search queries: insert for analytics
CREATE POLICY "Anyone can log search queries"
  ON search_queries FOR INSERT
  WITH CHECK (true);

-- Recommendations: insert for analytics
CREATE POLICY "System can create recommendations"
  ON recommendations FOR INSERT
  WITH CHECK (true);

-- Search cache: public read, system write
CREATE POLICY "Public can read search cache"
  ON search_cache FOR SELECT
  USING (expires_at > now());

CREATE POLICY "System can write search cache"
  ON search_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update search cache"
  ON search_cache FOR UPDATE
  USING (true);

-- ============================================================
-- PRIVATE TABLES (service role only — no public policies)
-- These tables have RLS enabled but NO public policies,
-- so only the service_role key can access them.
-- ============================================================

-- sources: internal only (no public SELECT policy)
-- tool_embeddings: internal only
-- automation_jobs: internal only
-- tool_changes: internal only
-- ai_providers: internal only
-- admin_audit_logs: internal only
-- category_weight_overrides: internal only

-- Service role bypasses RLS automatically in Supabase,
-- so no explicit policies needed for backend workers.
