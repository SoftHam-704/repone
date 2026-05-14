-- Migration 042: CRM Visitas Campo + IRIS Insights
-- Execute no pgAdmin para cada schema de tenant

-- ── visitas_campo ─────────────────────────────────────────────────────────────
-- Tabela de check-in/checkout de campo com captura de resultado de positivação.
-- Substitui registro_visitas para o fluxo novo; registro_visitas mantido para compat.
CREATE TABLE IF NOT EXISTS visitas_campo (
  id                   SERIAL PRIMARY KEY,
  cli_codigo           INTEGER NOT NULL REFERENCES clientes(cli_codigo)   ON DELETE CASCADE,
  ven_codigo           INTEGER NOT NULL REFERENCES vendedores(ven_codigo) ON DELETE CASCADE,
  data                 DATE         NOT NULL DEFAULT CURRENT_DATE,
  checkin_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  checkin_lat          NUMERIC(10,7),
  checkin_lng          NUMERIC(10,7),
  checkout_at          TIMESTAMPTZ,
  checkout_lat         NUMERIC(10,7),
  checkout_lng         NUMERIC(10,7),
  resultado            TEXT CHECK (resultado IN ('positivou','nao_positivou','reagendou','ausente','fechado')),
  motivo_nao_positivo  TEXT,
  duracao_minutos      INTEGER,
  notas                TEXT,
  criado_em            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_data         ON visitas_campo(data);
CREATE INDEX IF NOT EXISTS idx_vc_ven_data     ON visitas_campo(ven_codigo, data);
CREATE INDEX IF NOT EXISTS idx_vc_cli_data     ON visitas_campo(cli_codigo, data);
CREATE INDEX IF NOT EXISTS idx_vc_resultado    ON visitas_campo(resultado) WHERE resultado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vc_open         ON visitas_campo(data, ven_codigo) WHERE checkout_at IS NULL;

-- ── iris_insights ─────────────────────────────────────────────────────────────
-- Cache de insights gerados pelo IRIS (Claude API). Portal home consome daqui.
CREATE TABLE IF NOT EXISTS iris_insights (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT         NOT NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  gerado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valido_ate  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_iris_tipo      ON iris_insights(tipo);
CREATE INDEX IF NOT EXISTS idx_iris_gerado_em ON iris_insights(gerado_em DESC);
