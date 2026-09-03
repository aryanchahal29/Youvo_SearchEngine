import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

async function checkCronStats() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: jobs, error } = await supabase.from('automation_jobs').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  const stats = {
    extract: { claimed: 0, completed: 0, failed: 0, retries: 0, lastRun: null },
    verify: { claimed: 0, completed: 0, failed: 0, retries: 0, lastRun: null },
    discovery: { claimed: 0, completed: 0, failed: 0, retries: 0, lastRun: null }
  };
  
  for (const job of jobs) {
    let type = job.job_type;
    if (!stats[type as keyof typeof stats]) continue;
    
    stats[type as keyof typeof stats].claimed++;
    if (job.status === 'completed') stats[type as keyof typeof stats].completed++;
    if (job.status === 'failed') stats[type as keyof typeof stats].failed++;
    stats[type as keyof typeof stats].retries += job.retry_count || 0;
    
    if (job.completed_at) {
      const completedAt = new Date(job.completed_at);
      const currentLast = stats[type as keyof typeof stats].lastRun;
      if (!currentLast || completedAt > new Date(currentLast)) {
        stats[type as keyof typeof stats].lastRun = job.completed_at;
      }
    }
  }
  
  console.log('Cron Job Execution Stats (Database Truth):');
  console.log(JSON.stringify(stats, null, 2));
}

checkCronStats().then(() => process.exit(0));
