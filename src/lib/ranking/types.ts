export type ConstraintEvaluation = 'MATCH' | 'NO_MATCH' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface RankingWeights {
  relevance_weight: number;
  constraint_weight: number;
  skill_weight: number;
  capability_weight: number;
  consensus_weight: number;
  quality_weight: number;
  unknown_constraint_penalty: number;
}

export const DEFAULT_PRELIMINARY_WEIGHTS: RankingWeights = {
  relevance_weight: 0.20,
  constraint_weight: 0.25,
  skill_weight: 0.10,
  capability_weight: 0.15,
  consensus_weight: 0.15,
  quality_weight: 0.15,
  unknown_constraint_penalty: 10,
};

export interface FinalRankingWeights extends RankingWeights {
  verification_quality_weight: number;
  evidence_quality_weight: number;
  freshness_weight: number;
}

export const DEFAULT_FINAL_WEIGHTS: FinalRankingWeights = {
  relevance_weight: 0.10,
  constraint_weight: 0.30,
  skill_weight: 0.05,
  capability_weight: 0.15,
  consensus_weight: 0.10,
  quality_weight: 0.05,
  verification_quality_weight: 0.15,
  evidence_quality_weight: 0.05,
  freshness_weight: 0.05,
  unknown_constraint_penalty: 10
};
