-- =============================================================================
-- pgadmin_073_financeiro_seed_e_sequences_completo.sql
-- -----------------------------------------------------------------------------
-- OBJETIVO (script COMBINADO, aprovado por Hamilton 2026-06-10)
--   Fechar de uma vez o financeiro por-tenant em TODOS os 31 tenants RepOne:
--     FASE A (seed)      : semear o MODELO public -> tenant em fin_plano_contas /
--                          fin_centro_custo onde a tabela esta VAZIA.
--                          (logica do pgadmin_072_seed_financeiro_modelo_tenants_vazios.sql)
--     FASE B (sequences) : para TODOS os 31 tenants (vazios E nao-vazios,
--                          inclusive os 4 legados conquistarep/ro_consult/softham/
--                          target), GARANTIR que o id de cada tabela usa uma
--                          SEQUENCE LOCAL do proprio schema — nunca a sequence
--                          COMPARTILHADA do public.
--                          (logica do pgadmin_fix_fin_sequences_owned_by_all_tenants.sql)
--
--   Tudo numa UNICA transacao, idempotente, com guard de banco, asserts finais
--   que dao ROLLBACK total se qualquer invariante violar, e NOTICE por tenant.
--   O schema `public` NUNCA e escrito/alterado — somente lido (modelo).
--
-- -----------------------------------------------------------------------------
-- POR QUE COMBINAR
-- -----------------------------------------------------------------------------
--   O 072 so conserta a sequence dos tenants que ELE semeia (os vazios). Os 4
--   tenants legados NAO-VAZIOS ja tem plano de contas, entao o 072 os PULA — e
--   a drift de sequence deles fica pendente. Estado real confirmado em basesales
--   (2026-06-10), DEFAULT da coluna id apontando p/ a seq do PUBLIC sem schema:
--       conquistarep.fin_plano_contas  rows=64  def=nextval('fin_plano_contas_id_seq')
--       conquistarep.fin_centro_custo  rows=0   def=nextval('fin_centro_custo_id_seq')
--       ro_consult.fin_plano_contas    rows=46  def=nextval('fin_plano_contas_id_seq')
--       ro_consult.fin_centro_custo    rows=7   def=nextval('fin_centro_custo_id_seq')
--       softham.fin_plano_contas       rows=46  def=nextval('fin_plano_contas_id_seq')
--       softham.fin_centro_custo       rows=7   def=nextval('fin_centro_custo_id_seq')
--       target.fin_plano_contas        rows=46  def=nextval('fin_plano_contas_id_seq')
--       target.fin_centro_custo        rows=7   def=nextval('fin_centro_custo_id_seq')
--   PROVA DO VAZAMENTO: public.fin_plano_contas_id_seq.last_value=76 (alimentada
--   por esses tenants). Sem este conserto, o PROXIMO INSERT do REP nesses tenants
--   puxa id da seq compartilhada do public => risco de colisao/corrupcao.
--
--   A FASE B roda DEPOIS da FASE A sobre TODOS os tenants. As tabelas que a Fase A
--   acabou de semear ja ficam com seq local correta -> Fase B as detecta "ja ok"
--   e PULA (no-op). A Fase B e o que captura os 4 legados + qualquer drift
--   residual. Cada fase e idempotente por si; rodar o arquivo 2x = no-op.
--
-- -----------------------------------------------------------------------------
-- DESCOBERTA DE SCHEMAS (mecanismo canonico)
-- -----------------------------------------------------------------------------
--   O registro de tenants vive no master (salesmasters_master.public.empresas),
--   inacessivel por cross-DB query do pgAdmin rodando em basesales. As migrations
--   globais anteriores hardcodavam a lista literal dos 31 schemas.
--
--   Aqui derivamos a lista DINAMICAMENTE do proprio catalogo de basesales: todos
--   os schemas (exceto public/sistema) que possuem a tabela `fin_plano_contas`.
--   Verificado em 2026-06-10: retorna EXATAMENTE os 31 tenants esperados.
--   Vantagem: auto-descoberta, sem drift se um tenant entrar/sair; e
--   intrinsecamente correto p/ esta migration (so tocamos schemas que tem as
--   tabelas fin). Tripwire: a contagem precisa bater com EXPECTED_TENANTS (31),
--   senao aborta — protege contra schema novo nao-financeiro entrar na varredura
--   ou contra um tenant sumir inesperadamente.
--   (public._tenants existe em basesales mas esta STALE — 1 linha. NAO usar.)
--
-- -----------------------------------------------------------------------------
-- SEGURANCA
-- -----------------------------------------------------------------------------
--   * Guard: aborta se current_database() <> 'basesales'.
--   * UMA transacao (BEGIN/COMMIT). Asserts finais -> ROLLBACK total se qualquer
--     invariante violar. Nenhum tenant fica meio-aplicado.
--   * Idempotente: Fase A so semeia tabela com COUNT(*)=0; Fase B so altera o que
--     nao estiver ja correto.
--   * NAO ha DROP/TRUNCATE/DELETE. Apenas CREATE SEQUENCE IF NOT EXISTS, setval,
--     ALTER COLUMN SET DEFAULT, ALTER SEQUENCE OWNED BY, INSERT em tabela vazia.
--   * public (modelo + public.fin_*_id_seq) e SOMENTE LIDO. Nunca escrito.
--
-- COMO RODAR
--   1. pgAdmin conectado no database basesales (NAO no master).
--      Conferir: SELECT current_database();  -- deve ser 'basesales'
--   2. Rodar o arquivo inteiro. Ler os RAISE NOTICE de relatorio.
--   3. Se chegou ao COMMIT sem EXCEPTION, esta aplicado e validado.
--
-- Autor: DBA RepOne (SoftHam) | Data: 2026-06-10
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- GUARD: aborta se conectado no banco errado.
-- -----------------------------------------------------------------------------
DO $guard$
BEGIN
  IF current_database() <> 'basesales' THEN
    RAISE EXCEPTION 'ABORTADO: conectado em "%" — este script roda APENAS em basesales',
      current_database();
  END IF;
