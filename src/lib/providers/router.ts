// YouVo: AI Provider Router
// Implements a robust Provider-Pool architecture with circuit breakers and legitimate quota usage.

import type {
  AIProviderInterface,
  AITaskType,
  TaskComplexity,
  GenerateOptions,
  ProviderState,
  ProviderCapability,
} from './types';
import {
  AllProvidersUnavailableError,
  ProviderRateLimitError,
  ProviderTransientError,
  ProviderAuthError,
  ProviderInvalidRequestError,
} from './types';
import { GeminiProvider } from './gemini';
import { GroqProvider } from './groq';
import { MistralProvider } from './mistral';

// ============================================================
// PROVIDER REGISTRY & ROUTER
// ============================================================

export class AIProviderRouter {
  private registry: Map<string, ProviderState> = new Map();

  constructor() {
    this.initializeFromEnv();
  }

  /**
   * Initializes providers from environment variables using the required pattern:
   * GEMINI_PROVIDER_1_KEY, GEMINI_PROVIDER_1_PROJECT_ID, etc.
   * GROQ_PROVIDER_1_KEY, etc.
   */
  private initializeFromEnv() {
    const env = process.env;

    // 1. Initialize Gemini Providers
    for (let i = 1; i <= 10; i++) {
      const key = env[`GEMINI_PROVIDER_${i}_KEY`];
      if (!key) continue;

      const projectId = env[`GEMINI_PROVIDER_${i}_PROJECT_ID`] || `gemini-project-${i}`;
      const model = env[`GEMINI_PROVIDER_${i}_MODEL`] || 'gemini-flash-latest';
      const enabledStr = env[`GEMINI_PROVIDER_${i}_ENABLED`];
      const enabled = enabledStr ? enabledStr.toLowerCase() === 'true' : true;

      const id = `gemini:proj-${projectId}`;
      const provider = new GeminiProvider(key, model);

      this.registry.set(id, {
        id,
        type: 'gemini',
        projectId,
        model,
        enabled,
        health: 'healthy',
        circuitBreakerOpen: false,
        resetTime: null,
        lastSuccess: null,
        lastFailure: null,
        failureCount: 0,
        rateLimitCount: 0,
        provider,
        capabilities: {
          supportedTaskTypes: [
            'classification', 'query_classification', 'extraction', 'structured_extraction',
            'normalization', 'summarization', 'intent', 'explanation', 'verification',
            'web_discovery', 'embedding'
          ],
          supportsStructuredOutput: true,
          supportsEmbeddings: true,
          supportsWebSearch: true,
          costTier: 'moderate',
          priority: i + 2, // Gemini is used as fallback (priority 3, 4) to save search quota
        }
      });
      console.log(`[Router] Registered ${id} (${model}) - Enabled: ${enabled}`);
    }

    // 2. Initialize Groq Providers
    for (let i = 1; i <= 10; i++) {
      const key = env[`GROQ_PROVIDER_${i}_KEY`];
      if (!key) continue;

      const model = env[`GROQ_PROVIDER_${i}_MODEL`] || 'llama3-8b-8192';
      const enabledStr = env[`GROQ_PROVIDER_${i}_ENABLED`];
      const enabled = enabledStr ? enabledStr.toLowerCase() === 'true' : true;

      const id = `groq:default-${i}`;
      const provider = new GroqProvider(key, model);

      this.registry.set(id, {
        id,
        type: 'groq',
        model,
        enabled,
        health: 'healthy',
        circuitBreakerOpen: false,
        resetTime: null,
        lastSuccess: null,
        lastFailure: null,
        failureCount: 0,
        rateLimitCount: 0,
        provider,
        capabilities: {
          supportedTaskTypes: [
            'classification', 'query_classification', 'extraction', 'structured_extraction',
            'normalization', 'summarization', 'intent', 'explanation', 'verification'
          ],
          supportsStructuredOutput: true,
          supportsEmbeddings: false,
          supportsWebSearch: false, // Groq does not have built-in web grounding
          costTier: 'cheap',
          priority: i, // Groq 1 = priority 1 (primary), Groq 2 = priority 2 (backup)
        }
      });
      console.log(`[Router] Registered ${id} (${model}) - Enabled: ${enabled}`);
    }

    // 3. Initialize Mistral Providers
    for (let i = 1; i <= 10; i++) {
      const key = env[`MISTRAL_PROVIDER_${i}_KEY`];
      if (!key) continue;

      const model = env[`MISTRAL_PROVIDER_${i}_MODEL`] || 'mistral-small-latest';
      const enabledStr = env[`MISTRAL_PROVIDER_${i}_ENABLED`];
      const enabled = enabledStr ? enabledStr.toLowerCase() === 'true' : true;

      const id = `mistral:default-${i}`;
      const provider = new MistralProvider(key, model);

      this.registry.set(id, {
        id,
        type: 'mistral',
        model,
        enabled,
        health: 'healthy',
        circuitBreakerOpen: false,
        resetTime: null,
        lastSuccess: null,
        lastFailure: null,
        failureCount: 0,
        rateLimitCount: 0,
        provider,
        capabilities: {
          supportedTaskTypes: [
            'classification', 'query_classification', 'extraction', 'structured_extraction',
            'normalization', 'summarization', 'intent', 'explanation', 'verification', 'web_discovery'
          ],
          supportsStructuredOutput: true,
          supportsEmbeddings: false,
          supportsWebSearch: false,
          costTier: 'cheap',
          priority: i, // Mistral 1 = priority 1 (primary), Mistral 2 = priority 2 (backup)
        }
      });
      console.log(`[Router] Registered ${id} (${model}) - Enabled: ${enabled}`);
    }

    // Fallback support for older flat env variables if no specific providers found
    if (this.registry.size === 0) {
      if (env.GEMINI_API_KEY) {
        const id = 'gemini:legacy';
        this.registry.set(id, {
          id,
          type: 'gemini',
          model: 'gemini-flash-latest',
          enabled: true,
          health: 'healthy',
          circuitBreakerOpen: false,
          resetTime: null,
          lastSuccess: null,
          lastFailure: null,
          failureCount: 0,
          rateLimitCount: 0,
          provider: new GeminiProvider(env.GEMINI_API_KEY),
          capabilities: {
            supportedTaskTypes: [
              'classification', 'query_classification', 'extraction', 'structured_extraction',
              'normalization', 'summarization', 'intent', 'explanation', 'verification',
              'web_discovery', 'embedding'
            ],
            supportsStructuredOutput: true,
            supportsEmbeddings: true,
            supportsWebSearch: true,
            costTier: 'moderate',
            priority: 2,
          }
        });
        console.log(`[Router] Registered legacy Gemini provider`);
        
        const flashId = 'gemini:flash';
        this.registry.set(flashId, {
          id: flashId,
          type: 'gemini',
          model: 'gemini-1.5-flash-latest',
          enabled: true,
          health: 'healthy',
          circuitBreakerOpen: false,
          resetTime: null,
          lastSuccess: null,
          lastFailure: null,
          failureCount: 0,
          rateLimitCount: 0,
          provider: new GeminiProvider(env.GEMINI_API_KEY),
          capabilities: {
            supportedTaskTypes: [
              'classification', 'query_classification', 'extraction', 'structured_extraction',
              'normalization', 'summarization', 'intent', 'explanation', 'verification',
              'web_discovery', 'embedding'
            ],
            supportsStructuredOutput: true,
            supportsEmbeddings: true,
            supportsWebSearch: true,
            costTier: 'cheap',
            priority: 1,
          }
        });
        console.log(`[Router] Registered Gemini Flash provider`);
      }
      if (env.GROQ_API_KEY) {
        const id = 'groq:legacy';
        this.registry.set(id, {
          id,
          type: 'groq',
          model: 'llama3-8b-8192',
          enabled: true,
          health: 'healthy',
          circuitBreakerOpen: false,
          resetTime: null,
          lastSuccess: null,
          lastFailure: null,
          failureCount: 0,
          rateLimitCount: 0,
          provider: new GroqProvider(env.GROQ_API_KEY),
          capabilities: {
            supportedTaskTypes: [
              'classification', 'query_classification', 'extraction', 'structured_extraction',
              'normalization', 'summarization', 'intent', 'explanation', 'verification', 'web_discovery'
            ],
            supportsStructuredOutput: true,
            supportsEmbeddings: false,
            supportsWebSearch: false,
            costTier: 'cheap',
            priority: 1,
          }
        });
        console.log(`[Router] Registered legacy Groq provider`);
      }
    }
  }

