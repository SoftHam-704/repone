-- ============================================================================
-- MIGRATIONS PENDENTES: 031 + 032
-- Execute no pgAdmin conectado ao banco principal (basesales).
-- Aplica em todos os tenants. Idempotente — pode rodar mais de uma vez.
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

    -- ── 031: gru_usa_percomiss ──────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '031_grupos_usa_percomiss.sql') THEN
        EXECUTE '
          ALTER TABLE grupos
          ADD COLUMN IF NOT EXISTS gru_usa_percomiss BOOLEAN NOT NULL DEFAULT FALSE
        ';
        INSERT INTO _migrations(name) VALUES ('031_grupos_usa_percomiss.sql');
        RAISE NOTICE '  ✅ 031 aplicado';
      ELSE
        RAISE NOTICE '  ⏭  031 já aplicado';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 031 erro: %', SQLERRM;
    END;

    -- ── 032: cmp_tipo em campanhas_promocionais ─────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '032_campanhas_tipo.sql') THEN
        EXECUTE '
          ALTER TABLE campanhas_promocionais
          ADD COLUMN IF NOT EXISTS cmp_tipo VARCHAR(20) DEFAULT ''CRESCIMENTO''
        ';
        INSERT INTO _migrations(name) VALUES ('032_campanhas_tipo.sql');
        RAISE NOTICE '  ✅ 032 aplicado';
      ELSE
        RAISE NOTICE '  ⏭  032 já aplicado';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 032 erro: %', SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '━━━ Concluído ━━━';
END;
$outer$;
