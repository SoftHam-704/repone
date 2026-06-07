-- ============================================================================
-- Migration 070 — Conta Corrente da Parcela (Contas a RECEBER): LEDGER de baixas
-- ----------------------------------------------------------------------------
-- Banco : basesales (Postgres 16). Rodar no pgAdmin conectado em basesales.
-- Autor : dba  |  Data: 2026-06-07  |  Todos os 31 tenants RepOne ATIVOS.
-- Espelho EXATO da migration 069 (fin_baixas_pagar), lado RECEBER.
--
-- O QUE FAZ:
--   1) Cria, em CADA tenant, a tabela NOVA fin_baixas_receber — o "extrato"/ledger
--      das parcelas a receber. A parcela vira o PAI (titulo); cada recebimento
--      parcial/integral e cada estorno vira uma LINHA FILHA aqui. Hoje a baixa
--      SOBRESCREVE a parcela (perde historico) — esta tabela resolve isso.
--   2) BACKFILL: para cada parcela hoje RECEBIDO com valor_recebido>0, cria 1
--      movimento 'BAIXA' espelhando o estado atual da parcela, e linka ao
--      lancamento de caixa ja existente (livro_caixa origem='CR' /
--      id_parcela_origem) quando achavel. Idempotente: nao duplica em re-run.
--
-- O QUE *NAO* FAZ (de proposito):
--   - NAO altera valores de fin_parcelas_receber nem de fin_contas_receber. So
--     CRIA o ledger espelhando o estado atual. O recalculo derivado (parcela/conta
--     a partir do ledger) fica pro backend, na reescrita do baixaContaReceberHandler.
--   - NAO mexe no livro_caixa. So LE pra achar o id_lancamento_caixa.
--
-- DIFERENCAS vs 069 (lado PAGAR) — conferidas no schema real em producao 2026-06-07:
--   - Coluna de valor: a parcela RECEBER usa **valor_recebido** (nao valor_pago).
--     => O LEDGER tambem usa **valor_recebido** (mesmo nome, p/ o backend espelhar
--        limpo). ESTE E O NOME EXATO QUE O BACKEND DEVE USAR.
--   - Data de baixa: parcela usa **data_recebimento** (nao data_pagamento).
--   - FK pai: parcela.**id_conta_receber** -> fin_contas_receber.id.
--   - Status de quitacao: **'RECEBIDO'** (NAO 'PAGO'). conta e parcela usam o mesmo.
--   - livro_caixa origem do recebimento: **'CR'** (entrada, tipo 'C').
--   - fin_parcelas_receber NAO tem valor_com_imposto / valor_sem_imposto (a versao
--     PAGAR tem; a RECEBER nao). O ledger MANTEM essas colunas por simetria com o
--     fin_baixas_pagar e com o backend, mas no backfill elas ficam 0 (a parcela
--     receber nao guarda split de imposto). Coluna timestamp da parcela = criado_em.
--
-- CONVENCOES (identicas a 069):
--   - fin_* : id SERIAL PK, colunas com nomes PLANOS (sem prefixo).
--   - Monetario das parcelas = NUMERIC(15,2). O ledger usa (15,2) em
--     valor_recebido/juros/desconto (= precisao da parcela) e (14,2) nos
--     *_imposto (= padrao da 069 / origem PAGAR).
--   - Auditoria: timestamp WITHOUT time zone, DEFAULT CURRENT_TIMESTAMP.
--   - created_by INTEGER = req.user.userId numerico (distinto de
--     fin_contas_receber.criado_por que e varchar legado).
--   - livro_caixa_lancamentos.origem e CHAR(2) — comparo com TRIM no backfill.
--   - FKs LOGICAS (sem constraint rigida) — mesma linha das demais fin_*.
--
-- DADOS HOJE (auditados em producao 2026-06-07):
--   - So 2 tenants tem movimento real no RECEBER:
--       * remap        : 3 parcelas RECEBIDO, 3 lancamentos CR (1:1, valores batem).
--       * conquistarep : 7 parcelas RECEBIDO, 0 lancamentos de caixa (recebimentos
--                        anteriores a integracao do caixa -> id_lancamento_caixa fica
--                        NULL no backfill, igual ao comportamento best-effort da 069).
--   - Status unico observado = 'RECEBIDO' (em parcelas E contas), nos 31 tenants.
--   - Invariante conta.valor_recebido == SUM(parcelas RECEBIDO.valor_recebido) JA
--     VALE (0 contas divergentes em remap e conquistarep). Juros/desconto todos 0.
--   - Os outros 29 tenants nao tem parcela recebida (so ganham a tabela vazia).
--
-- SEGURANCA (producao viva, 24x7):
--   - Idempotente: CREATE TABLE/INDEX IF NOT EXISTS + backfill com NOT EXISTS.
--   - All-or-nothing: tudo num unico bloco DO; RAISE EXCEPTION aborta a TX inteira.
--   - Nao-destrutivo: so cria objeto novo e insere o espelho do estado atual.
--   - Asserts de invariante por tenant ANTES do COMMIT (abaixo).
--   - DRY-RUN: rode dentro de  BEGIN; <este script>  ROLLBACK;  no pgAdmin.
-- ============================================================================

