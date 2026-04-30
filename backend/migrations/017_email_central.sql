-- ─── 017_email_central.sql ────────────────────────────────────────────────────
-- Central de Emails Inteligente — IRIS captura e classifica emails recebidos

-- Campos IMAP adicionais em parametros (opt-in por tenant)
ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS par_email_central_ativo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS par_imap_porta          INTEGER DEFAULT 993,
  ADD COLUMN IF NOT EXISTS par_imap_ssl            BOOLEAN DEFAULT TRUE;

-- ─── Tipos ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE email_lead_tipo   AS ENUM ('cotacao','pedido','lead','suporte','reclamacao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_lead_estado AS ENUM ('novo','lido','respondido','arquivado','convertido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Leads capturados pela IRIS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_lead (
  id                SERIAL PRIMARY KEY,
  message_id        VARCHAR(500) UNIQUE NOT NULL,  -- Message-ID header (dedup)
  de                VARCHAR(200),                   -- remetente email
  de_nome           VARCHAR(200),                   -- remetente nome
  para              VARCHAR(200),                   -- destinatário
  assunto           VARCHAR(500),
  corpo_preview     TEXT,                           -- primeiros 1000 chars (texto puro)
  recebido_em       TIMESTAMP,
  tipo              email_lead_tipo   DEFAULT 'outro',
  resumo_ia         TEXT,
  dados_extraidos   JSONB             DEFAULT '{}',
  cliente_id        INTEGER,                        -- ref clientes(cli_codigo) se identificado
  estado            email_lead_estado DEFAULT 'novo',
  usuario_id        INTEGER,                        -- quem está tratando
  respondido_em     TIMESTAMP,
  tokens_consumidos INTEGER           DEFAULT 0,
  created_at        TIMESTAMP         DEFAULT NOW(),
  updated_at        TIMESTAMP         DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_lead_estado   ON email_lead(estado);
CREATE INDEX IF NOT EXISTS idx_email_lead_tipo     ON email_lead(tipo);
CREATE INDEX IF NOT EXISTS idx_email_lead_recebido ON email_lead(recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_email_lead_cliente  ON email_lead(cliente_id);
CREATE INDEX IF NOT EXISTS idx_email_lead_novo     ON email_lead(estado) WHERE estado = 'novo';

-- ─── Respostas enviadas de dentro do sistema ─────────────────────────────────
CREATE TABLE IF NOT EXISTS email_resposta (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES email_lead(id) ON DELETE CASCADE,
  de          VARCHAR(200),
  para        VARCHAR(200),
  assunto     VARCHAR(500),
  corpo       TEXT,
  enviado_em  TIMESTAMP DEFAULT NOW(),
  usuario_id  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_resposta_lead ON email_resposta(lead_id);
