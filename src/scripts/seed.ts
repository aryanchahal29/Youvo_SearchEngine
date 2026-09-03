import { createClient } from '@supabase/supabase-js';
import { getAIRouter } from '../lib/providers/router';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars since this runs outside Next.js
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tools = [
  {
    name: 'Cursor',
    slug: 'cursor',
    description: 'The AI Code Editor. Built to make you extraordinarily productive, Cursor is the best way to code with AI.',
    short_description: 'AI-first code editor built on VS Code.',
    company_name: 'Anysphere',
    official_url: 'https://cursor.com',
    status: 'verified',
    category_slug: 'ai-coding',
    pricing: [
      { plan_name: 'Basic', is_free: true, price: 0, billing_period: 'free', raw_description: '14-day Pro trial, then basic features' },
      { plan_name: 'Pro', is_free: false, price: 20, billing_period: 'monthly', raw_description: 'Unlimited completions, 500 premium requests' },
    ],
    features: ['Code completion', 'Chat with codebase', 'Inline edits', 'Terminal integration'],
    score: { relevance_score: 95, value_score: 90, ease_score: 85, quality_score: 95, overall_score: 92, confidence: 0.95 },
  },
  {
    name: 'Bolt.new',
    slug: 'bolt-new',
    description: 'Bolt is an AI-powered web development agent that lets you build, run, and deploy full-stack applications entirely in the browser.',
    short_description: 'Vibe coding agent in the browser.',
    company_name: 'StackBlitz',
    official_url: 'https://bolt.new',
    status: 'verified',
    category_slug: 'vibe-coding',
    pricing: [
      { plan_name: 'Free', is_free: true, price: 0, billing_period: 'free', raw_description: 'Limited daily AI tokens' },
      { plan_name: 'Pro', is_free: false, price: 20, billing_period: 'monthly', raw_description: '10M tokens/month' },
    ],
    features: ['Browser based IDE', 'Full stack preview', 'Deploy to Netlify', 'NPM support'],
    score: { relevance_score: 90, value_score: 85, ease_score: 95, quality_score: 85, overall_score: 88, confidence: 0.85 },
  },
  {
    name: 'HeyGen',
    slug: 'heygen',
    description: 'Create engaging videos 10x faster with AI. Produce studio-quality videos with AI-generated avatars and voices.',
    short_description: 'AI video and avatar generator.',
    company_name: 'HeyGen',
    official_url: 'https://heygen.com',
    status: 'verified',
    category_slug: 'ai-avatars',
    pricing: [
      { plan_name: 'Free', is_free: true, price: 0, billing_period: 'free', watermark: true, raw_description: '1 free credit, watermarked' },
      { plan_name: 'Creator', is_free: false, price: 29, billing_period: 'monthly', watermark: false, raw_description: '15 credits/month' },
    ],
    features: ['Custom avatars', 'Voice cloning', 'Text to video', 'Translation'],
    score: { relevance_score: 90, value_score: 75, ease_score: 90, quality_score: 95, overall_score: 87, confidence: 0.90 },
  }
];

async function seed() {
  console.log('Starting seed process...');
  const router = getAIRouter();

  for (const t of tools) {
    console.log(`\nProcessing ${t.name}...`);
    
    // 1. Get category ID
    const { data: cat } = await supabase.from('tool_categories').select('id').eq('slug', t.category_slug).single();
    if (!cat) {
      console.error(`Category ${t.category_slug} not found! Run 004_seed_categories.sql first.`);
      continue;
    }

    // 2. Insert Tool
    const { data: tool, error: toolErr } = await supabase.from('tools').upsert({
      name: t.name,
      slug: t.slug,
      description: t.description,
      short_description: t.short_description,
      company_name: t.company_name,
      official_url: t.official_url,
      status: t.status,
      primary_category_id: cat.id,
      quality_score: t.score.quality_score,
      confidence_score: t.score.confidence,
      last_verified_at: new Date().toISOString(),
      is_featured: true,
    }).select('id').single();

    if (toolErr) {
      console.error(`Error inserting ${t.name}:`, toolErr);
      continue;
    }

    const toolId = tool.id;
    console.log(`- Tool inserted (ID: ${toolId})`);

    // 3. Insert Category Assignment
    await supabase.from('tool_category_assignments').upsert({
      tool_id: toolId,
      category_id: cat.id,
      confidence: 1.0,
      source: 'seed',
    }, { onConflict: 'tool_id,category_id' });

    // 4. Insert Pricing
    await supabase.from('pricing_plans').delete().eq('tool_id', toolId);
    for (const p of t.pricing) {
      await supabase.from('pricing_plans').insert({
        tool_id: toolId,
        plan_name: p.plan_name,
        is_free: p.is_free,
        price: p.price,
        billing_period: p.billing_period,
        watermark: (p as any).watermark ?? (p.is_free ? false : null),
        raw_description: p.raw_description,
        confidence: 0.9,
        last_verified_at: new Date().toISOString(),
      });
    }
    console.log(`- Pricing inserted`);

    // 5. Insert Features
    await supabase.from('tool_features').delete().eq('tool_id', toolId);
    for (const f of t.features) {
      await supabase.from('tool_features').insert({
        tool_id: toolId,
        feature_name: f,
        confidence: 0.9,
      });
    }

    // 6. Insert Score
    await supabase.from('tool_scores').insert({
      tool_id: toolId,
      category_id: cat.id,
      ...t.score,
      ranking_version: 1,
    });
    console.log(`- Score inserted`);

    // 7. Generate & Insert Embedding
    console.log(`- Generating embedding...`);
    const embedText = `${t.name} ${t.short_description} ${t.description} ${t.features.join(', ')}`;
    try {
      const embedding = await router.generateEmbedding(embedText);
      await supabase.from('tool_embeddings').delete().eq('tool_id', toolId);
      await supabase.from('tool_embeddings').insert({
        tool_id: toolId,
        embedding: `[${embedding.join(',')}]`,
        embedding_model: 'text-embedding-004',
        embedding_dimensions: 768,
      });
      console.log(`- Embedding saved!`);
    } catch (e) {
      console.error(`- Embedding failed (check API keys):`, e);
    }
  }

  console.log('\nSeed process complete!');
}

seed().catch(console.error);
