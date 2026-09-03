// YouVo: Query Processor
// PRD §5: Search Understanding — spell correction, fuzzy matching, intent detection,
// constraint extraction, language understanding
// Converts raw user input into structured search requirements

import { getAIRouter } from '@/lib/providers/router';

// ============================================================
// TYPES
// ============================================================

export interface QualityPolicy {
  enablePublisherFiltering: boolean;
  enableAggregatorFiltering: boolean;
  enableArticleFiltering: boolean;
  enableIdentityValidation: boolean;
  enableSnippetConstraintEvidence: boolean;
  enableUnknownConstraintPenalty: boolean;
  enableTargetEntityFiltering: boolean;
  enableUnsupportedIntentHandling: boolean;
}

export interface ProcessedQuery {
  raw_query: string;
  corrected_query: string;
  was_corrected: boolean;
  intent: QueryIntent;
  category: string | null;
  constraints: QueryConstraints;
  priorities: string[];
  language: 'english' | 'hindi' | 'hinglish';
  search_terms: string[];
  target_entity: string | null;
  quality_policy?: QualityPolicy;
}

export interface QueryIntent {
  type: 'find_tool' | 'compare_tools' | 'explore_category' | 'specific_tool' | 'general_question';
  confidence: number;
}

export interface QueryConstraints {
  budget: 'free' | 'under_5' | 'under_10' | 'under_20' | 'any' | null;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | null;
  watermark: boolean | null; // null = not specified, false = no watermark wanted
  commercial_use: boolean | null;
  no_code: boolean | null;
  api_access: boolean | null;
  open_source: boolean | null;
  has_free_plan: boolean | null;
  has_free_trial: boolean | null;
  platforms?: string[];
  required_features?: string[];
  integration_needs?: string[];
  [key: string]: any;
}

// ============================================================
// COMMON MISSPELLINGS & CORRECTIONS
// ============================================================

const COMMON_CORRECTIONS: Record<string, string> = {
  // Tool names
  'chatgtp': 'chatgpt',
  'chatgbt': 'chatgpt',
  'chatjpt': 'chatgpt',
  'midjourny': 'midjourney',
  'midjorney': 'midjourney',
  'midjurney': 'midjourney',
  'dall-e': 'dall-e',
  'dalle': 'dall-e',
  'lovble': 'lovable',
  'loveable': 'lovable',
  'lovabl': 'lovable',
  'bollt': 'bolt',
  'curser': 'cursor',
  'cursur': 'cursor',
  'perplxity': 'perplexity',
  'perplixity': 'perplexity',
  'synthsia': 'synthesia',
  'syntheisa': 'synthesia',
  'hegen': 'heygen',
  'haygen': 'heygen',
  
  // Common terms
  'genrator': 'generator',
  'generater': 'generator',
  'generetor': 'generator',
  'vidoe': 'video',
  'vedio': 'video',
  'iamge': 'image',
  'imge': 'image',
  'imagee': 'image',
  'codng': 'coding',
  'codin': 'coding',
  'toool': 'tool',
  'toll': 'tool',
  'tol': 'tool',
  'websit': 'website',
  'webstie': 'website',
  'avtar': 'avatar',
  'avater': 'avatar',
  'avatr': 'avatar',
  'reserch': 'research',
  'reasearch': 'research',
  'tradin': 'trading',
  'tradng': 'trading',
  'beginer': 'beginner',
  'beginr': 'beginner',
  'wtermark': 'watermark',
  'watermaek': 'watermark',
  'watermrk': 'watermark',
};

// ============================================================
// CONSTRAINT KEYWORDS
// ============================================================

const FREE_KEYWORDS = ['free', 'muft', 'mufat', 'free mein', 'bina paisa', 'no cost', 'gratis'];
const BEGINNER_KEYWORDS = ['beginner', 'easy', 'simple', 'aasan', 'aasaan', 'noob', 'newbie', 'basic', 'start', 'shuru'];
const NO_WATERMARK_KEYWORDS = ['no watermark', 'without watermark', 'watermark nahi', 'bina watermark'];
const NO_CODE_KEYWORDS = ['no code', 'no-code', 'nocode', 'without coding', 'coding nahi', 'bina code', 'bina coding'];

