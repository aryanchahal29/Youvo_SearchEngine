-- YouVo: Seed dynamic categories
-- These are starting points — the system creates/infers new categories automatically
-- Supports unlimited depth via parent_id self-reference

-- Root categories
INSERT INTO tool_categories (id, name, slug, parent_id, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'AI Tools', 'ai-tools', NULL, 'Artificial intelligence powered tools and platforms'),
  ('10000000-0000-0000-0000-000000000002', 'Software', 'software', NULL, 'Traditional software tools and platforms'),
  ('10000000-0000-0000-0000-000000000003', 'Developer Tools', 'developer-tools', NULL, 'Tools for software developers');

-- AI subcategories
INSERT INTO tool_categories (id, name, slug, parent_id, description) VALUES
  -- Coding & Development
  ('20000000-0000-0000-0000-000000000001', 'AI Coding', 'ai-coding', '10000000-0000-0000-0000-000000000001', 'AI-powered coding assistants and tools'),
  ('20000000-0000-0000-0000-000000000002', 'Vibe Coding', 'vibe-coding', '20000000-0000-0000-0000-000000000001', 'AI tools for building apps with natural language'),
  ('20000000-0000-0000-0000-000000000003', 'AI Coding Agents', 'ai-coding-agents', '20000000-0000-0000-0000-000000000001', 'Autonomous AI coding agents'),
  
  -- Video
  ('20000000-0000-0000-0000-000000000010', 'AI Video', 'ai-video', '10000000-0000-0000-0000-000000000001', 'AI video generation and editing tools'),
  ('20000000-0000-0000-0000-000000000011', 'AI Avatars', 'ai-avatars', '20000000-0000-0000-0000-000000000010', 'AI avatar and talking head video generators'),
  ('20000000-0000-0000-0000-000000000012', 'Video Editing', 'ai-video-editing', '20000000-0000-0000-0000-000000000010', 'AI-powered video editing tools'),
  
  -- Image & Design
  ('20000000-0000-0000-0000-000000000020', 'AI Image Generation', 'ai-image-generation', '10000000-0000-0000-0000-000000000001', 'AI image and art generation tools'),
  ('20000000-0000-0000-0000-000000000021', 'AI Design', 'ai-design', '10000000-0000-0000-0000-000000000001', 'AI-powered design and prototyping tools'),
  ('20000000-0000-0000-0000-000000000022', '3D Generation', '3d-generation', '20000000-0000-0000-0000-000000000021', 'AI 3D model and scene generation'),
  
  -- Audio & Music
  ('20000000-0000-0000-0000-000000000030', 'AI Audio', 'ai-audio', '10000000-0000-0000-0000-000000000001', 'AI audio, voice, and music tools'),
  ('20000000-0000-0000-0000-000000000031', 'AI Music', 'ai-music', '20000000-0000-0000-0000-000000000030', 'AI music generation and composition'),
  ('20000000-0000-0000-0000-000000000032', 'AI Voice', 'ai-voice', '20000000-0000-0000-0000-000000000030', 'AI voice synthesis and cloning'),
  
  -- Research & Writing
  ('20000000-0000-0000-0000-000000000040', 'AI Research', 'ai-research', '10000000-0000-0000-0000-000000000001', 'AI research and academic tools'),
  ('20000000-0000-0000-0000-000000000041', 'AI Writing', 'ai-writing', '10000000-0000-0000-0000-000000000001', 'AI writing and content creation tools'),
  
  -- Marketing & SEO
  ('20000000-0000-0000-0000-000000000050', 'AI Marketing', 'ai-marketing', '10000000-0000-0000-0000-000000000001', 'AI marketing and content tools'),
  ('20000000-0000-0000-0000-000000000051', 'AI SEO', 'ai-seo', '20000000-0000-0000-0000-000000000050', 'AI-powered SEO tools'),
  
  -- Automation & Productivity
  ('20000000-0000-0000-0000-000000000060', 'AI Automation', 'ai-automation', '10000000-0000-0000-0000-000000000001', 'AI automation and workflow tools'),
  ('20000000-0000-0000-0000-000000000061', 'AI Productivity', 'ai-productivity', '10000000-0000-0000-0000-000000000001', 'AI productivity and organization tools'),
  
  -- Finance & Trading
  ('20000000-0000-0000-0000-000000000070', 'AI Trading', 'ai-trading', '10000000-0000-0000-0000-000000000001', 'AI trading analysis and financial tools'),
  ('20000000-0000-0000-0000-000000000071', 'AI Finance', 'ai-finance', '10000000-0000-0000-0000-000000000001', 'AI financial analysis and planning tools'),
  ('20000000-0000-0000-0000-000000000072', 'AI Analytics', 'ai-analytics', '10000000-0000-0000-0000-000000000001', 'AI data analytics and business intelligence'),
  
  -- Education
  ('20000000-0000-0000-0000-000000000080', 'AI Education', 'ai-education', '10000000-0000-0000-0000-000000000001', 'AI education and learning tools'),
  ('20000000-0000-0000-0000-000000000081', 'AI Tutoring', 'ai-tutoring', '20000000-0000-0000-0000-000000000080', 'AI tutoring and personalized learning'),
  
  -- Presentations
  ('20000000-0000-0000-0000-000000000090', 'AI Presentations', 'ai-presentations', '10000000-0000-0000-0000-000000000001', 'AI presentation and slide generation'),
  
  -- Customer & Sales
  ('20000000-0000-0000-0000-000000000100', 'AI Customer Support', 'ai-customer-support', '10000000-0000-0000-0000-000000000001', 'AI customer support and chatbot tools'),
  ('20000000-0000-0000-0000-000000000101', 'AI Sales', 'ai-sales', '10000000-0000-0000-0000-000000000001', 'AI sales automation and CRM tools'),
  ('20000000-0000-0000-0000-000000000102', 'AI CRM', 'ai-crm', '20000000-0000-0000-0000-000000000101', 'AI-powered customer relationship management'),
  
  -- Language
  ('20000000-0000-0000-0000-000000000110', 'AI Transcription', 'ai-transcription', '10000000-0000-0000-0000-000000000001', 'AI transcription and speech-to-text tools'),
  ('20000000-0000-0000-0000-000000000111', 'AI Translation', 'ai-translation', '10000000-0000-0000-0000-000000000001', 'AI translation and localization tools'),
  
  -- Security & Data
  ('20000000-0000-0000-0000-000000000120', 'AI Cybersecurity', 'ai-cybersecurity', '10000000-0000-0000-0000-000000000001', 'AI cybersecurity and threat detection tools'),
  ('20000000-0000-0000-0000-000000000121', 'AI Data Science', 'ai-data-science', '10000000-0000-0000-0000-000000000001', 'AI data science and ML tools');

-- Software subcategories
INSERT INTO tool_categories (id, name, slug, parent_id, description) VALUES
  ('30000000-0000-0000-0000-000000000001', 'No-Code', 'no-code', '10000000-0000-0000-0000-000000000002', 'No-code development platforms'),
  ('30000000-0000-0000-0000-000000000002', 'Website Builder', 'website-builder', '30000000-0000-0000-0000-000000000001', 'Website and landing page builders'),
  ('30000000-0000-0000-0000-000000000003', 'App Builder', 'app-builder', '30000000-0000-0000-0000-000000000001', 'Mobile and web app builders');

-- Developer tool subcategories
INSERT INTO tool_categories (id, name, slug, parent_id, description) VALUES
  ('30000000-0000-0000-0000-000000000010', 'IDE & Editors', 'ide-editors', '10000000-0000-0000-0000-000000000003', 'Code editors and IDEs'),
  ('30000000-0000-0000-0000-000000000011', 'DevOps', 'devops', '10000000-0000-0000-0000-000000000003', 'DevOps and deployment tools'),
  ('30000000-0000-0000-0000-000000000012', 'API Tools', 'api-tools', '10000000-0000-0000-0000-000000000003', 'API development and testing tools');
