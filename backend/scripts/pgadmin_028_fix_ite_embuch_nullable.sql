-- ============================================================================
-- MIGRATION 028 — Remove NOT NULL de itens_ped.ite_embuch (multi-tenant)
-- Execute no pgAdmin conectado ao banco principal (basesales).
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
    RAISE NOTICE '════ Migrando: % ════', _schema;
    PERFORM set_config('search_path', _schema || ', public', false);

    -- Garante tabela _migrations
    BEGIN
      EXECUTE 'CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- ── Migration 028 ────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '028_fix_ite_embuch_nullable.sql') THEN

        -- Remove NOT NULL apenas se a coluna existir
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = _schema
            AND table_name   = 'itens_ped'
            AND column_name  = 'ite_embuch'
        ) THEN
          EXECUTE 'ALTER TABLE itens_ped ALTER COLUMN ite_embuch DROP NOT NULL';
          EXECUTE 'ALTER TABLE itens_ped ALTER COLUMN ite_embuch SET DEFAULT ''''';
          RAISE NOTICE '  ✅ 028 — ite_embuch agora nullable';
        ELSE
          RAISE NOTICE '  ⏭  028 — coluna ite_embuch não existe neste schema';
        END IF;

        INSERT INTO _migrations (name) VALUES ('028_fix_ite_embuch_nullable.sql');

      ELSE
        RAISE NOTICE '  ⏭  028 — já aplicada';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 028: %', SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE ' Migration 028 concluída em todos os tenants!';
  RAISE NOTICE '════════════════════════════════════════';

END $outer$;
