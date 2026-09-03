/**
 * Generates controlled_eval_fixtures.json with realistic, hand-curated tool data.
 *
 * Each fixture contains:
 *  - Legitimate tools (real names/URLs) that SHOULD survive the pipeline
 *  - Poison candidates (aggregators, articles, duplicates, vague entities,
 *    publishers, generic titles, invalid URLs, competitors, contradictory snippets)
 *    that SHOULD be filtered by quality gates
 *  - Tavily search results (mix of useful + noisy)
 *
 * Tools use the DiscoveryLLMOutput schema (official_url, canonical_domain, why_match, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Known-real tools per category ───────────────────────────────────────────

const TOOL_CATALOG: Record<string, any[]> = {
  video: [
    { name: "CapCut", canonical_domain: "capcut.com", official_url: "https://www.capcut.com", description: "Free all-in-one video editor with AI-powered features for beginners. Free plan available with no watermark on exports.", why_match: "Free, beginner-friendly AI video editor with auto-captions and templates", capabilities: ["video editing", "auto captions", "templates", "effects"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.95 },
    { name: "DaVinci Resolve", canonical_domain: "blackmagicdesign.com", official_url: "https://www.blackmagicdesign.com/products/davinciresolve", description: "Professional video editing, color correction, VFX and audio post production. Completely free version available.", why_match: "Industry-standard free video editor with professional-grade features", capabilities: ["video editing", "color grading", "vfx", "audio"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.92 },
    { name: "Runway ML", canonical_domain: "runwayml.com", official_url: "https://runwayml.com", description: "AI-powered creative tools for video generation and editing. Not free, requires paid subscription.", why_match: "Leading AI video generation and editing platform", capabilities: ["ai video generation", "video editing", "green screen", "inpainting"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.90 },
    { name: "Pictory", canonical_domain: "pictory.ai", official_url: "https://pictory.ai", description: "AI video creation platform that turns text and articles into videos. Free trial available but not completely free.", why_match: "AI-powered text-to-video tool with auto-summarization", capabilities: ["text to video", "auto summarize", "subtitles", "branding"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.88 },
    { name: "Descript", canonical_domain: "descript.com", official_url: "https://www.descript.com", description: "All-in-one video and podcast editing with AI transcription. Free plan available with limited minutes.", why_match: "Edit video by editing text transcript, very beginner friendly", capabilities: ["video editing", "transcription", "screen recording", "podcasting"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.87 },
    { name: "InShot", canonical_domain: "inshot.com", official_url: "https://inshot.com", description: "Video editor and maker for Android and iOS with easy-to-use interface", why_match: "Popular mobile video editor for quick edits", capabilities: ["video editing", "trimming", "music", "filters"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.85 },
    { name: "Adobe Premiere Rush", canonical_domain: "adobe.com", official_url: "https://www.adobe.com/products/premiere-rush.html", description: "Simple video editing app by Adobe for quick social media content", why_match: "Adobe's simplified video editor for social content", capabilities: ["video editing", "color", "audio", "motion graphics"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.84 },
  ],
  video_screen_recorder: [
    { name: "OBS Studio", canonical_domain: "obsproject.com", official_url: "https://obsproject.com", description: "Completely free and open source screen recording and live streaming software for Windows, Mac, and Linux. 100% free with no watermark.", why_match: "Completely free screen recorder for Windows, no watermark", capabilities: ["screen recording", "live streaming", "multiple sources"], skill_level: "intermediate", pricing: { type: "free", known: true }, confidence: 0.96 },
    { name: "ShareX", canonical_domain: "getsharex.com", official_url: "https://getsharex.com", description: "Free and open source screen capture and screen recording tool for Windows. Completely free, no watermark.", why_match: "Free, open source screen recorder for Windows", capabilities: ["screen recording", "screenshot", "file sharing", "gif"], skill_level: "intermediate", pricing: { type: "free", known: true }, confidence: 0.93 },
  ],
  business: [
    { name: "HubSpot CRM", canonical_domain: "hubspot.com", official_url: "https://www.hubspot.com/products/crm", description: "Free CRM platform with sales, marketing, and service tools. Free plan available with no user limit for basic features.", why_match: "Free CRM with comprehensive features for small businesses", capabilities: ["crm", "email marketing", "pipeline management", "reporting"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.95 },
    { name: "Salesforce", canonical_domain: "salesforce.com", official_url: "https://www.salesforce.com", description: "Enterprise CRM platform with extensive customization and integrations. Not free, paid plans start at $25/month.", why_match: "Industry-leading CRM with scalable features", capabilities: ["crm", "analytics", "automation", "app ecosystem"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.93 },
    { name: "Zoho CRM", canonical_domain: "zoho.com", official_url: "https://www.zoho.com/crm/", description: "CRM for growing businesses with AI assistant and automation. Free plan available for up to 3 users.", why_match: "Affordable CRM with AI-powered sales assistant Zia", capabilities: ["crm", "ai assistant", "workflow automation", "multichannel"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.90 },
    { name: "Follow Up Boss", canonical_domain: "followupboss.com", official_url: "https://www.followupboss.com", description: "CRM built specifically for real estate teams and agents with Twilio integration for texting", why_match: "Real estate specific CRM with Twilio integration and lead routing", capabilities: ["crm", "lead management", "dialer", "texting", "twilio"], skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.85 },
    { name: "Linear", canonical_domain: "linear.app", official_url: "https://linear.app", description: "Modern issue tracker and project management tool, fast alternative to Jira", why_match: "Modern, fast alternative to Jira for software teams", capabilities: ["project management", "issue tracking", "roadmaps", "workflows"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.90 },
    { name: "Kommo", canonical_domain: "kommo.com", official_url: "https://www.kommo.com", description: "CRM with WhatsApp Business API integration for sales teams", why_match: "CRM with built-in WhatsApp Business API integration", capabilities: ["crm", "whatsapp", "sales pipeline", "messaging"], skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.82 },
    { name: "SuiteCRM", canonical_domain: "suitecrm.com", official_url: "https://suitecrm.com", description: "Free open source CRM with self-hosting capability. Runs on Linux. No user limit.", why_match: "Free open source CRM that runs on Linux", capabilities: ["crm", "workflow", "reporting", "self-hosting"], skill_level: "advanced", pricing: { type: "open_source", known: true }, confidence: 0.84 },
  ],
  marketing: [
    { name: "Mailchimp", canonical_domain: "mailchimp.com", official_url: "https://mailchimp.com", description: "Email marketing and automation platform for growing businesses. Free plan for up to 500 subscribers.", why_match: "Popular email marketing tool with free plan and automation", capabilities: ["email marketing", "automation", "landing pages", "analytics"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.94 },
    { name: "ActiveCampaign", canonical_domain: "activecampaign.com", official_url: "https://www.activecampaign.com", description: "Marketing automation platform with CRM and email marketing", why_match: "Advanced marketing automation with excellent deliverability", capabilities: ["email marketing", "crm", "automation", "machine learning"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.91 },
    { name: "Warmbox", canonical_domain: "warmbox.ai", official_url: "https://www.warmbox.ai", description: "Email warmup tool to improve deliverability and inbox placement with dedicated IP option", why_match: "Dedicated email warmup with network of real inboxes and dedicated IP", capabilities: ["email warmup", "deliverability", "inbox placement", "dedicated IP"], skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.86 },
    { name: "Hypefury", canonical_domain: "hypefury.com", official_url: "https://hypefury.com", description: "Schedule and automate Twitter/X threads. Free plan available for basic scheduling.", why_match: "Free Twitter thread scheduler with automation", capabilities: ["twitter scheduling", "threads", "analytics", "automation"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.83 },
  ],
  developer: [
    { name: "VS Code", canonical_domain: "code.visualstudio.com", official_url: "https://code.visualstudio.com", description: "Free source code editor with IntelliSense and debugging support. Completely free, runs on all platforms including Chromebook via browser.", why_match: "Most popular free code editor with excellent Python support", capabilities: ["code editing", "debugging", "extensions", "git integration"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.96 },
    { name: "PyCharm", canonical_domain: "jetbrains.com", official_url: "https://www.jetbrains.com/pycharm/", description: "Professional Python IDE with intelligent code completion", why_match: "Best dedicated Python IDE with scientific tools support", capabilities: ["python ide", "debugging", "testing", "scientific tools"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.93 },
    { name: "Ollama", canonical_domain: "ollama.com", official_url: "https://ollama.com", description: "Run large language models locally on your machine with minimal setup. Free and open source.", why_match: "Run open source LLMs locally with minimal setup", capabilities: ["local llm", "model management", "api server", "gpu acceleration"], skill_level: "intermediate", pricing: { type: "free", known: true }, confidence: 0.91 },
    { name: "Cursor", canonical_domain: "cursor.com", official_url: "https://www.cursor.com", description: "AI-first code editor built for pair programming with AI", why_match: "AI coding assistant built on VS Code", capabilities: ["code editing", "ai assistance", "chat", "autocomplete"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.90 },
    { name: "Retool", canonical_domain: "retool.com", official_url: "https://retool.com", description: "Build internal tools with drag-and-drop UI components and database connections. No code required.", why_match: "No-code internal tool builder", capabilities: ["internal tools", "drag and drop", "database", "workflows"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.88 },
    { name: "Supabase", canonical_domain: "supabase.com", official_url: "https://supabase.com", description: "Open source Firebase alternative with free tier. Provides database, auth, and API without coding.", why_match: "Free tier cloud database with no-code features", capabilities: ["database", "auth", "api", "storage"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.90 },
    { name: "Godot Engine", canonical_domain: "godotengine.org", official_url: "https://godotengine.org", description: "Free and open source game engine ideal for 2D pixel art games", why_match: "Open source game engine great for 2D pixel art", capabilities: ["2d games", "pixel art", "scripting", "cross platform"], skill_level: "intermediate", pricing: { type: "free", known: true }, confidence: 0.91 },
    { name: "Anima", canonical_domain: "animaapp.com", official_url: "https://www.animaapp.com", description: "Convert Figma designs directly to code without coding. Design-to-code tool.", why_match: "Create website from Figma without coding", capabilities: ["figma to code", "design handoff", "prototyping"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.82 },
  ],
  image: [
    { name: "Midjourney", canonical_domain: "midjourney.com", official_url: "https://www.midjourney.com", description: "AI image generation tool creating high-quality art from text prompts. Not free, no free trial currently available.", why_match: "Leading AI image generator with exceptional quality", capabilities: ["text to image", "image variation", "upscaling", "style mixing"], skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.95 },
    { name: "DALL-E", canonical_domain: "openai.com", official_url: "https://openai.com/dall-e-3", description: "AI system by OpenAI that creates realistic images from text descriptions", why_match: "High-quality AI image generation integrated with ChatGPT", capabilities: ["text to image", "image editing", "inpainting"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.93 },
    { name: "Leonardo AI", canonical_domain: "leonardo.ai", official_url: "https://leonardo.ai", description: "AI-powered image generation platform with model training. Generous free tier with 150 tokens/day.", why_match: "Generous free tier AI image generator with fine-tuning", capabilities: ["text to image", "model training", "canvas editing", "motion"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.89 },
    { name: "Remini", canonical_domain: "remini.ai", official_url: "https://remini.ai", description: "AI photo enhancer that restores and enhances old or blurry photos with facial enhancement technology", why_match: "Specializes in AI photo restoration and facial enhancement", capabilities: ["photo restoration", "face enhancement", "upscaling", "deblurring"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.87 },
    { name: "Affinity Photo", canonical_domain: "affinity.serif.com", official_url: "https://affinity.serif.com/photo", description: "Professional photo editing software, alternative to Photoshop. One-time purchase, no subscription.", why_match: "Professional Photoshop alternative with one-time purchase", capabilities: ["photo editing", "retouching", "compositing", "raw processing"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.90 },
  ],
  finance: [
    { name: "YNAB", canonical_domain: "ynab.com", official_url: "https://www.ynab.com", description: "Budgeting app based on the envelope method for personal finance", why_match: "Top-rated personal finance app with proactive budgeting approach", capabilities: ["budgeting", "bank sync", "goal tracking", "reporting"], skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.92 },
    { name: "Mint", canonical_domain: "mint.intuit.com", official_url: "https://mint.intuit.com", description: "Free personal finance tracker with budgeting and credit monitoring", why_match: "Free comprehensive finance tracker", capabilities: ["budgeting", "bill tracking", "credit score", "investment tracking"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.90 },
    { name: "Stock Alarm", canonical_domain: "stockalarm.io", official_url: "https://stockalarm.io", description: "Real-time stock price alerts with Discord and Telegram integration", why_match: "Stock alert bot with Discord integration", capabilities: ["stock alerts", "discord bot", "telegram bot", "portfolio tracking"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.84 },
    { name: "Wave", canonical_domain: "waveapps.com", official_url: "https://www.waveapps.com", description: "Free accounting software for small businesses and freelancers. Completely free invoicing and accounting.", why_match: "Free accounting software for freelancers", capabilities: ["accounting", "invoicing", "receipts", "payroll"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.90 },
    { name: "Xero", canonical_domain: "xero.com", official_url: "https://www.xero.com", description: "Cloud accounting software with UK VAT support, multi-currency, and Stripe integration", why_match: "UK accounting with VAT, multi-currency, and Stripe", capabilities: ["accounting", "vat", "multi-currency", "stripe", "bank feeds"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.91 },
    { name: "Tink", canonical_domain: "tink.com", official_url: "https://tink.com", description: "Open banking platform connecting to European banks for financial data aggregation", why_match: "Open banking API connecting to European banks", capabilities: ["open banking", "bank connections", "payment initiation", "account aggregation"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.83 },
  ],
  productivity: [
    { name: "Notion", canonical_domain: "notion.so", official_url: "https://www.notion.so", description: "All-in-one workspace for notes, docs, wikis, and project management", why_match: "Versatile workspace combining notes, databases, and project management", capabilities: ["notes", "databases", "wikis", "project management"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.95 },
    { name: "Obsidian", canonical_domain: "obsidian.md", official_url: "https://obsidian.md", description: "Knowledge base and note-taking app using local Markdown files", why_match: "Local-first, extensible Markdown note-taking with graph view", capabilities: ["notes", "markdown", "graph view", "plugins"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.92 },
    { name: "AppFlowy", canonical_domain: "appflowy.io", official_url: "https://appflowy.io", description: "Open source alternative to Notion with local-first approach. Free and open source.", why_match: "Open source Notion alternative with self-hosting option", capabilities: ["notes", "databases", "kanban", "calendar"], skill_level: "intermediate", pricing: { type: "open_source", known: true }, confidence: 0.85 },
    { name: "Raycast", canonical_domain: "raycast.com", official_url: "https://www.raycast.com", description: "Productivity launcher for macOS replacing Spotlight with extensible commands", why_match: "Mac-native productivity tool with AI and extensions", capabilities: ["launcher", "snippets", "window management", "ai chat"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.88 },
    { name: "Jitsi Meet", canonical_domain: "jitsi.org", official_url: "https://jitsi.org", description: "Free and open source video meeting tool with end-to-end encryption. Supports up to 100 users.", why_match: "Free video meeting with E2EE and large participant support", capabilities: ["video conferencing", "e2ee", "screen sharing", "recording"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.88 },
    { name: "Habitica", canonical_domain: "habitica.com", official_url: "https://habitica.com", description: "Gamified habit tracker and task manager available on iOS and Apple Watch", why_match: "Habit tracker with iOS and Apple Watch support", capabilities: ["habit tracking", "gamification", "to-do lists", "apple watch"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.85 },
    { name: "Gamma", canonical_domain: "gamma.app", official_url: "https://gamma.app", description: "AI-powered presentation maker. Free plan available with AI-generated slides.", why_match: "Free AI presentation maker", capabilities: ["presentations", "ai generation", "templates", "collaboration"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.87 },
    { name: "Todoist", canonical_domain: "todoist.com", official_url: "https://todoist.com", description: "Clean, minimalist to-do list app with beautiful design and cross-platform support", why_match: "Aesthetically pleasing to-do list with cross-platform sync", capabilities: ["task management", "labels", "filters", "collaboration"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.92 },
    { name: "iA Writer", canonical_domain: "ia.net", official_url: "https://ia.net/writer", description: "Minimalist text editor focused on pure writing experience", why_match: "Clean, minimalist writing app", capabilities: ["writing", "markdown", "focus mode", "library"], skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.88 },
    { name: "Arc Browser", canonical_domain: "arc.net", official_url: "https://arc.net", description: "Fast, lightweight web browser with modern interface and workspaces", why_match: "Modern, fast web browser with innovative design", capabilities: ["web browsing", "workspaces", "split view", "boost"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.86 },
  ],
  "3d": [
    { name: "Blender", canonical_domain: "blender.org", official_url: "https://www.blender.org", description: "Free and open source 3D creation suite for modeling, animation, and rendering. Architecture add-ons available for free.", why_match: "Most popular free 3D modeling software with extensive features", capabilities: ["3d modeling", "animation", "rendering", "sculpting"], skill_level: "intermediate", pricing: { type: "free", known: true }, confidence: 0.96 },
    { name: "Mixamo", canonical_domain: "mixamo.com", official_url: "https://www.mixamo.com", description: "Free 3D character rigging and animation service by Adobe. Compatible with Unity.", why_match: "Free auto-rigging and animation for 3D characters, Unity compatible", capabilities: ["character rigging", "animation", "3d characters", "unity export"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.88 },
  ],
  audio: [
    { name: "Audacity", canonical_domain: "audacityteam.org", official_url: "https://www.audacityteam.org", description: "Free, open source, cross-platform audio software for recording and editing. Runs on Linux.", why_match: "Most popular free audio editor for podcast recording", capabilities: ["audio recording", "editing", "effects", "multi-track"], skill_level: "beginner", pricing: { type: "free", known: true }, confidence: 0.94 },
    { name: "Riverside.fm", canonical_domain: "riverside.fm", official_url: "https://riverside.fm", description: "High-quality podcast and video recording platform", why_match: "Studio-quality remote podcast recording with local recording", capabilities: ["podcast recording", "video recording", "transcription", "editing"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.89 },
    { name: "Buzzsprout", canonical_domain: "buzzsprout.com", official_url: "https://www.buzzsprout.com", description: "Podcast hosting platform with distribution and analytics", why_match: "Easy podcast hosting with distribution to all major platforms", capabilities: ["podcast hosting", "distribution", "analytics", "monetization"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.87 },
    { name: "Megaphone", canonical_domain: "megaphone.fm", official_url: "https://www.megaphone.fm", description: "Enterprise podcast hosting with dynamic ad insertion", why_match: "Podcast host specializing in dynamic ad insertion", capabilities: ["podcast hosting", "dynamic ad insertion", "analytics", "monetization"], skill_level: "intermediate", pricing: { type: "paid", known: true }, confidence: 0.85 },
    { name: "ElevenLabs", canonical_domain: "elevenlabs.io", official_url: "https://elevenlabs.io", description: "AI voice generation and text-to-speech platform. Supports many languages including Polish. Free plan with limited characters. API access available.", why_match: "Leading AI voice generator with natural-sounding voices and API", capabilities: ["text to speech", "voice cloning", "dubbing", "api", "polish language"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.91 },
    { name: "Resemble AI", canonical_domain: "resemble.ai", official_url: "https://www.resemble.ai", description: "AI voice cloning that works with as little as 5 seconds of audio input", why_match: "Voice cloning with minimal audio input (5 seconds)", capabilities: ["voice cloning", "text to speech", "api", "real-time synthesis"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.84 },
  ],
  automation: [
    { name: "Make", canonical_domain: "make.com", official_url: "https://www.make.com", description: "Visual automation platform, alternative to Zapier. No code required. Free plan available.", why_match: "No-code Zapier alternative with visual builder", capabilities: ["automation", "integrations", "workflows", "no code"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.92 },
    { name: "n8n", canonical_domain: "n8n.io", official_url: "https://n8n.io", description: "Open source workflow automation tool. Self-hostable Zapier alternative.", why_match: "Open source, self-hostable Zapier alternative", capabilities: ["automation", "workflows", "self-hosting", "code nodes"], skill_level: "intermediate", pricing: { type: "freemium", known: true }, confidence: 0.89 },
    { name: "Zapier", canonical_domain: "zapier.com", official_url: "https://zapier.com", description: "Popular no-code automation platform connecting apps and services", why_match: "Leading no-code automation platform", capabilities: ["automation", "integrations", "zaps", "ai"], skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.94 },
  ],
};

// ─── Poison candidates (should be filtered by quality gates) ────────────────

function makePoisonCandidates(queryText: string, category: string): any[] {
  const poison: any[] = [];

  // 1. Aggregator / review site
  poison.push({
    name: "G2 Review List", canonical_domain: "g2.com",
    official_url: `https://www.g2.com/categories/${queryText.replace(/\s+/g, '-').toLowerCase()}`,
    description: `Top ${queryText} reviewed by users on G2. Compare features, pricing, and reviews.`,
    why_match: "Directory listing of tools", capabilities: [], skill_level: "unknown",
    pricing: { type: "unknown", known: false }, confidence: 0.3
  });

  // 2. Publisher article
  poison.push({
    name: "PCMag Best Picks", canonical_domain: "pcmag.com",
    official_url: `https://www.pcmag.com/picks/best-${queryText.replace(/\s+/g, '-').toLowerCase()}`,
    description: `PCMag's expert picks for best ${queryText} in 2026`,
    why_match: "Roundup article", capabilities: [], skill_level: "unknown",
    pricing: { type: "unknown", known: false }, confidence: 0.25
  });

  // 3. Article / blog post
  poison.push({
    name: "TechCrunch Article", canonical_domain: "techcrunch.com",
    official_url: `https://techcrunch.com/article/best-${queryText.replace(/\s+/g, '-').toLowerCase()}`,
    description: `News article about ${queryText}`, why_match: "Article about the topic",
    capabilities: [], skill_level: "unknown", pricing: { type: "unknown", known: false }, confidence: 0.2
  });

  // 4. GitHub awesome-list (not a specific repo)
  poison.push({
    name: "Awesome List", canonical_domain: "github.com",
    official_url: "https://github.com/awesome-list",
    description: "Curated list of tools", why_match: "List of tools",
    capabilities: [], skill_level: "unknown", pricing: { type: "unknown", known: false }, confidence: 0.2
  });

  // 5. Vague / generic entity
  poison.push({
    name: "AI Tool", canonical_domain: "example.com",
    official_url: "https://example.com",
    description: "An AI tool", why_match: "Generic tool",
    capabilities: [], skill_level: "unknown", pricing: { type: "unknown", known: false }, confidence: 0.1
  });

  // 6. Dictionary / Wikipedia
  poison.push({
    name: "Wikipedia Definition", canonical_domain: "wikipedia.org",
    official_url: `https://en.wikipedia.org/wiki/${queryText.replace(/\s+/g, '_')}`,
    description: `Wikipedia article about ${queryText}`,
    why_match: "Informational article", capabilities: [], skill_level: "unknown",
    pricing: { type: "unknown", known: false }, confidence: 0.15
  });

  // 7. YouTube video (not a tool)
  poison.push({
    name: "YouTube Tutorial", canonical_domain: "youtube.com",
    official_url: `https://www.youtube.com/watch?v=fake123`,
    description: `Tutorial video about ${queryText}`,
    why_match: "Video tutorial, not a tool", capabilities: [], skill_level: "unknown",
    pricing: { type: "unknown", known: false }, confidence: 0.1
  });

  // 8. Capterra (aggregator)
  poison.push({
    name: "Capterra List", canonical_domain: "capterra.com",
    official_url: `https://www.capterra.com/${queryText.replace(/\s+/g, '-').toLowerCase()}`,
    description: `Compare ${queryText} on Capterra. Read reviews and ratings.`,
    why_match: "Aggregator listing", capabilities: [], skill_level: "unknown",
    pricing: { type: "unknown", known: false }, confidence: 0.3
  });

  return poison;
}

// ─── Competitor tool (for target-entity queries) ────────────────

function makeCompetitorTool(queryText: string): any {
  return {
    name: "CompetitorTool", canonical_domain: "competitor-tool.io",
    official_url: "https://competitor-tool.io",
    description: `An alternative tool in the ${queryText} space`,
    why_match: "Competitor to the target entity",
    capabilities: ["similar features"], skill_level: "beginner",
    pricing: { type: "freemium", known: true }, confidence: 0.60
  };
}

// ─── Snippet contradiction tools (for constraint testing) ────────────────

function makeFreeSnippetTool(): any {
  return {
    name: "FreeToolX", canonical_domain: "freetoolx.com",
    official_url: "https://freetoolx.com",
    description: "Free plan available with generous limits. Completely free to use for basic features.",
    why_match: "Free tool", capabilities: ["basic features"],
    skill_level: "beginner", pricing: { type: "freemium", known: true }, confidence: 0.80
  };
}

function makeNotFreeTool(): any {
  return {
    name: "PaidOnlyTool", canonical_domain: "paidonlytool.com",
    official_url: "https://paidonlytool.com",
    description: "Premium tool. Not free, paid only. No free plan available. Starts at $29/month.",
    why_match: "Paid tool", capabilities: ["premium features"],
    skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.80
  };
}

function makeFreeTrialTool(): any {
  return {
    name: "TrialTool", canonical_domain: "trialtool.com",
    official_url: "https://trialtool.com",
    description: "Free trial for 14 days. After the trial, subscription required. Free demo available.",
    why_match: "Has free trial", capabilities: ["trial features"],
    skill_level: "beginner", pricing: { type: "paid", known: true }, confidence: 0.75
  };
}

// ─── Tavily search result helpers ────────────────

function makeTavilyResults(tools: any[], queryText: string): any[] {
  const results: any[] = [];

  // Add legit tool results
  for (const tool of tools.slice(0, 3)) {
    results.push({
      title: tool.name,
      url: tool.official_url,
      snippet: tool.description,
      content: tool.description,
      source: "TavilySearch"
    });
  }

  // Add some noise
  results.push({
    title: `Best ${queryText} in 2026 - PCMag`,
    url: `https://www.pcmag.com/picks/best-${queryText.replace(/\s+/g, '-').toLowerCase()}`,
    snippet: `Our experts have reviewed the best ${queryText} available today.`,
    content: `Our experts have reviewed the best ${queryText} available today.`,
    source: "TavilySearch"
  });

  results.push({
    title: `${queryText} - G2 Reviews`,
    url: `https://www.g2.com/categories/${queryText.replace(/\s+/g, '-').toLowerCase()}`,
    snippet: `Compare the top ${queryText}. Read user reviews on G2.`,
    content: `Compare the top ${queryText}. Read user reviews on G2.`,
    source: "TavilySearch"
  });

  return results;
}

// ─── Build fixture map ──────────────────────────────────────────────────────

function buildFixtures(): Record<string, any> {
  const queriesPath = path.join(process.cwd(), 'beta_queries_beta01.json');
  const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));
  const fixtures: Record<string, any> = {};

  // Map query -> relevant tool categories
  const QUERY_TOOLS: Record<string, string[]> = {
    q001: ['video'],
    q002: ['business'],
    q003: ['marketing'],
    q004: ['developer'],
    q005: ['image'],
    q006: ['finance'],
    q007: ['productivity'],
    q008: ['3d'],
    q009: ['audio'],
    q010: ['developer'],
    q011: ['developer'],
    q012: ['video'],         // Pictory specific
    q013: ['business'],
    q014: ['image'],
    q015: ['marketing'],
    q016: ['finance'],
    q017: ['video'],
    q018: ['3d'],
    q019: ['audio'],
    q020: ['productivity'],
    q021: ['audio'],
    q022: ['image'],
    q023: ['business'],
    q024: ['developer'],
    q025: ['video'],
    q026: ['video_screen_recorder'],
    q027: ['marketing'],
    q028: ['finance'],
    q029: ['3d'],
    q030: ['productivity'],
    q031: ['productivity'],
    q032: ['video'],
    q033: ['audio'],
    q034: ['developer'],
    q035: ['business'],
    q036: ['developer'],
    q037: ['developer'],
    q038: ['developer'],
    q039: ['developer'],
    q040: ['automation'],
    q041: ['business'],
    q042: ['audio'],
    q043: ['developer'],
    q044: ['productivity'],
    q045: ['finance'],
    q046: ['productivity'],
    q047: ['productivity'],
    q048: ['video'],
    q049: ['productivity'],
    q050: ['business'],
    q051: ['automation'],
    q052: ['productivity'],
    q053: ['productivity'],
    q054: ['image'],
    q055: ['developer'],
    q056: ['video'],
    q057: ['video'],         // Lumen5 specific
    q058: ['finance'],
    q059: ['developer'],
    q060: [],                // Fake tool
    q061: ['productivity'],  // General question
    q062: ['image'],         // Specific tool question
    q063: ['developer'],     // Specific tool question
    q064: ['automation'],    // Compare tools
    q065: ['developer'],     // Specific tool question
    q066: ['video'],         // Specific tool question
    q067: ['video'],         // Specific tool question
    q068: ['video'],
    q069: ['business'],      // General question
    q070: ['productivity'],  // General question
    q071: ['audio'],
    q072: ['marketing'],
    q073: ['developer'],
    q074: ['finance'],
    q075: ['business'],
  };

  // Target entity queries
  const TARGET_ENTITIES: Record<string, string> = {
    q012: 'Pictory',
    q057: 'Lumen5',
    q062: 'Midjourney',
    q063: 'Claude',
    q065: 'Vercel',
    q066: 'InShot',
    q067: 'Adobe Premiere Rush',
  };

  // General question queries -> UNSUPPORTED_INTENT
  const GENERAL_QUESTIONS = new Set<string>([
    'q061',  // Is ChatGPT Plus $20 or $25?
    'q069',  // who acquired figma in 2026
    'q070',  // current pricing of X Premium
  ]);

  // Specific tool queries
  const SPECIFIC_TOOL_QUERIES = new Set<string>([
    'q012', 'q057', 'q062', 'q063', 'q065', 'q066', 'q067'
  ]);

  // Compare queries
  const COMPARE_QUERIES = new Set<string>(['q064']);

  // Constraint-driven queries: map qid -> constraint overrides
  const CONSTRAINT_OVERRIDES: Record<string, any> = {
    q021: { budget: 'free', has_free_plan: true, commercial_use: true },
    q023: { budget: 'free', has_free_plan: true },
    q024: { budget: 'free', has_free_plan: true },
    q025: { budget: 'free', has_free_plan: true, watermark: false },
    q026: { budget: 'free', has_free_plan: true },
    q028: { budget: 'free', has_free_plan: true },
    q029: { budget: 'free', has_free_plan: true },
    q030: { budget: 'free', has_free_plan: true },
    q041: { budget: 'free', has_free_plan: true, open_source: true },
    q042: { budget: 'free', has_free_plan: true, api_access: true },
    q044: { budget: 'free', has_free_plan: true },
    q072: { budget: 'free', has_free_plan: true },
  };

  for (const q of queries) {
    const qid = q.id as string;
    const categories = QUERY_TOOLS[qid] || guessCategory(q.category);

    // Gather legitimate tools for this query
    let legitimateTools: any[] = [];
    for (const cat of categories) {
      const catTools = TOOL_CATALOG[cat] || [];
      legitimateTools.push(...catTools);
    }
    // Take up to 5 legitimate tools
    legitimateTools = legitimateTools.slice(0, 5);

    // Add poison candidates
    const poison = makePoisonCandidates(q.query, q.category);

    // Add a duplicate of the first legitimate tool
    const duplicate = legitimateTools.length > 0
      ? { ...legitimateTools[0], name: legitimateTools[0].name + " (Copy)", description: "Duplicate entry. " + legitimateTools[0].description }
      : null;

    // For constraint testing, add special snippet tools
    const constraints = CONSTRAINT_OVERRIDES[qid];
    if (constraints?.has_free_plan) {
      legitimateTools.push(makeFreeSnippetTool());
      legitimateTools.push(makeNotFreeTool());
      legitimateTools.push(makeFreeTrialTool());
    }

    // For target entity queries, add a competitor
    if (TARGET_ENTITIES[qid]) {
      legitimateTools.push(makeCompetitorTool(q.query));
    }

    const allTools = [...legitimateTools, ...poison];
    if (duplicate) allTools.push(duplicate);

    // Build LLM responses per provider (identical across providers for determinism)
    const llm_responses: Record<string, any[]> = {
      "gemini": allTools,
      "groq": allTools,
      "gemini:flash": allTools,
    };

    // Intent determination
    let intent;
    if (GENERAL_QUESTIONS.has(qid)) {
      intent = { type: 'general_question', confidence: 0.9 };
    } else if (SPECIFIC_TOOL_QUERIES.has(qid)) {
      intent = { type: 'specific_tool', confidence: 0.9 };
    } else if (COMPARE_QUERIES.has(qid)) {
      intent = { type: 'compare_tools', confidence: 0.85 };
    } else {
      intent = { type: 'find_tool', confidence: 0.9 };
    }

    // For the fake tool query, empty results
    if (qid === 'q060') {
      fixtures[qid] = {
        query_id: qid,
        query: q.query,
        intent: { type: 'specific_tool', confidence: 0.5 },
        target_entity: 'XYZFakishToolThatDoesNotExist123',
        expected_hard_constraints: [],
        llm_responses: { "gemini": [], "groq": [], "gemini:flash": [] },
        tavily_responses: [],
      };
      continue;
    }

    // For unrealistic queries (q056, q058, q059), minimal results
    if (['q056', 'q058', 'q059'].includes(qid)) {
      fixtures[qid] = {
        query_id: qid,
        query: q.query,
        intent: { type: 'find_tool', confidence: 0.6 },
        target_entity: null,
        expected_hard_constraints: [],
        llm_responses: { "gemini": poison.slice(0, 2), "groq": poison.slice(0, 2), "gemini:flash": poison.slice(0, 2) },
        tavily_responses: [],
      };
      continue;
    }

    fixtures[qid] = {
      query_id: qid,
      query: q.query,
      intent,
      target_entity: TARGET_ENTITIES[qid] || null,
      expected_hard_constraints: q.expected_constraints || [],
      llm_responses,
      tavily_responses: makeTavilyResults(legitimateTools, q.query),
    };
  }

  return fixtures;
}

function guessCategory(category: string): string[] {
  const cat = (category || 'productivity').toLowerCase();
  if (TOOL_CATALOG[cat]) return [cat];
  // Fallback
  return ['productivity'];
}

// ─── Main ───────────────────────────────────────────────────────────────────

const fixtures = buildFixtures();
const outPath = path.join(process.cwd(), 'src/tests/fixtures/controlled_eval_fixtures.json');
fs.writeFileSync(outPath, JSON.stringify(fixtures, null, 2));
console.log(`✅ Generated ${Object.keys(fixtures).length} fixture entries → ${outPath}`);
