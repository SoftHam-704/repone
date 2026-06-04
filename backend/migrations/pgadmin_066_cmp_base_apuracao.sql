-- ============================================================================
-- Migration 066 — cmp_base_apuracao (virada de apuracao SELL-IN -> SELL-OUT)
-- ----------------------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-06-04-campanhas-sellout-proposta.md (§5, §6 Fase 0)
-- Banco: basesales  |  Rodar no pgAdmin como webadmin  |  Todos os 31 tenants ATIVOS
-- Autor: dba  |  Data: 2026-06-04
--
-- O QUE FAZ:
--   1. Adiciona campanhas_promocionais.cmp_base_apuracao VARCHAR(8)
--      NOT NULL DEFAULT 'SELL_IN' + CHECK IN ('SELL_OUT','SELL_IN').
--      Decisao D7: toda campanha existente nasce SELL_IN (default preserva o
--      historico do acordo firmado). NAO altera campanha nenhuma.
--   2. crm_sellout: NAO cria indice. A query de apuracao
--        WHERE cli_codigo=? AND for_codigo=? AND periodo BETWEEN ? AND ?
--      ja e coberta pela UNIQUE crm_sellout_cli_codigo_for_codigo_periodo_key
--      (btree em cli_codigo, for_codigo, periodo) presente em todos os tenants
--      via ON CONFLICT do upsert. Igualdade nas 2 primeiras + range na ultima =
--      uso otimo do indice composto. Criar outro seria redundante (mandamento #2).
--      A migration apenas ASSERTA que esse indice existe e relata.
--
-- SEGURANCA (producao viva, 24x7):
--   - Idempotente: ADD COLUMN IF NOT EXISTS + guarda da CHECK via pg_constraint.
--   - All-or-nothing: tudo dentro de UM bloco DO; RAISE EXCEPTION aborta a TX
--     inteira -> nenhum tenant fica inconsistente.
--   - Nao-destrutivo: so adiciona coluna com DEFAULT (PG16 = metadata-only, sem
--     rewrite de tabela) e CHECK. Nada e apagado ou alterado.
-- ============================================================================

DO $outer$
DECLARE
  schema_var   TEXT;
  schemas_list TEXT[] := ARRAY[
    'alcarep','barrosrep','bissirep','borcatorep','brasil_wl','conquistarep',
    'damarep','eticarep','forecast','garrarep','gemagalhaes','jsaviorep','lagrep',
    'markpress','mettarep','mgarep','ndsrep','pctubarep','prestiarep','remap',
    'repmoraes','repsoma','repwill','rimef','rmrep','rmvcrep','ro_consult','softham',
    'target','tmbrep','trustrep'
  ];
  cnt_col       INT := 0;  -- tenants com a coluna garantida
  cnt_chk       INT := 0;  -- tenants com a CHECK garantida
  cnt_idx_ok    INT := 0;  -- tenants ja cobertos pelo indice do trio
  cnt_idx_new   INT := 0;  -- tenants onde o indice de fallback foi criado
  has_table     BOOLEAN;
  has_check     BOOLEAN;
  has_idx       BOOLEAN;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP

    -- guarda: a tabela tem de existir em todos os tenants ATIVOS
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = schema_var AND table_name = 'campanhas_promocionais'
    ) INTO has_table;
    IF NOT has_table THEN
      RAISE EXCEPTION 'ABORT: %.campanhas_promocionais nao existe (tenant ATIVO sem tabela)', schema_var;
    END IF;

    -- 1) coluna (idempotente; DEFAULT preenche linhas existentes como SELL_IN)
    EXECUTE format(
      'ALTER TABLE %I.campanhas_promocionais '
      'ADD COLUMN IF NOT EXISTS cmp_base_apuracao VARCHAR(8) NOT NULL DEFAULT ''SELL_IN''',
      schema_var
    );
    cnt_col := cnt_col + 1;

    -- 1b) CHECK constraint (so cria se ainda nao existir, por nome)
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class     cl ON cl.oid = con.conrelid
      JOIN pg_namespace n  ON n.oid  = cl.relnamespace
      WHERE n.nspname = schema_var
        AND cl.relname = 'campanhas_promocionais'
        AND con.conname = 'chk_cmp_base_apuracao'
    ) INTO has_check;
    IF NOT has_check THEN
      EXECUTE format(
        'ALTER TABLE %I.campanhas_promocionais '
        'ADD CONSTRAINT chk_cmp_base_apuracao '
        'CHECK (cmp_base_apuracao IN (''SELL_OUT'',''SELL_IN''))',
        schema_var
      );
    END IF;
    cnt_chk := cnt_chk + 1;

    -- 2) indice da apuracao sell-out: checar cobertura, criar fallback so se faltar.
    --    Cobertura = qualquer indice cujas 3 primeiras colunas sejam
    --    (cli_codigo, for_codigo, periodo), nessa ordem.
    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class     ic ON ic.oid = i.indexrelid
      JOIN pg_class     tc ON tc.oid = i.indrelid
      JOIN pg_namespace n  ON n.oid  = tc.relnamespace
      WHERE n.nspname  = schema_var
        AND tc.relname = 'crm_sellout'
        AND (i.indkey::int2[])[0] = (SELECT attnum FROM pg_attribute WHERE attrelid = tc.oid AND attname = 'cli_codigo')
        AND (i.indkey::int2[])[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = tc.oid AND attname = 'for_codigo')
        AND (i.indkey::int2[])[2] = (SELECT attnum FROM pg_attribute WHERE attrelid = tc.oid AND attname = 'periodo')
    ) INTO has_idx;

    IF has_idx THEN
      cnt_idx_ok := cnt_idx_ok + 1;
    ELSE
      -- fallback defensivo: so chega aqui se algum tenant nao tiver a UNIQUE do upsert
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_crm_sellout_cli_for_periodo '
        'ON %I.crm_sellout (cli_codigo, for_codigo, periodo)',
        schema_var
      );
      cnt_idx_new := cnt_idx_new + 1;
      RAISE NOTICE 'FALLBACK: criado indice de apuracao em %.crm_sellout (UNIQUE do upsert estava ausente)', schema_var;
    END IF;

  END LOOP;

  -- ---- ASSERTS de invariante (qualquer falha aborta a TX inteira) ----
  IF cnt_col <> array_length(schemas_list, 1) THEN
    RAISE EXCEPTION 'ABORT: coluna garantida em % tenants, esperado %', cnt_col, array_length(schemas_list, 1);
  END IF;
  IF cnt_chk <> array_length(schemas_list, 1) THEN
    RAISE EXCEPTION 'ABORT: CHECK garantida em % tenants, esperado %', cnt_chk, array_length(schemas_list, 1);
  END IF;
  IF (cnt_idx_ok + cnt_idx_new) <> array_length(schemas_list, 1) THEN
    RAISE EXCEPTION 'ABORT: indice de apuracao resolvido em % tenants, esperado %', (cnt_idx_ok + cnt_idx_new), array_length(schemas_list, 1);
  END IF;

  -- ---- RELATORIO ----
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Migration 066 — cmp_base_apuracao';
  RAISE NOTICE 'Tenants processados ............ %', array_length(schemas_list, 1);
  RAISE NOTICE 'Coluna cmp_base_apuracao ....... % (DEFAULT SELL_IN)', cnt_col;
  RAISE NOTICE 'CHECK chk_cmp_base_apuracao .... %', cnt_chk;
  RAISE NOTICE 'crm_sellout indice trio JA OK .. % (UNIQUE do upsert cobre a query)', cnt_idx_ok;
  RAISE NOTICE 'crm_sellout indice criado now .. %', cnt_idx_new;
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'OK. Faca COMMIT para aplicar (ou ROLLBACK para descartar).';
END $outer$;

-- ============================================================================
-- VERIFICACAO POS-COMMIT (rode separado, read-only, em 1-2 tenants):
--   SELECT cmp_base_apuracao, COUNT(*) FROM ro_consult.campanhas_promocionais
--   GROUP BY 1;   -- esperado: tudo SELL_IN
--   EXPLAIN SELECT SUM(valor), SUM(quantidade), COUNT(*) FROM ro_consult.crm_sellout
--   WHERE cli_codigo=119 AND for_codigo=3
--     AND periodo BETWEEN '2025-01-01' AND '2025-12-01';
--   -> deve usar crm_sellout_cli_codigo_for_codigo_periodo_key (Index Scan).
-- ============================================================================
