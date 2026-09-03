// YouVo: Groq API adapter
// Implements AIProviderInterface for Groq
// Secondary provider — fast inference, good for simple/medium tasks

import Groq from 'groq-sdk';
import type {
  AIProviderInterface,
  AITaskType,
  GenerateOptions,
  ProviderHealth,
  ProviderUsage,
} from './types';
import {
  ProviderRateLimitError,
  ProviderTransientError,
  ProviderAuthError,
  ProviderInvalidRequestError,
} from './types';

const SUPPORTED_TASKS: AITaskType[] = [
  'classification', 'extraction', 'normalization', 'summarization',
  'intent', 'explanation', 'verification',
];

export class GroqProvider implements AIProviderInterface {
  name = 'groq';
  displayName = 'Groq';

  private client: Groq;
  private model: string;
  private requestCount = 0;
  private tokenCount = 0;
  private lastHealthCheck: Date | null = null;
  private healthStatus: ProviderHealth['status'] = 'unknown';

  constructor(apiKey: string, model = 'llama3-8b-8192') {
    this.client = new Groq({ apiKey, maxRetries: 0 });
    this.model = model;
  }

  private handleError(error: unknown): never {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status as number;
      const msg = (error as any).message || 'Unknown Groq Error';
      
      if (status === 429) {
        let retryAfterSecs: number | undefined;
        // groq-sdk sometimes exposes response headers on the error object
        const headers = (error as any).response?.headers;
        if (headers) {
          const retryStr = headers.get ? headers.get('retry-after') : headers['retry-after'];
          if (retryStr) {
            retryAfterSecs = parseInt(retryStr, 10);
          }
        }
        throw new ProviderRateLimitError(msg, isNaN(retryAfterSecs!) ? undefined : retryAfterSecs);
      }
      if (status === 401 || status === 403) {
        throw new ProviderAuthError(msg);
      }
      if (status >= 400 && status < 500) {
        throw new ProviderInvalidRequestError(msg);
      }
      throw new ProviderTransientError(msg);
    }
    
    // If it's a fetch error like HTML parsing failed
    const msg = error instanceof Error ? error.message : String(error);
    throw new ProviderTransientError(`Groq connection failed: ${msg}`);
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    try {
      const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const requestOptions = options?.abortSignal ? { signal: options.abortSignal as any } : undefined;
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.max_tokens ?? 4096,
      }, requestOptions);

      const text = completion.choices[0]?.message?.content || '';
      
      this.requestCount++;
      this.tokenCount += completion.usage?.total_tokens ?? 0;
      
      return text;
    } catch (error) {
      this.healthStatus = 'degraded';
      this.handleError(error);
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    systemPrompt: string,
    responseSchema: Record<string, unknown>,
    options?: GenerateOptions
  ): Promise<T> {
    try {
      // Groq supports JSON mode via response_format
      const fullPrompt = `${prompt}\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(responseSchema, null, 2)}`;
      
      const requestOptions = options?.abortSignal ? { signal: options.abortSignal as any } : undefined;
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 4096,
        response_format: { type: 'json_object' },
      }, requestOptions);

      const text = completion.choices[0]?.message?.content || '{}';
      
      this.requestCount++;
      this.tokenCount += completion.usage?.total_tokens ?? 0;
      
      return JSON.parse(text) as T;
    } catch (error) {
      this.healthStatus = 'degraded';
      this.handleError(error);
    }
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    // Groq does not currently support embeddings
    throw new Error(
      'Groq does not support embeddings. Use a provider that supports embeddings (e.g., Gemini).'
    );
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      
      const latency = Date.now() - start;
      this.healthStatus = latency > 5000 ? 'degraded' : 'healthy';
      this.lastHealthCheck = new Date();
      
      return {
        status: this.healthStatus,
        latency_ms: latency,
        last_check: this.lastHealthCheck,
        error: null,
      };
    } catch (error) {
      this.healthStatus = 'unhealthy';
      this.lastHealthCheck = new Date();
      
      return {
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        last_check: this.lastHealthCheck,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getUsage(): Promise<ProviderUsage> {
    return {
      requests_used: this.requestCount,
      tokens_used: this.tokenCount,
      free_limit: null, // Groq free tier limits are dynamic
      usage_percentage: 0,
      reset_time: null,
    };
  }

  supportsTask(taskType: AITaskType): boolean {
    return SUPPORTED_TASKS.includes(taskType);
  }

  supportsEmbeddings(): boolean {
    return false;
  }
}
