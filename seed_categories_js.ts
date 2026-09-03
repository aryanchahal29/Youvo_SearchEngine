import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const categories = [
  // Root
  { id: '10000000-0000-0000-0000-000000000001', name: 'AI Tools', slug: 'ai-tools', parent_id: null, description: 'Artificial intelligence powered tools and platforms' },
  { id: '10000000-0000-0000-0000-000000000002', name: 'Software', slug: 'software', parent_id: null, description: 'Traditional software tools and platforms' },
  { id: '10000000-0000-0000-0000-000000000003', name: 'Developer Tools', slug: 'developer-tools', parent_id: null, description: 'Tools for software developers' },
  // AI subcategories
  { id: '20000000-0000-0000-0000-000000000001', name: 'AI Coding', slug: 'ai-coding', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI-powered coding assistants and tools' },
  { id: '20000000-0000-0000-0000-000000000002', name: 'Vibe Coding', slug: 'vibe-coding', parent_id: '20000000-0000-0000-0000-000000000001', description: 'AI tools for building apps with natural language' },
  { id: '20000000-0000-0000-0000-000000000003', name: 'AI Coding Agents', slug: 'ai-coding-agents', parent_id: '20000000-0000-0000-0000-000000000001', description: 'Autonomous AI coding agents' },
  { id: '20000000-0000-0000-0000-000000000010', name: 'AI Video', slug: 'ai-video', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI video generation and editing tools' },
  { id: '20000000-0000-0000-0000-000000000011', name: 'AI Avatars', slug: 'ai-avatars', parent_id: '20000000-0000-0000-0000-000000000010', description: 'AI avatar and talking head video generators' },
  { id: '20000000-0000-0000-0000-000000000012', name: 'Video Editing', slug: 'ai-video-editing', parent_id: '20000000-0000-0000-0000-000000000010', description: 'AI-powered video editing tools' },
  { id: '20000000-0000-0000-0000-000000000020', name: 'AI Image Generation', slug: 'ai-image-generation', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI image and art generation tools' },
  { id: '20000000-0000-0000-0000-000000000021', name: 'AI Design', slug: 'ai-design', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI-powered design and prototyping tools' },
  { id: '20000000-0000-0000-0000-000000000022', name: '3D Generation', slug: '3d-generation', parent_id: '20000000-0000-0000-0000-000000000021', description: 'AI 3D model and scene generation' },
  { id: '20000000-0000-0000-0000-000000000030', name: 'AI Audio', slug: 'ai-audio', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI audio, voice, and music tools' },
  { id: '20000000-0000-0000-0000-000000000031', name: 'AI Music', slug: 'ai-music', parent_id: '20000000-0000-0000-0000-000000000030', description: 'AI music generation and composition' },
  { id: '20000000-0000-0000-0000-000000000032', name: 'AI Voice', slug: 'ai-voice', parent_id: '20000000-0000-0000-0000-000000000030', description: 'AI voice synthesis and cloning' },
  { id: '20000000-0000-0000-0000-000000000040', name: 'AI Research', slug: 'ai-research', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI research and academic tools' },
  { id: '20000000-0000-0000-0000-000000000041', name: 'AI Writing', slug: 'ai-writing', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI writing and content creation tools' },
  { id: '20000000-0000-0000-0000-000000000050', name: 'AI Marketing', slug: 'ai-marketing', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI marketing and content tools' },
  { id: '20000000-0000-0000-0000-000000000051', name: 'AI SEO', slug: 'ai-seo', parent_id: '20000000-0000-0000-0000-000000000050', description: 'AI-powered SEO tools' },
  { id: '20000000-0000-0000-0000-000000000060', name: 'AI Automation', slug: 'ai-automation', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI automation and workflow tools' },
  { id: '20000000-0000-0000-0000-000000000061', name: 'AI Productivity', slug: 'ai-productivity', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI productivity and organization tools' },
  { id: '20000000-0000-0000-0000-000000000070', name: 'AI Trading', slug: 'ai-trading', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI trading analysis and financial tools' },
  { id: '20000000-0000-0000-0000-000000000071', name: 'AI Finance', slug: 'ai-finance', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI financial analysis and planning tools' },
  { id: '20000000-0000-0000-0000-000000000072', name: 'AI Analytics', slug: 'ai-analytics', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI data analytics and business intelligence' },
  { id: '20000000-0000-0000-0000-000000000080', name: 'AI Education', slug: 'ai-education', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI education and learning tools' },
  { id: '20000000-0000-0000-0000-000000000081', name: 'AI Tutoring', slug: 'ai-tutoring', parent_id: '20000000-0000-0000-0000-000000000080', description: 'AI tutoring and personalized learning' },
  { id: '20000000-0000-0000-0000-000000000090', name: 'AI Presentations', slug: 'ai-presentations', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI presentation and slide generation' },
  { id: '20000000-0000-0000-0000-000000000100', name: 'AI Customer Support', slug: 'ai-customer-support', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI customer support and chatbot tools' },
  { id: '20000000-0000-0000-0000-000000000101', name: 'AI Sales', slug: 'ai-sales', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI sales automation and CRM tools' },
  { id: '20000000-0000-0000-0000-000000000102', name: 'AI CRM', slug: 'ai-crm', parent_id: '20000000-0000-0000-0000-000000000101', description: 'AI-powered customer relationship management' },
  { id: '20000000-0000-0000-0000-000000000110', name: 'AI Transcription', slug: 'ai-transcription', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI transcription and speech-to-text tools' },
  { id: '20000000-0000-0000-0000-000000000111', name: 'AI Translation', slug: 'ai-translation', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI translation and localization tools' },
  { id: '20000000-0000-0000-0000-000000000120', name: 'AI Cybersecurity', slug: 'ai-cybersecurity', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI cybersecurity and threat detection tools' },
  { id: '20000000-0000-0000-0000-000000000121', name: 'AI Data Science', slug: 'ai-data-science', parent_id: '10000000-0000-0000-0000-000000000001', description: 'AI data science and ML tools' },
  { id: '30000000-0000-0000-0000-000000000001', name: 'No-Code', slug: 'no-code', parent_id: '10000000-0000-0000-0000-000000000002', description: 'No-code development platforms' },
  { id: '30000000-0000-0000-0000-000000000002', name: 'Website Builder', slug: 'website-builder', parent_id: '30000000-0000-0000-0000-000000000001', description: 'Website and landing page builders' },
  { id: '30000000-0000-0000-0000-000000000003', name: 'App Builder', slug: 'app-builder', parent_id: '30000000-0000-0000-0000-000000000001', description: 'Mobile and web app builders' },
  { id: '30000000-0000-0000-0000-000000000010', name: 'IDE & Editors', slug: 'ide-editors', parent_id: '10000000-0000-0000-0000-000000000003', description: 'Code editors and IDEs' },
  { id: '30000000-0000-0000-0000-000000000011', name: 'DevOps', slug: 'devops', parent_id: '10000000-0000-0000-0000-000000000003', description: 'DevOps and deployment tools' },
  { id: '30000000-0000-0000-0000-000000000012', name: 'API Tools', slug: 'api-tools', parent_id: '10000000-0000-0000-0000-000000000003', description: 'API development and testing tools' }
];

async function main() {
  console.log("Seeding categories...");
  for (const cat of categories) {
    const { error } = await supabase.from('tool_categories').upsert(cat);
    if (error) {
      console.error(`Error inserting ${cat.name}:`, error);
    } else {
      console.log(`Inserted ${cat.name}`);
    }
  }
  console.log("Done seeding categories.");
}

main().catch(console.error);
