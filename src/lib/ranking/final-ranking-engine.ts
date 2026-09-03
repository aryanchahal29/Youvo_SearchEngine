// YouVo: Final Ranking Engine (Phase 4)

import { getAIRouter } from '../providers/router';
import type { ProcessedQuery, QueryConstraints } from '../search/query-processor';
import type { VerifiedCandidateTool, FinalCandidateState, FinalExplainability } from '../reputation/types';
import type { ToolWithDetails } from '../supabase/types';

export interface FinalRankedTool extends VerifiedCandidateTool {
  rank: number;
}

export interface FinalRankingResult {
  best_match: FinalRankedTool | null;
  alternatives: FinalRankedTool[];
  explanation: string | null;
}

import { DEFAULT_FINAL_WEIGHTS } from './types';
export class FinalRankingEngine {
  /**
   * Re-evaluates hard constraints based on verified claims to determine final eligibility.
   */
  private static reEvaluateEligibility(tool: VerifiedCandidateTool, query: ProcessedQuery): FinalCandidateState {
    // If a required constraint is explicitly CONTRADICTED, it's INELIGIBLE.
    for (const claim of tool.verified_claims) {
      if (claim.claim_state === 'CONTRADICTED') {
        const isRequired = claim.claim_type.startsWith('supports_') || 
                           claim.claim_type.startsWith('capability_') ||
                           claim.claim_type === 'has_free_plan';
        if (isRequired) return 'FINAL_INELIGIBLE';
      }
    }
    return 'ELIGIBLE';
  }

  /**
   * Calculates the final score and explainability fields.
   */
  private static scoreTool(tool: VerifiedCandidateTool, query: ProcessedQuery): VerifiedCandidateTool {
    const verified = tool.verified_claims.filter(c => c.claim_state === 'VERIFIED');
    const contradicted = tool.verified_claims.filter(c => c.claim_state === 'CONTRADICTED');
    const unknown = tool.verified_claims.filter(c => c.claim_state === 'UNKNOWN');
    const conflicted = tool.verified_claims.filter(c => c.claim_state === 'CONFLICTED');

    let relevance = 50;
    let constraint_match = 0;
    let capability_match = 0;
    let verification_quality = 0;
    let consensus = (tool.consensus_ratio || 0) * 100;
    let freshness = 80;
    let evidence_quality = 0;
    const penalties = [];

    // Constraint Match Score
    const totalRequired = tool.verified_claims.length;
    if (totalRequired > 0) {
      constraint_match = (verified.length / totalRequired) * 100;
      verification_quality = ((verified.length + contradicted.length) / totalRequired) * 100;
    }

    // Evidence Quality
    let totalConfidence = 0;
    let evidenceCount = 0;
    for (const claim of verified) {
      if (claim.evidence.length > 0) {
        totalConfidence += claim.evidence[0].confidence;
        evidenceCount++;
      }
    }
    if (evidenceCount > 0) {
      evidence_quality = (totalConfidence / evidenceCount) * 100;
    }

    // Penalties
    let uncertaintyPenalty = 0;
    if (unknown.length > 0) {
      uncertaintyPenalty = unknown.length * 5;
      penalties.push(`Missing evidence for ${unknown.length} claims`);
    }
    if (conflicted.length > 0) {
      uncertaintyPenalty += conflicted.length * 10;
      penalties.push(`Conflicting evidence for ${conflicted.length} claims`);
    }

    const w = DEFAULT_FINAL_WEIGHTS; // Use imported ones, or passed in if modified
    let final_score = (
      (relevance * w.relevance_weight) +
      (constraint_match * w.constraint_weight) +
      (capability_match * w.capability_weight) +
      (verification_quality * w.verification_quality_weight) +
      (consensus * w.consensus_weight) +
      (freshness * w.freshness_weight) +
      (evidence_quality * w.evidence_quality_weight)
    ) - uncertaintyPenalty;

    final_score = Math.max(0, Math.min(100, final_score));

    // Explainability
    const matched_requirements = verified.map(c => c.claim_type);
    const failed_requirements = contradicted.map(c => c.claim_type);
    const unknown_requirements = unknown.map(c => c.claim_type);
    const conflicted_requirements = conflicted.map(c => c.claim_type);

    let why_match = `Verified match for ${matched_requirements.length} requirements.`;
    if (failed_requirements.length > 0) why_match += ` Fails on ${failed_requirements.join(', ')}.`;
    if (conflicted_requirements.length > 0) why_match += ` Evidence conflicted on ${conflicted_requirements.join(', ')}.`;

    const explainability: FinalExplainability = {
      matched_requirements,
      verified_requirements: matched_requirements,
      unknown_requirements,
      conflicted_requirements,
      failed_requirements,
      penalties,
      score_breakdown: {
        relevance,
        constraint_match,
        capability_match,
        verification_quality,
        consensus,
        freshness,
        evidence_quality,
        uncertaintyPenalty
      },
      evidence_summary: `Based on ${evidenceCount} verified claims.`,
      why_match
    };

    return {
      ...tool,
      final_score: Math.round(final_score * 100) / 100,
      explainability
    };
  }

  static async rankTools(tools: (VerifiedCandidateTool | ToolWithDetails)[], query: ProcessedQuery): Promise<FinalRankingResult> {
    if (tools.length === 0) {
      return { best_match: null, alternatives: [], explanation: 'No verified tools found.' };
    }

    const verifiedTools: VerifiedCandidateTool[] = tools.map((t: any) => {
       if (t.verified_claims) return t as VerifiedCandidateTool; // already verified
       // Convert ToolWithDetails to a pseudo VerifiedCandidateTool
       return {
         ...t,
         url: t.official_url || '',
         verification_level: 'VERIFIED',
         verified_claims: [] // We don't have the claims mapped yet for DB tools
       };
    });

    const reEvaluated = verifiedTools.map(t => ({
      ...t,
      final_eligibility: this.reEvaluateEligibility(t, query)
    }));

    const eligible = reEvaluated.filter(t => t.final_eligibility === 'ELIGIBLE');
    
    if (eligible.length === 0) {
      return { best_match: null, alternatives: [], explanation: 'Tools were found but none remained eligible after verification.' };
    }

    const scored = eligible.map(t => this.scoreTool(t, query));
    
    scored.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    const ranked: FinalRankedTool[] = scored.map((tool, index) => ({
      ...tool,
      rank: index + 1
    }));

    const bestMatch = ranked[0] || null;
    const alternatives = ranked.slice(1, 4);
    
    if (bestMatch && bestMatch.explainability) {
       bestMatch.explainability.why_ranked_high = `${bestMatch.name} achieved the highest verification score (${bestMatch.final_score}) because ${bestMatch.explainability.why_match}`;
    }

    return {
      best_match: bestMatch,
      alternatives,
      explanation: bestMatch?.explainability?.why_ranked_high || null
    };
  }
}
