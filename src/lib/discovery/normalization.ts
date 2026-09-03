import { CandidateTool } from './types';

export class NormalizationEngine {
  /**
   * Normalizes tool names, domains, URLs, categories, and aliases.
   * Produces one canonical internal representation per tool.
   * @param candidate The tool to normalize
   */
  static normalize(candidate: CandidateTool): CandidateTool {
    const url = candidate.url ? candidate.url.trim() : '';
    let domain = '';
    
    if (url) {
      try {
        const parsedUrl = new URL(url);
        domain = parsedUrl.hostname.toLowerCase();
        if (domain.startsWith('www.')) {
          domain = domain.substring(4);
        }
      } catch {
        domain = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      }
    }

    const normalizedName = candidate.name.trim();

    return {
      ...candidate,
      name: normalizedName,
      url: url,
      metadata: {
        ...candidate.metadata,
        canonical_domain: domain || undefined,
        normalized_name: normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '')
      }
    };
  }
}
