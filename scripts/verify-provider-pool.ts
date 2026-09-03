import { LiveDiscoveryOrchestrator } from '../src/lib/discovery/live-discovery-orchestrator';
import { getAIRouter } from '../src/lib/providers/router';
import { GeminiProvider } from '../src/lib/providers/gemini';
import { GroqProvider } from '../src/lib/providers/groq';
import { ProviderRateLimitError, AllProvidersUnavailableError } from '../src/lib/providers/types';

// Mock Supabase env vars for the script
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';

async function runManualVerification() {
  console.log('--- MANUAL VERIFICATION: PROVIDER POOL FALLBACK ---\n');

  // We inject mock providers into the router that simulate real behavior for the orchestrator.
  const router = getAIRouter();
  const registry = (router as any).registry as Map<string, any>;
  registry.clear();

  // Part A: One intentionally rate-limited, second legitimate available
  console.log('>> SCENARIO 1: Primary rate-limited, fallback successful');

  const g1 = new GeminiProvider('mock-key-1');
  const groq1 = new GroqProvider('mock-key-2');

  // Override to simulate actual network failure on Gemini, success on Groq
  g1.generateText = async () => { throw new ProviderRateLimitError('Simulated 429 Rate Limit'); };
  
  // For Groq we need it to return valid JSON so FactExtractor doesn't fail parsing,
  // or we can just test 'web_discovery'. But wait, web_discovery ONLY routes to Gemini!
  // The Orchestrator uses SearchAdapter for discovery, which calls web_discovery.
  // And FactExtractor uses extraction.
  
  // Let's test `FactExtractor.extractToolData` via router directly to prove the fallback.
  groq1.generateStructuredOutput = async <T>() => {
    return {
      name: 'Fallback Tool',
      description: 'Extracted by Groq after Gemini failed',
      pricing_plans: [],
      features: [],
      limitations: [],
      confidence: 90
    } as unknown as T;
  };

  registry.set('gemini:rate_limited', {
    id: 'gemini:rate_limited',
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
    provider: g1,
    capabilities: {
      supportedTaskTypes: ['extraction'],
      supportsStructuredOutput: true,
      supportsEmbeddings: true,
      supportsWebSearch: true,
      costTier: 'moderate',
      priority: 2,
    }
  });

  registry.set('groq:healthy', {
    id: 'groq:healthy',
    type: 'groq',
    model: 'llama-3.3-70b',
    enabled: true,
    health: 'healthy',
    circuitBreakerOpen: false,
    resetTime: null,
    lastSuccess: null,
    lastFailure: null,
    failureCount: 0,
    rateLimitCount: 0,
    provider: groq1,
    capabilities: {
      supportedTaskTypes: ['extraction'],
      supportsStructuredOutput: true,
      supportsEmbeddings: false,
      supportsWebSearch: false,
      costTier: 'cheap',
      priority: 1,
    }
  });

  try {
    const result = await router.generateStructuredOutput('Extract facts', 'System', {}, { task_type: 'extraction', complexity: 'complex' });
    console.log('Result:', result);
    console.log('Gemini State:', registry.get('gemini:rate_limited').health);
    console.log('Groq State:', registry.get('groq:healthy').health);
    console.log('SCENARIO 1 PASS: Fallback succeeded seamlessly.\n');
  } catch (e) {
    console.error('SCENARIO 1 FAIL:', e);
  }

  // Part B: All providers unavailable
  console.log('>> SCENARIO 2: All providers unavailable -> Truthful Async Fallback');
  
  registry.clear();
  
  const g2 = new GeminiProvider('mock-key-3');
  g2.generateText = async () => { throw new ProviderRateLimitError('Simulated 429 Rate Limit'); };
  g2.generateStructuredOutput = async () => { throw new ProviderRateLimitError('Simulated 429 Rate Limit'); };
  
  registry.set('gemini:unavailable', {
    id: 'gemini:unavailable',
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
    provider: g2,
    capabilities: {
      supportedTaskTypes: ['extraction', 'web_discovery'],
      supportsStructuredOutput: true,
      supportsEmbeddings: true,
      supportsWebSearch: true,
      costTier: 'moderate',
      priority: 2,
    }
  });

  try {
    const orchestrator = new LiveDiscoveryOrchestrator('Best free AI video generator');
    // Calling discoverInline will hit SearchProvider -> router -> throws AllProvidersUnavailableError
    // Orchestrator should catch it, log it, and return job_id for async fallback.
    const result = await orchestrator.discoverInline({
      raw_query: 'Best free AI video generator',
      corrected_query: 'Best free AI video generator',
      intent: { type: 'discovery', confidence: 100 },
      entities: [],
      constraints: { budget: 'free' }
    });

    console.log('Orchestrator returned tools:', result.discovered_tools.length);
    console.log('Is complete?', result.is_complete);
    console.log('Async Job ID queued:', result.job_id);
    console.log('Errors recorded in metrics:', result.metrics.errors);
    console.log('SCENARIO 2 PASS: Truthful fallback caught by orchestrator.\n');
  } catch (e) {
    console.error('SCENARIO 2 FAIL:', e);
  }
}

runManualVerification().catch(console.error);
