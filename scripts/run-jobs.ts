import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { DiscoveryHandler } from '../src/lib/jobs/handlers/discovery';
import { VerificationDispatcherHandler } from '../src/lib/jobs/handlers/verification';
import { MaintenanceDispatcherHandler } from '../src/lib/jobs/handlers/maintenance';

async function run() {
  console.log('Running Discovery Handler...');
  const discHandler = new DiscoveryHandler();
  await discHandler.dispatch('test-worker-disc', 5, 5);
  
  console.log('Running Verification Handler...');
  const verHandler = new VerificationDispatcherHandler();
  await verHandler.dispatch('test-worker-ver', 5, 5);

  console.log('Running Maintenance Handler (for embed/score)...');
  const mainHandler = new MaintenanceDispatcherHandler();
  await mainHandler.dispatch('test-worker-main', 5, 5);
  
  console.log('Done Processing ALL Jobs!');
}
run().catch(console.error);