DO $outer$
DECLARE
  schema_var TEXT;
  schemas_list TEXT[] := ARRAY[
    'alcarep','barrosrep','bissirep','borcatorep','brasil_wl','conquistarep',
    'damarep','eticarep','forecast','garrarep','gemagalhaes','jsaviorep','lagrep',
    'markpress','mettarep','mgarep','ndsrep','pctubarep','prestiarep','remap',
    'repmoraes','repsoma','repwill','rimef','rmrep','rmvcrep','ro_consult','softham',
    'target','tmbrep','trustrep'
  ];
  tenants_ok          INT := 0;
  total_baixas_ins    INT := 0;
  linkadas_neste      INT := 0;
  baixas_neste        INT := 0;
  contas_divergentes  INT := 0;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP

    -- ----------------------------------------------------------------------
    -- 1) TABELA fin_baixas_receber (idempotente)
    --    Espelho EXATO de fin_baixas_pagar, com a coluna de valor renomeada
    --    para valor_recebido (= nome da parcela RECEBER).
    -- ----------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.fin_baixas_receber (
        id                 SERIAL PRIMARY KEY,
        id_parcela         INTEGER       NOT NULL,
        tipo               VARCHAR(8)    NOT NULL DEFAULT 'BAIXA'
                             CHECK (tipo IN ('BAIXA','ESTORNO')),
        data               DATE          NOT NULL,
        valor_recebido     NUMERIC(15,2) NOT NULL DEFAULT 0,
        juros              NUMERIC(15,2) NOT NULL DEFAULT 0,
        desconto           NUMERIC(15,2) NOT NULL DEFAULT 0,
        valor_com_imposto  NUMERIC(14,2) NOT NULL DEFAULT 0,
        valor_sem_imposto  NUMERIC(14,2) NOT NULL DEFAULT 0,
        id_conta_caixa     INTEGER       NULL,
        id_lancamento_caixa INTEGER      NULL,
        estorno_de         INTEGER       NULL,
        observacoes        TEXT          NULL,
        created_by         INTEGER       NULL,
        created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    $f$, schema_var);

    -- Convergencia: se a tabela ja existia de um re-run parcial, alinha colunas.
    EXECUTE format($f$
      ALTER TABLE %I.fin_baixas_receber
        ADD COLUMN IF NOT EXISTS valor_recebido      NUMERIC(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS juros               NUMERIC(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS desconto            NUMERIC(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS valor_com_imposto   NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS valor_sem_imposto   NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS id_conta_caixa      INTEGER NULL,
        ADD COLUMN IF NOT EXISTS id_lancamento_caixa INTEGER NULL,
        ADD COLUMN IF NOT EXISTS estorno_de          INTEGER NULL,
        ADD COLUMN IF NOT EXISTS observacoes         TEXT NULL,
        ADD COLUMN IF NOT EXISTS created_by          INTEGER NULL,
        ADD COLUMN IF NOT EXISTS created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    $f$, schema_var);

    -- Guard do CHECK do tipo (caso a tabela tenha vindo de re-run sem o check).
    EXECUTE format($f$
      DO $g$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = '%1$I.fin_baixas_receber'::regclass
             AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%%tipo%%BAIXA%%ESTORNO%%'
        ) THEN
          ALTER TABLE %1$I.fin_baixas_receber
            ADD CONSTRAINT fin_baixas_receber_tipo_chk
            CHECK (tipo IN ('BAIXA','ESTORNO'));
        END IF;
      END $g$;
    $f$, schema_var);

    -- Indices (toda FK logica + campos de busca/conciliacao) — espelho da 069.
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_receber_parcela ON %I.fin_baixas_receber (id_parcela)', schema_var);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_receber_data    ON %I.fin_baixas_receber (data)', schema_var);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_receber_lancto  ON %I.fin_baixas_receber (id_lancamento_caixa)', schema_var);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_receber_estorno ON %I.fin_baixas_receber (estorno_de) WHERE estorno_de IS NOT NULL', schema_var);

    -- ----------------------------------------------------------------------
    -- 2) BACKFILL: 1 movimento BAIXA por parcela RECEBIDO, sem duplicar.
    --    Link ao caixa: livro_caixa origem='CR' AND id_parcela_origem = p.id.
    --    (1:1 confirmado em remap; conquistarep sem caixa -> link NULL, ok.
    --     Se um dia houver N, pego o lancamento de MENOR id — MIN(l.id).)
    --    valor_com_imposto/sem_imposto ficam 0 (parcela receber nao tem split).
    -- ----------------------------------------------------------------------
    EXECUTE format($f$
      INSERT INTO %1$I.fin_baixas_receber
        (id_parcela, tipo, data, valor_recebido, juros, desconto,
         valor_com_imposto, valor_sem_imposto, id_lancamento_caixa,
         observacoes, created_at)
      SELECT
        p.id,
        'BAIXA',
        COALESCE(p.data_recebimento, p.data_vencimento, CURRENT_DATE),
        COALESCE(p.valor_recebido, 0),
        COALESCE(p.juros, 0),
        COALESCE(p.desconto, 0),
        0,
        0,
        ( SELECT MIN(l.id)
            FROM %1$I.livro_caixa_lancamentos l
           WHERE TRIM(l.origem) = 'CR'
             AND l.id_parcela_origem = p.id ),
        'Migracao 070: baixa historica espelhada do estado da parcela.',
        COALESCE(p.criado_em, CURRENT_TIMESTAMP)
      FROM %1$I.fin_parcelas_receber p
      WHERE p.status = 'RECEBIDO'
        AND COALESCE(p.valor_recebido, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM %1$I.fin_baixas_receber b
           WHERE b.id_parcela = p.id AND b.tipo = 'BAIXA'
        )
    $f$, schema_var);
    GET DIAGNOSTICS baixas_neste = ROW_COUNT;
    total_baixas_ins := total_baixas_ins + baixas_neste;

    -- quantas baixas deste tenant conseguiram link de caixa (relatorio)
    EXECUTE format($f$
      SELECT COUNT(*) FROM %1$I.fin_baixas_receber
       WHERE tipo='BAIXA' AND id_lancamento_caixa IS NOT NULL
    $f$, schema_var) INTO linkadas_neste;

    -- ----------------------------------------------------------------------
    -- 3) ASSERT da INVARIANTE (por tenant, aborta tudo se violar):
    --    Para cada conta: SUM(ledger BAIXA - ESTORNO das suas parcelas em
    --    valor_recebido) == fin_contas_receber.valor_recebido atual (tol. 1 centavo).
    --    Estornos nao existem ainda, entao BAIXA - 0 = total recebido.
    -- ----------------------------------------------------------------------
    EXECUTE format($f$
      SELECT COUNT(*) FROM (
        SELECT c.id,
               COALESCE(c.valor_recebido,0) AS conta_vr,
               COALESCE((
                 SELECT SUM(CASE WHEN b.tipo='BAIXA'   THEN b.valor_recebido
                                 WHEN b.tipo='ESTORNO' THEN -b.valor_recebido END)
                   FROM %1$I.fin_baixas_receber b
                   JOIN %1$I.fin_parcelas_receber p2 ON p2.id = b.id_parcela
                  WHERE p2.id_conta_receber = c.id
               ),0) AS ledger_vr
          FROM %1$I.fin_contas_receber c
      ) t
      WHERE ABS(t.conta_vr - t.ledger_vr) > 0.01
    $f$, schema_var) INTO contas_divergentes;

    IF contas_divergentes > 0 THEN
      RAISE EXCEPTION
        'ABORTADO no tenant %: % conta(s) com SUM(ledger) <> conta.valor_recebido. Invariante violada — nada foi commitado.',
        schema_var, contas_divergentes;
    END IF;

    tenants_ok := tenants_ok + 1;
    RAISE NOTICE '  [%] OK  | baixas inseridas: %  | linkadas ao caixa: %  | contas conferidas',
      schema_var, baixas_neste, linkadas_neste;

  END LOOP;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Migration 070 — fin_baixas_receber (ledger Contas a Receber)';
  RAISE NOTICE '  Tenants processados (sem divergencia): % / 31', tenants_ok;
  RAISE NOTICE '  Movimentos BAIXA inseridos no total   : %', total_baixas_ins;
  RAISE NOTICE '  Invariante SUM(ledger)=conta.valor_recebido: OK em todos';
  RAISE NOTICE '  Nada de parcelas/contas foi alterado. So o ledger nasceu.';
  RAISE NOTICE '  Coluna de valor no ledger = valor_recebido (use no backend).';
  RAISE NOTICE '============================================================';

  -- Para DRY-RUN: envolva em BEGIN; ... ROLLBACK; no pgAdmin (banco intocado).
END $outer$;
