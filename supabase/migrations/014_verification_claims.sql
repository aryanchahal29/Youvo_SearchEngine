-- Migration 014: Claim Evidence

-- The state of the final resolved claim
CREATE TYPE claim_state AS ENUM ('VERIFIED', 'CONTRADICTED', 'UNKNOWN', 'CONFLICTED');

-- Represents a specific claim for a tool (e.g., "has_free_plan", "supports_windows")
CREATE TABLE tool_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  claim_type TEXT NOT NULL, 
  claim_value JSONB, 
  claim_state claim_state NOT NULL DEFAULT 'UNKNOWN',
  verification_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tool_id, claim_type)
);

-- Extend existing evidence table to act as the child records
ALTER TABLE evidence 
  ADD COLUMN tool_claim_id UUID REFERENCES tool_claims(id) ON DELETE CASCADE,
  ADD COLUMN observed_value JSONB,
  ADD COLUMN verification_run_id TEXT;
