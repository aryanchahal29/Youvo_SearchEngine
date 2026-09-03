import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';


dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_BASE = 'http://localhost:3000';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('==================================================');
  console.log('1. PREPARING DATABASE (CLEARING RELEVANT TOOLS)');
  console.log('==================================================');
  
  // Find category
  const { data: cat } = await supabase.from('tool_categories').select('id').eq('slug', 'ai-video').single();
  if (cat) {
    const { data: assignments } = await supabase.from('tool_category_assignments').select('tool_id').eq('category_id', cat.id);
    if (assignments && assignments.length > 0) {
      const toolIds = assignments.map(a => a.tool_id);
      console.log(`Deleting ${toolIds.length} tools for fresh test...`);
      await supabase.from('tools').delete().in('id', toolIds);
    }
  }

  // Double check by name
  await supabase.from('tools').delete().ilike('description', '%video%');
  // Clear the entire search cache!
  await supabase.from('search_cache').delete().neq('id', '12345678-1234-1234-1234-123456789012');

  console.log('Database cleared of video tools and query cache.');

  console.log('\n==================================================');
  console.log('2. EXECUTING LIVE SEARCH 1 (EMPTY DATABASE)');
  console.log('==================================================');
  
  const query = 'open source video generator';
  console.log(`Query: "${query}"`);
  
  const search1Start = Date.now();
  let res1 = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  let data1: any = await res1.json();

  if (data1.is_discovering) {
    console.log(`\n[Live Discovery Triggered] Job ID: ${data1.discovery_job_id}`);
    let complete = false;
    while (!complete) {
      await sleep(2000);
      const pollRes = await fetch(`${API_BASE}/api/search/discovery-status?job_id=${data1.discovery_job_id}`);
      const pollData: any = await pollRes.json();
      console.log(`Polling status: ${pollData.status}`);
      if (pollData.status === 'completed' || pollData.status === 'failed') {
        data1 = pollData;
        complete = true;
      }
    }
  }

  const search1Duration = Date.now() - search1Start;

  console.log('\n--- FULL API RESPONSE ---');
  console.log(JSON.stringify(data1, null, 2));

  console.log('\n--- LIVE DISCOVERY METRICS ---');
  if (data1.metrics) {
    console.log(JSON.stringify(data1.metrics, null, 2));
  } else {
    console.log('No metrics found (was live discovery triggered?)');
  }

  console.log('\n--- DISCOVERED TOOLS (TOP 3) ---');
  const tools1 = data1.recommendation?.alternatives || data1.tools || [];
  tools1.slice(0, 3).forEach((t: any, i: number) => {
    console.log(`${i+1}. ${t.name} (${t.url})`);
    console.log(`   Score: ${t.latest_score?.final_score || 'N/A'}`);
    console.log(`   Confidence: ${t.confidence}%`);
    const freePlan = t.pricing_plans?.find((p:any) => p.is_free);
    console.log(`   Free Plan: ${freePlan ? 'Yes' : 'No'} - ${freePlan?.usage_limit || 'N/A'}`);
    console.log(`   Watermark: ${freePlan?.watermark ? 'Yes' : 'No'}`);
    console.log(`   Evidence IDs: ${t.evidence_count} pieces of evidence`);
  });

  console.log('\n==================================================');
  console.log('3. DATABASE PERSISTENCE CHECK');
  console.log('==================================================');
  
  const { data: dbTools } = await supabase.from('tools').select('*').in('id', tools1.map((t:any) => t.id || t.tool_id));
  console.log(`Verified ${dbTools?.length || 0} tools in Supabase 'tools' table.`);
  
  if (dbTools && dbTools.length > 0) {
    const { data: pricing } = await supabase.from('pricing_plans').select('*').eq('tool_id', dbTools[0].id);
    console.log(`Found ${pricing?.length || 0} pricing plans for ${dbTools[0].name}.`);
    
    const { data: evidence } = await supabase.from('evidence').select('*').eq('tool_id', dbTools[0].id);
    console.log(`Found ${evidence?.length || 0} evidence records for ${dbTools[0].name}.`);
    if (evidence && evidence.length > 0) {
       console.log(`Sample Evidence URL: ${evidence[0].source_url}`);
    }
  }

  console.log('\n==================================================');
  console.log('4. EXECUTING LIVE SEARCH 2 (CACHE HIT)');
  console.log('==================================================');
  
  const search2Start = Date.now();
  const res2 = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  const data2: any = await res2.json();
  const search2Duration = Date.now() - search2Start;

  console.log(`Search 2 returned ${data2.results?.length || 0} results in ${search2Duration}ms.`);
  console.log(`Source: ${data2.source}`);
  console.log(`Live Discovery Triggered: ${data2.is_discovering || false}`);

}

runVerification().catch(console.error);
