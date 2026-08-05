CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS prompts_title_trgm_idx ON prompts USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prompts_description_trgm_idx ON prompts USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prompts_content_trgm_idx ON prompts USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING GIN (tags);
