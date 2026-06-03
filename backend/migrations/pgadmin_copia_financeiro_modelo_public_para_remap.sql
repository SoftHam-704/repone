-- ============================================================================
-- COPIA DO PLANO DE CONTAS + CENTRO DE CUSTOS MODELO  (public -> remap)
-- ----------------------------------------------------------------------------
-- Objetivo : popular o tenant 'remap' com o modelo de referencia que esta no
--            schema public (fin_plano_contas e fin_centro_custo).
-- Alvo     : APENAS o schema remap. NAO toca em nenhum outro tenant.
-- Banco    : basesales (Postgres 16).  Rodar no pgAdmin conectado em basesales.
--
-- DIAGNOSTICO (verificado em 2026-06-03, leitura read-only):
--   public.fin_plano_contas  -> 46 linhas (ids 1..46, contiguos, id_pai sem orfaos)
--   public.fin_centro_custo  ->  8 linhas (ids 1..8)
--   remap.fin_plano_contas   ->  0 linhas (tabela existe, VAZIA)
--   remap.fin_centro_custo   ->  0 linhas (tabela existe, VAZIA)
--
-- ESTRATEGIA:
--   * Plano de contas e HIERARQUICO (id_pai REFERENCES fin_plano_contas.id).
--     Como remap esta vazio, PRESERVAMOS os ids do modelo no INSERT. Assim o
--     id_pai continua valido sem nenhum remapeamento. Depois ressincronizamos
--     a sequence com setval para os proximos INSERTs do REP comecarem certos.
--   * Idempotente: so insere se a tabela do remap estiver vazia (guard por
--     COUNT). Rodar de novo nao duplica nada. As FKs id_plano_contas /
--     id_centro_custo de contas_pagar/receber NAO sao tocadas.
--   * As colunas copiadas batem 1:1 entre public e remap (id, codigo, descricao,
--     tipo, nivel, id_pai, ativo  /  id, codigo, descricao, ativo). criado_em e
--     atualizado_em ficam com DEFAULT (now) no remap -- nao ha valor a herdar.
--
-- SEGURANCA: tudo dentro de UMA transacao. Asserts abortam (RAISE EXCEPTION)
--            se qualquer invariante falhar -> nada e gravado.
--
-- >>> REVISAR antes de rodar. Conferir que esta conectado no DB 'basesales'.
-- >>> Producao viva: cargas leves (54 linhas), pode rodar a qualquer hora,
--     mas de preferencia fora do pico. NAO precisa janela de madrugada.
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
  v_seq          TEXT;
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
  RAISE NOTICE 'Destino %     : plano=% , centro=%', v_schema, v_plano_remap, v_centro_remap;

  IF v_plano_pub = 0 THEN
    RAISE EXCEPTION 'Modelo public.fin_plano_contas esta VAZIO - nada a copiar.';
  END IF;

  -- ==========================================================================
  -- 2. PLANO DE CONTAS  (preservando ids para manter a hierarquia id_pai)
  -- ==========================================================================
  IF v_plano_remap = 0 THEN
    EXECUTE format($q$
      INSERT INTO %I.fin_plano_contas (id, codigo, descricao, tipo, nivel, id_pai, ativo)
      SELECT id, codigo, descricao, tipo, nivel, id_pai, ativo
      FROM public.fin_plano_contas
      ORDER BY id
    $q$, v_schema);
    GET DIAGNOSTICS v_ins_plano = ROW_COUNT;

    -- Ressincroniza a sequence do remap para acima do maior id copiado.
    v_seq := pg_get_serial_sequence(v_schema || '.fin_plano_contas', 'id');
    IF v_seq IS NULL THEN
      RAISE EXCEPTION 'Sequence de %.fin_plano_contas.id nao encontrada.', v_schema;
    END IF;
    PERFORM setval(v_seq,
      (SELECT COALESCE(MAX(id), 0) FROM public.fin_plano_contas), true);

    RAISE NOTICE 'PLANO: % linhas inseridas em %.fin_plano_contas (sequence ressincronizada).', v_ins_plano, v_schema;
  ELSE
    RAISE NOTICE 'PLANO: % ja possui % linhas em fin_plano_contas - PULADO (sem duplicar).', v_schema, v_plano_remap;
  END IF;

  -- ==========================================================================
  -- 3. CENTRO DE CUSTO  (preservando ids por consistencia)
  -- ==========================================================================
  IF v_centro_pub = 0 THEN
    RAISE NOTICE 'CENTRO: modelo public.fin_centro_custo vazio - nada a copiar.';
  ELSIF v_centro_remap = 0 THEN
    EXECUTE format($q$
      INSERT INTO %I.fin_centro_custo (id, codigo, descricao, ativo)
      SELECT id, codigo, descricao, ativo
      FROM public.fin_centro_custo
      ORDER BY id
    $q$, v_schema);
    GET DIAGNOSTICS v_ins_centro = ROW_COUNT;

    v_seq := pg_get_serial_sequence(v_schema || '.fin_centro_custo', 'id');
    IF v_seq IS NULL THEN
      RAISE EXCEPTION 'Sequence de %.fin_centro_custo.id nao encontrada.', v_schema;
    END IF;
    PERFORM setval(v_seq,
      (SELECT COALESCE(MAX(id), 0) FROM public.fin_centro_custo), true);

    RAISE NOTICE 'CENTRO: % linhas inseridas em %.fin_centro_custo (sequence ressincronizada).', v_ins_centro, v_schema;
  ELSE
    RAISE NOTICE 'CENTRO: % ja possui % linhas em fin_centro_custo - PULADO (sem duplicar).', v_schema, v_centro_remap;
  END IF;

  -- ==========================================================================
  -- 4. ASSERTS pos-copia (so valem para o que foi efetivamente inserido)
  -- ==========================================================================
  -- 4a. Se inseriu plano, contagem do remap tem de bater com a origem.
  IF v_ins_plano > 0 THEN
    EXECUTE format('SELECT count(*) FROM %I.fin_plano_contas', v_schema) INTO v_plano_remap;
    IF v_plano_remap <> v_plano_pub THEN
      RAISE EXCEPTION 'ASSERT FALHOU: plano remap=% <> public=%', v_plano_remap, v_plano_pub;
    END IF;
    -- 4b. Nenhum id_pai orfao no destino.
    EXECUTE format($q$
      SELECT count(*) FROM %1$I.fin_plano_contas ch
      WHERE ch.id_pai IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM %1$I.fin_plano_contas p WHERE p.id = ch.id_pai)
    $q$, v_schema) INTO v_plano_remap;
    IF v_plano_remap <> 0 THEN
      RAISE EXCEPTION 'ASSERT FALHOU: % id_pai orfaos em %.fin_plano_contas', v_plano_remap, v_schema;
    END IF;
  END IF;

  IF v_ins_centro > 0 THEN
    EXECUTE format('SELECT count(*) FROM %I.fin_centro_custo', v_schema) INTO v_centro_remap;
    IF v_centro_remap <> v_centro_pub THEN
      RAISE EXCEPTION 'ASSERT FALHOU: centro remap=% <> public=%', v_centro_remap, v_centro_pub;
    END IF;
  END IF;

  RAISE NOTICE '========================================================';
  RAISE NOTICE 'OK. Tenant %: plano +% , centro +% . Transacao pronta p/ COMMIT.', v_schema, v_ins_plano, v_ins_centro;
  RAISE NOTICE '========================================================';
END $outer$;

-- Se os NOTICEs acima estiverem OK e nenhum EXCEPTION ocorreu, faca COMMIT.
-- (No pgAdmin, se rodar em bloco autocommit, o DO ja commitou. Se preferir
--  controle manual, envolva em BEGIN; ... DO ...; COMMIT;)
