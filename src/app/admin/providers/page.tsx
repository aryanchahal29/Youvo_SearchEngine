import { createClient } from '@/lib/supabase/server';

export default async function ProvidersAdminPage() {
  const supabase = await createClient();
  const { data: providers } = await supabase.from('ai_providers').select('*').order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Providers</h1>
        <p className="text-gray-500 mt-1">Monitor the health and usage of backend extraction models.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers?.map(provider => (
          <div key={provider.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${provider.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900 capitalize">{provider.name}</h3>
                <p className="text-sm text-gray-500">Model: {provider.model_version}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${provider.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {provider.status}
              </span>
            </div>
            
            <div className="mt-6 border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Usage</p>
                <p className="text-lg font-semibold text-gray-900">{provider.usage_count} <span className="text-xs font-normal text-gray-500">requests</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Error Rate</p>
                <p className="text-lg font-semibold text-gray-900">{provider.error_count} <span className="text-xs font-normal text-gray-500">errors</span></p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <span className="text-xs text-gray-400">Note: API Keys are securely managed and never displayed.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
