import { EvidenceCollector } from './evidence-collector';
import { ClaimVerifier } from './claim-verifier';
import type { VerifiedCandidateTool, VerificationChecklist, VerificationLevel } from './types';
import type { CandidateTool } from '../discovery/types';
import type { ProcessedQuery } from '../search/query-processor';
import { createClient } from '../supabase/server';
import { randomUUID } from 'crypto';
import { VerificationBudgetManager } from './budget';

export class VerificationEngine {
  private collector = new EvidenceCollector();

  /**
   * Generates a dynamic verification checklist based on the query and candidate.
   */
  private generateChecklist(query: ProcessedQuery, candidate: CandidateTool): VerificationChecklist {
    const required_claims: any[] = [];
    const optional_claims: any[] = [];

    // Core identity constraints are always required
    required_claims.push({ claim_type: 'identity', description: `Is this a real tool named ${candidate.name}?`, importance: 'REQUIRED' });

    if (query.constraints) {
      if (query.constraints.budget === 'free' || query.constraints.has_free_plan) {
        required_claims.push({ claim_type: 'has_free_plan', description: 'Does this tool have a genuinely free plan?', importance: 'REQUIRED' });
      }

      if (query.constraints.platforms && query.constraints.platforms.length > 0) {
        query.constraints.platforms.forEach((p: string) => {
          required_claims.push({ claim_type: `supports_${p.toLowerCase().replace(/\s+/g, '_')}`, description: `Does it support ${p}?`, importance: 'REQUIRED' });
        });
      }

      if (query.constraints.required_features) {
        query.constraints.required_features.forEach((f: string) => {
          required_claims.push({ claim_type: `capability_${f.toLowerCase().replace(/\s+/g, '_')}`, description: `Does it feature ${f}?`, importance: 'REQUIRED' });
        });
      }
    }

    return {
      required_claims,
      optional_claims
    };
  }

  /**
   * Derives the overall VerificationLevel based on the verified claims.
   */
  private deriveVerificationLevel(claims: any[]): VerificationLevel {
    let hasContradicted = false;
    let hasVerified = false;
    let hasUnknown = false;
    
    for (const claim of claims) {
      if (claim.claim_state === 'CONTRADICTED') hasContradicted = true;
      else if (claim.claim_state === 'VERIFIED') hasVerified = true;
      else if (claim.claim_state === 'UNKNOWN' || claim.claim_state === 'CONFLICTED') hasUnknown = true;
    }

    if (hasContradicted) return 'VERIFICATION_FAILED';
    if (hasUnknown && hasVerified) return 'PARTIALLY_VERIFIED';
    if (hasVerified) return 'VERIFIED';
    return 'UNVERIFIED';
  }

  /**
   * Verifies a candidate tool by collecting evidence and evaluating claims.
   */
  async verifyCandidate(candidate: CandidateTool, query: ProcessedQuery, budget: VerificationBudgetManager): Promise<VerifiedCandidateTool> {
    const checklist = this.generateChecklist(query, candidate);
    const evidenceMap = await this.collector.collectEvidence(candidate, checklist, budget);
    const runId = randomUUID();

    const verified_claims = [];
    const allClaimsToVerify = [...checklist.required_claims, ...checklist.optional_claims];

    for (const req of allClaimsToVerify) {
      const evidence = evidenceMap[req.claim_type] || [];
      const resolved = ClaimVerifier.verifyClaim(req.claim_type, evidence);
      verified_claims.push(resolved);
    }

    const verification_level = this.deriveVerificationLevel(verified_claims);

    const verifiedCandidate: VerifiedCandidateTool = {
      ...candidate,
      verification_level,
      verified_claims,
      verification_run_id: runId
    };

    return verifiedCandidate;
  }
}
