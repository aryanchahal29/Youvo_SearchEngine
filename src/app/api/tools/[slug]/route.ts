import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ToolCategory, PricingPlan, ToolScore, ToolFeature, Evidence, Review } from '@/lib/supabase/types';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    const slug = params.slug;
    const supabase = await createClient();

    // 1. Fetch core tool
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('*')
      .eq('slug', slug)
      .single();

    if (toolError || !tool) {
      if (toolError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
      }
      throw toolError;
    }

    // 2. Fetch all related data in parallel
    const [
      { data: assignments },
      { data: categories },
      { data: pricing },
      { data: scores },
      { data: features },
      { data: evidence },
      { data: reviews },
    ] = await Promise.all([
      supabase.from('tool_category_assignments').select('*').eq('tool_id', tool.id),
      supabase.from('tool_categories').select('*'),
      supabase.from('pricing_plans').select('*').eq('tool_id', tool.id),
      supabase.from('tool_scores').select('*').eq('tool_id', tool.id).order('calculated_at', { ascending: false }).limit(1),
      supabase.from('tool_features').select('*').eq('tool_id', tool.id),
      supabase.from('evidence').select('*').eq('tool_id', tool.id).order('confidence', { ascending: false }),
      supabase.from('reviews').select('*').eq('tool_id', tool.id).order('published_at', { ascending: false }),
    ]);

    // Map categories
    const categoryMap = new Map((categories || []).map(c => [c.id, c]));
    const toolCategories = (assignments || [])
      .map(a => categoryMap.get(a.category_id))
      .filter(Boolean) as ToolCategory[];

    // Assemble full profile
    const toolProfile = {
      ...tool,
      categories: toolCategories,
      primary_category: tool.primary_category_id ? categoryMap.get(tool.primary_category_id) || null : null,
      pricing_plans: (pricing || []) as PricingPlan[],
      latest_score: (scores && scores.length > 0 ? scores[0] : null) as ToolScore | null,
      features: (features || []) as ToolFeature[],
      evidence: (evidence || []) as Evidence[],
      reviews: (reviews || []) as Review[],
    };

    return NextResponse.json(toolProfile);

  } catch (error) {
    console.error('API Error fetching tool profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tool profile' },
      { status: 500 }
    );
  }
}
