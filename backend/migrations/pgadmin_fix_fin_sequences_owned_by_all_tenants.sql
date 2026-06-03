-- =============================================================================
-- pgadmin_fix_fin_sequences_owned_by_all_tenants.sql
-- -----------------------------------------------------------------------------
-- OBJETIVO
--   Consertar o provisionamento das sequences de PK das tabelas financeiras
--   por-tenant `fin_plano_contas` e `fin_centro_custo`. O id de cada uma deve
--   usar uma SEQUENCE LOCAL do proprio schema (<schema>.<tabela>_id_seq),
--   com o DEFAULT da coluna `id` qualificado pelo schema e a sequence
--   OWNED BY <schema>.<tabela>.id.
--
-- DEFEITOS QUE ESTE SCRIPT CORRIGE (confirmados em basesales 2026-06-03):
--   Grupo A  (8 tabelas)  : DEFAULT ja qualificado + seq local existe, mas SEM
--                           vinculo OWNED BY. -> barrosrep, brasil_wl, forecast,
--                           remap.
--   Grupo B1 (12 tabelas) : DEFAULT aponta para `nextval('fin_*_id_seq')` SEM
--                           schema (resolve para a seq do PUBLIC), mas a seq
--                           local JA EXISTE. -> conquistarep, garrarep,
--                           jsaviorep, mettarep, ndsrep, repmoraes.
--   Grupo B2 (12 tabelas) : DEFAULT sem schema E sem seq local. O nextval cai
--                           direto na seq COMPARTILHADA do public. -> mgarep,
--                           repsoma, rimef, ro_consult, softham, target.
--
--   PROVA DO VAZAMENTO: public.fin_plano_contas_id_seq.last_value=47 e
--   conquistarep.fin_plano_contas ja tem id=47 (puxou da seq do public).
--   Idem rimef/ro_consult/softham/target com 46 linhas vindas do public.
--
-- O QUE NAO TOCAMOS
--   * O schema `public` (tabelas modelo fin_plano_contas/fin_centro_custo e suas
--     sequences public.fin_*_id_seq). Apos o conserto, nenhum tenant alimenta
--     mais a seq do public; ela fica intacta e ociosa.
--   * Qualquer tenant ja 100% correto (30 tabelas OK) -> detectado e PULADO.
--
-- SEGURANCA
--   * Idempotente: rodar 2x = no-op na 2a passada.
--   * Transacional: tudo dentro de UMA transacao com asserts finais.
--     Qualquer invariante violada -> RAISE EXCEPTION -> ROLLBACK total.
--   * Anti-colisao: o setval da seq local fica SEMPRE >= MAX(id) atual da
--     tabela daquele tenant, para o proximo INSERT do REP nao repetir id.
--   * NAO ha DROP/TRUNCATE/DELETE. Apenas CREATE SEQUENCE IF NOT EXISTS,
--     setval, ALTER COLUMN SET DEFAULT, ALTER SEQUENCE OWNED BY.
--
-- COMO RODAR
--   1. Conectar o pgAdmin no database `basesales` (NAO no master).
--      Conferir: SELECT current_database();  -- deve ser 'basesales'
--   2. Rodar este arquivo inteiro. Ele esta envolto em BEGIN/COMMIT explicito.
--   3. Ler os RAISE NOTICE de relatorio. Se chegou ao COMMIT sem EXCEPTION,
--      o conserto foi aplicado e validado.
--
-- Autor: DBA RepOne (SoftHam) | Data: 2026-06-03
-- =============================================================================

BEGIN;

-- Trava de seguranca: aborta se conectado no banco errado.
DO $guard$
BEGIN
  IF current_database() <> 'basesales' THEN
    RAISE EXCEPTION 'ABORTADO: conectado em "%" — este script roda APENAS em basesales',
      current_database();
  END IF;
END
$guard$;

