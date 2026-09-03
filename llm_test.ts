import { AIProviderRouter } from './src/lib/providers/router';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const router = new AIProviderRouter();
  try {
    const text = await router.generateText('Extract the name of this tool: Viscriptix is a video app', 'Return JSON { "name": "string" }');
    console.log('Success:', text);
  } catch (e) {
    console.error('Failed:', e);
  }
}
run();
