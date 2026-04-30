-- ─── 021_fix_email_lead_public.sql ──────────────────────────────────────────
-- A tabela email_lead no schema public já existia com estrutura diferente.
-- Este script adiciona as colunas faltantes para compatibilidade com o módulo
-- Central de Emails. Seguro rodar múltiplas vezes (ADD COLUMN IF NOT EXISTS).

ALTER TABLE email_lead
  ADD COLUMN IF NOT EXISTS message_id        VARCHAR(500),
  ADD COLUMN IF NOT EXISTS para              VARCHAR(500),
  ADD COLUMN IF NOT EXISTS corpo_preview     TEXT,
  ADD COLUMN IF NOT EXISTS dados_extraidos   JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cliente_id        INTEGER,
  ADD COLUMN IF NOT EXISTS usuario_id        INTEGER,
  ADD COLUMN IF NOT EXISTS respondido_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tokens_consumidos INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ  DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ  DEFAULT NOW();

-- Índice único em message_id (se ainda não existir)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename  = 'email_lead'
      AND indexname  = 'email_lead_message_id_key'
  ) THEN
    CREATE UNIQUE INDEX email_lead_message_id_key
      ON email_lead (message_id)
      WHERE message_id IS NOT NULL;
  END IF;
END $$;

-- Tabela de respostas (só cria se não existir)
CREATE TABLE IF NOT EXISTS email_resposta (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES email_lead(id) ON DELETE CASCADE,
  de          VARCHAR(500),
  para        VARCHAR(500),
  assunto     VARCHAR(500),
  corpo       TEXT,
  usuario_id  INTEGER,
  enviado_em  TIMESTAMPTZ DEFAULT NOW()
);
