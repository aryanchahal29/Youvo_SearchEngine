import { createClient } from '@/lib/supabase/server';
import JobQueue from './JobQueue';

export default async function JobsAdminPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase.from('automation_jobs').select('*').order('created_at', { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automation Queue</h1>
        <p className="text-gray-500 mt-1">Live monitoring of background tasks via Supabase Realtime.</p>
      </div>

      <JobQueue initialJobs={jobs || []} />
    </div>
  );
}
