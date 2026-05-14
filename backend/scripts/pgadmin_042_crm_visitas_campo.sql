-- ============================================================================
-- MIGRATION 042: visitas_campo + iris_insights
-- Execute no pgAdmin conectado ao banco principal (basesales).
-- Aplica em todos os tenants. Idempotente — pode rodar mais de uma vez.
-- Pula public (já aplicado manualmente).
-- ============================================================================

DO $outer$
DECLARE
  _schema TEXT;
BEGIN

  FOR _schema IN
    SELECT nspname
    FROM   pg_namespace
    WHERE  nspname NOT IN (
             'public', 'information_schema', 'pg_catalog', 'pg_toast', 'basesales'
           )
      AND  nspname NOT LIKE 'pg_%'
    ORDER  BY nspname
  LOOP
    RAISE NOTICE '━━━ Schema: % ━━━', _schema;
    PERFORM set_config('search_path', _schema || ', public', false);

    -- ── 042: visitas_campo + iris_insights ────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '042_crm_visitas_campo.sql') THEN

        -- visitas_campo
        EXECUTE '
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
            resultado            TEXT CHECK (resultado IN (''positivou'',''nao_positivou'',''reagendou'',''ausente'',''fechado'')),
            motivo_nao_positivo  TEXT,
            duracao_minutos      INTEGER,
            notas                TEXT,
            criado_em            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
          )
        ';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vc_data      ON visitas_campo(data)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vc_ven_data  ON visitas_campo(ven_codigo, data)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vc_cli_data  ON visitas_campo(cli_codigo, data)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vc_resultado ON visitas_campo(resultado) WHERE resultado IS NOT NULL';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vc_open      ON visitas_campo(data, ven_codigo) WHERE checkout_at IS NULL';

        -- iris_insights
        EXECUTE '
          CREATE TABLE IF NOT EXISTS iris_insights (
            id         SERIAL PRIMARY KEY,
            tipo       TEXT        NOT NULL,
            payload    JSONB       NOT NULL DEFAULT ''{}'',
            gerado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            valido_ate TIMESTAMPTZ
          )
        ';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iris_tipo      ON iris_insights(tipo)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iris_gerado_em ON iris_insights(gerado_em DESC)';

        INSERT INTO _migrations(name) VALUES ('042_crm_visitas_campo.sql');
        RAISE NOTICE '  ✅ 042 aplicado';
      ELSE
        RAISE NOTICE '  ⏭  042 já aplicado';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 042 erro: %', SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '━━━ Concluído ━━━';
END;
$outer$;
