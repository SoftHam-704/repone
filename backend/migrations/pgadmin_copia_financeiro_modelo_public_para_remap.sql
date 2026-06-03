-- ============================================================================
-- COPIA DO PLANO DE CONTAS + CENTRO DE CUSTOS MODELO  (public -> remap)
-- VERSAO 2 (corrigida) -- 2026-06-03
-- ----------------------------------------------------------------------------
-- Objetivo : popular o tenant 'remap' com o modelo de referencia que esta no
--            schema public (fin_plano_contas e fin_centro_custo).
-- Alvo     : APENAS o schema remap. NAO toca em nenhum outro tenant.
-- Banco    : basesales (Postgres 16).  Rodar no pgAdmin conectado em basesales.
--
-- ----------------------------------------------------------------------------
-- POR QUE A V1 ABORTOU
-- ----------------------------------------------------------------------------
-- A V1 usava  pg_get_serial_sequence('remap.fin_plano_contas','id')  para achar
-- a sequence e ressincronizar. Esse helper SO resolve a sequence pelo vinculo
-- OWNED BY (pg_depend deptype='a'). No remap a sequence EXISTE e o DEFAULT da
-- coluna aponta certo para ela:
--     remap.fin_plano_contas.id  DEFAULT nextval('remap.fin_plano_contas_id_seq')
--     remap.fin_centro_custo.id  DEFAULT nextval('remap.fin_centro_custo_id_seq')
-- ...mas a sequence NAO esta OWNED BY a coluna. Logo pg_get_serial_sequence
-- retorna NULL e o guard (corretamente) abortou. O INSERT do REP funciona
-- normalmente (o DEFAULT dispara o nextval); o problema era so do nosso helper.
--
-- Esta V2:
--   * Resolve a sequence pelo DEFAULT real da coluna (pg_attrdef), nao por OWNED BY.
--   * CONSERTA o vinculo faltante com ALTER SEQUENCE ... OWNED BY <col>, deixando
--     remap estruturalmente correto (pg_dump/DROP CASCADE passam a tratar a
--     sequence como parte da tabela).
--   * So entao copia o modelo preservando ids e ressincroniza com setval.
--
-- DIAGNOSTICO (verificado em 2026-06-03, leitura read-only):
--   public.fin_plano_contas  -> 46 linhas (ids 1..46, contiguos, id_pai sem orfaos)
--   public.fin_centro_custo  ->  8 linhas (ids 1..8)
--   remap.fin_plano_contas   ->  0 linhas (tabela existe, VAZIA, seq SEM owned-by)
--   remap.fin_centro_custo   ->  0 linhas (tabela existe, VAZIA, seq SEM owned-by)
--
-- ESTRATEGIA DE COPIA:
--   * Plano de contas e HIERARQUICO (id_pai REFERENCES fin_plano_contas.id).
--     Como remap esta vazio, PRESERVAMOS os ids do modelo no INSERT, mantendo
--     id_pai valido sem remapeamento. Depois ressincronizamos a sequence com
--     setval(MAX(id)) para os proximos INSERTs do REP comecarem em MAX+1.
--   * Idempotente: so insere se a tabela do remap estiver vazia (guard COUNT).
--     Rodar de novo nao duplica nada. As FKs de contas_pagar/receber nao mudam.
--   * O conserto do OWNED BY tambem e idempotente (re-aplicar e no-op).
--
-- SEGURANCA: tudo dentro de UMA transacao. Asserts (RAISE EXCEPTION) abortam e
--            nada e gravado se qualquer invariante falhar.
--
-- >>> Conferir que esta conectado no DB 'basesales'.
-- >>> Carga leve (54 linhas). Pode rodar a qualquer hora; de preferencia fora de pico.
-- ============================================================================

DO $outer$
DECLARE
  v_schema       TEXT := 'remap';
  v_plano_pub    INT;
  v_centro_pub   INT;
  v_plano_remap  INT;
  v_centro_remap INT;
  v_ins_plano    INT := 0;
  v_ins_centro   INT := 0;
  v_seq          TEXT;   -- nome qualificado schema.seq, resolvido pelo DEFAULT
  v_orphans      INT;
