// YouVo: LLM Discovery Adapter
// Executes the dynamic PromptBuilder against specific LLM models (e.g., Gemini, Groq)
// to discover structured candidate tools for a user query.

import { DiscoveryProvider, DiscoveryCapability, CandidateTool, SourceHealth, RateLimitState } from './types';
import { getAIRouter } from '../providers/router';
import { PromptBuilder, DiscoverySchema, DiscoveryLLMOutput } from './prompt-builder';
import { ProcessedQuery } from '../search/query-processor';

export class LLMDiscoveryAdapter implements DiscoveryProvider {
  id: string;
  name: string;
  capabilities: DiscoveryCapability[] = ['web_discovery']; // We map this to 'web_discovery' so orchestrator picks it up
  rateLimitState: RateLimitState = { isRateLimited: false, resetTime: null };
  private modelProviderId: string; // e.g., 'gemini:proj-proj-1' or 'groq:default-1'
  private taskType: string;

  constructor(id: string, name: string, modelProviderId: string, taskType: string = 'web_discovery') {
    this.id = id;
    this.name = name;
    this.modelProviderId = modelProviderId;
    this.taskType = taskType;
  }

  isEnabled(): boolean {
    return true; 
  }

  /** Generic batch discovery */
  async discover(): Promise<any[]> {
    // We would need a dummy ProcessedQuery here, but for now we skip batch logic
    return [];
  }

  /** Query-specific discovery for the live search pipeline. */
  async discoverForQuery(query: string, limit: number = 10): Promise<any[]> {
    // For V2, the orchestrator must pass the ProcessedQuery object, not just a string.
    // However, the interface currently accepts a string. 
    // We will throw an error if we can't parse it, or we handle it in the orchestrator.
    throw new Error('LLMDiscoveryAdapter requires a ProcessedQuery object. Please use discoverWithProcessedQuery.');
  }

  /** New interface method for V2 dynamic prompts */
  async discoverWithProcessedQuery(query: ProcessedQuery): Promise<CandidateTool[]> {
    const router = getAIRouter();
    
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt(query);

    console.log(`[${this.name}] Starting LLM discovery for: "${query.raw_query}"`);

    try {
      // Execute the request via the router. 
      // Note: We use specific task_type and force a specific provider if we want to run in parallel
      // but the router itself abstracts this. We might need to bypass routing and call provider directly
      // if we want parallel specific models, OR register distinct task types for each.
      // For now, we will use the router with 'structured_extraction'. 
      const response = await router.generateStructuredOutput<DiscoveryLLMOutput>(
        userPrompt,
        systemPrompt,
        DiscoverySchema,
        {
          task_type: this.taskType as any,
          complexity: 'complex',
          force_provider_id: this.modelProviderId,
          max_tokens: 1500 // Limit token requests to prevent free-tier RPM/TPM exhaustion
        }
      );

      if (!response || !response.tools) {
        console.warn(`[${this.name}] Invalid LLM output format.`);
        return [];
      }

      return response.tools.map(tool => ({
        name: tool.name,
        url: tool.official_url,
        description: tool.description,
        source: this.name,
        discovered_at: new Date(),
        metadata: {
          search_query: query.raw_query,
          canonical_domain: tool.canonical_domain,
          why_match: tool.why_match,
          skill_level: tool.skill_level,
          pricing: tool.pricing,
          capabilities: tool.capabilities,
          confidence: tool.confidence
        }
      }));

    } catch (error) {
      console.error(`[${this.name}] LLM Discovery failed:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<SourceHealth> {
    return { status: 'healthy', last_checked: new Date() };
  }
}
