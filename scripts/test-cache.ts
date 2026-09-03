import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { hybridSearch } from '../src/lib/search/hybrid-search';
import { getAIRouter } from '../src/lib/providers/router';

async function main() {
  const router = getAIRouter();
  router.forceProviderStatus('gemini:proj-proj-1', 'unavailable');
  router.forceProviderStatus('gemini:proj-proj-2', 'unavailable');
  router.forceProviderStatus('gemini:proj-proj-3', 'unavailable');
  router.forceProviderStatus('groq:default-1', 'available');

  console.log('Running search for "tool for vibe coding"...');
  const result = await hybridSearch({
    raw_query: 'tool for vibe coding',
    corrected_query: 'tool for vibe coding',
    intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: true },
    constraints: {},
    category: null,
  });
  console.log('\n--- Result ---');
  console.log(`Tools Recommended: ${result.results?.length ?? 0}`);
  console.log(`Is Discovering: ${result.is_discovering}`);
  console.log(`DB Candidates Evaluated: ${result.metrics?.db_candidates}`);
}
main().catch(console.error);
