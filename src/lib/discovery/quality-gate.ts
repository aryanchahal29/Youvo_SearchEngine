import { CandidateTool, RejectionReason } from './types';

export class QualityGate {
  /**
   * Validates structural integrity. Answers: "Is this data structurally valid?"
   * @param rawTool The raw tool object from the provider/adapter.
   * @returns An array of rejection reasons (empty if valid).
   */
  static validateSchema(rawTool: any): RejectionReason[] {
    const reasons: RejectionReason[] = [];

    if (!rawTool || typeof rawTool !== 'object') {
      return ['INVALID_SCHEMA'];
    }

    if (!rawTool.name || typeof rawTool.name !== 'string' || rawTool.name.trim() === '') {
      reasons.push('MISSING_NAME');
    }

    // A URL is not strictly required if we have strong canonical identity,
    // but if it exists and is blatantly malformed, it's a schema issue.
    if (rawTool.url) {
      if (typeof rawTool.url !== 'string') {
        reasons.push('INVALID_URL');
      } else {
        try {
          const parsed = new URL(rawTool.url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            reasons.push('INVALID_URL');
          }
        } catch {
          reasons.push('INVALID_URL');
        }
      }
    }

    // Require some sort of description or why_match string from raw output
    if (!rawTool.description || typeof rawTool.description !== 'string' || rawTool.description.trim() === '') {
      reasons.push('INVALID_SCHEMA');
    }

    return reasons;
  }

  /**
   * Evaluates candidate quality. Answers: "Is this actually a valid tool candidate?"
   * @param candidate The candidate that has already passed schema validation.
   * @returns A quality rejection reason, or null if it passes.
   */
  static evaluateQuality(candidate: CandidateTool, qualityPolicy?: any): RejectionReason | null {
    // 1. Invalid Identity / Vague Services
    const enableIdentityValidation = qualityPolicy?.enableIdentityValidation ?? true;
    if (enableIdentityValidation && this.isVagueOrGenericEntity(candidate.name)) {
      return 'INVALID_IDENTITY';
    }

    // 2. Not a Tool (Articles, generic domains, tutorials)
    const enableArticleFiltering = qualityPolicy?.enableArticleFiltering ?? true;
    if (enableArticleFiltering && this.isGenericOrArticleUrl(candidate.url)) {
      return 'NOT_A_TOOL';
    }

    // 3. Low Relevance
    const whyMatch = (candidate.metadata?.why_match as string) || '';
    const description = candidate.description || '';
    if (whyMatch.length < 5 && description.length < 10) {
      return 'LOW_RELEVANCE';
    }

    return null; // Passed Quality Gate
  }

  private static isVagueOrGenericEntity(name: string): boolean {
    const genericTerms = ['ai tool', 'video generator', 'software', 'platform', 'app'];
    const normalizedName = name.toLowerCase().trim();
    if (genericTerms.includes(normalizedName)) return true;
    if (normalizedName.length < 2) return true;
    return false;
  }

  private static isGenericOrArticleUrl(url: string | undefined): boolean {
    if (!url) return false;
    
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const genericDomains = [
        'youtube.com',
        'medium.com',
        'reddit.com',
        'quora.com',
        'wikipedia.org',
        'linkedin.com',
        'twitter.com',
        'facebook.com',
        'instagram.com',
        'tiktok.com',
        'g2.com',
        'capterra.com',
        'trustradius.com',
        'alternativeto.net',
        'producthunt.com',
        'sbdc.org'
      ];
      
      let isGenericDomain = false;
      for (const domain of genericDomains) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          isGenericDomain = true;
          break;
        }
      }

      // GitHub is allowed ONLY if it points to a specific repo (e.g. github.com/user/repo)
      if (hostname === 'github.com' || hostname === 'www.github.com') {
        const path = new URL(url).pathname;
        const parts = path.split('/').filter(p => p.length > 0);
        if (parts.length < 2) {
          isGenericDomain = true; // Just pointing to github.com or github.com/user
        }
      }

      if (isGenericDomain) return true;

      // Check for common article paths
      const pathname = new URL(url).pathname.toLowerCase();
      if (
        pathname.includes('/blog/') || 
        pathname.includes('/article/') || 
        pathname.includes('/news/') ||
        pathname.includes('/post/')
      ) {
        return true;
      }

      return false;
    } catch {
      return false; // If URL parsing fails, we handled that in schema validation
    }
  }
}