-- -----------------------------------------------------------------------------
-- BLOCO PRINCIPAL: varredura por-schema, por-tabela.
-- -----------------------------------------------------------------------------
DO $fix$
DECLARE
  schema_var   TEXT;
  tbl_var      TEXT;
  schemas_list TEXT[] := ARRAY[
    'alcarep','barrosrep','bissirep','borcatorep','brasil_wl','conquistarep',
    'damarep','eticarep','forecast','garrarep','gemagalhaes','jsaviorep','lagrep',
    'markpress','mettarep','mgarep','ndsrep','pctubarep','prestiarep','remap',
    'repmoraes','repsoma','repwill','rimef','rmrep','rmvcrep','ro_consult','softham',
    'target','tmbrep','trustrep'
  ];
  tables_list  TEXT[] := ARRAY['fin_plano_contas','fin_centro_custo'];

  seq_qual     TEXT;   -- 'schema.tabela_id_seq'
  tbl_qual     TEXT;   -- 'schema.tabela'
  want_default TEXT;   -- expressao desejada do DEFAULT

  cur_default  TEXT;   -- DEFAULT atual da coluna id
  cur_owned    TEXT;   -- pg_get_serial_sequence atual (OWNED BY resolvido)
  seq_exists   BOOLEAN;

  default_ok   BOOLEAN;
  owned_ok     BOOLEAN;

  next_safe    BIGINT; -- proximo valor que a seq deve entregar (>= MAX(id)+1)

  n_fixed      INT := 0;
  n_skipped    INT := 0;
  n_total      INT := 0;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP
    FOREACH tbl_var IN ARRAY tables_list LOOP

      tbl_qual := format('%I.%I', schema_var, tbl_var);
      seq_qual := format('%I.%I', schema_var, tbl_var || '_id_seq');

      -- Pula se a tabela nao existe nesse tenant (nao deveria acontecer, mas e seguro).
      IF to_regclass(tbl_qual) IS NULL THEN
        RAISE NOTICE '[%][%] TABELA AUSENTE — pulado', schema_var, tbl_var;
        CONTINUE;
      END IF;

      n_total := n_total + 1;

      -- Expressao desejada do DEFAULT (qualificada com o schema do tenant).
      want_default := format('nextval(%L::regclass)', seq_qual);

      -- Estado ATUAL: DEFAULT da coluna id.
      SELECT pg_get_expr(d.adbin, d.adrelid)
        INTO cur_default
        FROM pg_attribute a
        JOIN pg_class cl ON cl.oid = a.attrelid
        JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE nsp.nspname = schema_var
         AND cl.relname  = tbl_var
         AND a.attname   = 'id';

      -- Estado ATUAL: OWNED BY resolvido.
      cur_owned  := pg_get_serial_sequence(tbl_qual, 'id');
      seq_exists := (to_regclass(seq_qual) IS NOT NULL);

      -- DEFAULT ok = aponta EXATAMENTE para a seq local qualificada.
      default_ok := (cur_default IS NOT NULL)
                AND (cur_default = format('nextval(''%I.%I''::regclass)', schema_var, tbl_var || '_id_seq'));

      -- OWNED ok = pg_get_serial_sequence resolve para a seq local qualificada.
      owned_ok := (cur_owned = format('%I.%I', schema_var, tbl_var || '_id_seq'));

      -- Caso ja esteja 100% correto -> no-op.
      IF default_ok AND owned_ok AND seq_exists THEN
        n_skipped := n_skipped + 1;
        RAISE NOTICE '[%][%] ja ok — pulado', schema_var, tbl_var;
        CONTINUE;
      END IF;

      -- ---------------------------------------------------------------------
      -- PASSO 1: garantir a sequence LOCAL no schema do tenant.
      -- ---------------------------------------------------------------------
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s', seq_qual);

      -- ---------------------------------------------------------------------
      -- PASSO 2: ressincronizar a seq local ACIMA do que ja existe na tabela
      --          do tenant E acima do valor atual da propria seq local
      --          (se ela ja vinha sendo usada). Anti-colisao.
      --
      --   next_safe = proximo valor seguro que a seq deve entregar.
      --             = GREATEST( MAX(id)+1 ,
      --                         proximo_valor_atual_da_seq_local ,
      --                         1 )
      --   Queremos que o PROXIMO nextval entregue exatamente next_safe.
      --
      --   setval robusto (vale ate p/ tabela vazia, next_safe = 1):
      --     * next_safe <= 1  -> setval(seq, 1, false)         (is_called=false)
      --                          => proximo nextval = 1, sem violar o minimo 1.
      --     * next_safe >= 2  -> setval(seq, next_safe - 1, true)
      --                          => proximo nextval = next_safe.
      --   O setval(seq, 0, true) antigo estourava em tenant VAZIO porque 0 < 1
      --   (minimo da sequence). Nunca reusa id ja gravado; nunca recua a seq.
      -- ---------------------------------------------------------------------
      EXECUTE format($q$
        SELECT GREATEST(
                 (SELECT COALESCE(MAX(id), 0) + 1 FROM %1$s),
                 (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
                    FROM %2$s),
                 1
               )
      $q$, tbl_qual, seq_qual) INTO next_safe;

      IF next_safe <= 1 THEN
        -- is_called=false => o proximo nextval retorna 1 (sem violar o minimo).
        PERFORM setval(seq_qual::regclass, 1, false);
      ELSE
        -- is_called=true  => o proximo nextval retorna next_safe.
        PERFORM setval(seq_qual::regclass, next_safe - 1, true);
      END IF;

      -- ---------------------------------------------------------------------
      -- PASSO 3: repontar o DEFAULT da coluna id para a seq LOCAL qualificada.
      -- ---------------------------------------------------------------------
      EXECUTE format('ALTER TABLE %s ALTER COLUMN id SET DEFAULT %s',
                     tbl_qual, want_default);

      -- ---------------------------------------------------------------------
      -- PASSO 4: vincular OWNED BY -> a seq morre junto com a coluna.
      -- ---------------------------------------------------------------------
      EXECUTE format('ALTER SEQUENCE %s OWNED BY %s.id', seq_qual, tbl_qual);

      n_fixed := n_fixed + 1;
      RAISE NOTICE '[%][%] CORRIGIDO — default=%, owned_by=%.id, seq setada p/ proximo=%',
        schema_var, tbl_var, want_default, tbl_qual, next_safe;

    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'RESUMO: % tabelas avaliadas | % corrigidas | % ja ok (puladas)',
    n_total, n_fixed, n_skipped;
  RAISE NOTICE '====================================================';
