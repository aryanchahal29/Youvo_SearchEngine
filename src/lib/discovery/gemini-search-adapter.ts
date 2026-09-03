import { GoogleGenerativeAI } from '@google/generative-ai';
import { SearchProvider, WebSearchResult } from './search-provider';
import { DiscoveryProvider, DiscoveryCapability, SearchResult, RateLimitState } from './types';

export class GeminiSearchAdapter implements SearchProvider, DiscoveryProvider {
  id = 'gemini-search';
  name = 'gemini_search';
  capabilities: DiscoveryCapability[] = ['web_discovery'];
  rateLimitState: RateLimitState = { isRateLimited: false, resetTime: null };
  private client: GoogleGenerativeAI;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_PROVIDER_1_KEY;
    this.client = new GoogleGenerativeAI(this.apiKey || '');
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  isEnabled(): boolean {
    return this.isAvailable();
  }

  async healthCheck(): Promise<any> {
    return {
      status: this.isAvailable() ? 'healthy' : 'unconfigured',
      last_check: new Date(),
      message: this.isAvailable() ? 'Ready' : 'API Key missing'
    };
  }

  async discover(): Promise<SearchResult[]> {
    return this.discoverForQuery('top AI tools', 10);
  }

  async discoverForQuery(query: string, limit: number = 10): Promise<SearchResult[]> {
    const results = await this.search(query, limit);
    return results.map(r => ({
      ...r,
      source: 'gemini_search'
    }));
  }

  async search(query: string, limit: number = 10): Promise<WebSearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured for search');
    }

    try {
      const model = this.client.getGenerativeModel({
        model: process.env.GEMINI_SEARCH_MODEL || 'gemini-pro',
        tools: [{ googleSearch: {} } as any], // Cast as any because some TS versions lack proper typings for this new feature
      });

      const prompt = `Return the top ${limit} web search results for the query: "${query}".
Output exactly a JSON array of objects with keys: "title", "url", "snippet".
IMPORTANT: For the "snippet", you MUST paraphrase the content into a VERY SHORT 1-sentence summary (max 20 words). Do NOT directly quote or recite the exact text from the web page, or you will be blocked by recitation filters. Ensure the JSON is valid and do not wrap it in markdown code blocks if possible.`;

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response.response.text();
      let parsed: any[] = [];
      
      try {
        // Strip out markdown code blocks if they exist
        const jsonStr = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[GeminiSearch] Failed to parse search results JSON:', parseError);
        console.error('[GeminiSearch] Raw text was:', text);
        return [];
      }

      if (!Array.isArray(parsed)) {
        console.error('[GeminiSearch] Expected an array but got:', typeof parsed);
        return [];
      }

      const results: WebSearchResult[] = parsed
        .map(item => {
          let snippet = String(item.snippet || '');
          // Truncate snippet to severely reduce tokens passed to verifier
          if (snippet.length > 200) snippet = snippet.substring(0, 197) + '...';
          return {
            title: String(item.title || ''),
            url: String(item.url || ''),
            snippet,
            source: 'google'
          };
        })
        .filter(item => item.title && item.url)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('[GeminiSearch] Search failed:', error);
      throw error;
    }
  }
}
