import { createClient } from '@/lib/supabase/server';
import { updateRankingConfig } from './actions';

export default async function RankingsAdminPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from('ranking_config').select('*').single();
  
  // Fetch top 50 recent scores for visualizer, joined with tool name
  const { data: scores } = await supabase
    .from('tool_scores')
    .select('*, tools(name)')
    .order('calculated_at', { ascending: false })
    .limit(50);

  if (!config) return <div>No configuration found.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ranking Configuration</h1>
        <p className="text-gray-500 mt-1">Adjust the global weights for the hybrid search scoring algorithm.</p>
      </div>

      <form action={updateRankingConfig} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Relevance Weight</label>
            <input type="number" step="0.1" name="relevance_weight" defaultValue={config.relevance_weight} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Value Weight</label>
            <input type="number" step="0.1" name="value_weight" defaultValue={config.value_weight} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ease Weight</label>
            <input type="number" step="0.1" name="ease_weight" defaultValue={config.ease_weight} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reputation Weight</label>
            <input type="number" step="0.1" name="reputation_weight" defaultValue={config.reputation_weight} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700">Reason for Change (Required)</label>
          <p className="text-xs text-gray-500 mb-2">This will be permanently recorded in the audit log.</p>
          <textarea name="reason" required rows={3} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"></textarea>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium">
            Save & Audit Configuration
          </button>
        </div>
      </form>

      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Ranking Visualizer (Live Scores)</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tool</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Overall</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reputation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Risk Penalty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Version</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scores?.map((score) => (
                  <tr key={score.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {(score.tools as any)?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-indigo-600">
                      {score.overall_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {score.value_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {score.reputation_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-red-500">
                      -{score.risk_penalty.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {(score.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                      v{score.ranking_version}
                    </td>
                  </tr>
                ))}
                {(!scores || scores.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      No tool scores calculated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
