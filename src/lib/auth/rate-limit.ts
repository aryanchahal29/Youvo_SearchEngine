import { rateLimiter } from '@/lib/security/rate-limiter';

export async function checkRateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000): Promise<boolean> {
  const result = await rateLimiter.check(ip, maxRequests, windowMs);
  return result.allowed;
}
