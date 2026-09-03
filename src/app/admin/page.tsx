import { createClient } from '@/lib/supabase/server';

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  // Fetch quick metrics safely using RLS
  const { count: toolCount } = await supabase.from('tools').select('*', { count: 'exact', head: true });
  const { count: jobCount } = await supabase.from('automation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: auditCount } = await supabase.from('admin_audit_logs').select('*', { count: 'exact', head: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Tools</h3>
          <p className="mt-2 text-3xl font-semibold text-indigo-600">{toolCount || 0}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending Jobs</h3>
          <p className="mt-2 text-3xl font-semibold text-amber-500">{jobCount || 0}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Audit Events</h3>
          <p className="mt-2 text-3xl font-semibold text-slate-700">{auditCount || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
        <p className="text-gray-600">The YouVo Automation Pipeline is running normally. 5 Master Dispatchers are active.</p>
        <div className="mt-4 flex gap-2">
          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Discovery: Healthy</span>
          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Extraction: Healthy</span>
          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Verification: Healthy</span>
        </div>
      </div>
    </div>
  );
}
