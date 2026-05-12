-- ============================================================================
-- MIGRATION 030 — Índices cad_tabelaspre — TODOS OS TENANTS
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
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '030_fix_cad_tabelaspre_indexes.sql') THEN

        -- índice composto principal
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_ind_tab
                   ON cad_tabelaspre(itab_idindustria, itab_tabela)';

        -- índice simples para listagens por indústria
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_idindustria
                   ON cad_tabelaspre(itab_idindustria)';

        -- índice na FK do JOIN com cad_prod
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_idprod
                   ON cad_tabelaspre(itab_idprod)';

        -- índice em pro_nome para ORDER BY
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cad_prod_nome
                   ON cad_prod(pro_nome)';

        -- remove índice na coluna errada (itab_industria)
        EXECUTE 'DROP INDEX IF EXISTS idx_cad_tabelaspre_ind';

        INSERT INTO _migrations(name) VALUES ('030_fix_cad_tabelaspre_indexes.sql');
        RAISE NOTICE '  ✅ 030 aplicado em %', _schema;

      ELSE
        RAISE NOTICE '  ⏭  030 já aplicado em %', _schema;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Erro em %: %', _schema, SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE 'Concluído.';
END;
$outer$;
