-- ============================================================================
-- MIGRATIONS CONSOLIDADAS — 031, 040, 041, 043
-- Aplica em TODOS os schemas de tenant automaticamente.
-- Seguro para reexecução: cada bloco verifica antes de alterar.
--
-- Execute no pgAdmin conectado ao banco principal (basesales).
-- Acompanhe os NOTICES na aba "Messages" para confirmar o resultado.
-- ============================================================================

DO $outer$
DECLARE
  _schema  TEXT;
  _col_type TEXT;
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
    RAISE NOTICE '══════════════════════════════════════════';
    RAISE NOTICE 'Schema: %', _schema;

    -- ── 031: gru_usa_percomiss em grupos ────────────────────────────────────
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.grupos
           ADD COLUMN IF NOT EXISTS gru_usa_percomiss BOOLEAN NOT NULL DEFAULT FALSE',
        _schema
      );
      RAISE NOTICE '  ✅ 031 — gru_usa_percomiss OK';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 031 — %', SQLERRM;
    END;

    -- ── 040: ped_enviado varchar(1) → boolean ────────────────────────────────
    -- Só converte se ainda for character varying; ignora se já for boolean.
    BEGIN
      SELECT data_type INTO _col_type
      FROM   information_schema.columns
      WHERE  table_schema = _schema
        AND  table_name   = 'pedidos'
        AND  column_name  = 'ped_enviado';

      IF _col_type IS NULL THEN
        RAISE NOTICE '  ⚠  040 — coluna ped_enviado não existe, pulando';
      ELSIF _col_type = 'boolean' THEN
        RAISE NOTICE '  ⏭  040 — ped_enviado já é boolean';
      ELSE
        EXECUTE format(
          'ALTER TABLE %I.pedidos
             ALTER COLUMN ped_enviado TYPE boolean
             USING (ped_enviado = ''S'')',
          _schema
        );
        RAISE NOTICE '  ✅ 040 — ped_enviado convertido para boolean';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 040 — %', SQLERRM;
    END;

    -- ── 041: ped_iris_autoriza + ped_iris_enviado_em em pedidos ─────────────
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.pedidos
           ADD COLUMN IF NOT EXISTS ped_iris_autoriza   boolean   DEFAULT false,
           ADD COLUMN IF NOT EXISTS ped_iris_enviado_em timestamp DEFAULT NULL',
        _schema
      );
      RAISE NOTICE '  ✅ 041 — colunas IRIS OK';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 041 — %', SQLERRM;
    END;

    -- ── 043: for_usa_menor_preco em fornecedores ─────────────────────────────
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.fornecedores
           ADD COLUMN IF NOT EXISTS for_usa_menor_preco BOOLEAN NOT NULL DEFAULT FALSE',
        _schema
      );
      RAISE NOTICE '  ✅ 043 — for_usa_menor_preco OK';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 043 — %', SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'Concluído — verifique os NOTICES acima.';

END;
$outer$;
