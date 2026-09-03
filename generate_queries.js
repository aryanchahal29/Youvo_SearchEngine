const fs = require('fs');

const categories = [
  'video', 'audio', 'business', 'developer', 'productivity', 
  'image', 'automation', 'finance', 'marketing', '3d', 'unknown'
];

const queries = [
  // Broad
  { q: 'best AI video editor for beginners', c: 'video', ec: ['beginner'] },
  { q: 'CRM software for small business', c: 'business', ec: ['small_business'] },
  { q: 'top marketing automation tools', c: 'marketing', ec: [] },
  { q: 'good code editor for python', c: 'developer', ec: ['python'] },
  { q: 'AI image generators', c: 'image', ec: [] },
  { q: 'tools for personal finance tracking', c: 'finance', ec: [] },
  { q: 'best productivity apps for mac', c: 'productivity', ec: ['mac'] },
  { q: '3d modeling software for beginners', c: '3d', ec: ['beginner'] },
  { q: 'podcast recording software', c: 'audio', ec: [] },
  { q: 'data visualization tools', c: 'business', ec: [] },

  // Specific / Niche
  { q: 'open source LLM that can run locally on Mac with 8GB RAM', c: 'developer', ec: ['open_source', 'local', 'mac'] },
  { q: 'Does Pictory AI support 4k export on the free plan?', c: 'video', ec: ['free', '4k'] },
  { q: 'CRM for real estate agents with twilio integration', c: 'business', ec: ['real_estate', 'twilio'] },
  { q: 'AI tool to restore old blurry photos with facial enhancement', c: 'image', ec: ['restore', 'face'] },
  { q: 'marketing email warmup tool with dedicated IP', c: 'marketing', ec: ['email_warmup', 'dedicated_ip'] },
  { q: 'discord bot for stock price alerts', c: 'finance', ec: ['discord', 'stock'] },
  { q: 'automated subtitle generator for premiere pro', c: 'video', ec: ['premiere_pro', 'subtitles'] },
  { q: '3d character rigger compatible with unity', c: '3d', ec: ['rigger', 'unity'] },
  { q: 'podcast host with dynamic ad insertion', c: 'audio', ec: ['dynamic_ads'] },
  { q: 'open source alternative to notion', c: 'productivity', ec: ['open_source'] },

  // Free / Budget
  { q: 'free AI voice generator with commercial use', c: 'audio', ec: ['free', 'commercial_use'] },
  { q: 'cheap alternatives to midjourney under $10', c: 'image', ec: ['cheap'] },
  { q: 'free CRM with no user limit', c: 'business', ec: ['free', 'no_user_limit'] },
  { q: 'free tier cloud database', c: 'developer', ec: ['free'] },
  { q: 'free video editor without watermark', c: 'video', ec: ['free', 'no_watermark'] },
  { q: 'completely free screen recorder for windows', c: 'productivity', ec: ['free', 'windows'] },
  { q: 'cheap email marketing tool for 10k subscribers', c: 'marketing', ec: ['cheap'] },
  { q: 'free accounting software for freelancers', c: 'finance', ec: ['free'] },
  { q: 'free blender add-ons for architecture', c: '3d', ec: ['free', 'blender'] },
  { q: 'best free AI presentation maker', c: 'productivity', ec: ['free'] },

  // Platform
  { q: 'habit tracker app for iOS and apple watch', c: 'productivity', ec: ['ios', 'apple_watch'] },
  { q: 'video editing app for Android tablet', c: 'video', ec: ['android', 'tablet'] },
  { q: 'local music player for linux', c: 'audio', ec: ['linux'] },
  { q: 'code editor for chromebook', c: 'developer', ec: ['chromebook'] },
  { q: 'project management tool with windows native app', c: 'business', ec: ['windows'] },

  // No-code
  { q: 'no-code app builder for marketplace', c: 'developer', ec: ['no_code'] },
  { q: 'create website from figma without coding', c: 'developer', ec: ['no_code', 'figma'] },
  { q: 'build internal tools no code', c: 'developer', ec: ['no_code'] },
  { q: 'no code backend database', c: 'developer', ec: ['no_code'] },
  { q: 'zapier alternative no code', c: 'automation', ec: ['no_code'] },

  // Multiple hard constraints
  { q: 'free open source CRM that runs on linux and has an android app', c: 'business', ec: ['free', 'open_source', 'linux', 'android'] },
  { q: 'AI text to speech that supports Polish language, is free, and has API', c: 'audio', ec: ['polish', 'free', 'api'] },
  { q: 'cheap VPS under $5 per month located in Europe with DDoS protection', c: 'developer', ec: ['cheap', 'europe', 'ddos'] },
  { q: 'video meeting tool with end-to-end encryption, max 50 users, free plan', c: 'productivity', ec: ['e2ee', '50_users', 'free'] },
  { q: 'accounting software for UK with VAT support, multi-currency, and stripe integration', c: 'finance', ec: ['uk', 'vat', 'multi_currency', 'stripe'] },

  // Soft preferences
  { q: 'good looking aesthetic to do list app', c: 'productivity', ec: [] },
  { q: 'minimalist text editor for writing', c: 'productivity', ec: [] },
  { q: 'easy to use video editor that looks nice', c: 'video', ec: [] },
  { q: 'fast and lightweight web browser', c: 'productivity', ec: [] },
  { q: 'modern alternative to jira', c: 'business', ec: [] },

  // Ambiguous
  { q: 'make things happen automatically', c: 'automation', ec: [] },
  { q: 'app to manage my life', c: 'productivity', ec: [] },
  { q: 'AI tool for stuff', c: 'unknown', ec: [] },
  { q: 'better than photoshop', c: 'image', ec: [] },
  { q: 'code faster', c: 'developer', ec: [] },

  // Zero-result / Impossible / Fallback cases
  { q: 'is there any AI tool that creates full feature films automatically from a single prompt', c: 'video', ec: [] },
  { q: 'Does Lumen5 Is this a real tool named Lumen5??', c: 'unknown', ec: [] },
  { q: 'free tool that generates infinite money', c: 'finance', ec: [] },
  { q: 'AI that can read my mind and write code', c: 'developer', ec: [] },
  { q: 'XYZFakishToolThatDoesNotExist123', c: 'unknown', ec: [] },

  // Provider disagreement / Ambiguous facts
  { q: 'Is ChatGPT Plus $20 or $25?', c: 'productivity', ec: [] },
  { q: 'Does Midjourney have a free trial right now?', c: 'image', ec: [] },
  { q: 'Can you use Claude 3 Opus for free?', c: 'developer', ec: [] },
  { q: 'Zapier vs Make for simple automations', c: 'automation', ec: [] },
  { q: 'Is Vercel completely free for commercial use?', c: 'developer', ec: [] },
  
  // Specific fallbacks
  { q: 'Does InShot Is this a real tool named InShot??', c: 'video', ec: [] },
  { q: 'Does Adobe Premiere Rush Is this a real tool named Adobe Premiere Rush??', c: 'video', ec: [] },
  { q: 'latest 2026 AI tools for video', c: 'video', ec: [] },
  { q: 'who acquired figma in 2026', c: 'business', ec: [] },
  { q: 'current pricing of X Premium', c: 'social', ec: [] },
  
  // Extra specific tools
  { q: 'AI voice cloner that works with just 5 seconds of audio', c: 'audio', ec: ['clone', '5_seconds'] },
  { q: 'tool to schedule twitter threads for free', c: 'marketing', ec: ['twitter', 'free'] },
  { q: 'open source game engine for 2d pixel art', c: 'developer', ec: ['open_source', '2d'] },
  { q: 'finance app that connects to European banks via open banking', c: 'finance', ec: ['europe', 'open_banking'] },
  { q: 'CRM that integrates with WhatsApp business API', c: 'business', ec: ['whatsapp'] }
];

const formatted = queries.map((q, i) => ({
  id: `q${String(i + 1).padStart(3, '0')}`,
  query: q.q,
  category: q.c,
  expected_constraints: q.ec,
  notes: 'Generated test query'
}));

fs.writeFileSync('beta_queries_beta01.json', JSON.stringify(formatted, null, 2));
console.log(`Generated ${formatted.length} queries to beta_queries_beta01.json`);
