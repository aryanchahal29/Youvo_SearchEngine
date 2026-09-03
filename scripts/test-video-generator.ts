import { config } from 'dotenv';
config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/server';
import { processQuery } from '../src/lib/search/query-processor';
import { hybridSearch } from '../src/lib/search/hybrid-search';
import { rankTools } from '../src/lib/ranking/ranking-engine';

async function runTest() {
  const supabase = createAdminClient();
  const rawQuery = "Best free AI video generator";
  
  console.log("Clearing cache...");
  await supabase.from('search_cache').delete().ilike('normalized_query', '%free ai video generator%');

  console.log("\n--- 1. Query processor ---");
  const processed = await processQuery(rawQuery);
  console.log(JSON.stringify({
    corrected_query: processed.corrected_query,
    intent: processed.intent,
    category: processed.category,
    constraints: processed.constraints
  }, null, 2));

  console.log("\n--- 2. Running Hybrid Search ---");
  const result = await hybridSearch(processed);

  console.log("\n--- 5. Final state summary ---");
  console.log(`Cache state: ${result.cache_state}`);
  console.log(`Is discovering: ${result.is_discovering}`);
  console.log(`Candidates: ${result.candidates.length}`);
  console.log(`Tools fetched: ${result.tools.length}`);

  if (result.tools.length > 0) {
    const ranking = await rankTools(result.tools, processed);
    console.log(`Ranked count: ${ranking.alternatives.length + (ranking.best_match ? 1 : 0)}`);
  }

  console.log("\n--- 6. Exact API JSON response ---");
  try {
    const res = await fetch("http://localhost:3000/api/search?q=Best%20free%20AI%20video%20generator");
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("API Fetch Failed:", err);
  }
}

runTest().catch(console.error);
