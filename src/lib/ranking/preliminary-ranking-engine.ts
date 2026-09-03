import { CandidateTool } from '../discovery/types';
import { ProcessedQuery } from '../search/query-processor';
import { RankingWeights, DEFAULT_PRELIMINARY_WEIGHTS } from './types';

export class PreliminaryRankingEngine {
  /**
   * Computes a lightweight preliminary score for candidates prior to deep verification.
   * Modifies the candidate in place, adding `preliminary_score`, `score_breakdown`, and `ranking_reasons`.
   * Candidates marked as INELIGIBLE receive a score of 0 or negative.
   */
  static rankCandidates(
    candidates: CandidateTool[],
    query: ProcessedQuery,
    weights: RankingWeights = DEFAULT_PRELIMINARY_WEIGHTS
  ): CandidateTool[] {
    const ranked = candidates.map(candidate => this.scoreCandidate(candidate, query, weights));
    
    // Sort descending by preliminary score
    return ranked.sort((a, b) => (b.preliminary_score || 0) - (a.preliminary_score || 0));
  }

  private static scoreCandidate(
    candidate: CandidateTool,
    query: ProcessedQuery,
    weights: RankingWeights
  ): CandidateTool {
    const reasons: string[] = [];
    const breakdown: Record<string, number> = {};

    // 1. Eligibility Check
    if (candidate.eligibility_status === 'INELIGIBLE') {
      candidate.preliminary_score = -100;
      candidate.score_breakdown = { penalty: -100 };
      candidate.ranking_reasons = ['Eliminated: Failed hard constraints'];
      return candidate;
    }

    // 2. Consensus Score
    const consensusRatio = candidate.consensus_ratio || 0;
    const consensusScore = consensusRatio * 100 * weights.consensus_weight;
    breakdown.consensus = consensusScore;
    if (consensusRatio > 0.5) reasons.push('Strong provider consensus');

    // 3. Metadata Quality Score
    let qualityScore = 0;
    if (candidate.description && candidate.description.length > 20) qualityScore += 50;
    if (candidate.metadata?.capabilities && Array.isArray(candidate.metadata.capabilities)) qualityScore += 50;
    const finalQualityScore = qualityScore * weights.quality_weight;
    breakdown.quality = finalQualityScore;

    // 4. Soft Constraint / Priority Match Score
    let constraintScore = 0;
    const matchedCount = (candidate.matched_constraints || []).length;
    // Hard constraints that matched are rewarded
    constraintScore += matchedCount * 20;

    // TODO: Incorporate query.priorities if possible
    if (query.priorities && query.priorities.length > 0) {
      // Just a baseline reward if we know constraints matched
      if (matchedCount > 0) constraintScore += 10;
    }

    // Cap constraint score at 100 before weighting
    constraintScore = Math.min(constraintScore, 100);
    let finalConstraintScore = constraintScore * weights.constraint_weight;

    const unknownCount = (candidate.unknown_constraints || []).length;
    const enableUnknownConstraintPenalty = query.quality_policy?.enableUnknownConstraintPenalty ?? true;
    if (enableUnknownConstraintPenalty && unknownCount > 0 && weights.unknown_constraint_penalty) {
      const penalty = unknownCount * weights.unknown_constraint_penalty;
      finalConstraintScore -= penalty;
      reasons.push(`Penalized -${penalty} points for ${unknownCount} unknown constraint(s)`);
    } else if (unknownCount > 0) {
      reasons.push('Some constraints are unknown (pending verification)');
    }

    if (matchedCount > 0) reasons.push(`Matched ${matchedCount} constraints`);

    breakdown.constraints = finalConstraintScore;

    // 5. Relevance (basic proxy from LLM why_match or capability overlap)
    let relevanceScore = 50; // Baseline
    const whyMatch = candidate.metadata?.why_match as string | undefined;
    if (whyMatch && whyMatch.length > 10) relevanceScore += 30; // LLM explicitly stated why it matches
    const finalRelevanceScore = relevanceScore * weights.relevance_weight;
    breakdown.relevance = finalRelevanceScore;

    // Total Score
    let totalScore = finalQualityScore + finalConstraintScore + finalRelevanceScore + consensusScore;
    
    // Normalize to 0-100 roughly
    totalScore = Math.min(Math.max(totalScore, 0), 100);

    candidate.preliminary_score = Math.round(totalScore * 10) / 10;
    candidate.score_breakdown = {
      consensus: Math.round(breakdown.consensus * 10) / 10,
      quality: Math.round(breakdown.quality * 10) / 10,
      constraints: Math.round(breakdown.constraints * 10) / 10,
      relevance: Math.round(breakdown.relevance * 10) / 10,
    };
    candidate.ranking_reasons = reasons;

    return candidate;
  }
}
