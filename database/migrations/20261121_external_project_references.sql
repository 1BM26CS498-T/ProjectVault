BEGIN;

CREATE TABLE IF NOT EXISTS external_project_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  source_type TEXT NOT NULL CHECK (source_type IN ('website', 'github')),
  source_url TEXT NOT NULL CHECK (char_length(source_url) <= 2048),
  content_text TEXT NOT NULL CHECK (char_length(content_text) BETWEEN 20 AND 80000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, source_url)
);

CREATE INDEX IF NOT EXISTS external_project_references_owner_created_idx
  ON external_project_references(owner_id, created_at DESC);

COMMIT;
