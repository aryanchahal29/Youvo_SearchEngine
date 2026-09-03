import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Clean up any previous 'Best free AI video generator' search cache to trigger Live Discovery
  await supabase.from('search_cache').delete().ilike('normalized_query', '%video generator%');
  
  // Call the search endpoint
  console.log('Sending search request to test Live Discovery...');
  const res = await fetch('http://localhost:3000/api/search?q=Best+free+AI+video+generator', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  const data = await res.json();
  console.log('Search response:', JSON.stringify(data, null, 2));
}

run().catch(console.error).then(() => process.exit(0));
