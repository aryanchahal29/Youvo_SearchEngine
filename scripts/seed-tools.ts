import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Seeding mock tools...");

  // 1. Create a category
  const { data: cat, error: catError } = await supabase
    .from('tool_categories')
    .insert({ name: 'Vibe Coding', slug: 'vibe-coding' })
    .select()
    .single();

  if (catError && catError.code !== '23505') console.error(catError);

  const categoryId = cat ? cat.id : (await supabase.from('tool_categories').select().eq('slug', 'vibe-coding').single()).data.id;

  // 2. Create tools
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .insert([
      {
        name: 'Cursor',
        slug: 'cursor-vibe',
        description: 'The AI Code Editor. Build software faster in an editor designed for pair-programming with AI.',
        short_description: 'AI Code Editor for vibe coding',
        status: 'verified',
        primary_category_id: categoryId,
        risk_level: 'low',
        quality_score: 95,
        confidence_score: 0.9,
      },
      {
        name: 'Lovable',
        slug: 'lovable-vibe',
        description: 'Your AI team member. Build software just by talking to it.',
        short_description: 'No-code vibe coding assistant',
        status: 'verified',
        primary_category_id: categoryId,
        risk_level: 'low',
        quality_score: 85,
        confidence_score: 0.8,
      }
    ])
    .select();
    
  if (toolsError) {
    console.error("Error inserting tools:", toolsError);
    return;
  }

  // 3. Assign categories
  for (const tool of tools) {
    await supabase.from('tool_category_assignments').insert({
      tool_id: tool.id,
      category_id: categoryId,
      confidence: 0.95
    });

    // 4. Add pricing
    await supabase.from('pricing_plans').insert({
      tool_id: tool.id,
      plan_name: 'Free',
      billing_period: 'monthly',
      price: 0,
      is_free: true,
      currency: 'USD'
    });

    // 5. Add a score
    await supabase.from('tool_scores').insert({
      tool_id: tool.id,
      overall_score: tool.quality_score,
      relevance_score: 90,
      value_score: 85,
      ease_score: 90,
      quality_score: tool.quality_score,
      reputation_score: 95,
      freshness_score: 100,
      transparency_score: 90,
      risk_penalty: 0,
      confidence: tool.confidence_score,
      ranking_version: 1,
    });
  }

  console.log("Successfully seeded tools!");
}

main().catch(console.error);
