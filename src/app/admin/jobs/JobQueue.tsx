'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Job = {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  attempt_count: number;
  locked_by: string | null;
  started_at: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
  error: string | null;
};

export default function JobQueue({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('automation_jobs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'automation_jobs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((current) => [payload.new as Job, ...current].slice(0, 50));
          } else if (payload.eventType === 'UPDATE') {
            setJobs((current) =>
              current.map((job) => (job.id === payload.new.id ? (payload.new as Job) : job))
            );
          } else if (payload.eventType === 'DELETE') {
            setJobs((current) => current.filter((job) => job.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Attempts</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Worker Lock</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Started</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{job.job_type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                      job.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                        : job.status === 'failed'
                        ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10'
                        : job.status === 'running'
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10 animate-pulse'
                        : job.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10'
                        : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.attempt_count} / 3</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {job.locked_by ? (
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">{job.locked_by}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(job.started_at)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={job.error || ''}>
                  {job.error ? <span className="text-red-600">{job.error}</span> : '-'}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  No automation jobs in the queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
