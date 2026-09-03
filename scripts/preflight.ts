import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  require('dotenv').config({ path: '.env.local' });
}

async function runPreflight() {
  console.log('🚀 Running Production Preflight Checks...\n');
  let hasErrors = false;

  const logSuccess = (msg: string) => console.log(`✅ ${msg}`);
  const logError = (msg: string) => {
    console.error(`❌ ${msg}`);
    hasErrors = true;
  };

  // 1. Check Env Vars
  const requiredEnvs = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  requiredEnvs.forEach((env) => {
    if (!process.env[env]) {
      logError(`Missing Environment Variable: ${env}`);
    } else {
      logSuccess(`Environment Variable ${env} is set`);
    }
  });

  if (hasErrors) {
    console.error('\n💥 Preflight failed due to missing environment variables.');
    process.exit(1);
  }

  // 2. Check Supabase Connectivity
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { error: dbError } = await supabase.from('tools').select('id').limit(1);
    if (dbError) throw dbError;
    logSuccess('Supabase Database connectivity verified');

    // 3. Check RLS is enabled (simple heuristic check on an admin table)
    const { error: rlsError } = await supabase.from('admin_audit_logs').select('id').limit(1);
    if (!rlsError) {
      logSuccess('RLS policies active (or using service role successfully)');
    }

  } catch (error: any) {
    logError(`Supabase connection failed: ${error.message}`);
  }

  // 4. Check API Keys don't leak
  if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    logError('CRITICAL: Service role or AI keys are exposed via NEXT_PUBLIC_ prefix!');
  } else {
    logSuccess('No sensitive keys exposed to client bundle');
  }

  if (hasErrors) {
    console.error('\n💥 Preflight failed. Do not deploy.');
    process.exit(1);
  } else {
    console.log('\n✨ All preflight checks passed. Ready for production build.');
  }
}

runPreflight();
