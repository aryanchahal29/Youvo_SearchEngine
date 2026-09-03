// YouVo: Gemini API adapter
// Implements AIProviderInterface for Google Gemini
// Primary provider for text, structured output, and embeddings

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
  'intent', 'explanation', 'verification', 'embedding',
];

export class GeminiProvider implements AIProviderInterface {
  name = 'gemini';
  displayName = 'Google Gemini';

  private client: GoogleGenerativeAI;
  private model: string;
  private embeddingModel: string;
  private requestCount = 0;
  private tokenCount = 0;
  private lastHealthCheck: Date | null = null;
  private healthStatus: ProviderHealth['status'] = 'unknown';

  constructor(apiKey: string, model = 'gemini-flash-latest', embeddingModel = 'gemini-embedding-2') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
    this.embeddingModel = embeddingModel;
  }

  private handleError(error: unknown): never {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const statusMatch = msg.match(/\[(\d{3})[^\]]*\]/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;

    console.error(`[GeminiProvider] Error encountered: Status=${status}, Message=${msg}`);

    if (status === 429) {
      throw new ProviderRateLimitError(msg);
    }
    if (status === 401 || status === 403 || msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
      throw new ProviderAuthError(msg);
    }
    if (status >= 400 && status < 500) {
      throw new ProviderInvalidRequestError(msg);
    }
    throw new ProviderTransientError(msg);
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    try {
      const isWebSearch = options?.task_type === 'web_discovery';
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt ? { role: 'system', parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.max_tokens ?? 4096,
        },
        tools: isWebSearch ? [{ googleSearch: {} } as any] : undefined,
      });

      const requestOptions = options?.abortSignal ? { signal: options.abortSignal } : undefined;
      const result = await model.generateContent(prompt, requestOptions);
      let text = result.response.text();
      
      if (isWebSearch) {
        const chunks = result.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const uris = chunks.map((c: any) => c?.web?.uri).filter(Boolean);
        if (uris.length > 0) {
          text += `\n\n__GROUNDING_URIS__\n${JSON.stringify(uris)}`;
        }
      }
      
      this.requestCount++;
      this.tokenCount += (text.length / 4); // rough estimate
      
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
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: options?.temperature ?? 0.1,
          maxOutputTokens: options?.max_tokens ?? 4096,
          responseMimeType: 'application/json',
          responseSchema: responseSchema as any,
        },
      });

      const requestOptions = options?.abortSignal ? { signal: options.abortSignal } : undefined;
      const result = await model.generateContent(prompt, requestOptions);
      const text = result.response.text();
      
      this.requestCount++;
      this.tokenCount += (text.length / 4);
      
      return JSON.parse(text) as T;
    } catch (error) {
      this.healthStatus = 'degraded';
      this.handleError(error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-embedding-2' });
      const result = await model.embedContent(text);
      
      this.requestCount++;
      
      return result.embedding.values;
    } catch (error) {
      this.healthStatus = 'degraded';
      this.handleError(error);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.generateContent('ping');
      
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
      free_limit: null, // Gemini free tier limits are dynamic
      usage_percentage: 0, // Would need API quota endpoint
      reset_time: null,
    };
  }

  supportsTask(taskType: AITaskType): boolean {
    return SUPPORTED_TASKS.includes(taskType);
  }

  supportsEmbeddings(): boolean {
    return true;
  }
}
