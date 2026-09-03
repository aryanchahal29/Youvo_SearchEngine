import { createClient } from '../supabase/server';
import { CandidateTool } from './types';

export class DeduplicationEngine {
  /**
   * Checks if a candidate tool already exists in the database.
   * Returns the existing tool ID if a match is found, otherwise null.
   */
  static async findExisting(candidate: CandidateTool): Promise<string | null> {
    const supabase = await createClient();

    // 1. Domain match
    const canonicalDomain = this.extractCanonicalDomain(candidate.url);
    if (canonicalDomain) {
      const { data: byDomain } = await supabase
        .from('tools')
        .select('id')
        .eq('domain', canonicalDomain)
        .limit(1)
        .maybeSingle();

      if (byDomain) return byDomain.id;
    }

    // 2. Name match (fuzzy or exact)
    const normalizedName = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Exact slug match
    const { data: bySlug } = await supabase
      .from('tools')
      .select('id')
      .eq('slug', normalizedName)
      .limit(1)
      .maybeSingle();

    if (bySlug) return bySlug.id;

    // Use fuzzy search RPC for Name match if available
    const { data: fuzzyMatches } = await supabase.rpc('fuzzy_search_tools', {
      search_term: candidate.name,
      min_similarity: 0.85
    });

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      return fuzzyMatches[0].tool_id;
    }

    return null;
  }

  static extractCanonicalDomain(url: string | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      let domain = parsed.hostname;
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }
      return domain;
    } catch {
      return null;
    }
  }

  /**
   * Entity Resolution and Deduplication across multiple provider results.
   * Merges provenance and capabilities without destroying conflicting metadata.
   */
  static deduplicateCandidatesBatch(candidates: CandidateTool[]): CandidateTool[] {
    const resolved: CandidateTool[] = [];

    for (const candidate of candidates) {
      // Find matching entity in already resolved list
      let matchedIndex = -1;
      
      const candidateDomain = candidate.metadata?.canonical_domain as string | undefined;
      const candidateNormName = candidate.metadata?.normalized_name as string;

      for (let i = 0; i < resolved.length; i++) {
        const existing = resolved[i];
        const existingDomain = existing.metadata?.canonical_domain as string | undefined;
        const existingNormName = existing.metadata?.normalized_name as string;

        // Rule 1: Exact Domain Match
        if (candidateDomain && existingDomain && candidateDomain === existingDomain) {
          matchedIndex = i;
          break;
        }

        // Rule 2: Exact URL Match
        if (candidate.url && existing.url && candidate.url === existing.url) {
          matchedIndex = i;
          break;
        }

        // Rule 3: Strong Normalized Name match (only if domain is missing for one of them)
        if ((!candidateDomain || !existingDomain) && candidateNormName === existingNormName && candidateNormName.length > 3) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex >= 0) {
        // Merge candidate into existing
        const existing = resolved[matchedIndex];
        
        // Merge Sources
        if (!existing.sources) existing.sources = [];
        if (candidate.sources) {
          existing.sources.push(...candidate.sources);
        } else {
          existing.sources.push({ provider_id: candidate.source, model_id: 'unknown', discovered_at: candidate.discovered_at });
        }

        // Keep existing as primary, but merge lists (like capabilities)
        if (candidate.metadata?.capabilities) {
          const existCaps = (existing.metadata?.capabilities as string[]) || [];
          const newCaps = (candidate.metadata.capabilities as string[]) || [];
          existing.metadata = existing.metadata || {};
          existing.metadata.capabilities = Array.from(new Set([...existCaps, ...newCaps]));
        }

        // Do NOT blindly overwrite pricing/metadata if conflicting.
        // We preserve the conflict or keep the first found.
        
        // Mark candidate as deduplicated (in practice it's dropped, but if we wanted to track it, we could return it separately)
        candidate.deduplication_action = 'MERGED';
      } else {
        // First time seeing this entity
        if (!candidate.sources) {
          candidate.sources = [{ provider_id: candidate.source, model_id: 'unknown', discovered_at: candidate.discovered_at }];
        }
        resolved.push(candidate);
      }
    }

    return resolved;
  }
}
