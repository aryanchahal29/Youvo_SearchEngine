import { CandidateTool, SearchResult } from './types';
import { DeduplicationEngine } from './deduplication';

export interface DeterministicFallbackConfig {
  aggregatorDomains: string[];
  publisherDomains: string[];
  communityDomains: string[];
  articlePaths: string[];
}

const DEFAULT_FALLBACK_CONFIG: DeterministicFallbackConfig = {
  aggregatorDomains: [
    'g2.com', 'capterra.com', 'trustradius.com', 'sourceforge.net', 'softwareadvice.com',
    'getapp.com', 'producthunt.com', 'alternativeto.net', 'tooltester.com', 'slant.co',
    'stackshare.io', 'trustpilot.com', 'sbdc.org', 'uschamber.com', 'thereisanaiforthat.com', 'theresanaiforthat.com'
  ],
  publisherDomains: [
    'techradar.com', 'pcmag.com', 'forbes.com', 'wired.com', 'theverge.com', 'zdnet.com',
    'tomsguide.com', 'cnet.com', 'websiteplanet.com', 'investopedia.com', 'nerdwallet.com',
    'bloggingwizard.com', 'makeuseof.com', 'xda-developers.com', 'androidauthority.com',
    '9to5mac.com', 'macworld.com', 'pcworld.com'
  ],
  communityDomains: [
    'reddit.com', 'quora.com', 'youtube.com', 'medium.com', 'github.com', 'thesaurus.com', 'dictionary.com', 'wikipedia.org'
  ],
  articlePaths: ['/blog', '/news', '/top-', '/best-', '/article', '/reviews', '/compare', '/vs-', '/alternatives', '/guide', '/hub', '/category', '/post']
};

export class FallbackExtractor {
  
  static extractDeterministicCandidates(
    results: SearchResult[], 
    config: DeterministicFallbackConfig = DEFAULT_FALLBACK_CONFIG
  ): CandidateTool[] {
    const candidates: CandidateTool[] = [];
    
    for (const result of results) {
      if (!result.url) continue;

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(result.url);
      } catch {
        continue; // Invalid URL
      }

      // 1. Path checking
      const lowerPath = parsedUrl.pathname.toLowerCase();
      let rejected = false;
      let rejectionReason = '';

      for (const articlePath of config.articlePaths) {
        if (lowerPath.includes(articlePath)) {
          rejected = true;
          rejectionReason = 'ARTICLE_PATH';
          break;
        }
      }

      // 2. Domain classification checking
      const domain = DeduplicationEngine.extractCanonicalDomain(result.url) || parsedUrl.hostname;
      if (!rejected) {
        const isAggregator = config.aggregatorDomains.some(d => domain.includes(d) || parsedUrl.hostname.includes(d));
        if (isAggregator) {
          rejected = true;
          rejectionReason = 'DOMAIN_AGGREGATOR';
        } else {
          const isPublisher = config.publisherDomains.some(d => domain.includes(d) || parsedUrl.hostname.includes(d));
          if (isPublisher) {
            rejected = true;
            rejectionReason = 'DOMAIN_PUBLISHER';
          } else {
            const isCommunity = config.communityDomains.some(d => domain.includes(d) || parsedUrl.hostname.includes(d));
            if (isCommunity) {
               // Only reject community domains if they aren't explicitly a project page, but usually we reject them as fallback
               rejected = true;
               rejectionReason = 'DOMAIN_COMMUNITY';
            }
          }
        }
      }

      // We still do title validation to catch generic titles
      const identity = this.extractIdentity(result, parsedUrl, domain);
      
      if (!rejected && identity.source === 'GENERIC_TITLE_REJECTED') {
         rejected = true;
         rejectionReason = 'GENERIC_TITLE';
      }
      
      if (!rejected && identity.confidence === 'INVALID') {
         rejected = true;
         rejectionReason = 'INVALID_IDENTITY';
      }

      if (rejected) {
        console.warn(`[FallbackExtractor] Rejected ${result.url} - Reason: ${rejectionReason}`);
        continue;
      }

      // Clean the URL (remove tracking)
      const cleanUrl = this.normalizeUrl(parsedUrl);

      candidates.push({
        name: identity.name,
        url: cleanUrl,
        description: result.snippet || result.content || '',
        source: 'tavily_deterministic',
        discovered_at: new Date(),
        metadata: {
          identity_source: identity.source,
          identity_confidence: identity.confidence,
          fallback_source: 'tavily',
          canonical_domain: domain
        }
      });
    }

