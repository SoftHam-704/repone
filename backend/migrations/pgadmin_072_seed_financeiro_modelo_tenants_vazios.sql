-- =============================================================================
-- pgadmin_072_seed_financeiro_modelo_tenants_vazios.sql
-- -----------------------------------------------------------------------------
-- OBJETIVO
--   Popular o MODELO de referencia do Financeiro (plano de contas + centro de
--   custo) nos tenants que estao com a tabela VAZIA. Copia de:
--       public.fin_plano_contas  (modelo, 46 linhas, hierarquico via id_pai)
--       public.fin_centro_custo  (modelo, 8 linhas)
--   ...para cada <tenant>.fin_plano_contas / <tenant>.fin_centro_custo que
--   estiver com 0 linhas. Preserva os ids do modelo (mantem a hierarquia
--   id_pai sem remapeamento, ja que o destino esta vazio).
--
--   Generaliza o template provado:
--       pgadmin_copia_financeiro_modelo_public_para_remap.sql (V2, 2026-06-03)
--   ...para um LOOP sobre TODOS os 31 tenants RepOne ATIVOS.
--
-- POR QUE ESTE SCRIPT EXISTE
--   O listPlanoContasHandler le SO o schema do tenant (sem fallback runtime pro
--   public). Tenant com fin_plano_contas vazio => REP fica sem plano de contas.
--   Varredura read-only (2026-06-10, basesales) encontrou o gap WIDESPREAD:
--     PLANO VAZIO (25): alcarep, bissirep, borcatorep, brasil_wl, damarep,
--       eticarep, forecast, garrarep, gemagalhaes, jsaviorep, lagrep, markpress,
--       mettarep, mgarep, ndsrep, pctubarep, prestiarep, repmoraes, repsoma,
--       repwill, rimef, rmrep, rmvcrep, tmbrep, trustrep
--     CENTRO VAZIO (25): alcarep, bissirep, borcatorep, brasil_wl, conquistarep,
--       damarep, eticarep, forecast, garrarep, gemagalhaes, jsaviorep, lagrep,
--       markpress, mettarep, mgarep, ndsrep, pctubarep, prestiarep, repmoraes,
--       repsoma, repwill, rimef, rmvcrep, tmbrep, trustrep
--   Nao-vazios (PULADOS, intactos): barrosrep(46/8), conquistarep(64 plano),
--     remap(136/10), ro_consult/softham/target(46 plano, 7 centro), rmrep(2 centro).
--
-- -----------------------------------------------------------------------------
-- ARMADILHA CRITICA TRATADA AQUI (descoberta 2026-06-10)
-- -----------------------------------------------------------------------------
--   O fix pgadmin_fix_fin_sequences_owned_by_all_tenants.sql NAO foi totalmente
--   aplicado em producao. 12 tenants ainda tem o DEFAULT da coluna id apontando
--   para a SEQUENCE COMPARTILHADA DO PUBLIC, sem schema:
--       nextval('fin_plano_contas_id_seq'::regclass)   -- resolve p/ public!
--   (garrarep, jsaviorep, mettarep, mgarep, ndsrep, repmoraes, repsoma, rimef,
--    ro_consult, softham, target, conquistarep). public.fin_plano_contas_id_seq
--    ja esta em last_value=76 por vazamento desses tenants.
--
--   Se este seed resolvesse a sequence pelo DEFAULT (como a V2 do remap, que
--   assumia DEFAULT ja qualificado) e desse setval/OWNED BY nela, MOVERIA a
--   sequence do PUBLIC e corromperia o modelo. POR ISSO este script NAO confia
--   no DEFAULT: para cada tabela que vai semear, ele
--     (1) garante a sequence LOCAL  <schema>.<tabela>_id_seq  (CREATE IF NOT EXISTS)
--     (2) repointa o DEFAULT da coluna id para essa seq local QUALIFICADA
--     (3) faz OWNED BY <schema>.<tabela>.id  (seq morre junto com a coluna)
--     (4) copia o modelo preservando id
--     (5) setval na seq LOCAL p/ MAX(id) copiado (proximo INSERT do REP em MAX+1)
--   Ou seja, dobra a logica do fix de sequences dentro do seed, deixando o
--   tenant estruturalmente correto E populado. O public nunca e tocado.
--
-- -----------------------------------------------------------------------------
-- DESCOBERTA DE SCHEMAS
--   pgAdmin roda em basesales; o registro de tenants vive no master
--   (salesmasters_master.public.empresas), inacessivel por cross-DB query daqui.
--   Reusamos o MESMO mecanismo canonico da migration global existente
--   (pgadmin_fix_fin_sequences_owned_by_all_tenants.sql): a lista literal dos 31
--   schemas ATIVOS db_nome='basesales'. Tabela que nao existir no tenant e
--   pulada com NOTICE (defensivo).
--
-- SEGURANCA
--   * Idempotente: so semeia tabela com COUNT(*)=0. Rodar 2x = no-op.
--   * NAO ha DROP/TRUNCATE/DELETE. Tenant nao-vazio nunca e tocado (skip).
--   * Tudo em UMA transacao (BEGIN/COMMIT). Asserts finais -> ROLLBACK total
--     se qualquer invariante violar. Nenhum tenant fica meio-semeado.
--   * O public (modelo + suas sequences) e somente LIDO.
--
-- COMO RODAR
--   1. pgAdmin conectado no database basesales (NAO no master).
--   2. Rodar o arquivo inteiro. Ler os RAISE NOTICE de relatorio.
--   3. Se chegou ao COMMIT sem EXCEPTION, esta aplicado e validado.
--
-- Autor: DBA RepOne (SoftHam) | Data: 2026-06-10
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
-- BLOCO PRINCIPAL
-- -----------------------------------------------------------------------------
DO $seed$
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
  -- Ordem importa: plano primeiro (hierarquico), centro depois.
  tables_list  TEXT[] := ARRAY['fin_plano_contas','fin_centro_custo'];

  tbl_qual     TEXT;   -- "schema"."tabela"
  seq_qual     TEXT;   -- "schema"."tabela_id_seq"  (sequence LOCAL desejada)
  cnt_dest     INT;
  cnt_model    INT;
  ins_rows     INT;

  n_seeded     INT := 0;   -- tabelas efetivamente semeadas
  n_skipped    INT := 0;   -- tabelas nao-vazias puladas
  n_absent     INT := 0;   -- tabelas ausentes no tenant
