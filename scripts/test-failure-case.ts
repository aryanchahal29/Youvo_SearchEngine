import { config } from 'dotenv';
config({ path: '.env.local' });
import { hybridSearch } from '../src/lib/search/hybrid-search';

async function runFailureTest() {
  process.env.GEMINI_API_KEY = 'invalid';
  process.env.TAVILY_API_KEY = 'invalid';

  try {
    const result = await hybridSearch({
      raw_query: 'test failure query',
      corrected_query: 'test failure query',
      intent: { type: 'finding', confidence: 0.9, requires_live_discovery: true, requires_recent_data: false },
      constraints: {},
      category: null,
    });
    console.log('\n--- Final Output ---');
    console.log('Result Source:', result.source);
    console.log('Result Cache State:', result.cache_state);
    console.log('Candidates returned:', result.candidates.length);
  } catch (error) {
    console.error('Search threw error:', error);
  }
}
runFailureTest();