    return candidates;
  }

  private static extractIdentity(result: SearchResult, parsedUrl: URL, domain: string) {
    let namePart = '';
    let nameSource = '';
    
    // 1. Try Title Extraction
    if (result.title) {
      const separators = [' - ', ' | ', ' : ', ' — '];
      for (const sep of separators) {
        if (result.title.includes(sep)) {
          const part = result.title.split(sep)[0].trim();
          if (part && part.length < 60) { // relaxed length limit
            namePart = part;
            nameSource = 'TITLE';
            break;
          }
        }
      }
      if (!namePart && result.title.length < 60) {
        namePart = result.title.trim();
        nameSource = 'TITLE_FULL';
      }
    }

    if (namePart) {
      const lowerName = namePart.toLowerCase();
      // Reject editorial/listicle patterns
      const articlePatterns = ['best', 'top', 'free', 'guide', 'review', 'vs', 'alternatives', 'how to', '10', '15', '20'];
      const startsWithPattern = articlePatterns.some(p => lowerName.startsWith(p + ' '));
      const isSemanticallyCategory = (lowerName.includes('software') || lowerName.includes('tools') || lowerName.includes('apps') || lowerName.includes('generators')) && lowerName.split(' ').length > 2;
      
      if (startsWithPattern || isSemanticallyCategory) {
         // Generic title detected, do not use it for identity.
         // Actually, if it's a generic title, the whole result might be an article!
         return { name: 'Generic', source: 'GENERIC_TITLE_REJECTED', confidence: 'INVALID' };
      }
      
      return {
        name: namePart,
        source: nameSource,
        confidence: 'HIGH'
      };
    }

    // 2. Domain Extraction (Fallback)
    const domainParts = domain.split('.');
    if (domainParts.length > 0) {
      let rawName = domainParts[0];
      if (rawName === 'www' && domainParts.length > 1) {
          rawName = domainParts[1];
      }
      
      if (rawName && rawName.length > 2) {
         const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
         return {
           name,
           source: 'DOMAIN',
           confidence: 'MEDIUM'
         };
      }
    }

    // 3. Last Resort
    return {
      name: domain || 'Unknown Tool',
      source: 'UNKNOWN',
      confidence: 'LOW'
    };
  }

  private static normalizeUrl(url: URL): string {
    const paramsToDelete = [];
    for (const [key] of url.searchParams.entries()) {
      if (key.startsWith('utm_') || key === 'ref' || key === 'source') {
        paramsToDelete.push(key);
      }
    }
    for (const key of paramsToDelete) {
      url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  }

  static mergeCandidates(deterministic: CandidateTool[], llmEnriched: CandidateTool[]): CandidateTool[] {
    const merged = [...deterministic];

    for (const llmTool of llmEnriched) {
      const llmDomain = DeduplicationEngine.extractCanonicalDomain(llmTool.url);
      
      const matchIndex = merged.findIndex(d => 
        DeduplicationEngine.extractCanonicalDomain(d.url) === llmDomain || 
        d.name.toLowerCase() === llmTool.name.toLowerCase()
      );

      if (matchIndex >= 0) {
        const d = merged[matchIndex];
        merged[matchIndex] = {
          ...llmTool,
          ...d, 
          description: llmTool.description && llmTool.description.length > d.description.length ? llmTool.description : d.description,
          source: d.source,
          metadata: {
            ...d.metadata,
            ...llmTool.metadata,
            llm_enriched: true
          }
        };
      } else {
        merged.push({
           ...llmTool,
           metadata: {
             ...llmTool.metadata,
             fallback_source: 'tavily_llm'
           }
        });
      }
    }

    return merged;
  }
}
