import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/cron';
import { MaintenanceDispatcherHandler } from '@/lib/jobs/handlers/maintenance';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const workerId = `worker-maintenance-${crypto.randomUUID().substring(0, 8)}`;
  try {
    const handler = new MaintenanceDispatcherHandler();
    const result = await handler.dispatch(workerId, 5, 5);
    return NextResponse.json({ dispatcher: 'maintenance', worker_id: workerId, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
