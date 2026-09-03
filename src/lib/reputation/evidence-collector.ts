import { FactExtractor } from '../extraction/fact-extractor';
import { GeminiSearchAdapter } from '../discovery/gemini-search-adapter';
import type { ClaimEvidence, VerificationChecklist, RequiredClaim, SourceType } from './types';
import type { CandidateTool } from '../discovery/types';
import { VerificationBudgetManager } from './budget';

export class EvidenceCollector {
  private searchProvider = new GeminiSearchAdapter();

  /**
   * Collects evidence for a given candidate based on the checklist.
   */
  async collectEvidence(candidate: CandidateTool, checklist: VerificationChecklist, budget: VerificationBudgetManager): Promise<Record<string, ClaimEvidence[]>> {
    const evidenceMap: Record<string, ClaimEvidence[]> = {};
    const url = candidate.url;

    if (!url) {
      return evidenceMap; // Cannot crawl without URL
    }

    const allClaims = [...checklist.required_claims, ...checklist.optional_claims];

    // 1. Primary Source: Official Website
    // We crawl the official site and extract all relevant facts at once.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s crawl timeout

      let html;
      try {
        const response = await fetch(url, { signal: controller.signal });
        html = await response.text();
      } finally {
        clearTimeout(timeoutId);
      }

      // Token optimization: aggressively strip scripts, styles, and truncate to 12000 chars
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                 .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                 .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
                 .replace(/<[^>]+>/g, ' '); // Strip remaining tags
      if (html.length > 12000) {
        html = html.substring(0, 12000);
      }

      // Tell FactExtractor to look for specific claims
      const specificInstructions = allClaims.map(c => `- ${c.claim_type}: ${c.description}`).join('\n');
      
      const primaryData = await FactExtractor.extractToolData(url, html, specificInstructions);
      
      // Map extracted data to evidence
      for (const claim of allClaims) {
        let observedValue: any = null;
        let confidence = 0;

        // Map FactExtractor output to specific claim types
        if (claim.claim_type === 'pricing' || claim.claim_type === 'has_free_plan') {
          const hasFree = primaryData.pricing_plans.some(p => p.is_free);
          observedValue = hasFree;
          confidence = primaryData.confidence;
        } else if (claim.claim_type === 'watermark') {
           const freePlan = primaryData.pricing_plans.find(p => p.is_free);
           if (freePlan && freePlan.watermark !== undefined) {
             observedValue = freePlan.watermark;
             confidence = primaryData.confidence;
           }
        } else if (claim.claim_type === 'commercial_use') {
           const freePlan = primaryData.pricing_plans.find(p => p.is_free);
           if (freePlan && freePlan.commercial_use !== undefined) {
             observedValue = freePlan.commercial_use;
             confidence = primaryData.confidence;
           }
        } else {
          // Check features and limitations
          const featureMatch = primaryData.features.find(f => f.name.toLowerCase().includes(claim.claim_type.toLowerCase()));
          if (featureMatch) {
            observedValue = featureMatch.value || true;
            confidence = primaryData.confidence;
          }
        }

        if (observedValue !== null) {
          if (!evidenceMap[claim.claim_type]) evidenceMap[claim.claim_type] = [];
          evidenceMap[claim.claim_type].push({
            source_url: url,
            source_type: 'FIRST_PARTY',
            source_title: primaryData.name || candidate.name,
            observed_value: observedValue,
            confidence: confidence / 100, // normalized 0-1
            retrieved_at: new Date().toISOString(),
            verified_at: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.warn(`[EvidenceCollector] Primary crawl failed for ${url}:`, e);
    }

    // 2. Secondary Source: Tavily (Only for required claims that are missing or low confidence)
    const missingClaims = checklist.required_claims.filter(c => {
      const ev = evidenceMap[c.claim_type];
      return !ev || ev.length === 0 || ev[0].confidence < 0.6;
    });

    if (missingClaims.length > 0) {
      // We perform targeted Tavily searches for the missing claims.
      await Promise.allSettled(missingClaims.map(async (claim) => {
        // Attempt to consume a call for this specific candidate
        const candidateId = (candidate as any).id || candidate.name; // fallback to name if id is missing in mock/DB
        if (!budget.tryConsumeTavilyCall(candidateId)) {
          return; // Budget exhausted
        }

        try {
          const query = `Does ${candidate.name} ${claim.description}?`;
          const results = await this.searchProvider.search(query, 3); // top 3 results
          
          if (results && results.length > 0) {
            const bestResult = results[0];
            const snippet = (bestResult.content || bestResult.snippet || '').toLowerCase();
            let observedValue: any = null;
            
            if (snippet.includes('does not') || snippet.includes('no ') || snippet.includes('unsupported')) {
               observedValue = false;
            } else if (snippet.includes('yes') || snippet.includes('supports') || snippet.includes('features')) {
               observedValue = true;
            }

            if (observedValue !== null) {
              if (!evidenceMap[claim.claim_type]) evidenceMap[claim.claim_type] = [];
              evidenceMap[claim.claim_type].push({
                source_url: bestResult.url,
                source_type: 'SECONDARY',
                source_title: bestResult.title,
                observed_value: observedValue,
                confidence: 0.6,
                retrieved_at: new Date().toISOString(),
                verified_at: new Date().toISOString()
              });
            }
          }
        } catch (e) {
           console.error(`[EvidenceCollector] Search failed:`, e);
        }
      }));
    }

    return evidenceMap;
  }
}
