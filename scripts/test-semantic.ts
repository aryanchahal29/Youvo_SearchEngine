import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const dummyVector = Array.from({length: 768}, () => Math.random());

async function testSemanticSearch() {
  console.log('Testing RPC semantic_search_tools with 768-d vector...');
  const { data, error } = await supabase.rpc('semantic_search_tools', {
    query_embedding: dummyVector,
    min_similarity: 0.1,
    match_limit: 5
  });
  if (error) {
    console.error('❌ RPC Error:', error);
  } else {
    console.log('✅ RPC Success! Returned rows:', data ? data.length : 0);
  }
}

testSemanticSearch().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
