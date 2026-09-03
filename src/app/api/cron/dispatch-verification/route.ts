import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/cron';
import { VerificationDispatcherHandler } from '@/lib/jobs/handlers/verification';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const workerId = `worker-verification-${crypto.randomUUID().substring(0, 8)}`;
  try {
    const handler = new VerificationDispatcherHandler();
    const result = await handler.dispatch(workerId, 5, 5);
    return NextResponse.json({ dispatcher: 'verification', worker_id: workerId, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