BEGIN
  -- ---- 0. Pre-checagens de existencia das tabelas ---------------------------
  IF to_regclass('public.fin_plano_contas') IS NULL
     OR to_regclass('public.fin_centro_custo') IS NULL THEN
    RAISE EXCEPTION 'Modelo ausente em public (fin_plano_contas / fin_centro_custo).';
  END IF;
  IF to_regclass(v_schema || '.fin_plano_contas') IS NULL
     OR to_regclass(v_schema || '.fin_centro_custo') IS NULL THEN
    RAISE EXCEPTION 'Tabelas financeiras nao existem no tenant %. Rode o financeiro_schema.sql antes.', v_schema;
  END IF;

  -- ---- 1. Contagens de origem e destino -------------------------------------
  SELECT count(*) INTO v_plano_pub  FROM public.fin_plano_contas;
  SELECT count(*) INTO v_centro_pub FROM public.fin_centro_custo;
  EXECUTE format('SELECT count(*) FROM %I.fin_plano_contas', v_schema) INTO v_plano_remap;
  EXECUTE format('SELECT count(*) FROM %I.fin_centro_custo', v_schema) INTO v_centro_remap;

  RAISE NOTICE 'Origem  public : plano=% , centro=%', v_plano_pub, v_centro_pub;
  RAISE NOTICE 'Destino %      : plano=% , centro=%', v_schema, v_plano_remap, v_centro_remap;

  IF v_plano_pub = 0 THEN
    RAISE EXCEPTION 'Modelo public.fin_plano_contas esta VAZIO - nada a copiar.';
  END IF;

  -- ==========================================================================
  -- 2. PLANO DE CONTAS
  -- ==========================================================================
  IF v_plano_remap = 0 THEN
    -- 2a. Resolve a sequence pelo DEFAULT real da coluna id (independe de OWNED BY).
    SELECT regexp_replace(
             pg_get_expr(ad.adbin, ad.adrelid),
             '^nextval\(''(.*)''::regclass\)$', '\1')
      INTO v_seq
    FROM pg_attribute a
    JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = (v_schema || '.fin_plano_contas')::regclass
      AND a.attname  = 'id';

    IF v_seq IS NULL OR v_seq NOT LIKE '%_id_seq' THEN
      RAISE EXCEPTION 'Nao consegui resolver a sequence do DEFAULT de %.fin_plano_contas.id (got: %).', v_schema, v_seq;
    END IF;
    IF to_regclass(v_seq) IS NULL THEN
      RAISE EXCEPTION 'A sequence % referenciada pelo DEFAULT nao existe.', v_seq;
    END IF;

    -- 2b. CONSERTA o vinculo OWNED BY faltante (idempotente).
    EXECUTE format('ALTER SEQUENCE %s OWNED BY %I.fin_plano_contas.id', v_seq, v_schema);
    RAISE NOTICE 'PLANO: OWNED BY garantido (% -> %.fin_plano_contas.id).', v_seq, v_schema;

    -- 2c. Copia preservando ids para manter a hierarquia id_pai.
    EXECUTE format($q$
      INSERT INTO %I.fin_plano_contas (id, codigo, descricao, tipo, nivel, id_pai, ativo)
      SELECT id, codigo, descricao, tipo, nivel, id_pai, ativo
      FROM public.fin_plano_contas
      ORDER BY id
    $q$, v_schema);
    GET DIAGNOSTICS v_ins_plano = ROW_COUNT;

    -- 2d. Ressincroniza a sequence para acima do maior id copiado.
    PERFORM setval(v_seq,
      (SELECT COALESCE(MAX(id), 0) FROM public.fin_plano_contas), true);

    RAISE NOTICE 'PLANO: % linhas inseridas em %.fin_plano_contas (sequence % ressincronizada).',
                 v_ins_plano, v_schema, v_seq;
  ELSE
    RAISE NOTICE 'PLANO: % ja possui % linhas em fin_plano_contas - PULADO (sem duplicar).', v_schema, v_plano_remap;
  END IF;

  -- ==========================================================================
  -- 3. CENTRO DE CUSTO
  -- ==========================================================================
  IF v_centro_pub = 0 THEN
    RAISE NOTICE 'CENTRO: modelo public.fin_centro_custo vazio - nada a copiar.';
  ELSIF v_centro_remap = 0 THEN
    SELECT regexp_replace(
             pg_get_expr(ad.adbin, ad.adrelid),
             '^nextval\(''(.*)''::regclass\)$', '\1')
      INTO v_seq
    FROM pg_attribute a
    JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = (v_schema || '.fin_centro_custo')::regclass
      AND a.attname  = 'id';

    IF v_seq IS NULL OR v_seq NOT LIKE '%_id_seq' THEN
      RAISE EXCEPTION 'Nao consegui resolver a sequence do DEFAULT de %.fin_centro_custo.id (got: %).', v_schema, v_seq;
    END IF;
    IF to_regclass(v_seq) IS NULL THEN
      RAISE EXCEPTION 'A sequence % referenciada pelo DEFAULT nao existe.', v_seq;
    END IF;

    EXECUTE format('ALTER SEQUENCE %s OWNED BY %I.fin_centro_custo.id', v_seq, v_schema);
    RAISE NOTICE 'CENTRO: OWNED BY garantido (% -> %.fin_centro_custo.id).', v_seq, v_schema;

    -- codigo e copiado explicitamente; o DEFAULT lpad(nextval(...)) do remap NAO dispara.
    EXECUTE format($q$
      INSERT INTO %I.fin_centro_custo (id, codigo, descricao, ativo)
      SELECT id, codigo, descricao, ativo
      FROM public.fin_centro_custo
      ORDER BY id
    $q$, v_schema);
    GET DIAGNOSTICS v_ins_centro = ROW_COUNT;

    PERFORM setval(v_seq,
      (SELECT COALESCE(MAX(id), 0) FROM public.fin_centro_custo), true);

    RAISE NOTICE 'CENTRO: % linhas inseridas em %.fin_centro_custo (sequence % ressincronizada).',
                 v_ins_centro, v_schema, v_seq;
  ELSE
    RAISE NOTICE 'CENTRO: % ja possui % linhas em fin_centro_custo - PULADO (sem duplicar).', v_schema, v_centro_remap;
  END IF;

  -- ==========================================================================
  -- 4. ASSERTS pos-copia (so valem para o que foi efetivamente inserido)
  -- ==========================================================================
  IF v_ins_plano > 0 THEN
    EXECUTE format('SELECT count(*) FROM %I.fin_plano_contas', v_schema) INTO v_plano_remap;
    IF v_plano_remap <> v_plano_pub THEN
      RAISE EXCEPTION 'ASSERT FALHOU: plano remap=% <> public=%', v_plano_remap, v_plano_pub;
    END IF;
    EXECUTE format($q$
      SELECT count(*) FROM %1$I.fin_plano_contas ch
      WHERE ch.id_pai IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM %1$I.fin_plano_contas p WHERE p.id = ch.id_pai)
    $q$, v_schema) INTO v_orphans;
    IF v_orphans <> 0 THEN
      RAISE EXCEPTION 'ASSERT FALHOU: % id_pai orfaos em %.fin_plano_contas', v_orphans, v_schema;
    END IF;
  END IF;

  IF v_ins_centro > 0 THEN
    EXECUTE format('SELECT count(*) FROM %I.fin_centro_custo', v_schema) INTO v_centro_remap;
    IF v_centro_remap <> v_centro_pub THEN
      RAISE EXCEPTION 'ASSERT FALHOU: centro remap=% <> public=%', v_centro_remap, v_centro_pub;
    END IF;
  END IF;

  -- 4c. Confirma que agora o OWNED BY existe (helper passa a funcionar).
  IF v_ins_plano > 0 AND pg_get_serial_sequence(v_schema || '.fin_plano_contas', 'id') IS NULL THEN
    RAISE EXCEPTION 'ASSERT FALHOU: OWNED BY de %.fin_plano_contas.id nao foi estabelecido.', v_schema;
  END IF;
  IF v_ins_centro > 0 AND pg_get_serial_sequence(v_schema || '.fin_centro_custo', 'id') IS NULL THEN
    RAISE EXCEPTION 'ASSERT FALHOU: OWNED BY de %.fin_centro_custo.id nao foi estabelecido.', v_schema;
  END IF;

  RAISE NOTICE '========================================================';
  RAISE NOTICE 'OK. Tenant %: plano +% , centro +% . OWNED BY consertado. Transacao pronta p/ COMMIT.', v_schema, v_ins_plano, v_ins_centro;
  RAISE NOTICE '========================================================';
END $outer$;

-- Se os NOTICEs acima estiverem OK e nenhum EXCEPTION ocorreu, faca COMMIT.
-- (No pgAdmin, se rodar em bloco autocommit, o DO ja commitou. Se preferir
--  controle manual, envolva em BEGIN; ... DO ...; COMMIT;)
