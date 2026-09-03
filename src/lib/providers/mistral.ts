// YouVo: Mistral API adapter
// Implements AIProviderInterface for Mistral
// Fast inference, good for simple/medium extraction tasks

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

export class MistralProvider implements AIProviderInterface {
  name = 'mistral';
  displayName = 'Mistral';

  private apiKey: string;
  private model: string;
  private requestCount = 0;
  private tokenCount = 0;
  private lastHealthCheck: Date | null = null;
  private healthStatus: ProviderHealth['status'] = 'unknown';

  constructor(apiKey: string, model = 'mistral-small-latest') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private handleError(error: unknown): never {
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('429')) {
        throw new ProviderRateLimitError(msg);
      }
      if (msg.includes('401') || msg.includes('403')) {
        throw new ProviderAuthError(msg);
      }
      if (msg.includes('400')) {
        throw new ProviderInvalidRequestError(msg);
      }
      if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
        throw new ProviderTransientError(msg);
      }
      throw error;
    }
    throw new Error('Unknown Mistral Error');
  }

  private async fetchMistral(
    messages: any[],
    options?: GenerateOptions,
    responseFormat?: 'json_object'
  ) {
    const url = 'https://api.mistral.ai/v1/chat/completions';
    
    // Hard limit max tokens to save quotas, unless strictly overridden
    let maxTokens = options?.max_tokens || 800;

    const body: any = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: maxTokens,
    };

    if (responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: options?.abortSignal,
      });

      if (!res.ok) {
        throw new Error(`Mistral Error ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      
      this.requestCount++;
      if (data.usage?.total_tokens) {
        this.tokenCount += data.usage.total_tokens;
      }

      return data.choices[0].message.content;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      this.handleError(error);
    }
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const content = await this.fetchMistral(messages, options);
    return content;
  }

  async generateStructuredOutput<T>(
    prompt: string,
    systemPrompt: string,
    responseSchema: Record<string, unknown>,
    options?: GenerateOptions
  ): Promise<T> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt + `\n\nEnsure the response is valid JSON matching this schema: ${JSON.stringify(responseSchema)}` }
    ];

    const content = await this.fetchMistral(messages, options, 'json_object');
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      throw new Error(`Failed to parse Mistral JSON output: ${content}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('MistralProvider does not implement generateEmbedding in this project.');
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = new Date();
    // Cache health check for 60s
    if (this.lastHealthCheck && (now.getTime() - this.lastHealthCheck.getTime() < 60000)) {
      return {
        status: this.healthStatus,
        latency_ms: null,
        last_check: this.lastHealthCheck,
        error: null,
      };
    }

    try {
      const start = Date.now();
      await this.generateText('Ping. Reply with "pong" only.', undefined, { max_tokens: 10 });
      const latency = Date.now() - start;
      
      this.healthStatus = 'healthy';
      this.lastHealthCheck = now;
      
      return {
        status: 'healthy',
        latency_ms: latency,
        last_check: now,
        error: null,
      };
    } catch (error: any) {
      this.healthStatus = 'unhealthy';
      this.lastHealthCheck = now;
      return {
        status: 'unhealthy',
        latency_ms: null,
        last_check: now,
        error: error.message || 'Health check failed',
      };
    }
  }

  async getUsage(): Promise<ProviderUsage> {
    return {
      requests_used: this.requestCount,
      tokens_used: this.tokenCount,
      free_limit: null,
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
