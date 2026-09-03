import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data } = await adminClient.from('user_feedback').select('*').limit(5);
  console.log('Sample user_feedback rows:', data);

  const { data: fkeys } = await adminClient.rpc('get_foreign_keys'); // if we have such an RPC, we don't.
}

run().catch(console.error);
