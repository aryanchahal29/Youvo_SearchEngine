// YouVo: Fact Extractor
// Extracts structured pricing, features, and limitations from crawled HTML.
// Uses generateStructuredOutput() with a strict schema — no raw JSON.parse().
// Applies prompt injection defense via buildSecurePrompt().

import { getAIRouter } from '../providers/router';
import { buildSecurePrompt } from '../security/prompt-injection';
import type { ExtractedToolData, ExtractedPricingPlan, ExtractedFeature } from '../discovery/types';

// ============================================================
// RESPONSE SCHEMA (for Gemini structured output)
// ============================================================

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Official name of the tool/product' },
    description: { type: 'string', description: 'What the tool does (1-3 sentences)' },
    short_description: { type: 'string', nullable: true, description: 'One-line summary' },
    company_name: { type: 'string', nullable: true, description: 'Company or developer name' },
    pricing_plans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          plan_name: { type: 'string' },
          price: { type: 'number', nullable: true, description: 'Price in USD, null if free' },
          billing_period: { type: 'string', enum: ['free', 'monthly', 'yearly', 'one_time', 'pay_as_you_go', 'custom'] },
          is_free: { type: 'boolean' },
          free_credits: { type: 'number', nullable: true, description: 'Number of free credits/generations/minutes' },
          credit_period: { type: 'string', nullable: true, description: 'Period for free credits (daily, monthly, one_time)' },
          watermark: { type: 'boolean', nullable: true, description: 'Whether free plan has watermark' },
          commercial_use: { type: 'boolean', nullable: true, description: 'Whether commercial use is allowed' },
          usage_limit: { type: 'string', nullable: true, description: 'Usage limit description' },
          export_limitations: { type: 'string', nullable: true, description: 'Export quality or format limitations' },
          api_access: { type: 'boolean', nullable: true, description: 'Whether API access is included' },
        },
        required: ['plan_name', 'is_free', 'billing_period'],
      },
    },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Feature name' },
          value: { type: 'string', nullable: true, description: 'Feature value or detail' },
        },
        required: ['name'],
      },
    },
    limitations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Known limitations or restrictions',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score 0-100 for the overall extraction quality',
    },
  },
  required: ['name', 'description', 'pricing_plans', 'features', 'limitations', 'confidence'],
};

// ============================================================
// MAIN EXTRACTOR
// ============================================================

export class FactExtractor {
  /**
   * Extracts structured tool data from crawled HTML.
   * Uses AI structured output with prompt injection defense.
   * Returns typed ExtractedToolData — no raw JSON.parse().
   */
  static async extractToolData(url: string, html: string, specificInstructions: string = ''): Promise<ExtractedToolData> {
    const router = getAIRouter();

    // Clean HTML to remove bloat
    let cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const truncatedHtml = cleanedHtml.length > 5000 
      ? cleanedHtml.substring(0, 5000) + '\n\n[Content truncated...]' 
      : cleanedHtml;

    const schemaInstructions = `You are a precise fact extraction engine for an AI tool recommendation platform.

Extract ONLY factual information from the provided website HTML. Do NOT invent, guess, or hallucinate information.

Extract the following:
1. TOOL NAME: The official product/tool name
2. DESCRIPTION: What the tool does (factual, 1-3 sentences)
3. SHORT DESCRIPTION: One-line summary
4. COMPANY NAME: The company or developer behind the tool
5. PRICING PLANS: Every pricing tier mentioned, including:
   - Free plan details (if any): credits, limits, watermark, commercial use
   - Paid plan prices and what they include
   - Trial information
6. FEATURES: Key capabilities and features mentioned
7. LIMITATIONS: Any restrictions, caps, or limitations mentioned

CRITICAL RULES:
- If information is NOT on the page, use null — do NOT guess
- For pricing, only extract numbers that are explicitly stated
- For watermark/commercial_use, only set true/false if explicitly mentioned
- Set confidence based on how much data you could actually find (0-100)
- confidence < 30 if the page doesn't seem to be a tool's official site
- confidence < 50 if pricing info is missing

${specificInstructions ? `TARGETED EXTRACTION REQUIREMENTS:\n${specificInstructions}\n` : ''}
The website URL is: ${url}`;

    const securePrompt = buildSecurePrompt(schemaInstructions, truncatedHtml);

    try {
      const result = await router.generateStructuredOutput<ExtractedToolData>(
        securePrompt,
        'You are a strict data extraction bot. Extract only facts present in the HTML. Never invent information.',
        EXTRACTION_SCHEMA,
        { task_type: 'extraction', complexity: 'complex', temperature: 0.05, max_tokens: 600 }
      );

      // Validate the result
      return this.validateExtraction(result, url);
    } catch (error: any) {
      console.error(`[FactExtractor] Extraction failed for ${url}:`, error);
      if (error && error.name === 'AllProvidersUnavailableError') {
        throw error;
      }
      // Return a low-confidence empty extraction
      return {
        name: '',
        description: '',
        short_description: null,
        company_name: null,
        pricing_plans: [],
        features: [],
        limitations: [],
        confidence: 0,
      };
    }
  }

  /**
   * Legacy method: extracts facts and creates evidence records directly.
   * Retained for backward compatibility with existing pipeline tests.
   */
  static async extractAndCreateEvidence(toolId: string, url: string, html: string): Promise<void> {
    const data = await this.extractToolData(url, html);
    if (data.confidence < 20) {
      console.warn(`[FactExtractor] Low confidence (${data.confidence}) for ${url}, skipping evidence creation`);
      return;
    }
    // Evidence creation is now handled by the orchestrator, not here.
    // This method is a compatibility shim.
    console.log(`[FactExtractor] Extracted ${data.pricing_plans.length} plans, ${data.features.length} features from ${url}`);
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private static validateExtraction(data: ExtractedToolData, url: string): ExtractedToolData {
    // Ensure required fields are present
    if (!data.name || data.name.trim() === '') {
      // Try to extract name from URL domain
      try {
        const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
        data.name = domain.charAt(0).toUpperCase() + domain.slice(1);
      } catch {
        data.name = 'Unknown Tool';
      }
      data.confidence = Math.min(data.confidence, 30);
    }

    if (!data.description || data.description.trim() === '') {
      data.description = `AI tool at ${url}`;
      data.confidence = Math.min(data.confidence, 20);
    }

    // Validate pricing plans
    data.pricing_plans = (data.pricing_plans || []).filter(plan => {
      if (!plan.plan_name) return false;
      // Price sanity check
      if (plan.price !== null && (plan.price < 0 || plan.price > 100000)) {
        return false;
      }
      return true;
    });

    // Validate features
    data.features = (data.features || []).filter(f => f.name && f.name.trim() !== '');

    // Clamp confidence
    data.confidence = Math.max(0, Math.min(100, data.confidence || 0));

    return data;
  }
}
