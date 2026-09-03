// YouVo: Environment variable validation
// Fails at build time if required vars are missing
// Security Spec §4: API keys never in frontend code

type EnvConfig = {
  // Public (safe for browser)
  supabaseUrl: string;
  supabaseAnonKey: string;
  // Server-only (NEVER exposed to browser)
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  groqApiKey: string;
  // Optional discovery tokens (graceful degradation if missing)
  productHuntToken: string;
  githubToken: string;
};

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Make sure it is set in your .env.local file.`
    );
  }
  return value || '';
}

// Public env vars (prefixed with NEXT_PUBLIC_ — safe for browser)
export function getPublicEnv() {
  return {
    supabaseUrl: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

// Server-only env vars (NEVER prefixed with NEXT_PUBLIC_)
// These must only be called from server components, route handlers, or server actions
export function getServerEnv(): EnvConfig {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServerEnv() was called in browser context! ' +
      'Server environment variables must never be accessed from client code. ' +
      'This is a security violation.'
    );
  }
  
  return {
    supabaseUrl: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    geminiApiKey: getEnvVar('GEMINI_API_KEY'),
    groqApiKey: getEnvVar('GROQ_API_KEY'),
    // Optional discovery tokens (not required for core operation)
    productHuntToken: getEnvVar('PRODUCT_HUNT_TOKEN', false),
    githubToken: getEnvVar('GITHUB_TOKEN', false),
  };
}

// Validate that no secret keys are accidentally exposed as NEXT_PUBLIC_
export function validateSecurityInvariants() {
  const dangerousVars = [
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_GEMINI_API_KEY',
    'NEXT_PUBLIC_GROQ_API_KEY',
  ];
  
  for (const varName of dangerousVars) {
    if (process.env[varName]) {
      throw new Error(
        `SECURITY VIOLATION: ${varName} is set as a public environment variable! ` +
        `Remove the NEXT_PUBLIC_ prefix immediately. ` +
        `This key must never be exposed to the browser.`
      );
    }
  }
}
