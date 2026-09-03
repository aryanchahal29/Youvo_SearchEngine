import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/cron';
import { ReputationDispatcherHandler } from '@/lib/jobs/handlers/reputation';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const workerId = `worker-reputation-${crypto.randomUUID().substring(0, 8)}`;
  try {
    const handler = new ReputationDispatcherHandler();
    const result = await handler.dispatch(workerId, 5, 5);
    return NextResponse.json({ dispatcher: 'reputation', worker_id: workerId, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