  // ============================================================
  // ROUTING LOGIC
  // ============================================================

  /** Health recovery: re-enable providers whose cooldown has expired */
  private checkRecovery() {
    const now = new Date();
    for (const [id, state] of this.registry) {
      if (state.resetTime && state.resetTime <= now) {
        console.log(`[Router] Recovery: Provider ${id} cooldown expired. Reactivating.`);
        state.health = 'healthy';
        state.circuitBreakerOpen = false;
        state.resetTime = null;
        state.failureCount = 0; // Partial reset to allow cautious traffic
      }
    }
  }

  /** Retrieve and rank eligible providers based on task requirements */
  private getEligibleProviders(
    taskType: AITaskType,
    complexity: TaskComplexity,
    options?: GenerateOptions
  ): ProviderState[] {
    this.checkRecovery();

    const eligible = Array.from(this.registry.values()).filter(state => {
      // 1. Must be enabled and not in hard error/rate-limited state with active circuit breaker
      if (!state.enabled || state.circuitBreakerOpen || state.health === 'disabled') {
        return false;
      }
      // 2. Must support the specific task type
      if (!state.capabilities.supportedTaskTypes.includes(taskType)) {
        return false;
      }
      // 3. Must match force_provider_id if specified
      if (options?.force_provider_id && !state.id.startsWith(options.force_provider_id)) {
        return false;
      }
      return true;
    });

    // Ranking logic
    return eligible.sort((a, b) => {
      // 1. Health (Healthy > Degraded)
      if (a.health === 'healthy' && b.health !== 'healthy') return -1;
      if (b.health === 'healthy' && a.health !== 'healthy') return 1;

      // 2. Complexity matching
      if (complexity === 'cheap') {
        return a.capabilities.costTier === 'cheap' ? -1 : 1;
      } else if (complexity === 'complex' || complexity === 'critical') {
        // Higher priority (like Gemini) first for complex tasks
        return b.capabilities.priority - a.capabilities.priority;
      }
      return 0; // Stable fallback
    });
  }

