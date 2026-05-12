-- ============================================================================
-- MIGRATION 043 — Flag de política de menor preço por indústria
-- Adiciona for_usa_menor_preco BOOLEAN à tabela fornecedores.
--
-- Quando TRUE: o cálculo do item usa min(bruto_líquido, promo, especial).
-- Quando FALSE (padrão): comportamento padrão RepOne (bruto com descontos).
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
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '043_fornecedores_usa_menor_preco.sql') THEN

        EXECUTE '
          ALTER TABLE fornecedores
          ADD COLUMN IF NOT EXISTS for_usa_menor_preco BOOLEAN NOT NULL DEFAULT FALSE
        ';

        INSERT INTO _migrations(name) VALUES ('043_fornecedores_usa_menor_preco.sql');
        RAISE NOTICE '  ✅ 043 aplicado em %', _schema;

      ELSE
        RAISE NOTICE '  ⏭  043 já aplicado em %', _schema;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Erro em %: %', _schema, SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE 'Concluído.';
END;
$outer$;
