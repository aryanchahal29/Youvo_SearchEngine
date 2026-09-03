import { NextRequest } from 'next/server';
import crypto from 'crypto';

export function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7).trim();
  const secret = (process.env.CRON_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-do-not-use-in-prod' : '')).trim();
  
  if (!secret) {
    console.error('[CRON AUTH] Missing CRON_SECRET in production environment');
    return false;
  }

  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(secret);
    
    // Length must match for timingSafeEqual, otherwise it throws
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
  } catch (error) {
    return false;
  }
}
