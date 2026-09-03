import { ClaimState } from '../supabase/types';
import type { ClaimEvidence, VerifiedClaim } from './types';

export class ClaimVerifier {
  /**
   * Resolves a set of evidence into a final VerifiedClaim state.
   */
  static verifyClaim(claim_type: string, evidence: ClaimEvidence[]): VerifiedClaim {
    if (!evidence || evidence.length === 0) {
      return {
        claim_type,
        claim_value: null,
        claim_state: 'UNKNOWN',
        evidence: []
      };
    }

    // Sort evidence by freshness/confidence and priority (FIRST_PARTY > SECONDARY)
    const sorted = [...evidence].sort((a, b) => {
      // 1. Priority to FIRST_PARTY
      if (a.source_type === 'FIRST_PARTY' && b.source_type !== 'FIRST_PARTY') return -1;
      if (b.source_type === 'FIRST_PARTY' && a.source_type !== 'FIRST_PARTY') return 1;
      
      // 2. Priority to higher confidence
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      
      // 3. Priority to freshness
      return new Date(b.retrieved_at).getTime() - new Date(a.retrieved_at).getTime();
    });

    const primaryEvidence = sorted[0];
    
    // Check for conflicts among high-confidence evidence
    let hasConflict = false;
    for (const ev of sorted) {
      if (ev.confidence > 0.5) { // Only consider decent confidence evidence for conflicts
        if (JSON.stringify(ev.observed_value) !== JSON.stringify(primaryEvidence.observed_value)) {
          // If a secondary source disagrees with a very strong first-party source, 
          // we might not call it conflicted if the primary is > 0.9 confidence and fresh.
          if (primaryEvidence.source_type === 'FIRST_PARTY' && primaryEvidence.confidence > 0.9) {
            // Trust the primary entirely
            continue;
          }
          hasConflict = true;
          break;
        }
      }
    }

    if (hasConflict) {
      return {
        claim_type,
        claim_value: primaryEvidence.observed_value, // We can preserve the primary value but mark it conflicted
        claim_state: 'CONFLICTED',
        evidence: sorted
      };
    }

    // If it's a boolean constraint and value is false, it's CONTRADICTED
    // For non-boolean constraints, if the observed value is null/empty and confidence is high, it could mean it doesn't exist.
    // We treat "verified as false" as CONTRADICTED for boolean claims.
    let state: ClaimState = 'VERIFIED';
    
    if (primaryEvidence.observed_value === false || primaryEvidence.observed_value === 'false') {
      state = 'CONTRADICTED';
    } else if (primaryEvidence.confidence < 0.3) {
      state = 'UNKNOWN'; // Too low confidence to be verified
    }

    return {
      claim_type,
      claim_value: primaryEvidence.observed_value,
      claim_state: state,
      evidence: sorted
    };
  }
}