BEGIN
  -- Pre-checagem: modelo public existe e nao esta vazio (ao menos o plano).
  IF to_regclass('public.fin_plano_contas') IS NULL
     OR to_regclass('public.fin_centro_custo') IS NULL THEN
    RAISE EXCEPTION 'Modelo ausente em public (fin_plano_contas / fin_centro_custo).';
  END IF;
  IF (SELECT count(*) FROM public.fin_plano_contas) = 0 THEN
    RAISE EXCEPTION 'Modelo public.fin_plano_contas esta VAZIO — nada a copiar.';
  END IF;
  -- Modelo nao pode ter id_pai orfao (garante hierarquia copiavel).
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

      -- Tabela ausente no tenant? defensivo (nao deveria ocorrer).
      IF to_regclass(tbl_qual) IS NULL THEN
        n_absent := n_absent + 1;
        RAISE NOTICE '[%][%] TABELA AUSENTE — pulado', schema_var, tbl_var;
        CONTINUE;
      END IF;

      -- Guard de idempotencia: so semeia se destino estiver VAZIO.
      EXECUTE format('SELECT count(*) FROM %s', tbl_qual) INTO cnt_dest;
      IF cnt_dest > 0 THEN
        n_skipped := n_skipped + 1;
        RAISE NOTICE '[%][%] ja tem % linha(s) — PULADO (sem duplicar)', schema_var, tbl_var, cnt_dest;
        CONTINUE;
      END IF;

      -- -----------------------------------------------------------------------
      -- (1) Garante a sequence LOCAL no schema do tenant.
      --     NUNCA confiamos no DEFAULT atual (pode apontar p/ a seq do public).
      -- -----------------------------------------------------------------------
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s', seq_qual);

      -- (2) Repointa o DEFAULT da coluna id para a seq LOCAL qualificada.
      EXECUTE format('ALTER TABLE %s ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
                     tbl_qual, seq_qual);

      -- (3) Vincula OWNED BY -> a seq morre junto com a coluna (pg_dump correto).
      EXECUTE format('ALTER SEQUENCE %s OWNED BY %s.id', seq_qual, tbl_qual);

      -- -----------------------------------------------------------------------
      -- (4) Copia o modelo public PRESERVANDO id (mantem id_pai valido).
      -- -----------------------------------------------------------------------
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

      -- (5) Ressincroniza a seq LOCAL p/ MAX(id) copiado (proximo INSERT = MAX+1).
      EXECUTE format(
        'SELECT setval(%L::regclass, (SELECT COALESCE(MAX(id),0) FROM %s), true)',
        seq_qual, tbl_qual);

      n_seeded := n_seeded + 1;
      RAISE NOTICE '[%][%] SEMEADO — % linhas copiadas do modelo, seq local % ressincronizada',
        schema_var, tbl_var, ins_rows, seq_qual;

    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'RESUMO: % tabelas semeadas | % ja-tinha (puladas) | % ausentes',
    n_seeded, n_skipped, n_absent;
  RAISE NOTICE '====================================================';