END
$fix$;

-- -----------------------------------------------------------------------------
-- ASSERTS FINAIS: invariante de TODOS os tenants alvo.
--   Para cada (schema, tabela): DEFAULT precisa estar qualificado com a seq
--   local correta E pg_get_serial_sequence precisa resolver para a mesma seq.
--   Qualquer divergencia -> RAISE EXCEPTION -> ROLLBACK de tudo.
-- -----------------------------------------------------------------------------
DO $assert$
DECLARE
  schema_var   TEXT;
  tbl_var      TEXT;
  schemas_list TEXT[] := ARRAY[
    'alcarep','barrosrep','bissirep','borcatorep','brasil_wl','conquistarep',
    'damarep','eticarep','forecast','garrarep','gemagalhaes','jsaviorep','lagrep',
    'markpress','mettarep','mgarep','ndsrep','pctubarep','prestiarep','remap',
    'repmoraes','repsoma','repwill','rimef','rmrep','rmvcrep','ro_consult','softham',
    'target','tmbrep','trustrep'
  ];
  tables_list  TEXT[] := ARRAY['fin_plano_contas','fin_centro_custo'];

  tbl_qual     TEXT;
  want_default TEXT;
  want_owned   TEXT;
  cur_default  TEXT;
  cur_owned    TEXT;
  max_id       BIGINT;
  seq_next     BIGINT;
  n_checked    INT := 0;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP
    FOREACH tbl_var IN ARRAY tables_list LOOP

      tbl_qual := format('%I.%I', schema_var, tbl_var);
      IF to_regclass(tbl_qual) IS NULL THEN
        CONTINUE;
      END IF;

      want_default := format('nextval(''%I.%I''::regclass)', schema_var, tbl_var || '_id_seq');
      want_owned   := format('%I.%I', schema_var, tbl_var || '_id_seq');

      SELECT pg_get_expr(d.adbin, d.adrelid)
        INTO cur_default
        FROM pg_attribute a
        JOIN pg_class cl ON cl.oid = a.attrelid
        JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE nsp.nspname = schema_var
         AND cl.relname  = tbl_var
         AND a.attname   = 'id';

      cur_owned := pg_get_serial_sequence(tbl_qual, 'id');

      -- Invariante 1: DEFAULT qualificado correto.
      IF cur_default IS DISTINCT FROM want_default THEN
        RAISE EXCEPTION 'ASSERT FALHOU [%.%]: default atual=% esperado=%',
          schema_var, tbl_var, COALESCE(cur_default,'<null>'), want_default;
      END IF;

      -- Invariante 2: OWNED BY resolvivel para a seq local correta.
      IF cur_owned IS DISTINCT FROM want_owned THEN
        RAISE EXCEPTION 'ASSERT FALHOU [%.%]: owned_by atual=% esperado=%',
          schema_var, tbl_var, COALESCE(cur_owned,'<null>'), want_owned;
      END IF;

      -- Invariante 3: anti-colisao — proximo valor da seq > MAX(id) atual.
      EXECUTE format('SELECT COALESCE(MAX(id),0) FROM %s', tbl_qual) INTO max_id;
      EXECUTE format('SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM %I.%I',
                     schema_var, tbl_var || '_id_seq') INTO seq_next;
      IF seq_next <= max_id THEN
        RAISE EXCEPTION 'ASSERT FALHOU [%.%]: proximo nextval=% NAO supera MAX(id)=%',
          schema_var, tbl_var, seq_next, max_id;
      END IF;

      n_checked := n_checked + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'ASSERTS OK: % tabelas validadas (default local + owned by + anti-colisao).',
    n_checked;
  RAISE NOTICE 'Seguro para COMMIT.';
  RAISE NOTICE '====================================================';
END
$assert$;

COMMIT;

-- =============================================================================
-- ROLLBACK MANUAL (se quiser abortar antes do COMMIT, troque COMMIT por ROLLBACK).
-- Nada do public foi tocado em momento algum.
-- =============================================================================
