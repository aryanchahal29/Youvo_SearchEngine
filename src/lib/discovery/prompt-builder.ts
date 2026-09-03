import { ProcessedQuery } from '../search/query-processor';

// ============================================================
// STRUCTURED OUTPUT SCHEMAS
// ============================================================

export interface LLMDiscoveredTool {
  name: string;
  canonical_domain: string;
  official_url: string;
  description: string;
  why_match: string;
  capabilities: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'professional' | 'unknown';
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'open_source' | 'unknown';
    known: boolean;
  };
  confidence: number;
}

export interface DiscoveryLLMOutput {
  query_interpretation: {
    category: string;
    subcategory: string;
    skill_level: 'beginner' | 'intermediate' | 'advanced' | 'professional' | 'unknown';
  };
  tools: LLMDiscoveredTool[];
}

export const DiscoverySchema = {
  type: "object",
  properties: {
    query_interpretation: {
      type: "object",
      properties: {
        category: { type: "string" },
        subcategory: { type: "string" },
        skill_level: { type: "string", enum: ["beginner", "intermediate", "advanced", "professional", "unknown"] }
      },
      required: ["category", "subcategory", "skill_level"]
    },
    tools: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          canonical_domain: { type: "string", description: "e.g., example.com" },
          official_url: { type: "string", description: "e.g., https://www.example.com" },
          description: { type: "string", description: "Concise summary of what the tool does." },
          why_match: { type: "string", description: "Why this tool fits the user's specific constraints and intent." },
          capabilities: { type: "array", items: { type: "string" } },
          skill_level: { type: "string", enum: ["beginner", "intermediate", "advanced", "professional", "unknown"] },
          pricing: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["free", "freemium", "paid", "open_source", "unknown"] },
              known: { type: "boolean" }
            },
            required: ["type", "known"]
          },
          confidence: { type: "number", description: "Confidence score between 0.0 and 1.0 that this tool accurately fits the user's request." }
        },
        required: [
          "name", 
          "canonical_domain", 
          "official_url", 
          "description", 
          "why_match", 
          "capabilities", 
          "skill_level", 
          "pricing", 
          "confidence"
        ]
      }
    }
  },
  required: ["query_interpretation", "tools"]
};

// ============================================================
// PROMPT BUILDER
// ============================================================

export class PromptBuilder {
  /**
   * Generates the system prompt instructing the model on the overall task.
   */
  static buildSystemPrompt(): string {
    return `You are an expert AI software discovery engine. 
Your goal is to recommend real, existing software tools, products, or platforms that best match the user's query.

CRITICAL RULES:
1. NEVER invent or hallucinate tools, URLs, or pricing. If you are unsure, do not include it.
2. URLs must be the OFFICIAL website of the tool, not a directory or review site.
3. Prioritize relevance over sheer popularity. Match the user's specific skill level and intent.
4. Do not include articles, tutorials, or generic websites—only software tools or products.
5. If the user explicitly asks for "free", prioritize free or freemium tools.
6. Provide concise, objective descriptions and clear reasons why the tool matches the request.`;
  }

  /**
   * Generates the dynamic user prompt based on the parsed constraints.
   */
  static buildUserPrompt(query: ProcessedQuery): string {
    const rawQuery = query.corrected_query || query.raw_query;
    
    let constraintsText = '';
    
    // Hard constraints
    if (query.constraints.budget) {
      constraintsText += `- Budget: ${query.constraints.budget}\n`;
    }
    if (query.constraints.skill_level) {
      constraintsText += `- Required Skill Level: ${query.constraints.skill_level}\n`;
    }
    if (query.constraints.open_source === true) {
      constraintsText += `- Must be Open Source\n`;
    }
    if (query.constraints.no_code === true) {
      constraintsText += `- Must be No-Code / Zero-Code\n`;
    }
    if (query.constraints.api_access === true) {
      constraintsText += `- Must have API Access\n`;
    }

    // Preferences / intent
    const focusAreas = query.priorities.length > 0 
      ? `- Focus specifically on: ${query.priorities.join(', ')}`
      : '';

    return `Discover the best software tools for the following request:
"${rawQuery}"

${constraintsText ? `USER CONSTRAINTS (You MUST respect these):\n${constraintsText}` : ''}
${focusAreas}

Instructions:
1. Interpret the query to determine the best category and subcategory.
2. Brainstorm a list of up to 4 highly relevant tools that fit the constraints.
3. Filter out any tools that you know for a fact violate the constraints (e.g. do not suggest a $100/mo enterprise tool if budget is "free").
4. Return the structured data according to the schema.`;
  }
}
