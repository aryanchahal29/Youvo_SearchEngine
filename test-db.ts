import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

async function main() {
  console.log("Fetching tools...");
  const { data, error } = await supabase.from('tools').select('*');
  console.log("Tools:", data);
  console.log("Error:", error);
}

main().catch(console.error);
