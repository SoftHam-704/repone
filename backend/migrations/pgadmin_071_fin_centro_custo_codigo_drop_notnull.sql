-- ============================================================
-- MIGRATION 071 — fin_centro_custo.codigo: DROP NOT NULL (drift fix)
-- ============================================================
-- CONTEXTO:
--   Bug em produção: cadastrar Centro de Custo sem informar Código
--   falha com "null value in column codigo ... violates not-null constraint".
--   O schema canônico (financeiro_schema.sql) define `codigo VARCHAR(20) UNIQUE`
--   (nullable). O backend trata codigo como OPCIONAL. Porém TODOS os 31 tenants
--   estão com codigo NOT NULL (drift de uma versão anterior do schema).
--
-- ESCOPO: 31/31 tenants RepOne ATIVOS em basesales (drift universal).
--
-- O QUE FAZ:
--   ALTER COLUMN codigo DROP NOT NULL em cada tenant.
--   NÃO toca na constraint UNIQUE (preservada — só vale 1 NULL? NÃO: em PG,
--   UNIQUE permite MÚLTIPLOS NULLs, que é exatamente o comportamento desejado
--   para centros de custo sem código).
--
-- SEGURANÇA:
--   - Idempotente: roda quantas vezes quiser; já-nullable é no-op silencioso.
--   - Transacional (DO block): all-or-nothing. Qualquer falha → ROLLBACK total.
--   - Asserts: aborta se a tabela/coluna não existir em algum tenant, OU se
--     ao final ainda restar algum tenant com codigo NOT NULL.
--   - Não destrói dados (afrouxa constraint; 0 linhas com codigo NULL hoje).
--   - NÃO mexe na UNIQUE.
--
-- EXECUÇÃO: pgAdmin, conectado ao DB basesales. Rodar o bloco inteiro.
-- ============================================================

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
  v_exists     BOOLEAN;
  v_nullable   TEXT;
  changed      INT := 0;
  skipped      INT := 0;
  still_nn     INT := 0;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP
    -- ASSERT: a coluna existe neste tenant?
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = schema_var
         AND table_name   = 'fin_centro_custo'
         AND column_name  = 'codigo'
    ) INTO v_exists;

    IF NOT v_exists THEN
      RAISE EXCEPTION 'ABORT: %.fin_centro_custo.codigo nao existe — tenant fora do padrao', schema_var;
    END IF;

    -- estado atual
    SELECT is_nullable INTO v_nullable
      FROM information_schema.columns
     WHERE table_schema = schema_var
       AND table_name   = 'fin_centro_custo'
       AND column_name  = 'codigo';

    IF v_nullable = 'NO' THEN
      EXECUTE format(
        'ALTER TABLE %I.fin_centro_custo ALTER COLUMN codigo DROP NOT NULL',
        schema_var
      );
      changed := changed + 1;
      RAISE NOTICE '  [FIX] % — codigo NOT NULL -> nullable', schema_var;
    ELSE
      skipped := skipped + 1;
      RAISE NOTICE '  [OK ] % — codigo ja nullable (no-op)', schema_var;
    END IF;
  END LOOP;

  -- ASSERT FINAL: nenhum tenant pode restar com codigo NOT NULL
  SELECT count(*) INTO still_nn
    FROM information_schema.columns
   WHERE table_schema = ANY(schemas_list)
     AND table_name   = 'fin_centro_custo'
     AND column_name  = 'codigo'
     AND is_nullable  = 'NO';

  IF still_nn > 0 THEN
    RAISE EXCEPTION 'ABORT: % tenant(s) ainda com codigo NOT NULL apos a migration', still_nn;
  END IF;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRATION 071 OK — alterados: %, ja-nullable: %, total: %',
               changed, skipped, changed + skipped;
  RAISE NOTICE 'fin_centro_custo.codigo agora nullable em todos os tenants.';
  RAISE NOTICE '============================================================';
END $outer$;