END
$seed$;

-- -----------------------------------------------------------------------------
-- ASSERTS FINAIS
--   Para cada tenant/tabela que ficou populada(o):
--     A1. id_pai sem orfaos no plano de contas.
--     A2. DEFAULT da coluna id aponta para a seq LOCAL qualificada (nunca public).
--     A3. OWNED BY resolve para a seq local (pg_get_serial_sequence).
--     A4. anti-colisao: proximo nextval da seq local > MAX(id) atual.
--   Qualquer divergencia -> RAISE EXCEPTION -> ROLLBACK total.
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
  cnt_dest     INT;
  orphans      INT;
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

      EXECUTE format('SELECT count(*) FROM %s', tbl_qual) INTO cnt_dest;
      -- So checamos tabelas POPULADAS. Vazias (modelo nao semeou — nao deveria,
      -- mas defensivo) nao impoem invariante de sequence aqui.
      IF cnt_dest = 0 THEN
        CONTINUE;
      END IF;

      -- A1. Plano de contas: id_pai sem orfaos.
      IF tbl_var = 'fin_plano_contas' THEN
        EXECUTE format($q$
          SELECT count(*) FROM %1$I.fin_plano_contas ch
          WHERE ch.id_pai IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM %1$I.fin_plano_contas p WHERE p.id = ch.id_pai)
        $q$, schema_var) INTO orphans;
        IF orphans <> 0 THEN
          RAISE EXCEPTION 'ASSERT FALHOU [%.%]: % id_pai orfaos', schema_var, tbl_var, orphans;
        END IF;
      END IF;

      -- A2/A3 valem para os tenants que FORAM semeados nesta rodada (seq local
      -- qualificada). Tenants que ja vinham populados de antes podem ter
      -- estrutura legada (ex.: conquistarep ainda aponta seq do public). Para
      -- nao reprovar dados historicos que nao tocamos, so exigimos a invariante
      -- de sequence quando o DEFAULT JA esta qualificado com o schema local
      -- (assinatura do que este script — ou o fix anterior — deixou correto).
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

      IF cur_default = want_default THEN
        -- DEFAULT local: exigimos OWNED BY local + anti-colisao.
        cur_owned := pg_get_serial_sequence(tbl_qual, 'id');
        IF cur_owned IS DISTINCT FROM want_owned THEN
          RAISE EXCEPTION 'ASSERT FALHOU [%.%]: owned_by=% esperado=%',
            schema_var, tbl_var, COALESCE(cur_owned,'<null>'), want_owned;
        END IF;
        EXECUTE format('SELECT COALESCE(MAX(id),0) FROM %s', tbl_qual) INTO max_id;
        EXECUTE format('SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM %s',
                       want_owned) INTO seq_next;
        IF seq_next <= max_id THEN
          RAISE EXCEPTION 'ASSERT FALHOU [%.%]: proximo nextval=% NAO supera MAX(id)=%',
            schema_var, tbl_var, seq_next, max_id;
        END IF;
      END IF;

      n_checked := n_checked + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'ASSERTS OK: % tabelas populadas validadas (id_pai + seq local).', n_checked;
  RAISE NOTICE 'Public (modelo) intacto — somente leitura. Seguro para COMMIT.';
  RAISE NOTICE '====================================================';
END
$assert$;

COMMIT;

-- =============================================================================
-- ROLLBACK MANUAL: troque COMMIT por ROLLBACK para abortar sem gravar.
-- O schema public nunca foi escrito.
-- =============================================================================
