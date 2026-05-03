-- ============================================================================
-- MIGRATION 031 — Flag de comissão própria por grupo de produto
-- Adiciona gru_usa_percomiss BOOLEAN à tabela grupos.
--
-- Quando TRUE: o relatório de comissão usa gru_percomiss do grupo.
-- Quando FALSE (padrão): usa o % padrão do vendedor (vin_percom).
--
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
    RAISE NOTICE 'Migrando: %', _schema;
    PERFORM set_config('search_path', _schema || ', public', false);

    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '031_grupos_usa_percomiss.sql') THEN

        EXECUTE '
          ALTER TABLE grupos
          ADD COLUMN IF NOT EXISTS gru_usa_percomiss BOOLEAN NOT NULL DEFAULT FALSE
        ';

        INSERT INTO _migrations(name) VALUES ('031_grupos_usa_percomiss.sql');
        RAISE NOTICE '  ✅ 031 aplicado em %', _schema;

      ELSE
        RAISE NOTICE '  ⏭  031 já aplicado em %', _schema;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Erro em %: %', _schema, SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE 'Concluído.';
END;
$outer$;