END
$guard$;

-- =============================================================================
-- FASE A — SEED do modelo public -> tenant (somente tabelas VAZIAS)
-- =============================================================================
DO $seed$
DECLARE
  schema_var       TEXT;
  tbl_var          TEXT;
  schemas_list     TEXT[];
  expected_tenants CONSTANT INT := 31;  -- tripwire da auto-descoberta
  tables_list      TEXT[] := ARRAY['fin_plano_contas','fin_centro_custo']; -- plano 1o (hierarquico)

  tbl_qual     TEXT;   -- "schema"."tabela"
  seq_qual     TEXT;   -- "schema"."tabela_id_seq"  (seq LOCAL desejada)
  cnt_dest     INT;
  ins_rows     INT;

  n_seeded     INT := 0;
  n_skipped    INT := 0;
  n_absent     INT := 0;
BEGIN
  -- Auto-descoberta canonica: schemas que possuem fin_plano_contas.
  SELECT array_agg(table_schema ORDER BY table_schema)
    INTO schemas_list
    FROM information_schema.tables
   WHERE table_name = 'fin_plano_contas'
     AND table_schema NOT IN ('public','information_schema','pg_catalog','pg_toast');

  IF schemas_list IS NULL OR array_length(schemas_list,1) <> expected_tenants THEN
    RAISE EXCEPTION 'Auto-descoberta de tenants retornou % schema(s); esperado % — abortado (lista: %).',
      COALESCE(array_length(schemas_list,1),0), expected_tenants, schemas_list;
  END IF;
  RAISE NOTICE 'Tenants descobertos (%): %', array_length(schemas_list,1), array_to_string(schemas_list, ', ');

  -- Pre-checagem do MODELO public.
  IF to_regclass('public.fin_plano_contas') IS NULL
     OR to_regclass('public.fin_centro_custo') IS NULL THEN
    RAISE EXCEPTION 'Modelo ausente em public (fin_plano_contas / fin_centro_custo).';
  END IF;
  IF (SELECT count(*) FROM public.fin_plano_contas) = 0 THEN
    RAISE EXCEPTION 'Modelo public.fin_plano_contas esta VAZIO — nada a copiar.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.fin_plano_contas ch
    WHERE ch.id_pai IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.fin_plano_contas p WHERE p.id = ch.id_pai)
  ) THEN
    RAISE EXCEPTION 'Modelo public.fin_plano_contas tem id_pai orfao — abortado.';
  END IF;

  FOREACH schema_var IN ARRAY schemas_list LOOP
    FOREACH tbl_var IN ARRAY tables_list LOOP

      tbl_qual := format('%I.%I', schema_var, tbl_var);
      seq_qual := format('%I.%I', schema_var, tbl_var || '_id_seq');

      IF to_regclass(tbl_qual) IS NULL THEN
        n_absent := n_absent + 1;
        RAISE NOTICE '[A][%][%] TABELA AUSENTE — pulado', schema_var, tbl_var;
        CONTINUE;
      END IF;

      -- Idempotencia: so semeia se destino VAZIO.
      EXECUTE format('SELECT count(*) FROM %s', tbl_qual) INTO cnt_dest;
      IF cnt_dest > 0 THEN
        n_skipped := n_skipped + 1;
        RAISE NOTICE '[A][%][%] ja tem % linha(s) — PULADO (sem semear; seq tratada na Fase B)',
          schema_var, tbl_var, cnt_dest;
        CONTINUE;
      END IF;

      -- (1) Sequence LOCAL no schema do tenant (nunca confiar no DEFAULT atual,
      --     que pode apontar p/ a seq do public).
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s', seq_qual);

      -- (2) DEFAULT da coluna id -> seq LOCAL qualificada.
      EXECUTE format('ALTER TABLE %s ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
                     tbl_qual, seq_qual);

      -- (3) OWNED BY -> a seq morre junto com a coluna.
      EXECUTE format('ALTER SEQUENCE %s OWNED BY %s.id', seq_qual, tbl_qual);

      -- (4) Copia o modelo PRESERVANDO id (mantem id_pai valido).
      IF tbl_var = 'fin_plano_contas' THEN
        EXECUTE format($q$
          INSERT INTO %s (id, codigo, descricao, tipo, nivel, id_pai, ativo)
          SELECT id, codigo, descricao, tipo, nivel, id_pai, ativo
          FROM public.fin_plano_contas
          ORDER BY id
        $q$, tbl_qual);
      ELSE  -- fin_centro_custo
        EXECUTE format($q$
          INSERT INTO %s (id, codigo, descricao, ativo)
          SELECT id, codigo, descricao, ativo
          FROM public.fin_centro_custo
          ORDER BY id
        $q$, tbl_qual);
      END IF;
      GET DIAGNOSTICS ins_rows = ROW_COUNT;

      -- (5) setval da seq LOCAL p/ MAX(id) copiado (proximo INSERT = MAX+1).
      EXECUTE format(
        'SELECT setval(%L::regclass, (SELECT COALESCE(MAX(id),0) FROM %s), true)',
        seq_qual, tbl_qual);

      n_seeded := n_seeded + 1;
      RAISE NOTICE '[A][%][%] SEMEADO — % linhas, seq local % ressincronizada',
        schema_var, tbl_var, ins_rows, seq_qual;

    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'FASE A (seed): % semeada(s) | % ja-tinha (puladas) | % ausentes',
    n_seeded, n_skipped, n_absent;
  RAISE NOTICE '====================================================';
