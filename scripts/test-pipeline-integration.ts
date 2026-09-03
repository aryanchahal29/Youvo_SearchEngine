import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../src/lib/supabase/server';
import { hybridSearch } from '../src/lib/search/hybrid-search';
import { processQuery } from '../src/lib/search/query-processor';
import { MockSearchProvider } from '../src/lib/discovery/mock-search-adapter';
import { DeduplicationEngine } from '../src/lib/discovery/deduplication';

async function cleanupDatabase(supabase: any) {
  console.log('Cleaning up mock tools and caches...');
  await supabase.from('search_cache').delete().ilike('normalized_query', '%mock%');
  
  const { data: tools } = await supabase.from('tools').select('id, name').eq('name', 'MockVideoGen AI');
  if (tools && tools.length > 0) {
    const ids = tools.map((t: any) => t.id);
    await supabase.from('tools').delete().in('id', ids);
    console.log(`Deleted ${tools.length} old mock tools.`);
  }
}

async function runMockTest() {
  const supabase = createAdminClient();
  await cleanupDatabase(supabase);

  // 1. Mock fetch for the orchestrator's crawl step
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('mockvideogen.test')) {
      const res = new Response(`
        <html>
          <head><title>MockVideoGen AI</title></head>
          <body>
            <h1>The Best AI Video Generator</h1>
            <p>Generate stunning videos from text. We offer a free plan with watermarks.</p>
            <a href="/pricing">Pricing</a>
            <div>$10/month premium plan. Free tier available.</div>
          </body>
        </html>
      `, { status: 200, headers: { 'Content-Type': 'text/html' } });
      
      Object.defineProperty(res, 'url', { value: url });
      return res;
    }
    return originalFetch(input, init);
  };

  console.log('\n======================================================');
  console.log('PIPELINE INTEGRATION TEST (MOCK ADAPTER & MOCK PAGES)');
  console.log('======================================================\n');

  const queryStr = 'best free ai mock video generator';
  const start = Date.now();

  try {
    const processedQuery = await processQuery(queryStr);
    
    // Inject Mock Adapter
    const customAdapters = [new MockSearchProvider()];
    
    // Execute hybridSearch
    const searchResults = await hybridSearch(processedQuery, 10, customAdapters);

    const metrics = searchResults.discovery_metrics;
    console.log('\n--- PIPELINE METRICS ---');
    console.log(JSON.stringify(metrics, null, 2));

    console.log('\n--- RETURNED RECOMMENDATIONS ---');
    console.log(JSON.stringify(searchResults.candidates, null, 2));

    // VERIFY CRITERIA
    const pass = 
      metrics?.live_discovery === true &&
      metrics.discovered >= 1 &&
      metrics.crawl_succeeded >= 1 &&
      metrics.facts_extracted >= 1 &&
      searchResults.candidates.length > 0;

    console.log('\n--- MOCKED PIPELINE TEST RESULT ---');
    console.log(pass ? '✅ SUCCESS: E2E Pipeline works deterministically.' : '❌ FAILED: Acceptance criteria not met.');
    
  } finally {
    global.fetch = originalFetch;
  }
}

runMockTest().catch(console.error);
