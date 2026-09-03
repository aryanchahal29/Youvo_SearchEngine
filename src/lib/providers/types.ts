// YouVo: AI Provider abstraction types
// TDA §18: Use a provider abstraction
// PRD §31 Rule 7: No provider lock-in

// ============================================================
// PROVIDER INTERFACE
// ============================================================

export type TaskComplexity = 'cheap' | 'moderate' | 'complex' | 'critical';

export type AITaskType =
  | 'classification'
  | 'query_classification'
  | 'extraction'
  | 'structured_extraction'
  | 'normalization'
  | 'summarization'
  | 'intent'
  | 'explanation'
  | 'verification'
  | 'web_discovery'
  | 'embedding';

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency_ms: number | null;
  last_check: Date;
  error: string | null;
}

export interface ProviderUsage {
  requests_used: number;
  tokens_used: number;
  free_limit: number | null;
  usage_percentage: number;
  reset_time: Date | null;
}

export interface GenerateOptions {
  temperature?: number;
  max_tokens?: number;
  task_type?: AITaskType;
  complexity?: TaskComplexity;
  force_provider_id?: string;
  
  // Timeout and Failure Control
  abortSignal?: AbortSignal;
  total_timeout_ms?: number;
  per_provider_timeout_ms?: number;
  max_retries?: number;
}

export interface StructuredOutputOptions<T> extends GenerateOptions {
  schema: T;
  schema_description?: string;
}

export interface AIProviderInterface {
  name: string;
  displayName: string;
  
  // Core generation
  generateText(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string>;
  
  // Structured output (JSON)
  generateStructuredOutput<T>(
    prompt: string,
    systemPrompt: string,
    responseSchema: Record<string, unknown>,
    options?: GenerateOptions
  ): Promise<T>;
  
  // Embeddings
  generateEmbedding(text: string): Promise<number[]>;
  
  // Health & usage
  healthCheck(): Promise<ProviderHealth>;
  getUsage(): Promise<ProviderUsage>;
  
  // Capability check
  supportsTask(taskType: AITaskType): boolean;
  supportsEmbeddings(): boolean;
}

// ============================================================
// ROUTER TYPES
// ============================================================

export interface RoutingDecision {
  provider: AIProviderInterface;
  reason: string;
  fallback: AIProviderInterface | null;
}

export interface TaskRequest {
  task_type: AITaskType;
  complexity: TaskComplexity;
  prompt: string;
  system_prompt?: string;
  require_embedding?: boolean;
}

// ============================================================
// PROVIDER POOL TYPES
// ============================================================

export interface ProviderCapability {
  supportedTaskTypes: AITaskType[];
  supportsStructuredOutput: boolean;
  supportsEmbeddings: boolean;
  supportsWebSearch: boolean;
  contextLimitTokens?: number;
  costTier: 'cheap' | 'moderate' | 'expensive';
  priority: number;
}

export interface ProviderState {
  id: string; // e.g. "gemini-1", "groq-default"
  type: string; // "gemini", "groq"
  projectId?: string;
  model: string;
  enabled: boolean;
  
  // State
  health: 'healthy' | 'rate_limited' | 'error' | 'disabled';
  circuitBreakerOpen: boolean;
  resetTime: Date | null;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  failureCount: number;
  rateLimitCount: number;
  
  provider: AIProviderInterface;
  capabilities: ProviderCapability;
}

export class AllProvidersUnavailableError extends Error {
  constructor(message: string = 'All eligible AI providers are currently unavailable.') {
    super(message);
    this.name = 'AllProvidersUnavailableError';
  }
}

export class ProviderRateLimitError extends Error {
  retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ProviderRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ProviderTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderTransientError';
  }
}

export class ProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderInvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderInvalidRequestError';
  }
}
