import { config } from 'dotenv';
config({ path: '.env.local' });

import { GET } from '../src/app/api/search/route';
import { NextRequest } from 'next/server';
import { createAdminClient } from '../src/lib/supabase/server';
import { UrlResolver } from '../src/lib/discovery/url-resolver';
import { TavilySearchAdapter } from '../src/lib/discovery/tavily-adapter';
import { SafeCrawler } from '../src/lib/crawler/crawler';
import { FactExtractor } from '../src/lib/extraction/fact-extractor';

// Patch Tavily
const originalDiscover = TavilySearchAdapter.prototype.discoverForQuery;
TavilySearchAdapter.prototype.discoverForQuery = async function(q, limit) {
  const res = await originalDiscover.call(this, q, limit);
  console.log("\n--- 3. LIVE DISCOVERY: TAVILY CANDIDATES ---");
  console.log(`Count: ${res.length}`);
  res.forEach(c => console.log(`- ${c.name} (${c.url})`));
  return res;
};

// Patch UrlResolver
const originalFollow = UrlResolver.followRedirects;
UrlResolver.followRedirects = async function(url, timeout) {
  try {
    const res = await originalFollow.call(this, url, timeout);
    console.log(`[URL] Resolved: ${url} -> ${res}`);
    return res;
  } catch(e: any) {
    console.log(`[URL] Failed: ${url} -> ${e.message}`);
    throw e;
  }
};

// Patch SafeCrawler
const originalFetch = SafeCrawler.fetchContent;
SafeCrawler.fetchContent = async function(url, timeout) {
  try {
    const res = await originalFetch.call(this, url, timeout);
    console.log(`[CRAWL] Success: ${url}`);
    return res;
  } catch(e: any) {
    console.log(`[CRAWL] Fail: ${url} (${e.message})`);
    throw e;
  }
};

// Patch FactExtractor
const originalExtract = FactExtractor.extractToolData;
FactExtractor.extractToolData = async function(url, html) {
  try {
    const res = await originalExtract.call(this, url, html);
    console.log(`[EXTRACTION] Success: ${url}`);
    console.log(`   Free plan: ${res.pricing_plans?.some(p => p.price === 0) ? 'yes' : 'no/unknown'}`);
    console.log(`   Watermark: ${res.limitations?.some(l => l.toLowerCase().includes('watermark')) ? 'yes' : 'no/unknown'}`);
    return res;
  } catch(e: any) {
    console.log(`[EXTRACTION] Fail: ${url} (${e.message})`);
    throw e;
  }
};

async function run() {
  const supabase = createAdminClient();
  
  const { data: beforeCache } = await supabase.from('search_cache').select('*').ilike('normalized_query', '%vibe coding%');
  console.log("\n--- 2. DATABASE SEARCH ---");
  console.log(`Cache state before: ${beforeCache?.length ? JSON.stringify(beforeCache) : 'None (or cleared)'}`);
  
  await supabase.from('search_cache').delete().ilike('normalized_query', '%vibe coding%');
  console.log("Cache cleared.");
  
  console.log("\n--- EXECUTING API REQUEST ---");
  const req = new NextRequest('http://localhost:3000/api/search?q=Tool+for+vibe+coding');
  const res = await GET(req);
  const json = await res.json();
  
  console.log("\n--- 6. EXACT API RESPONSE ---");
  console.log(JSON.stringify(json, null, 2));

  console.log("\n--- 7. DATABASE STATE ---");
  const { data: afterCache } = await supabase.from('search_cache').select('*').ilike('normalized_query', '%vibe coding%');
  console.log("search_cache row:", JSON.stringify(afterCache, null, 2));

  const { data: jobs } = await supabase.from('automation_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("automation_jobs row(s):", JSON.stringify(jobs, null, 2));
}

run().catch(console.error);
