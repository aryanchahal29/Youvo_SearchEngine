-- YouVo: Enable required PostgreSQL extensions
-- pgvector: vector similarity search for semantic embeddings
-- pg_trgm: trigram-based fuzzy text matching
-- pgcrypto: cryptographic functions for hashing

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
