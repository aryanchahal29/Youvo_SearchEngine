import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as http from 'http';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/['"]/g, '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/['"]/g, '').trim();
let cronSecret = (process.env.CRON_SECRET || '').replace(/['"]/g, '').trim();
if (cronSecret === '[SENSITIVE]' || !cronSecret) {
  cronSecret = 'dev-secret-do-not-use-in-prod';
}

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error("Invalid URL detected:", supabaseUrl);
  throw new Error("Missing Supabase URL or Key");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const prodUrl = 'http://localhost:3000';

function getMockHtmlUrl(price: number) {
  const html = `<html><head><title>Test Tool</title></head><body><h1>Test Tool</h1><p>A great tool.</p><div class="pricing"><h2>Pro Plan</h2><p>Only $${price} per month!</p></div></body></html>`;
  return `data:text/html,${encodeURIComponent(html)}`;
}

async function runAutonomousTest() {
  console.log('=== STARTING AUTONOMOUS UPDATE TEST (PRODUCTION) ===\n');

  // 1. Create a dummy tool in production DB
  console.log('1. Creating test tool...');
  
  // Clean up any old data first just in case
  await supabase.from('automation_jobs').delete().eq('job_type', 'extract');
  await supabase.from('evidence').delete().eq('claim_type', 'pricing');
  
  const url1 = getMockHtmlUrl(49);
  const { data: tool, error: toolErr } = await supabase.from('tools').upsert({
    slug: 'test-autonomous-tool',
    name: 'Test Autonomous Tool',
    official_url: url1,
    description: 'A tool for testing autonomous updates',
    status: 'discovered'
  }, { onConflict: 'slug' }).select().single();

  if (toolErr) throw toolErr;
  console.log(`✓ Tool created: ${tool.id}`);

  // 2. Queue an extraction job for baseline
  console.log('\n2. Queueing initial extract job...');
  const { error: jobErr1 } = await supabase.from('automation_jobs').insert({
    job_type: 'extract',
    status: 'pending',
    priority: 1,
    payload: { tool_id: tool.id }
  });
  if (jobErr1) throw jobErr1;
  
  console.log('✓ Triggering Maintenance Dispatcher for baseline...');
  await fetch(`${prodUrl}/api/cron/dispatch-maintenance`, {
    headers: { 'Authorization': `Bearer ${cronSecret}` }
  });
  
  // Wait for baseline extraction to complete
  console.log('Waiting for baseline extraction to complete...');
  let ev1: any[] = [];
  for (let i = 0; i < 15; i++) {
    const { data } = await supabase.from('evidence').select('*').eq('tool_id', tool.id);
    if (data && data.length > 0) {
      ev1 = data;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`✓ Baseline evidence collected: ${ev1?.length || 0} facts.`);
  if (ev1 && ev1.length > 0) console.log(`Sample: ${JSON.stringify(ev1[0].claim)}`);

  // 3. Simulate source drift by updating the URL in the DB to point to new HTML
  console.log('\n3. Simulating source drift (Price -> $99)...');
  const url2 = getMockHtmlUrl(99);
  await supabase.from('tools').update({ official_url: url2 }).eq('id', tool.id);
  
  // 4. Queue maintenance job
  console.log('\n4. Queueing maintenance job...');
  await supabase.from('automation_jobs').delete().eq('payload->>tool_id', tool.id);
  await supabase.from('automation_jobs').insert({
    job_type: 'extract',
    status: 'pending',
    priority: 1,
    payload: { tool_id: tool.id }
  });

  console.log('✓ Triggering Maintenance Dispatcher...');
  await fetch(`${prodUrl}/api/cron/dispatch-maintenance`, { headers: { Authorization: `Bearer ${cronSecret}` } });
  
  // Wait for maintenance -> fetch -> extract -> verify -> rank
  console.log('Waiting for drift detection to complete...');
  let ev2: any[] = [];
  for (let i = 0; i < 15; i++) {
    const { data } = await supabase.from('evidence').select('*').eq('tool_id', tool.id);
    if (data && data.length > 0) {
      let pricePlan = data[0].claim;
      if (typeof pricePlan === 'string') pricePlan = JSON.parse(pricePlan);
      
      if (pricePlan && pricePlan.price === 99) {
        ev2 = data;
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`✓ New evidence collected: ${ev2?.length || 0} facts.`);
  
  let driftDetected = false;
  if (ev2 && ev2.length > 0) {
    let pricePlan = ev2[0].claim;
    if (typeof pricePlan === 'string') pricePlan = JSON.parse(pricePlan);
    
    if (pricePlan && pricePlan.price === 99) {
      driftDetected = true;
    }
  }

  // 6. Cleanup
  console.log('\n✓ Cleanup complete.');
  console.log('\n6. Cleaning up test fixture...');
  await supabase.from('tools').delete().eq('id', tool.id);
  
  if (driftDetected) {
    console.log('\n✅ AUTONOMOUS UPDATE TEST PASSED');
  } else {
    console.log('\n❌ AUTONOMOUS UPDATE TEST FAILED (Drift not reflected in DB)');
  }
}

runAutonomousTest().catch(console.error);
