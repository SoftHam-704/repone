-- ============================================================================
-- MIGRATION 041 — Campos dedicados para IRIS e-mail automático
-- Execute no pgAdmin conectado ao banco basesales.
-- NÃO toca em ped_enviado (flag legada de envio à indústria).
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
           ADD COLUMN IF NOT EXISTS ped_iris_autoriza   boolean   DEFAULT false,
           ADD COLUMN IF NOT EXISTS ped_iris_enviado_em timestamp DEFAULT NULL',
        _schema
      );
      RAISE NOTICE '  ✔ % — colunas IRIS adicionadas', _schema;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ % — erro: %', _schema, SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '════ Concluído ════';

END;
$outer$;
