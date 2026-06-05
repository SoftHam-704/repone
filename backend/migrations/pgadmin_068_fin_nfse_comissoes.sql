-- ============================================================================
-- Migration 068 — Controle de NFS-e (Comissoes do Escritorio) — FASE 1
--                  (+ colunas EMISSION-READY pra FASE 3, todas opcionais)
-- ----------------------------------------------------------------------------
-- Banco : basesales (Postgres 16). Rodar no pgAdmin conectado em basesales.
-- Autor : dba  |  Data: 2026-06-05  |  Todos os 31 tenants RepOne ATIVOS.
--
-- O QUE FAZ:
--   Cria, em CADA tenant, as duas tabelas do modulo "Controle de NFS-e":
--     1) fin_nfse_aliquotas — matriz tributaria do escritorio (1 linha, id=1),
--        seedada com os defaults do REMAP (Lucro Presumido / servicos).
--        Carrega tambem a config de EMISSAO do prestador (inscricao municipal,
--        codigo de servico padrao, ambiente) — usada so na Fase 3.
--     2) fin_nfse           — os lancamentos mensais (1 linha por nota emitida
--        a uma representada), espelhando a planilha da contadora. Os impostos
--        sao GRAVADOS no registro (snapshot), para o historico nao mudar se a
--        matriz de aliquotas for editada depois.
--
-- FASE 1 vs FASE 3 (decisao Hamilton 2026-06-05):
--   A 068 ja NASCE emission-ready pra rodar UMA migration so. As colunas de
--   emissao (rps_*, codigo_servico, discriminacao, protocolo, codigo_verificacao,
--   emitida_em, cancelada_em, xml, pdf_url, erro_msg + status) sao TODAS
--   nulas/opcionais e NAO atrapalham a Fase 1 (controle/apuracao puro).
--   - fin_nfse.status DEFAULT 'CONTROLE' = registro de apuracao, sem emissao real.
--     O ciclo de emissao da Fase 3 usa PENDENTE -> EMITIDA / CANCELADA / ERRO.
--   - Certificado A1 NAO fica no banco (tratado fora, na Fase 3).
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
--   - Convergencia: apos cada CREATE, um bloco ALTER TABLE ... ADD COLUMN
--     IF NOT EXISTS garante que, mesmo num ambiente onde a tabela tenha sido
--     criada parcialmente (versao antiga da 068, sem as colunas de emissao),
--     o re-run alinha o schema sem quebrar nada existente.
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
        -- config de EMISSAO do prestador (Fase 3 — opcional ate la)
        inscricao_municipal   VARCHAR(20) NULL,
        codigo_servico_padrao VARCHAR(10) NULL,  -- cod. servico default novas notas
        ambiente      VARCHAR(12)  NOT NULL DEFAULT 'HOMOLOGACAO',
        atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT chk_fin_nfse_aliq_singleton CHECK (id = 1),
        CONSTRAINT chk_fin_nfse_aliq_ambiente
          CHECK (ambiente IN ('HOMOLOGACAO','PRODUCAO'))
      )
    $f$, schema_var);

    -- convergencia: garante colunas de emissao em tabela pre-existente parcial
    EXECUTE format($f$
      ALTER TABLE %I.fin_nfse_aliquotas
        ADD COLUMN IF NOT EXISTS inscricao_municipal   VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS codigo_servico_padrao VARCHAR(10) NULL,
        ADD COLUMN IF NOT EXISTS ambiente VARCHAR(12) NOT NULL DEFAULT 'HOMOLOGACAO'
    $f$, schema_var);
    EXECUTE format($f$
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'chk_fin_nfse_aliq_ambiente'
            AND conrelid = '%1$I.fin_nfse_aliquotas'::regclass
        ) THEN
          ALTER TABLE %1$I.fin_nfse_aliquotas
            ADD CONSTRAINT chk_fin_nfse_aliq_ambiente
            CHECK (ambiente IN ('HOMOLOGACAO','PRODUCAO'));
        END IF;
      END $$
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
        -- ---- EMISSION-READY (Fase 3) — tudo nulo/opcional na Fase 1 ----
        status           VARCHAR(12)  NOT NULL DEFAULT 'CONTROLE',
        rps_numero       INTEGER       NULL,   -- Recibo Provisorio de Servicos
        rps_serie        VARCHAR(5)    NULL,
        codigo_servico   VARCHAR(10)   NULL,   -- LC116/municipal (repres. ~ 10.09)
        discriminacao    TEXT          NULL,   -- texto dos servicos na nota
        protocolo        VARCHAR(60)   NULL,   -- retorno da prefeitura
        codigo_verificacao VARCHAR(60) NULL,
        emitida_em       TIMESTAMPTZ   NULL,
        cancelada_em     TIMESTAMPTZ   NULL,
        xml              TEXT          NULL,   -- XML da nota (ou referencia)
        pdf_url          TEXT          NULL,   -- link/caminho do PDF
        erro_msg         TEXT          NULL,   -- mensagem de erro da emissao
        created_by       INTEGER       NULL,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT chk_fin_nfse_status
          CHECK (status IN ('CONTROLE','PENDENTE','EMITIDA','CANCELADA','ERRO'))
      )
    $f$, schema_var);

    -- convergencia: garante colunas de emissao em tabela pre-existente parcial
    EXECUTE format($f$
      ALTER TABLE %I.fin_nfse
        ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'CONTROLE',
        ADD COLUMN IF NOT EXISTS rps_numero       INTEGER     NULL,
        ADD COLUMN IF NOT EXISTS rps_serie        VARCHAR(5)  NULL,
        ADD COLUMN IF NOT EXISTS codigo_servico   VARCHAR(10) NULL,
        ADD COLUMN IF NOT EXISTS discriminacao    TEXT        NULL,
        ADD COLUMN IF NOT EXISTS protocolo        VARCHAR(60) NULL,
        ADD COLUMN IF NOT EXISTS codigo_verificacao VARCHAR(60) NULL,
        ADD COLUMN IF NOT EXISTS emitida_em       TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS cancelada_em     TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS xml              TEXT        NULL,
        ADD COLUMN IF NOT EXISTS pdf_url          TEXT        NULL,
        ADD COLUMN IF NOT EXISTS erro_msg         TEXT        NULL
    $f$, schema_var);
    EXECUTE format($f$
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'chk_fin_nfse_status'
            AND conrelid = '%1$I.fin_nfse'::regclass
        ) THEN
          ALTER TABLE %1$I.fin_nfse
            ADD CONSTRAINT chk_fin_nfse_status
            CHECK (status IN ('CONTROLE','PENDENTE','EMITIDA','CANCELADA','ERRO'));
        END IF;
      END $$
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
    -- emissao (Fase 3): fila de notas que precisam de acao (PENDENTE/ERRO).
    -- parcial -> nao indexa CONTROLE/EMITIDA/CANCELADA (a esmagadora maioria).
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS idx_fin_nfse_status_pend ON %I.fin_nfse (status)
      WHERE status IN ('PENDENTE','ERRO')
    $f$, schema_var);

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

  -- emission-ready: confere que as colunas-chave de emissao convergiram em
  -- TODOS os tenants (pega o caso de tabela pre-existente nao alinhada).
  IF EXISTS (
    SELECT 1 FROM unnest(schemas_list) s
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = s AND table_name = 'fin_nfse' AND column_name = 'status'
    )
  ) THEN
    RAISE EXCEPTION 'ABORT: coluna fin_nfse.status ausente em algum tenant';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(schemas_list) s
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = s AND table_name = 'fin_nfse_aliquotas'
        AND column_name = 'ambiente'
    )
  ) THEN
    RAISE EXCEPTION 'ABORT: coluna fin_nfse_aliquotas.ambiente ausente em algum tenant';
  END IF;

  -- ---- RELATORIO ----
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Migration 068 — NFS-e (Comissoes) FASE 1 + emission-ready';
  RAISE NOTICE 'Tenants processados ............... %', array_length(schemas_list, 1);
  RAISE NOTICE 'fin_nfse_aliquotas garantida ...... %', cnt_aliq_tbl;
  RAISE NOTICE 'fin_nfse garantida ................ %', cnt_nfse_tbl;
  RAISE NOTICE 'Matriz seedada (linha id=1) ....... %', cnt_seed;
  RAISE NOTICE 'Colunas de emissao ................ OK (status DEFAULT CONTROLE)';
  RAISE NOTICE 'Ambiente padrao ................... HOMOLOGACAO';
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'OK. Faca COMMIT para aplicar (ou ROLLBACK para descartar).';
END $outer$;

-- ============================================================================
-- VERIFICACAO POS-COMMIT (read-only — rode separado em 1-2 tenants):
--
--   SELECT * FROM remap.fin_nfse_aliquotas;          -- 1 linha, matriz REMAP
--                                                    -- (ambiente='HOMOLOGACAO')
--
--   SELECT table_schema, table_name
--   FROM information_schema.tables
--   WHERE table_name IN ('fin_nfse','fin_nfse_aliquotas')
--     AND table_schema IN ('alcarep','remap','softham')
--   ORDER BY 1,2;                                     -- 2 tabelas por tenant
--
--   \d remap.fin_nfse                                 -- confere colunas/indices
--
--   -- emission-ready: colunas de emissao presentes nos 31 tenants?
--   SELECT table_schema, count(*) AS cols_emissao
--   FROM information_schema.columns
--   WHERE table_name = 'fin_nfse'
--     AND column_name IN ('status','rps_numero','rps_serie','codigo_servico',
--       'discriminacao','protocolo','codigo_verificacao','emitida_em',
--       'cancelada_em','xml','pdf_url','erro_msg')
--   GROUP BY table_schema ORDER BY 1;                 -- esperado: 12 por tenant
-- ============================================================================