  private async executeWithRouting<T>(
    taskType: AITaskType,
    complexity: TaskComplexity,
    executor: (provider: AIProviderInterface, opts?: GenerateOptions) => Promise<T>,
    options?: GenerateOptions
  ): Promise<{ result: T; providerId: string }> {
    const candidates = this.getEligibleProviders(taskType, complexity, options);

    if (candidates.length === 0) {
      throw new AllProvidersUnavailableError(`No eligible providers available for task: ${taskType}`);
    }

    const totalTimeoutMs = options?.total_timeout_ms ?? 30000;
    const perProviderTimeoutMs = options?.per_provider_timeout_ms ?? 15000;
    const maxRetries = options?.max_retries ?? 2;
    const startTime = Date.now();
    const deadline = startTime + totalTimeoutMs;

    for (let i = 0; i < candidates.length; i++) {
      const state = candidates[i];
      let attempt = 0;
      let lastError: Error | null = null;
      
      while (attempt <= maxRetries) {
        attempt++;
        const now = Date.now();
        if (now >= deadline) {
           console.warn(`[Router] TASK: ${taskType} | STATUS: deadline_exceeded`);
           throw new AllProvidersUnavailableError(`Total request timeout exceeded for task: ${taskType}`);
        }

        const remainingDeadline = deadline - now;
        const attemptTimeout = Math.min(perProviderTimeoutMs, remainingDeadline);
        
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(new ProviderTransientError('Timeout')), attemptTimeout);
        
        try {
          const attemptStart = Date.now();
          const runOptions = { ...options, abortSignal: abortController.signal };
          const result = await executor(state.provider, runOptions);
          clearTimeout(timeoutId);
          
          const latency = Date.now() - attemptStart;
          
          // Success
          state.lastSuccess = new Date();
          state.failureCount = 0;
          state.health = 'healthy';
          
          console.log(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: success | LATENCY: ${latency}ms | RETRIES: ${attempt - 1}`);
          return { result, providerId: state.id };

        } catch (error) {
          clearTimeout(timeoutId);
          const isAbortError = error instanceof Error && (error.name === 'AbortError' || error.message === 'Timeout' || (error as any).code === 'ABORT_ERR');
          const effectiveError = isAbortError ? new ProviderTransientError('Timeout') : error;
          lastError = effectiveError instanceof Error ? effectiveError : new Error(String(effectiveError));
          
          const errorName = lastError.name;
          const msg = lastError.message;

          if (errorName === 'ProviderInvalidRequestError') {
            // 400 Bad Request: Do not fail over, it's a client error.
            console.error(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: invalid_request | ERROR: ${msg}`);
            throw lastError;
          }

          if (errorName === 'ProviderAuthError') {
            // 401/403: Disable credential permanently
            state.health = 'disabled';
            state.enabled = false;
            console.error(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: auth_error | MSG: Credential disabled. Alert admin.`);
            break; // Fail over
          }

          if (errorName === 'ProviderRateLimitError') {
            // 429: Rate Limited
            state.health = 'rate_limited';
            state.rateLimitCount++;
            state.circuitBreakerOpen = true;
            const retryAfter = (lastError as any).retryAfterSeconds;
            const cooldownSecs = retryAfter || Math.min(60 * Math.pow(2, state.rateLimitCount), 3600);
            state.resetTime = new Date(Date.now() + cooldownSecs * 1000);
            
            console.warn(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: rate_limited | COOLDOWN: ${cooldownSecs}s | ERROR: ${msg}`);
            break; // Fail over
          }

          if (errorName === 'ProviderTransientError') {
            // 5xx: Transient error. Retry with backoff if attempts remain and deadline allows
            if (attempt <= maxRetries) {
              const checkNow = Date.now();
              const remainingForBackoff = deadline - checkNow;
              const backoffMs = Math.pow(2, attempt) * 500 + Math.random() * 200; // jittered
              
              if (backoffMs >= remainingForBackoff) {
                console.warn(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: transient_error | MSG: Backoff exceeds deadline. | ERROR: ${msg}`);
                break; // Give up on this provider
              }
              
              console.warn(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: retrying_in_${Math.round(backoffMs)}ms | ERROR: ${msg}`);
              await new Promise(r => setTimeout(r, backoffMs));
              continue; // Retry
            } else {
              state.failureCount++;
              if (state.failureCount >= 3) {
                state.health = 'error';
                state.circuitBreakerOpen = true;
                state.resetTime = new Date(Date.now() + 60000); // 1 minute cooldown
                console.warn(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: transient_error | MSG: Circuit breaker opened. | ERROR: ${msg}`);
              } else {
                console.warn(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: transient_error | ERROR: ${msg}`);
              }
              break; // Fail over
            }
          }

          // Unknown error: treat as transient but don't retry locally
          state.failureCount++;
          console.warn(`[Router] TASK: ${taskType} | PROV: ${state.id} | STATUS: unknown_error | ERROR: ${msg}`);
          break; // Fail over
        }
      }
    }

