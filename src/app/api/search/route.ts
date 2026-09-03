import { NextResponse } from 'next/server';
import { processQuery } from '@/lib/search/query-processor';
import { getAIRouter } from '@/lib/providers/router';
import { FinalRankedTool } from '@/lib/ranking/final-ranking-engine'; // Still import type if needed or just define inline
import { buildSecurePrompt } from '@/lib/security/prompt-injection';

export const maxDuration = 30; // Vercel hobby max is 10s, pro is 60s. We set to 30s.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    
    if (!q || q.trim() === '') {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const queryStr = q.trim();
    const startTime = Date.now();

    // 1. Process query (intent, constraints, spelling)
    const processedQuery = await processQuery(queryStr);

    // 2. Direct LLM Search
    const router = getAIRouter();
    
    const searchPrompt = `You are YouVo, an expert AI tool recommendation engine. 
The user is looking for AI tools or software based on the following processed query data:
- Raw Query: "${processedQuery.raw_query}"
- Intent: ${processedQuery.intent.type}
- Category: ${processedQuery.category || 'Any'}
- Constraints: ${JSON.stringify(processedQuery.constraints)}

Based on your vast knowledge of current AI tools and software (e.g. Cursor, Bolt.new, HeyGen, ChatGPT, Midjourney, etc.), provide the best tool recommendation (best match) and up to 3 alternatives that fit the user's needs.

For each tool, provide:
- name: The name of the tool
- slug: A url-friendly slug (e.g., chatgpt, cursor)
- short_description: A brief 1-sentence description
- official_url: The official website URL
- pricing: An array of pricing plans (e.g., [{plan_name: "Free", price: 0}])
- final_score: A score from 0 to 100 on how well it fits
- explainability: An object containing 'why_match' (a short string explaining why it's a good fit)

If no tools match the criteria, leave the best_match null and alternatives empty.`;

    const result = await router.generateStructuredOutput<{
      best_match: any | null;
      alternatives: any[];
      explanation: string;
    }>(
      buildSecurePrompt(searchPrompt, "Find the best AI tools."),
      "You are a strict data extraction bot.",
      {
        type: 'object',
        properties: {
          best_match: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              short_description: { type: 'string' },
              official_url: { type: 'string' },
              final_score: { type: 'number' },
              pricing_plans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    plan_name: { type: 'string' },
                    price: { type: 'number' }
                  }
                }
              },
              explainability: {
                type: 'object',
                properties: {
                  why_match: { type: 'string' }
                }
              }
            },
            required: ['name', 'slug', 'short_description', 'official_url', 'final_score']
          },
          alternatives: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                short_description: { type: 'string' },
                official_url: { type: 'string' },
                final_score: { type: 'number' },
                pricing_plans: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      plan_name: { type: 'string' },
                      price: { type: 'number' }
                    }
                  }
                },
                explainability: {
                  type: 'object',
                  properties: {
                    why_match: { type: 'string' }
                  }
                }
              },
              required: ['name', 'slug', 'short_description', 'official_url', 'final_score']
            }
          },
          explanation: { type: 'string' }
        },
        required: ['alternatives', 'explanation']
      },
      { task_type: 'extraction', complexity: 'high', temperature: 0.3, max_tokens: 4000 }
    );

    const processing_time_ms = Date.now() - startTime;

    // Add mock IDs to the tools if they don't exist since the frontend expects them
    if (result.best_match && !result.best_match.id) {
       result.best_match.id = result.best_match.slug || result.best_match.name;
    }
    result.alternatives.forEach(alt => {
       if (!alt.id) alt.id = alt.slug || alt.name;
    });

    // Return the combined result
    return NextResponse.json({
      query: {
        raw: processedQuery.raw_query,
        corrected: processedQuery.was_corrected ? processedQuery.corrected_query : null,
        intent: processedQuery.intent.type,
        category: processedQuery.category,
        constraints: processedQuery.constraints,
        language: processedQuery.language,
      },
      results: result.alternatives,
      recommendation: {
        best_match: result.best_match,
        explanation: result.explanation || result.best_match?.explainability?.why_match || 'Here are the best tools we found for you.',
      },
      source: 'live_discovery',
      processing_time_ms: processing_time_ms,
      // Discovery pipeline fields (mocked or empty now)
      discovery_job_id: null,
      discovery_metrics: null,
      is_discovering: false,
      cache_state: 'SUCCESS_RESULT',
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your search' },
      { status: 500 }
    );
  }
}