END
$seed$;

-- =============================================================================
-- FASE B — SEQUENCES LOCAIS para TODOS os tenants (vazios e nao-vazios)
--   Captura os 4 legados (conquistarep/ro_consult/softham/target) que a Fase A
--   pula por ja terem plano populado. Tabelas semeadas na Fase A ficam "ja ok"
--   aqui -> no-op.
-- =============================================================================
DO $fix$
DECLARE
  schema_var       TEXT;
  tbl_var          TEXT;
  schemas_list     TEXT[];
  expected_tenants CONSTANT INT := 31;
  tables_list      TEXT[] := ARRAY['fin_plano_contas','fin_centro_custo'];

  seq_qual     TEXT;   -- "schema"."tabela_id_seq"
  tbl_qual     TEXT;   -- "schema"."tabela"
  want_default TEXT;   -- DEFAULT desejado

  cur_default  TEXT;
  cur_owned    TEXT;
  seq_exists   BOOLEAN;
  default_ok   BOOLEAN;
  owned_ok     BOOLEAN;

  next_safe    BIGINT;

  n_fixed      INT := 0;
  n_skipped    INT := 0;
  n_total      INT := 0;
BEGIN
  -- Mesma auto-descoberta canonica + tripwire da Fase A.
  SELECT array_agg(table_schema ORDER BY table_schema)
    INTO schemas_list
    FROM information_schema.tables
   WHERE table_name = 'fin_plano_contas'
     AND table_schema NOT IN ('public','information_schema','pg_catalog','pg_toast');

  IF schemas_list IS NULL OR array_length(schemas_list,1) <> expected_tenants THEN
    RAISE EXCEPTION 'Auto-descoberta (Fase B) retornou % schema(s); esperado % — abortado.',
      COALESCE(array_length(schemas_list,1),0), expected_tenants;
  END IF;

  FOREACH schema_var IN ARRAY schemas_list LOOP
    FOREACH tbl_var IN ARRAY tables_list LOOP

      tbl_qual := format('%I.%I', schema_var, tbl_var);
      seq_qual := format('%I.%I', schema_var, tbl_var || '_id_seq');

      IF to_regclass(tbl_qual) IS NULL THEN
        RAISE NOTICE '[B][%][%] TABELA AUSENTE — pulado', schema_var, tbl_var;
        CONTINUE;
      END IF;

      n_total := n_total + 1;

      want_default := format('nextval(%L::regclass)', seq_qual);

      SELECT pg_get_expr(d.adbin, d.adrelid)
        INTO cur_default
        FROM pg_attribute a
        JOIN pg_class cl ON cl.oid = a.attrelid
        JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE nsp.nspname = schema_var
         AND cl.relname  = tbl_var
         AND a.attname   = 'id';

      cur_owned  := pg_get_serial_sequence(tbl_qual, 'id');
      seq_exists := (to_regclass(seq_qual) IS NOT NULL);

      default_ok := (cur_default IS NOT NULL)
                AND (cur_default = format('nextval(''%I.%I''::regclass)', schema_var, tbl_var || '_id_seq'));
      owned_ok   := (cur_owned = format('%I.%I', schema_var, tbl_var || '_id_seq'));

      -- Ja 100% correto (caso tipico das tabelas semeadas na Fase A) -> no-op.
      IF default_ok AND owned_ok AND seq_exists THEN
        n_skipped := n_skipped + 1;
        RAISE NOTICE '[B][%][%] ja ok (seq local) — pulado', schema_var, tbl_var;
        CONTINUE;
      END IF;

      -- PASSO 1: garante a sequence LOCAL.
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s', seq_qual);

      -- PASSO 2: ressincroniza a seq local ACIMA do MAX(id) da tabela do tenant
      --          E acima do valor atual da propria seq local (anti-colisao).
      --          next_safe = GREATEST(MAX(id)+1, proximo_valor_atual_seq, 1).
      --          setval robusto p/ tabela vazia (next_safe=1 => is_called=false).
      EXECUTE format($q$
        SELECT GREATEST(
                 (SELECT COALESCE(MAX(id), 0) + 1 FROM %1$s),
                 (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
                    FROM %2$s),
                 1
               )
      $q$, tbl_qual, seq_qual) INTO next_safe;

      IF next_safe <= 1 THEN
        PERFORM setval(seq_qual::regclass, 1, false);   -- proximo nextval = 1
      ELSE
        PERFORM setval(seq_qual::regclass, next_safe - 1, true); -- proximo = next_safe
      END IF;

      -- PASSO 3: DEFAULT da coluna id -> seq LOCAL qualificada.
      EXECUTE format('ALTER TABLE %s ALTER COLUMN id SET DEFAULT %s',
                     tbl_qual, want_default);

      -- PASSO 4: OWNED BY -> a seq morre junto com a coluna.
      EXECUTE format('ALTER SEQUENCE %s OWNED BY %s.id', seq_qual, tbl_qual);

      n_fixed := n_fixed + 1;
      RAISE NOTICE '[B][%][%] CORRIGIDO — default local, owned_by %.id, seq p/ proximo=%',
        schema_var, tbl_var, tbl_qual, next_safe;

    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'FASE B (sequences): % avaliadas | % corrigidas | % ja ok (puladas)',
    n_total, n_fixed, n_skipped;
  RAISE NOTICE '====================================================';
