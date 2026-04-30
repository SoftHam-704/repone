-- Migration 013: Smart Importer Drafts Table
-- Rascunhos do Importador Simplificado, por schema de tenant

CREATE TABLE IF NOT EXISTS smart_importer_drafts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  cli_codigo    INTEGER NOT NULL,
  industria_id  INTEGER NOT NULL,
  industria_nome TEXT,
  items         JSONB    NOT NULL DEFAULT '[]',
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_drafts_user ON smart_importer_drafts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_drafts_unique ON smart_importer_drafts(user_id, cli_codigo, industria_id);
