import { createClient } from '@/lib/supabase/server';
import { enqueueToolJob } from './actions';

export default async function ToolsAdminPage() {
  const supabase = await createClient();
  
  // Fetch tools with their latest score
  const { data: tools } = await supabase
    .from('tools')
    .select('*, tool_categories(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tools Directory</h1>
        <p className="text-gray-500 mt-1">Manage discovered tools and manually trigger pipeline jobs.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tool</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk Level</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Manual Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tools?.map((tool) => (
                <tr key={tool.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{tool.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]" title={tool.slug}>{tool.slug}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(tool.tool_categories as any)?.name || 'Uncategorized'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                      tool.status === 'verified' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' :
                      tool.status === 'dead' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10' :
                      'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10'
                    }`}>
                      {tool.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      tool.risk_level === 'high_risk' ? 'text-red-700 bg-red-50' :
                      tool.risk_level === 'elevated' ? 'text-amber-700 bg-amber-50' :
                      'text-gray-600 bg-gray-50'
                    }`}>
                      {tool.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2 flex justify-end">
                    <form action={async () => {
                      'use server';
                      await enqueueToolJob(tool.id, 'score', 'Manual re-score triggered by admin');
                    }}>
                      <button type="submit" className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded text-xs font-semibold border border-indigo-100 transition-colors">
                        Re-score
                      </button>
                    </form>
                    <form action={async () => {
                      'use server';
                      await enqueueToolJob(tool.id, 'reindex', 'Manual re-index triggered by admin');
                    }}>
                      <button type="submit" className="text-slate-600 hover:text-slate-900 bg-slate-50 px-3 py-1 rounded text-xs font-semibold border border-slate-200 transition-colors">
                        Re-index
                      </button>
                    </form>
                    <form action={async () => {
                      'use server';
                      await enqueueToolJob(tool.id, 'dead_link_check', 'Manual health check triggered by admin');
                    }}>
                      <button type="submit" className="text-amber-600 hover:text-amber-900 bg-amber-50 px-3 py-1 rounded text-xs font-semibold border border-amber-200 transition-colors">
                        Health Check
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(!tools || tools.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No tools found in the directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
