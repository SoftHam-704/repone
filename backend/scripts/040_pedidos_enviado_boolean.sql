-- ============================================================================
-- MIGRATION 040 — Converte ped_enviado de varchar(1) para boolean
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
    RAISE NOTICE 'Migrando schema: %', _schema;

    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.pedidos
           ALTER COLUMN ped_enviado TYPE boolean
           USING (ped_enviado = ''S'')',
        _schema
      );
      RAISE NOTICE '  ✔ % — ped_enviado convertido para boolean', _schema;
    EXCEPTION
      WHEN undefined_column THEN
        RAISE NOTICE '  ⚠ % — coluna ped_enviado não existe, pulando', _schema;
      WHEN OTHERS THEN
        RAISE NOTICE '  ❌ % — erro: %', _schema, SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '════ Concluído ════';

END;
$outer$;