END
$fix$;

-- =============================================================================
-- ASSERTS FINAIS — invariante de TODOS os tenants alvo.
--   A1. plano de contas: id_pai sem orfaos (so onde populado).
--   A2. DEFAULT da coluna id aponta para a seq LOCAL qualificada (NUNCA public).
--   A3. OWNED BY (pg_get_serial_sequence) resolve p/ a mesma seq local.
--   A4. anti-colisao: proximo nextval da seq local > MAX(id) atual.
--   A5. nenhum tenant aponta para a seq compartilhada do public
--       (default sem schema = nextval('fin_*_id_seq'::regclass)).
--   A6. todo tenant com plano populado tem >= 46 linhas (modelo).
--   Qualquer divergencia -> RAISE EXCEPTION -> ROLLBACK total.
-- =============================================================================
DO $assert$
DECLARE
  schema_var       TEXT;
  tbl_var          TEXT;
  schemas_list     TEXT[];
  expected_tenants CONSTANT INT := 31;
  model_min        CONSTANT INT := 46;  -- linhas do modelo public.fin_plano_contas
  tables_list      TEXT[] := ARRAY['fin_plano_contas','fin_centro_custo'];

  tbl_qual     TEXT;
  want_default TEXT;
  want_owned   TEXT;
  cur_default  TEXT;
  cur_owned    TEXT;
  cnt_dest     INT;
  orphans      INT;
  max_id       BIGINT;
  seq_next     BIGINT;
  n_checked    INT := 0;
  n_seeded_ok  INT := 0;  -- tenants com plano >= model_min