    throw new AllProvidersUnavailableError(`All eligible providers failed for task: ${taskType}`);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    const task = options?.task_type ?? 'extraction';
    const complexity = options?.complexity ?? 'cheap';
    
    // Aggressive token optimization
    options = {
      ...options,
      max_tokens: Math.min(options?.max_tokens || 400, 800)
    };

    const { result } = await this.executeWithRouting(
      task,
      complexity,
      (provider, runOpts) => provider.generateText(prompt, systemPrompt, runOpts),
      options
    );
    return result;
  }

  async generateStructuredOutput<T>(
    prompt: string,
    systemPrompt: string,
    responseSchema: Record<string, unknown>,
    options?: GenerateOptions
  ): Promise<T> {
    const task = options?.task_type ?? 'structured_extraction';
    const complexity = options?.complexity ?? 'cheap';

    // Aggressive token optimization
    options = {
      ...options,
      max_tokens: Math.min(options?.max_tokens || 500, 1000)
    };

    const { result } = await this.executeWithRouting(
      task,
      complexity,
      (provider, runOpts) => provider.generateStructuredOutput<T>(prompt, systemPrompt, responseSchema, runOpts),
      options
    );
    return result;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const { result } = await this.executeWithRouting(
      'embedding',
      'moderate',
      (provider, runOpts) => provider.generateEmbedding(text)
    );
    return result;
  }

  // ============================================================
  // OBSERVABILITY & ADMIN
  // ============================================================

  getRegistryState() {
    // Return safe public state (no secrets)
    return Array.from(this.registry.values()).map(state => ({
      id: state.id,
      type: state.type,
      projectId: state.projectId,
      model: state.model,
      enabled: state.enabled,
      health: state.health,
      circuitBreakerOpen: state.circuitBreakerOpen,
      resetTime: state.resetTime,
      failureCount: state.failureCount,
      rateLimitCount: state.rateLimitCount,
    }));
  }

  forceResetAll(): void {
    for (const [id, state] of this.registry.entries()) {
      if (state.health === 'rate_limited' || state.health === 'error' || state.health === 'disabled') {
        state.health = 'healthy';
        state.enabled = true; // For testing disabled credentials resetting too
        state.circuitBreakerOpen = false;
        state.resetTime = null;
        state.rateLimitCount = 0;
        state.failureCount = 0;
      }
    }
  }

  forceProviderStatus(providerType: string, health: 'healthy' | 'down', taskType?: string): void {
    for (const [id, state] of this.registry.entries()) {
      if (state.type === providerType) {
        if (taskType) {
          if (health === 'down') {
             state.capabilities.supportedTaskTypes = state.capabilities.supportedTaskTypes.filter(t => t !== taskType);
          } else {
             if (!state.capabilities.supportedTaskTypes.includes(taskType as any)) {
               state.capabilities.supportedTaskTypes.push(taskType as any);
             }
          }
        } else {
          state.health = health === 'down' ? 'disabled' : 'healthy';
          state.enabled = health === 'down' ? false : true;
        }
      }
    }
  }
}

// Singleton factory
let routerInstance: AIProviderRouter | null = null;

export function getAIRouter(): AIProviderRouter {
  if (!routerInstance) {
    routerInstance = new AIProviderRouter();
  }
  return routerInstance;
}
