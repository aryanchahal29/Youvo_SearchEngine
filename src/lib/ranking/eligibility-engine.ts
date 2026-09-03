import { CandidateTool } from '../discovery/types';
import { QueryConstraints, ProcessedQuery } from '../search/query-processor';
import { ConstraintEvaluation } from './types';

interface EvalResult {
  status: ConstraintEvaluation;
  evidence_text?: string;
  source?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class EligibilityEngine {
  static evaluateCandidates(candidates: CandidateTool[], query: ProcessedQuery): CandidateTool[] {
    return candidates.map(candidate => this.evaluateCandidate(candidate, query));
  }

  static evaluateCandidate(candidate: CandidateTool, query: ProcessedQuery): CandidateTool {
    const constraints = query.constraints;
    const qualityPolicy = query.quality_policy;
    const matched: string[] = [];
    const failed: string[] = [];
    const unknown: string[] = [];
    
    if (!candidate.metadata) candidate.metadata = {};
    if (!candidate.metadata.constraint_evidence) candidate.metadata.constraint_evidence = {};

    const evals: Record<string, EvalResult> = {
      budget: this.evaluateBudget(candidate, constraints.budget, query),
      skill_level: this.evaluateSkillLevel(candidate, constraints.skill_level, query),
      watermark: this.evaluateWatermark(candidate, constraints.watermark, query),
      commercial_use: this.evaluateCommercialUse(candidate, constraints.commercial_use, query),
      no_code: this.evaluateNoCode(candidate, constraints.no_code, query),
      api_access: this.evaluateApiAccess(candidate, constraints.api_access, query),
      open_source: this.evaluateOpenSource(candidate, constraints.open_source, query),
      has_free_plan: this.evaluateFreePlan(candidate, constraints.has_free_plan, query),
    };

    const enableTargetEntityFiltering = qualityPolicy?.enableTargetEntityFiltering ?? true;
    if (enableTargetEntityFiltering && query.target_entity) {
       const target = query.target_entity.toLowerCase();
       const isTarget = candidate.name.toLowerCase().includes(target) || 
                        (candidate.url && candidate.url.toLowerCase().includes(target.replace(/\s+/g, '')));
       evals['target_entity'] = {
          status: isTarget ? 'MATCH' : 'NO_MATCH',
          evidence_text: `Target entity '${query.target_entity}' required`,
          source: 'SYSTEM',
          confidence: 'HIGH'
       };
    }

    let isEligible = true;

    for (const [key, evalResult] of Object.entries(evals)) {
      if (evalResult.status === 'MATCH') matched.push(key);
      else if (evalResult.status === 'NO_MATCH') {
        failed.push(key);
        isEligible = false;
      }
      else if (evalResult.status === 'UNKNOWN') unknown.push(key);

      if (evalResult.status !== 'NOT_APPLICABLE') {
         candidate.metadata.constraint_evidence[key] = {
            evaluation: evalResult.status,
            evidence_text: evalResult.evidence_text || null,
            source: evalResult.source || (candidate.metadata.llm_enriched ? 'DISCOVERY_LLM' : 'UNKNOWN'),
            confidence: evalResult.confidence || 'LOW'
         };
      }
    }

    candidate.eligibility_status = isEligible ? 'ELIGIBLE' : 'INELIGIBLE';
    candidate.matched_constraints = matched;
    candidate.failed_constraints = failed;
    candidate.unknown_constraints = unknown;

    if (!isEligible) {
      candidate.eligibility_reason = `Failed constraints: ${failed.join(', ')}`;
    } else if (unknown.length > 0) {
      candidate.eligibility_reason = `Eligible, but unknown constraints: ${unknown.join(', ')}`;
    } else {
      candidate.eligibility_reason = 'Matched all constraints or none were required.';
    }

    return candidate;
  }

  private static checkSnippet(
    candidate: CandidateTool,
    matchKeywords: string[],
    rejectKeywords: string[],
    neutralKeywords: string[] = [],
    query?: ProcessedQuery
  ): EvalResult {
    const enableSnippetConstraintEvidence = query?.quality_policy?.enableSnippetConstraintEvidence ?? true;
    if (!enableSnippetConstraintEvidence) return { status: 'UNKNOWN' };

    if (!candidate.description) return { status: 'UNKNOWN' };
    const text = candidate.description.toLowerCase();

    for (const keyword of rejectKeywords) {
      if (text.includes(keyword)) {
         return { status: 'NO_MATCH', evidence_text: `Found negated/reject keyword: "${keyword}"`, source: 'DISCOVERY_SNIPPET', confidence: 'MEDIUM' };
      }
    }
    
    // Check neutral/contextual keywords that invalidate a MATCH
    let neutralFound = false;
    for (const keyword of neutralKeywords) {
      if (text.includes(keyword)) {
         neutralFound = true;
         break;
      }
    }

    if (!neutralFound) {
      for (const keyword of matchKeywords) {
        if (text.includes(keyword)) {
           return { status: 'MATCH', evidence_text: `Found match keyword: "${keyword}"`, source: 'DISCOVERY_SNIPPET', confidence: 'LOW' };
        }
      }
    }

    return { status: 'UNKNOWN' };
  }

  private static evaluateBudget(candidate: CandidateTool, required: string | null, query?: ProcessedQuery): EvalResult {
    if (!required || required === 'any') return { status: 'NOT_APPLICABLE' };
    
    const budgetHint = candidate.metadata?.pricing_hint as string | undefined;
    
    if (required === 'free') {
      if (budgetHint === 'free') return { status: 'MATCH', source: 'DISCOVERY_METADATA', confidence: 'MEDIUM' };
      if (budgetHint === 'paid') return { status: 'NO_MATCH', source: 'DISCOVERY_METADATA', confidence: 'MEDIUM' };
      
      // Snippet check
      return this.checkSnippet(
         candidate,
         ['free plan', 'completely free', '100% free', 'open source', 'free forever'],
         ['not free', 'paid only', 'no free plan'],
         ['free trial', 'free demo', 'cheaper than', 'affordable', 'free article about'],
         query
      );
    }
    
    return { status: 'UNKNOWN' };
  }

  private static evaluateSkillLevel(candidate: CandidateTool, required: string | null, query?: ProcessedQuery): EvalResult {
    if (!required) return { status: 'NOT_APPLICABLE' };
    
    const skillHint = candidate.metadata?.skill_level as string | undefined;
    if (skillHint) {
       const reqLower = required.toLowerCase();
       const hintLower = skillHint.toLowerCase();
       if (reqLower === 'beginner') {
         if (hintLower === 'beginner') return { status: 'MATCH', source: 'DISCOVERY_METADATA' };
         if (hintLower === 'advanced') return { status: 'NO_MATCH', source: 'DISCOVERY_METADATA' };
       } else if (reqLower === 'advanced') {
         if (hintLower === 'advanced') return { status: 'MATCH', source: 'DISCOVERY_METADATA' };
         if (hintLower === 'beginner') return { status: 'NO_MATCH', source: 'DISCOVERY_METADATA' };
       }
    }

    if (required.toLowerCase() === 'beginner') {
       return this.checkSnippet(candidate, ['easy to use', 'beginner friendly', 'simple to use', 'no learning curve', 'intuitive'], ['steep learning curve', 'complex', 'for professionals', 'advanced tool'], [], query);
    }

    return { status: 'UNKNOWN' };
  }

  private static evaluateWatermark(candidate: CandidateTool, required: boolean | null, query?: ProcessedQuery): EvalResult {
    if (required === null) return { status: 'NOT_APPLICABLE' };

    const hasWatermarkHint = candidate.metadata?.watermark as boolean | undefined;
    if (hasWatermarkHint !== undefined) {
      if (required === false) return { status: hasWatermarkHint === false ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
      if (required === true) return { status: hasWatermarkHint === true ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
    }
    
    if (required === false) {
       return this.checkSnippet(candidate, ['no watermark', 'without watermark'], ['adds a watermark', 'with watermark'], ['free trial with watermark'], query);
    }

    return { status: 'UNKNOWN' };
  }

  private static evaluateCommercialUse(candidate: CandidateTool, required: boolean | null, query?: ProcessedQuery): EvalResult {
    if (!required) return { status: 'NOT_APPLICABLE' };
    const hint = candidate.metadata?.commercial_use as boolean | undefined;
    if (hint !== undefined) return { status: hint ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
    return this.checkSnippet(candidate, ['commercial use', 'for business', 'commercial license'], ['personal use only', 'non-commercial'], [], query);
  }

  private static evaluateNoCode(candidate: CandidateTool, required: boolean | null, query?: ProcessedQuery): EvalResult {
    if (!required) return { status: 'NOT_APPLICABLE' };
    const hint = candidate.metadata?.no_code as boolean | undefined;
    if (hint !== undefined) return { status: hint ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
    return this.checkSnippet(candidate, ['no code', 'no-code', 'without coding', 'zero code'], ['requires coding', 'developer tool', 'api only'], [], query);
  }

  private static evaluateApiAccess(candidate: CandidateTool, required: boolean | null, query?: ProcessedQuery): EvalResult {
    if (!required) return { status: 'NOT_APPLICABLE' };
    const hint = candidate.metadata?.api_access as boolean | undefined;
    if (hint !== undefined) return { status: hint ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
    return this.checkSnippet(candidate, ['developer api', 'rest api', 'graphql api', 'api access'], ['no api'], [], query);
  }

  private static evaluateOpenSource(candidate: CandidateTool, required: boolean | null, query?: ProcessedQuery): EvalResult {
    if (!required) return { status: 'NOT_APPLICABLE' };
    const hint = candidate.metadata?.open_source as boolean | undefined;
    if (hint !== undefined) return { status: hint ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
    return this.checkSnippet(candidate, ['open source', 'open-source', 'github repository', 'foss'], ['closed source', 'proprietary'], ['open source alternatives to'], query);
  }

  private static evaluateFreePlan(candidate: CandidateTool, required: boolean | null, query?: ProcessedQuery): EvalResult {
    if (!required) return { status: 'NOT_APPLICABLE' };
    const hint = candidate.metadata?.has_free_plan as boolean | undefined;
    if (hint !== undefined) return { status: hint ? 'MATCH' : 'NO_MATCH', source: 'DISCOVERY_METADATA' };
    return this.evaluateBudget(candidate, 'free', query);
  }
}
