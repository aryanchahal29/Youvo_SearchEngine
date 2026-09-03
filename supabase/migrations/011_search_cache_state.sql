-- Migration 011: Add cache_state to search_cache
-- Enables stateful caching for negative results, provider failures, and in-progress discovery.

DO $$ 
BEGIN
  -- Add cache_state column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'search_cache' 
    AND column_name = 'cache_state'
  ) THEN
    ALTER TABLE search_cache ADD COLUMN cache_state TEXT NOT NULL DEFAULT 'SUCCESS_RESULT';
  END IF;

  -- Add constraint to ensure valid states
  -- Drop constraint if exists first to allow idempotency
  ALTER TABLE search_cache DROP CONSTRAINT IF EXISTS search_cache_state_check;
  
  ALTER TABLE search_cache ADD CONSTRAINT search_cache_state_check 
  CHECK (cache_state IN ('SUCCESS_RESULT', 'NEGATIVE_RESULT', 'DISCOVERY_IN_PROGRESS', 'PROVIDER_FAILURE'));
  
END $$;
