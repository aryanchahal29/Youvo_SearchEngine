"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";

type DiscoveryStage = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

export function LiveDiscoveryProgress({ jobId }: { jobId: string }) {
  const [stages, setStages] = useState<DiscoveryStage[]>([
    { id: 'discover', label: 'Understanding your request', status: 'pending' },
    { id: 'extract', label: 'Finding fresh tools', status: 'pending' },
    { id: 'verify', label: 'Checking official sources', status: 'pending' },
    { id: 'score', label: 'Verifying pricing & Ranking', status: 'pending' }
  ]);
  const supabase = createClient();

  useEffect(() => {
    // We assume the initial job passed in is the "master" discovery job, or 
    // we just listen for any jobs related to this search session.
    // For now, if we have a job ID, we track its status.
    if (!jobId) return;

    // Set initial stage to running
    setStages(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'running' } : s));

    const channel = supabase
      .channel(`job_${jobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'automation_jobs' },
        (payload) => {
          const job = payload.new as any;
          if (!job) return;

          setStages(currentStages => {
            const newStages = [...currentStages];
            
            // Map job types to our UI stages
            let stageIndex = -1;
            if (job.job_type === 'discover' || job.job_type === 'fetch') stageIndex = 0;
            else if (job.job_type === 'extract') stageIndex = 1;
            else if (job.job_type === 'verify') stageIndex = 2;
            else if (job.job_type === 'score' || job.job_type === 'embed' || job.job_type === 'reindex') stageIndex = 3;

            if (stageIndex >= 0) {
              if (job.status === 'running') {
                newStages[stageIndex].status = 'running';
                for (let i = 0; i < stageIndex; i++) {
                  newStages[i].status = 'completed';
                }
              } else if (job.status === 'completed') {
                newStages[stageIndex].status = 'completed';
                setTimeout(() => window.location.reload(), 1500);
              } else if (job.status === 'failed') {
                newStages[stageIndex].status = 'failed';
                setTimeout(() => window.location.reload(), 1500);
              }
            }
            return newStages;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, supabase]);

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Live Discovery Active</h3>
        <div className="space-y-6">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {stage.status === 'pending' && <Circle className="w-5 h-5 text-gray-300" />}
                {stage.status === 'running' && <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />}
                {stage.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {stage.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-500" />}
              </div>
              <div className={`text-sm font-medium transition-colors duration-200 ${
                stage.status === 'running' ? 'text-indigo-900' :
                stage.status === 'completed' ? 'text-gray-900' :
                stage.status === 'failed' ? 'text-red-600' :
                'text-gray-400'
              }`}>
                {stage.label}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-8 pt-6 border-t border-gray-100">
          We are analyzing real-time data to find the best tools for your specific requirements.
        </p>
      </div>
    </div>
  );
}
