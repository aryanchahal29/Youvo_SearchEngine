-- YouVo: Seed default ranking configuration and AI providers

-- Default ranking weights (PRD §18)
INSERT INTO ranking_config (id, category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency, is_default) VALUES
  ('a0000000-0000-0000-0000-000000000001', NULL, 'default', 0.30, 0.20, 0.15, 0.15, 0.10, 0.05, 0.05, true);

-- Category-specific ranking configs
-- Vibe Coding: prioritize ease of use and free value
INSERT INTO ranking_config (category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency)
  SELECT id, 'vibe_coding', 0.20, 0.25, 0.25, 0.10, 0.10, 0.05, 0.05
  FROM tool_categories WHERE slug = 'vibe-coding';

-- AI Video: prioritize quality and value
INSERT INTO ranking_config (category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency)
  SELECT id, 'ai_video', 0.20, 0.20, 0.10, 0.25, 0.10, 0.10, 0.05
  FROM tool_categories WHERE slug = 'ai-video';

-- AI Avatars: prioritize quality (realism, voice, lip sync)
INSERT INTO ranking_config (category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency)
  SELECT id, 'ai_avatars', 0.15, 0.15, 0.10, 0.30, 0.10, 0.10, 0.10
  FROM tool_categories WHERE slug = 'ai-avatars';

-- AI Image: prioritize quality and ease
INSERT INTO ranking_config (category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency)
  SELECT id, 'ai_image', 0.20, 0.20, 0.15, 0.25, 0.10, 0.05, 0.05
  FROM tool_categories WHERE slug = 'ai-image-generation';

-- AI Research: prioritize source quality and reliability
INSERT INTO ranking_config (category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency)
  SELECT id, 'ai_research', 0.25, 0.15, 0.10, 0.20, 0.10, 0.10, 0.10
  FROM tool_categories WHERE slug = 'ai-research';

-- AI Trading: prioritize transparency and reliability
INSERT INTO ranking_config (category_id, name, weight_relevance, weight_value, weight_ease, weight_capability, weight_reputation, weight_freshness, weight_transparency)
  SELECT id, 'ai_trading', 0.20, 0.15, 0.10, 0.20, 0.15, 0.05, 0.15
  FROM tool_categories WHERE slug = 'ai-trading';

-- Seed AI providers (TDA §17)
INSERT INTO ai_providers (id, provider_name, display_name, enabled, priority, model, embedding_model, task_types, health_status) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'gemini', 'Google Gemini', true, 1, 'gemini-2.0-flash', 'text-embedding-004', '["classification","extraction","normalization","summarization","intent","explanation","verification","embedding"]'::jsonb, 'healthy'),
  ('b0000000-0000-0000-0000-000000000002', 'groq', 'Groq', true, 2, 'llama-3.3-70b-versatile', NULL, '["classification","extraction","normalization","summarization","intent","explanation","verification"]'::jsonb, 'healthy');