// ============================================================
// MAIN PROCESSOR
// ============================================================

export async function processQuery(rawQuery: unknown): Promise<ProcessedQuery> {
  // Step 1: Validate type and enforce max length
  if (typeof rawQuery !== 'string') {
    throw new Error('Invalid query type. Expected string.');
  }
  const safeQuery = rawQuery.slice(0, 500); // Enforce max length of 500 characters

  // Step 2: Normalize
  const normalized = normalizeQuery(safeQuery);
  
  // Step 2: Spell correction (dictionary-based fast pass)
  const corrected = correctSpelling(normalized);
  const wasCorrected = corrected !== normalized;
  
  // Step 3: Detect language
  const language = detectLanguage(normalized);
  
  // Step 4: Extract constraints from keywords (fast, no AI needed)
  const keywordConstraints = extractKeywordConstraints(normalized);
  
  // Step 5: Use AI for intent + category + refined constraints
  let aiAnalysis;
  try {
    aiAnalysis = await analyzeQueryWithAI(corrected, language);
  } catch {
    // Fallback if AI is unavailable — use keyword-based analysis
    aiAnalysis = {
      intent: { type: 'find_tool' as const, confidence: 0.5 },
      category: null,
      constraints: keywordConstraints,
      priorities: [],
      search_terms: corrected.split(/\s+/).filter(t => t.length > 2),
      target_entity: null,
    };
  }

  // Merge keyword constraints with AI constraints (keyword takes priority for explicit flags)
  const mergedConstraints: QueryConstraints = {
    ...aiAnalysis.constraints,
    ...Object.fromEntries(
      Object.entries(keywordConstraints).filter(([, v]) => v !== null)
    ),
  };

  return {
    raw_query: rawQuery,
    corrected_query: corrected,
    was_corrected: wasCorrected,
    intent: aiAnalysis.intent,
    category: aiAnalysis.category,
    constraints: mergedConstraints,
    priorities: aiAnalysis.priorities,
    language,
    search_terms: aiAnalysis.search_terms,
    target_entity: aiAnalysis.target_entity,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function normalizeQuery(query: string): string {
  // We keep characters mostly intact to not strip legitimate content
  // We only replace excessive whitespace and trim
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function correctSpelling(query: string): string {
  let corrected = query;
  const words = query.split(/\s+/);
  
  for (const word of words) {
    if (COMMON_CORRECTIONS[word]) {
      corrected = corrected.replace(
        new RegExp(`\\b${word}\\b`, 'g'),
        COMMON_CORRECTIONS[word]
      );
    }
  }
  
  return corrected;
}

function detectLanguage(query: string): 'english' | 'hindi' | 'hinglish' {
  // Simple heuristic: check for Hindi/Hinglish markers
  const hindiMarkers = ['mujhe', 'mujhko', 'mereko', 'mere', 'mera', 'meri',
    'chahiye', 'chahie', 'karo', 'karna', 'karni', 'banana', 'banani', 'banao',
    'hai', 'hain', 'ho', 'tha', 'thi', 'ke', 'ka', 'ki', 'ko', 'se', 'mein',
    'nahi', 'nhi', 'bina', 'aur', 'ya', 'liye', 'wala', 'wali', 'koi',
    'sabse', 'best', 'achha', 'accha', 'sasta'];
  
  const words = query.toLowerCase().split(/\s+/);
  const hindiWordCount = words.filter(w => hindiMarkers.includes(w)).length;
  
  if (hindiWordCount === 0) return 'english';
  if (hindiWordCount > words.length * 0.5) return 'hindi';
  return 'hinglish';
}

function extractKeywordConstraints(query: string): QueryConstraints {
  const q = query.toLowerCase();
  
  return {
    budget: FREE_KEYWORDS.some(k => q.includes(k)) ? 'free'
      : q.includes('under $5') || q.includes('under 5') ? 'under_5'
      : q.includes('under $10') || q.includes('under 10') ? 'under_10'
      : q.includes('under $20') || q.includes('under 20') ? 'under_20'
      : null,
    skill_level: BEGINNER_KEYWORDS.some(k => q.includes(k)) ? 'beginner'
      : q.includes('advanced') || q.includes('professional') || q.includes('pro') ? 'advanced'
      : null,
    watermark: NO_WATERMARK_KEYWORDS.some(k => q.includes(k)) ? false : null,
    commercial_use: q.includes('commercial') ? true : null,
    no_code: NO_CODE_KEYWORDS.some(k => q.includes(k)) ? true : null,
    api_access: q.includes('api') ? true : null,
    open_source: q.includes('open source') || q.includes('open-source') || q.includes('opensource') ? true : null,
    has_free_plan: FREE_KEYWORDS.some(k => q.includes(k)) ? true : null,
    has_free_trial: q.includes('free trial') || q.includes('trial') ? true : null,
  };
}

import { buildSecurePrompt } from '@/lib/security/prompt-injection';

async function analyzeQueryWithAI(query: string, language: string) {
  const router = getAIRouter();
  
  const schemaInstructions = `You are a query understanding engine for YouVo, an AI tool recommendation platform.
Analyze the user's search query and extract structured information.
The query may be in English, Hindi, or Hinglish (Hindi-English mix).

Respond with a JSON object containing:
- intent: { type: "find_tool" | "compare_tools" | "explore_category" | "specific_tool" | "general_question", confidence: 0-1 }
- category: the most relevant tool category slug (e.g., "vibe-coding", "ai-video", "ai-image-generation", "ai-trading", "ai-research") or null
- constraints: { budget, skill_level, watermark, commercial_use, no_code, api_access, open_source, has_free_plan, has_free_trial } — use null for unspecified
- priorities: array of what matters most to the user (e.g., ["free_usage", "ease_of_use", "no_watermark", "quality"])
- search_terms: array of key search terms extracted from the query
- target_entity: if intent is specific_tool, extract the name of the tool they are asking about (e.g., "Pictory AI", "Lumen5"), otherwise null`;

  const safePrompt = buildSecurePrompt(schemaInstructions, `Query: "${query}"\nDetected language: ${language}`);

  const result = await router.generateStructuredOutput<{
    intent: QueryIntent;
    category: string | null;
    constraints: QueryConstraints;
    priorities: string[];
    search_terms: string[];
    target_entity: string | null;
  }>(
    safePrompt,
    "You are a strict data extraction bot.",
    {
      type: 'object',
      properties: {
        intent: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['find_tool', 'compare_tools', 'explore_category', 'specific_tool', 'general_question'] },
            confidence: { type: 'number' },
          },
          required: ['type', 'confidence'],
        },
        category: { type: 'string', nullable: true },
        constraints: {
          type: 'object',
          properties: {
            budget: { type: 'string', nullable: true },
            skill_level: { type: 'string', nullable: true },
            watermark: { type: 'boolean', nullable: true },
            commercial_use: { type: 'boolean', nullable: true },
            no_code: { type: 'boolean', nullable: true },
            api_access: { type: 'boolean', nullable: true },
            open_source: { type: 'boolean', nullable: true },
            has_free_plan: { type: 'boolean', nullable: true },
            has_free_trial: { type: 'boolean', nullable: true },
          },
        },
        priorities: { type: 'array', items: { type: 'string' } },
        search_terms: { type: 'array', items: { type: 'string' } },
        target_entity: { type: 'string', nullable: true },
      },
      required: ['intent', 'category', 'constraints', 'priorities', 'search_terms'],
    },
    { task_type: 'intent', complexity: 'moderate', temperature: 0.1 }
  );

  return result;
}
