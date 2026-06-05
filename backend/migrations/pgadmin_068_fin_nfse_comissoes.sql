-- ============================================================================
-- Migration 068 — Controle de NFS-e (Comissoes do Escritorio) — FASE 1
-- ----------------------------------------------------------------------------
-- Banco : basesales (Postgres 16). Rodar no pgAdmin conectado em basesales.
-- Autor : dba  |  Data: 2026-06-05  |  Todos os 31 tenants RepOne ATIVOS.
--
-- O QUE FAZ:
--   Cria, em CADA tenant, as duas tabelas do modulo "Controle de NFS-e":
--     1) fin_nfse_aliquotas — matriz tributaria do escritorio (1 linha, id=1),
--        seedada com os defaults do REMAP (Lucro Presumido / servicos).
--     2) fin_nfse           — os lancamentos mensais (1 linha por nota emitida
--        a uma representada), espelhando a planilha da contadora. Os impostos
--        sao GRAVADOS no registro (snapshot), para o historico nao mudar se a
--        matriz de aliquotas for editada depois.
--
-- MATRIZ (% sobre o VR BRUTO da comissao) seedada:
--   IRRF 1.50 | PIS 0.65 | COFINS 3.00 | CSLL 2.88 | IRPJ 4.80 | ISS 2.50 | FGTS/GPS 2.70
-- FORMULAS (validadas com a planilha):
--   liquido_nf = vr_bruto - irrf
--   liq_rec    = liquido_nf - (pis + cofins + csll + irpj + iss + fgts_gps)
--   (sao calculadas no app e gravadas; o CHECK abaixo so garante valores >= 0)
--
-- CONVENCOES DO PROJETO (conferidas em fin_*/livro_caixa_*/despesas):
--   - Tabelas fin_* usam id SERIAL PK e colunas com nomes PLANOS (sem prefixar
--     cada coluna com a abreviacao da tabela). Seguido aqui (numero, emissao...).
--   - Monetario = NUMERIC(14,2); valores grandes do plano de contas usam (14,2).
--   - Representada = fornecedores.for_codigo (INT). FK LOGICA (sem constraint
--     rigida, mesma linha das demais tabelas fin_*), + snapshot do nome.
--   - timestamptz nos campos de auditoria (padrao despesas/066-067).
--   - Aliquotas em NUMERIC(6,4): cobre ate 99.9999% com 4 casas — folga p/ taxas
--     municipais com mais de 2 decimais sem nunca estourar.
--
-- SEGURANCA (producao viva, 24x7):
--   - Idempotente: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
--     seed via INSERT ... ON CONFLICT (id) DO NOTHING.
--   - All-or-nothing: tudo num unico bloco DO; RAISE EXCEPTION aborta a TX
--     inteira -> nenhum tenant fica pela metade.
--   - Nao-destrutivo: so cria objetos novos e semeia 1 linha de config. Nada
--     existente e apagado ou alterado.
--   - Asserts pos-condicao + RAISE NOTICE de relatorio antes do COMMIT.
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
  cnt_aliq_tbl  INT := 0;  -- tenants com fin_nfse_aliquotas garantida
  cnt_nfse_tbl  INT := 0;  -- tenants com fin_nfse garantida
  cnt_seed      INT := 0;  -- tenants com a linha de matriz (id=1) presente
  has_seed      BOOLEAN;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP

    -- guarda: tenant ATIVO precisa ter o schema (sanidade)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = schema_var
    ) THEN
      RAISE EXCEPTION 'ABORT: schema % nao existe (tenant ATIVO ausente)', schema_var;
    END IF;

    -- ------------------------------------------------------------------------
    -- 1) Matriz tributaria do escritorio (1 linha de config, id fixo = 1)
    -- ------------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.fin_nfse_aliquotas (
        id            SMALLINT     PRIMARY KEY DEFAULT 1,
        regime        VARCHAR(20)  NOT NULL DEFAULT 'PRESUMIDO',
        irrf_pct      NUMERIC(6,4) NOT NULL DEFAULT 0,
        pis_pct       NUMERIC(6,4) NOT NULL DEFAULT 0,
        cofins_pct    NUMERIC(6,4) NOT NULL DEFAULT 0,
        csll_pct      NUMERIC(6,4) NOT NULL DEFAULT 0,
        irpj_pct      NUMERIC(6,4) NOT NULL DEFAULT 0,
        iss_pct       NUMERIC(6,4) NOT NULL DEFAULT 0,
        fgts_gps_pct  NUMERIC(6,4) NOT NULL DEFAULT 0,
        atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT chk_fin_nfse_aliq_singleton CHECK (id = 1)
      )
    $f$, schema_var);
    cnt_aliq_tbl := cnt_aliq_tbl + 1;

    -- seed da matriz REMAP (so se ainda nao houver a linha id=1)
    EXECUTE format($f$
      INSERT INTO %I.fin_nfse_aliquotas
        (id, regime, irrf_pct, pis_pct, cofins_pct, csll_pct, irpj_pct, iss_pct, fgts_gps_pct)
      VALUES (1, 'PRESUMIDO', 1.5000, 0.6500, 3.0000, 2.8800, 4.8000, 2.5000, 2.7000)
      ON CONFLICT (id) DO NOTHING
    $f$, schema_var);

    EXECUTE format($f$
      SELECT EXISTS (SELECT 1 FROM %I.fin_nfse_aliquotas WHERE id = 1)
    $f$, schema_var) INTO has_seed;
    IF has_seed THEN
      cnt_seed := cnt_seed + 1;
    END IF;

    -- ------------------------------------------------------------------------
    -- 2) Lancamentos mensais (1 linha por NFS-e emitida a uma representada)
    -- ------------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.fin_nfse (
        id               SERIAL       PRIMARY KEY,
        numero           VARCHAR(20)  NULL,            -- numero da NF (manual)
        emissao          DATE         NOT NULL,
        competencia      CHAR(7)      NOT NULL,        -- 'YYYY-MM' (filtro por mes)
        for_codigo       INTEGER      NOT NULL,        -- representada (FK logica)
        representada_nome VARCHAR(120) NULL,           -- snapshot historico
        vr_bruto         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (vr_bruto >= 0),
        -- impostos GRAVADOS (snapshot da apuracao no momento do lancamento)
        irrf             NUMERIC(14,2) NOT NULL DEFAULT 0,
        pis              NUMERIC(14,2) NOT NULL DEFAULT 0,
        cofins           NUMERIC(14,2) NOT NULL DEFAULT 0,
        csll             NUMERIC(14,2) NOT NULL DEFAULT 0,
        irpj             NUMERIC(14,2) NOT NULL DEFAULT 0,
        iss              NUMERIC(14,2) NOT NULL DEFAULT 0,
        fgts_gps         NUMERIC(14,2) NOT NULL DEFAULT 0,
        liquido_nf       NUMERIC(14,2) NOT NULL DEFAULT 0,  -- vr_bruto - irrf
        liq_rec          NUMERIC(14,2) NOT NULL DEFAULT 0,  -- liquido_nf - demais
        data_pgto        DATE          NULL,
        transf           BOOLEAN       NOT NULL DEFAULT false, -- planilha 'SIM/OK'
        obs              TEXT          NULL,
        created_by       INTEGER       NULL,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    $f$, schema_var);
    cnt_nfse_tbl := cnt_nfse_tbl + 1;

    -- indices: filtro por mes/competencia (relatorio mensal) e por representada
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_fin_nfse_competencia ON %I.fin_nfse (competencia)',
      schema_var);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_fin_nfse_for_codigo ON %I.fin_nfse (for_codigo)',
      schema_var);
    -- composto: tela costuma listar "competencia X agrupado por representada"
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_fin_nfse_comp_for ON %I.fin_nfse (competencia, for_codigo)',
      schema_var);

  END LOOP;

  -- ---- ASSERTS de invariante (qualquer falha aborta a TX inteira) ----
  IF cnt_aliq_tbl <> array_length(schemas_list, 1) THEN
    RAISE EXCEPTION 'ABORT: fin_nfse_aliquotas garantida em % tenants, esperado %',
      cnt_aliq_tbl, array_length(schemas_list, 1);
  END IF;
  IF cnt_nfse_tbl <> array_length(schemas_list, 1) THEN
    RAISE EXCEPTION 'ABORT: fin_nfse garantida em % tenants, esperado %',
      cnt_nfse_tbl, array_length(schemas_list, 1);
  END IF;
  IF cnt_seed <> array_length(schemas_list, 1) THEN
    RAISE EXCEPTION 'ABORT: matriz (id=1) presente em % tenants, esperado %',
      cnt_seed, array_length(schemas_list, 1);
  END IF;

  -- ---- RELATORIO ----
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Migration 068 — Controle de NFS-e (Comissoes) FASE 1';
  RAISE NOTICE 'Tenants processados ............... %', array_length(schemas_list, 1);
  RAISE NOTICE 'fin_nfse_aliquotas garantida ...... %', cnt_aliq_tbl;
  RAISE NOTICE 'fin_nfse garantida ................ %', cnt_nfse_tbl;
  RAISE NOTICE 'Matriz seedada (linha id=1) ....... %', cnt_seed;
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'OK. Faca COMMIT para aplicar (ou ROLLBACK para descartar).';
END $outer$;

-- ============================================================================
-- VERIFICACAO POS-COMMIT (read-only — rode separado em 1-2 tenants):
--
--   SELECT * FROM remap.fin_nfse_aliquotas;          -- 1 linha, matriz REMAP
--
--   SELECT table_schema, table_name
--   FROM information_schema.tables
--   WHERE table_name IN ('fin_nfse','fin_nfse_aliquotas')
--     AND table_schema IN ('alcarep','remap','softham')
--   ORDER BY 1,2;                                     -- 2 tabelas por tenant
--
--   \d remap.fin_nfse                                 -- confere colunas/indices
-- ============================================================================
