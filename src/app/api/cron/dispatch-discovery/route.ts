import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/cron';
import { DiscoveryHandler } from '@/lib/jobs/handlers/discovery';

export const maxDuration = 300; // 5 mins Vercel function timeout (if deployed there)

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerId = `worker-discovery-${crypto.randomUUID().substring(0, 8)}`;
  
  try {
    const handler = new DiscoveryHandler();
    // Use lease duration of 5 minutes, limit 3 concurrent per worker instance
    const result = await handler.dispatch(workerId, 3, 5);
    
    return NextResponse.json({
      dispatcher: 'discovery',
      worker_id: workerId,
      ...result
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
