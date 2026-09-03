// YouVo: Search Provider Abstraction
// Routes web discovery tasks through the AIProviderRouter to ensure compliance with provider pools,
// circuit breakers, and rate limit rules.
// 
// Gemini search results are DISCOVERY EVIDENCE, not source of truth.
// The pipeline must: search → obtain candidate URLs → resolve → crawl → extract → verify → rank.

import { getAIRouter } from '../providers/router';
import type {
  SearchResult,
  DiscoveryProvider,
  DiscoveryCapability,
  SourceHealth,
  RateLimitState
} from './types';
import { AllProvidersUnavailableError } from '../providers/types';

// ============================================================
// SEARCH PROVIDER INTERFACE
// ============================================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  source: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, limit: number): Promise<WebSearchResult[]>;
  isAvailable(): boolean;
}

// ============================================================
// ROUTED SEARCH PROVIDER
// ============================================================

export class RoutedSearchProvider implements SearchProvider {
  name = 'routed_web_search';

  isAvailable(): boolean {
    return true; // The router internally handles availability and circuit breakers
  }

  async discover(): Promise<SearchResult[]> {
    return this.search('top new AI tools list');
  }

  async discoverForQuery(query: string, limit: number = 10): Promise<SearchResult[]> {
    return this.search(query, limit);
  }

  public async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const router = getAIRouter();
    
    const searchPrompt = `Find ${limit} real AI tools that match this query: "${query}".

For each tool, provide:
- The exact official tool name
- The official website URL (not a review site, not a directory — the actual product homepage)
- A brief description of what the tool does

Only include tools that actually exist. Do not invent or hallucinate tools.
Focus on tools with official websites that can be independently verified.
Include both well-known and lesser-known tools.

Return ONLY a JSON array with objects having keys: "name", "url", "description"
Do not include any markdown formatting, code blocks, or extra text.`;

    try {
      // The router will automatically select a provider capable of 'web_discovery'
      // If the provider supports grounding natively, it will append __GROUNDING_URIS__ to the output.
      const text = await router.generateText(searchPrompt, undefined, {
        task_type: 'web_discovery',
        complexity: 'complex',
        temperature: 0.1,
      });

      // Extract grounding metadata if the provider injected it
      let cleanedText = text;
      let groundingUris: string[] = [];
      
      const groundingMarker = '__GROUNDING_URIS__';
      const markerIndex = text.indexOf(groundingMarker);
      if (markerIndex !== -1) {
        cleanedText = text.substring(0, markerIndex).trim();
        try {
          const urisJson = text.substring(markerIndex + groundingMarker.length).trim();
          groundingUris = JSON.parse(urisJson);
        } catch (e) {
          console.warn('[SearchProvider] Failed to parse injected grounding URIs');
        }
      }

      const parsed = this.parseSearchResponse(cleanedText, limit);

      // Merge grounding URIs as additional evidence
      for (const uri of groundingUris) {
        const matchingResult = parsed.find(r => uri.includes(new URL(r.url).hostname));
        if (!matchingResult) {
          parsed.push({
            title: 'Grounding Evidence',
            url: uri,
            snippet: '',
            source: 'web_grounding_chunk',
            content: ''
          });
        }
      }

      return parsed.slice(0, limit);

    } catch (error) {
      if (error instanceof AllProvidersUnavailableError) {
        console.warn('[SearchProvider] All web discovery providers unavailable.');
        throw error; // Let the Orchestrator catch this to correctly log sources_rate_limited
      }
      console.error('[SearchProvider] Search failed:', error);
      throw error;
    }
  }

  private parseSearchResponse(text: string, limit: number): SearchResult[] {
    try {
      // Strip markdown code fences if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item: any) => item.name && item.url)
        .map((item: any) => ({
          title: String(item.name || ''),
          url: String(item.url || ''),
          snippet: String(item.description || ''),
          content: String(item.description || ''),
          source: this.name,
          metadata: { search_query: 'search' }
        }))
        .slice(0, limit);
    } catch {
      console.warn('[SearchProvider] Failed to parse JSON response, attempting text extraction');
      return this.extractFromFreeText(text, limit);
    }
  }

  private extractFromFreeText(text: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    const urlRegex = /(?:\*\*([^*]+)\*\*|([A-Z][a-zA-Z0-9\s.]+?))\s*[-–:]*\s*(https?:\/\/[^\s,)]+)/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null && results.length < limit) {
      const name = (match[1] || match[2] || '').trim();
      const url = match[3].trim();
      if (name && url) {
        results.push({
          title: name,
          url,
          snippet: '',
          source: 'websearch_ai_fallback',
          content: ''
        });
      }
    }
    return results;
  }
}

// ============================================================
// FACTORY
// ============================================================

let providerInstance: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (!providerInstance) {
    providerInstance = new RoutedSearchProvider();
  }
  return providerInstance;
}

export function setSearchProvider(provider: SearchProvider | null): void {
  providerInstance = provider;
}
