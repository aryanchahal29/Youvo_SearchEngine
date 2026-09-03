import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.production
const envPath = path.resolve(process.cwd(), '.env.production');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const cronSecret = process.env.CRON_SECRET?.trim();
const prodUrl = 'https://youvo.vercel.app';

if (!cronSecret) {
  console.error("No CRON_SECRET found in .env.production");
  process.exit(1);
}

async function runTests() {
  console.log(`\n=== RUNNING PRODUCTION TESTS AGAINST ${prodUrl} ===\n`);

  console.log("C. Testing Cron Dispatchers...");
  const crons = ['discovery', 'verification', 'reputation', 'health', 'maintenance'];
  
  for (const cronName of crons) {
    console.log(`\nTriggering ${cronName}...`);
    try {
      const start = Date.now();
      const res = await fetch(`${prodUrl}/api/cron/dispatch-${cronName}`, {
        headers: {
          'Authorization': `Bearer ${cronSecret}`
        }
      });
      const data = await res.text();
      const timeMs = Date.now() - start;
      console.log(`[${res.status}] ${res.statusText} (${timeMs}ms)`);
      if (res.status !== 200) {
        console.error(`Response: ${data}`);
      } else {
        console.log(`Success! Response length: ${data.length} chars`);
      }
    } catch (e: any) {
      console.error(`Fetch failed for ${cronName}: ${e.message}`);
    }
  }

  console.log("\nE. Testing Security (unauthorized cron request)...");
  try {
    const res = await fetch(`${prodUrl}/api/cron/dispatch-discovery`);
    console.log(`[${res.status}] ${res.statusText} (Expected: 401)`);
  } catch (e: any) {
    console.error(`Security test failed: ${e.message}`);
  }

  console.log("\nA. Testing Production Search API...");
  try {
    const res = await fetch(`${prodUrl}/api/search?q=Best+free+AI+video+generator`);
    console.log(`[${res.status}] ${res.statusText}`);
  } catch (e: any) {
    console.error(`Search test failed: ${e.message}`);
  }

  console.log("\nTests complete.");
}

runTests().catch(console.error);
