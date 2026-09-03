import { getAIRouter } from '@/lib/providers/router';

export default async function SourcesAdminPage() {
  const router = getAIRouter();
  const providers = router.getRegistryState();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sources & Providers</h1>
        <p className="text-gray-500 mt-1">Live health status of AI providers and discovery sources.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Breaker</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate Limits</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Failures</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {providers.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {p.id}
                  {!p.enabled && <span className="ml-2 text-xs text-red-500 font-normal">(Disabled)</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.model}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                    p.health === 'healthy' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' :
                    p.health === 'rate_limited' ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' :
                    p.health === 'error' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10' :
                    'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10'
                  }`}>
                    {p.health}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {p.circuitBreakerOpen ? (
                    <span className="text-red-600 font-medium">OPEN (Tripped)</span>
                  ) : (
                    <span className="text-emerald-600">CLOSED</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.rateLimitCount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.failureCount}</td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No providers registered in the router.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