BEGIN
  SELECT array_agg(table_schema ORDER BY table_schema)
    INTO schemas_list
    FROM information_schema.tables
   WHERE table_name = 'fin_plano_contas'
     AND table_schema NOT IN ('public','information_schema','pg_catalog','pg_toast');

  IF schemas_list IS NULL OR array_length(schemas_list,1) <> expected_tenants THEN
    RAISE EXCEPTION 'ASSERT: auto-descoberta retornou % schema(s); esperado %.',
      COALESCE(array_length(schemas_list,1),0), expected_tenants;
  END IF;

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

      -- A5: nunca a seq compartilhada do public (default sem schema).
      IF cur_default = format('nextval(''%I''::regclass)', tbl_var || '_id_seq') THEN
        RAISE EXCEPTION 'ASSERT A5 FALHOU [%.%]: DEFAULT aponta p/ a seq COMPARTILHADA do public (%).',
          schema_var, tbl_var, cur_default;
      END IF;

      -- A2: DEFAULT qualificado correto (seq local do tenant).
      IF cur_default IS DISTINCT FROM want_default THEN
        RAISE EXCEPTION 'ASSERT A2 FALHOU [%.%]: default atual=% esperado=%',
          schema_var, tbl_var, COALESCE(cur_default,'<null>'), want_default;
      END IF;

      -- A3: OWNED BY resolve p/ a seq local correta.
      IF cur_owned IS DISTINCT FROM want_owned THEN
        RAISE EXCEPTION 'ASSERT A3 FALHOU [%.%]: owned_by atual=% esperado=%',
          schema_var, tbl_var, COALESCE(cur_owned,'<null>'), want_owned;
      END IF;

      -- A4: anti-colisao — proximo nextval > MAX(id) atual.
      EXECUTE format('SELECT COALESCE(MAX(id),0) FROM %s', tbl_qual) INTO max_id;
      EXECUTE format('SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM %I.%I',
                     schema_var, tbl_var || '_id_seq') INTO seq_next;
      IF seq_next <= max_id THEN
        RAISE EXCEPTION 'ASSERT A4 FALHOU [%.%]: proximo nextval=% NAO supera MAX(id)=%',
          schema_var, tbl_var, seq_next, max_id;
      END IF;

      -- A1/A6 especificas do plano de contas.
      IF tbl_var = 'fin_plano_contas' THEN
        EXECUTE format('SELECT count(*) FROM %s', tbl_qual) INTO cnt_dest;

        -- A1: id_pai sem orfaos.
        EXECUTE format($q$
          SELECT count(*) FROM %1$I.fin_plano_contas ch
          WHERE ch.id_pai IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM %1$I.fin_plano_contas p WHERE p.id = ch.id_pai)
        $q$, schema_var) INTO orphans;
        IF orphans <> 0 THEN
          RAISE EXCEPTION 'ASSERT A1 FALHOU [%.fin_plano_contas]: % id_pai orfaos', schema_var, orphans;
        END IF;

        -- A6: todo plano populado tem >= 46 linhas (cobre os semeados; os legados
        --     ja vinham com >= 46: conquistarep=64, ro_consult/softham/target=46).
        IF cnt_dest > 0 THEN
          IF cnt_dest < model_min THEN
            RAISE EXCEPTION 'ASSERT A6 FALHOU [%.fin_plano_contas]: % linhas (< % do modelo)',
              schema_var, cnt_dest, model_min;
          END IF;
          n_seeded_ok := n_seeded_ok + 1;
        ELSE
          RAISE EXCEPTION 'ASSERT A6 FALHOU [%.fin_plano_contas]: ficou VAZIO apos a Fase A', schema_var;
        END IF;
      END IF;

      n_checked := n_checked + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'ASSERTS OK: % tabelas validadas | % tenants com plano >= % linhas.',
    n_checked, n_seeded_ok, model_min;
  RAISE NOTICE 'Nenhum tenant aponta para a seq do public (A5). Public intacto — somente leitura.';
  RAISE NOTICE 'Seguro para COMMIT.';
  RAISE NOTICE '====================================================';
END
$assert$;

COMMIT;

-- =============================================================================
-- ROLLBACK MANUAL: troque COMMIT por ROLLBACK para abortar sem gravar.
-- O schema public (modelo + public.fin_*_id_seq) nunca foi escrito.
-- =============================================================================
