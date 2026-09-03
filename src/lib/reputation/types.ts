import { ClaimState } from '../supabase/types';
import type { CandidateTool } from '../discovery/types';

export type VerificationLevel = 'UNVERIFIED' | 'PARTIALLY_VERIFIED' | 'VERIFIED' | 'VERIFICATION_FAILED';
export type FinalCandidateState = 'ELIGIBLE' | 'FINAL_INELIGIBLE';
export type SourceType = 'FIRST_PARTY' | 'SECONDARY' | 'OFFICIAL_DOCS' | 'OFFICIAL_PRICING' | 'OFFICIAL_PRODUCT_PAGE' | 'SEARCH_RESULT' | 'OTHER';

export interface RequiredClaim {
  claim_type: string;
  description: string;
  importance: 'REQUIRED' | 'IMPORTANT' | 'OPTIONAL';
}

export interface VerificationChecklist {
  required_claims: RequiredClaim[];
  optional_claims: RequiredClaim[];
}

export interface ClaimEvidence {
  source_url: string;
  source_type: SourceType;
  source_title?: string;
  observed_value: any;
  confidence: number;
  retrieved_at: string;
  verified_at?: string;
  verification_run_id?: string;
}

export interface VerifiedClaim {
  claim_type: string;
  claim_value: any;
  claim_state: ClaimState;
  evidence: ClaimEvidence[];
}

export interface FinalExplainability {
  why_ranked_high?: string;
  matched_requirements: string[];
  verified_requirements: string[];
  unknown_requirements: string[];
  conflicted_requirements: string[];
  failed_requirements: string[];
  penalties: string[];
  score_breakdown: Record<string, number>;
  evidence_summary: string;
  why_match: string;
}

export interface VerifiedCandidateTool extends CandidateTool {
  verification_level: VerificationLevel;
  final_eligibility?: FinalCandidateState;
  verified_claims: VerifiedClaim[];
  final_score?: number;
  explainability?: FinalExplainability;
  verification_run_id?: string;
}
