export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
}

export interface RateLimiter {
  check(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

// In-memory fallback implementation (Free-first requirement)
class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, { count: number; expiresAt: number }>();

  async check(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let record = this.store.get(identifier);

    if (!record || record.expiresAt < now) {
      record = { count: 0, expiresAt: now + windowMs };
    }

    record.count += 1;
    this.store.set(identifier, record);

    return {
      allowed: record.count <= limit,
      limit,
      remaining: Math.max(0, limit - record.count),
      resetTimeMs: record.expiresAt,
    };
  }
}

import { createClient } from '@supabase/supabase-js';

// Global singletons for Supabase client
const getSupabase = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
};

class SupabaseRateLimiter implements RateLimiter {
  private fallback = new InMemoryRateLimiter();

  async check(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const supabase = getSupabase();
    
    if (!supabase) {
      console.warn('Rate limiter falling back to in-memory: Missing Supabase credentials');
      return this.fallback.check(identifier, limit, windowMs);
    }

    try {
      const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
        p_ip: identifier,
        p_endpoint: 'global', // We can expand this later to use endpoints
        p_limit: limit,
        p_window_ms: windowMs
      });

      if (error) {
        console.error('Supabase rate limit RPC error:', error);
        // Fail-safe: Deny access if rate limit fails
        return { allowed: false, limit, remaining: 0, resetTimeMs: Date.now() + windowMs };
      }

      return {
        allowed: !!allowed,
        limit,
        remaining: allowed ? 1 : 0, // Simplified for now since RPC handles the math
        resetTimeMs: Date.now() + windowMs // Approximate
      };
    } catch (err) {
      console.error('Supabase rate limit exception:', err);
      // Deny by default on exception
      return { allowed: false, limit, remaining: 0, resetTimeMs: Date.now() + windowMs };
    }
  }
}

// Global instance to persist across HMR in dev
const globalForRateLimiter = globalThis as unknown as {
  _rateLimiter: RateLimiter | undefined;
};

export const rateLimiter = globalForRateLimiter._rateLimiter ?? new SupabaseRateLimiter();

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimiter._rateLimiter = rateLimiter;
}
