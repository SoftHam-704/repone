-- ============================================================================
-- Migration 069 — Conta Corrente da Parcela (Contas a Pagar): LEDGER de baixas
-- ----------------------------------------------------------------------------
-- Banco : basesales (Postgres 16). Rodar no pgAdmin conectado em basesales.
-- Autor : dba  |  Data: 2026-06-06  |  Todos os 31 tenants RepOne ATIVOS.
-- Spec  : docs/superpowers/specs/2026-06-06-conta-corrente-parcela-design.md
--
-- O QUE FAZ:
--   1) Cria, em CADA tenant, a tabela NOVA fin_baixas_pagar — o "extrato"/ledger
--      das parcelas a pagar. A parcela vira o PAI (obrigacao); cada pagamento
--      parcial/integral e cada estorno vira uma LINHA FILHA aqui. Hoje a baixa
--      SOBRESCREVE a parcela (perde historico) — esta tabela resolve isso.
--   2) BACKFILL: para cada parcela hoje PAGO com valor_pago>0, cria 1 movimento
--      'BAIXA' espelhando o estado atual da parcela, e linka ao lancamento de
--      caixa ja existente (livro_caixa origem='CP' / id_parcela_origem) quando
--      achavel. Idempotente: nao duplica em re-run.
--
-- O QUE *NAO* FAZ (de proposito):
--   - NAO altera valores de fin_parcelas_pagar nem de fin_contas_pagar. So CRIA
--     o ledger espelhando o estado atual. O recalculo derivado (parcela/conta a
--     partir do ledger) fica pro backend, na reescrita do baixaContaPagarHandler.
--   - NAO mexe no livro_caixa. So LE pra achar o id_lancamento_caixa.
--
-- CONVENCOES (conferidas no schema real do tenant remap, 2026-06-06):
--   - fin_* : id SERIAL PK, colunas com nomes PLANOS (sem prefixo).
--   - Monetario das parcelas = NUMERIC(15,2); imposto = NUMERIC(14,2). O ledger
--     usa (15,2) em valor_pago/juros/desconto (= precisao da parcela, evita
--     surpresa de arredondamento no backfill) e (14,2) nos *_imposto (= origem).
--   - Auditoria: timestamp WITHOUT time zone, DEFAULT CURRENT_TIMESTAMP
--     (= padrao de TODAS as fin_*; NAO uso timestamptz aqui pra nao destoar).
--   - created_by INTEGER = req.user.userId (o backend ja passa userId numerico
--     na baixa; e coluna do ledger, distinta de fin_contas_pagar.criado_por que
--     e varchar legado).
--   - livro_caixa_lancamentos.origem e CHAR(2) ('CP','CR','MA','TR') — comparo
--     com TRIM/cast certinho no backfill.
--   - FKs LOGICAS (sem constraint rigida) — mesma linha das demais fin_*.
--
-- DADOS HOJE (auditados em producao 2026-06-06):
--   - So o tenant remap tem movimento real: 45 parcelas PAGO, 45 lancamentos de
--     caixa CP, relacao 1:1 (zero parcelas com >1 lancamento CP).
--   - caixa.valor == parcela.valor_pago nos 45 (juros todos 0 hoje).
--   - Invariante conta.valor_pago == SUM(parcelas PAGO.valor_pago) JA VALE
--     (0 contas divergentes). Os demais 30 tenants nao tem parcela paga ainda
--     (so ganham a tabela vazia — backfill no-op).
--
-- SEGURANCA (producao viva, 24x7):
--   - Idempotente: CREATE TABLE/INDEX IF NOT EXISTS + backfill com NOT EXISTS.
--   - All-or-nothing: tudo num unico bloco DO; RAISE EXCEPTION aborta a TX
--     inteira -> nenhum tenant fica pela metade.
--   - Nao-destrutivo: so cria objeto novo e insere o espelho do estado atual.
--   - Asserts de invariante por tenant ANTES do COMMIT (abaixo).
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
  tenants_ok       INT := 0;
  total_baixas_ins INT := 0;
  total_linkadas   INT := 0;
  baixas_neste     INT := 0;
  linkadas_neste   INT := 0;
  contas_divergentes INT := 0;
  rec RECORD;
BEGIN
  FOREACH schema_var IN ARRAY schemas_list LOOP

    -- ----------------------------------------------------------------------
    -- 1) TABELA fin_baixas_pagar (idempotente)
    -- ----------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.fin_baixas_pagar (
        id                 SERIAL PRIMARY KEY,
        id_parcela         INTEGER       NOT NULL,
        tipo               VARCHAR(8)    NOT NULL DEFAULT 'BAIXA'
                             CHECK (tipo IN ('BAIXA','ESTORNO')),
        data               DATE          NOT NULL,
        valor_pago         NUMERIC(15,2) NOT NULL DEFAULT 0,
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
      ALTER TABLE %I.fin_baixas_pagar
        ADD COLUMN IF NOT EXISTS valor_com_imposto   NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS valor_sem_imposto   NUMERIC(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS id_conta_caixa      INTEGER NULL,
        ADD COLUMN IF NOT EXISTS id_lancamento_caixa INTEGER NULL,
        ADD COLUMN IF NOT EXISTS estorno_de          INTEGER NULL,
        ADD COLUMN IF NOT EXISTS observacoes         TEXT NULL,
        ADD COLUMN IF NOT EXISTS created_by          INTEGER NULL,
        ADD COLUMN IF NOT EXISTS created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    $f$, schema_var);

    -- Indices (toda FK logica + campos de busca/conciliacao)
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_pagar_parcela ON %I.fin_baixas_pagar (id_parcela)', schema_var);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_pagar_data    ON %I.fin_baixas_pagar (data)', schema_var);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_pagar_lancto  ON %I.fin_baixas_pagar (id_lancamento_caixa)', schema_var);
    -- Acelera a regra "estornos de uma baixa" (lookup por estorno_de).
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fin_baixas_pagar_estorno ON %I.fin_baixas_pagar (estorno_de) WHERE estorno_de IS NOT NULL', schema_var);

    -- ----------------------------------------------------------------------
    -- 2) BACKFILL: 1 movimento BAIXA por parcela PAGO, sem duplicar.
    --    Link ao caixa: livro_caixa origem='CP' AND id_parcela_origem = p.id.
    --    (Relacao 1:1 confirmada em producao; se um dia houver N, pego o
    --     lancamento de MENOR id deterministicamente — MIN(l.id).)
    -- ----------------------------------------------------------------------
    EXECUTE format($f$
      INSERT INTO %1$I.fin_baixas_pagar
        (id_parcela, tipo, data, valor_pago, juros, desconto,
         valor_com_imposto, valor_sem_imposto, id_lancamento_caixa,
         observacoes, created_at)
      SELECT
        p.id,
        'BAIXA',
        COALESCE(p.data_pagamento, p.data_vencimento, CURRENT_DATE),
        COALESCE(p.valor_pago, 0),
        COALESCE(p.juros, 0),
        COALESCE(p.desconto, 0),
        COALESCE(p.valor_com_imposto, 0),
        COALESCE(p.valor_sem_imposto, 0),
        ( SELECT MIN(l.id)
            FROM %1$I.livro_caixa_lancamentos l
           WHERE TRIM(l.origem) = 'CP'
             AND l.id_parcela_origem = p.id ),
        'Migracao 069: baixa historica espelhada do estado da parcela.',
        COALESCE(p.criado_em, CURRENT_TIMESTAMP)
      FROM %1$I.fin_parcelas_pagar p
      WHERE p.status = 'PAGO'
        AND COALESCE(p.valor_pago, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM %1$I.fin_baixas_pagar b
           WHERE b.id_parcela = p.id AND b.tipo = 'BAIXA'
        )
    $f$, schema_var);
    GET DIAGNOSTICS baixas_neste = ROW_COUNT;
    total_baixas_ins := total_baixas_ins + baixas_neste;

    -- quantas dessas conseguiram link de caixa (relatorio)
    EXECUTE format($f$
      SELECT COUNT(*) FROM %1$I.fin_baixas_pagar
       WHERE tipo='BAIXA' AND id_lancamento_caixa IS NOT NULL
    $f$, schema_var) INTO linkadas_neste;
    total_linkadas := linkadas_neste;  -- snapshot por tenant (sobrescreve no loop)

    -- ----------------------------------------------------------------------
    -- 3) ASSERT da INVARIANTE (por tenant, aborta tudo se violar):
    --    Para cada conta: SUM(ledger BAIXA.valor_pago das suas parcelas)
    --                     == fin_contas_pagar.valor_pago atual (tol. 1 centavo).
    --    Estornos nao existem ainda nesta migracao, entao BAIXA - 0 = total pago.
    -- ----------------------------------------------------------------------
    EXECUTE format($f$
      SELECT COUNT(*) FROM (
        SELECT c.id,
               COALESCE(c.valor_pago,0) AS conta_vp,
               COALESCE((
                 SELECT SUM(CASE WHEN b.tipo='BAIXA' THEN b.valor_pago
                                 WHEN b.tipo='ESTORNO' THEN -b.valor_pago END)
                   FROM %1$I.fin_baixas_pagar b
                   JOIN %1$I.fin_parcelas_pagar p2 ON p2.id = b.id_parcela
                  WHERE p2.id_conta_pagar = c.id
               ),0) AS ledger_vp
          FROM %1$I.fin_contas_pagar c
      ) t
      WHERE ABS(t.conta_vp - t.ledger_vp) > 0.01
    $f$, schema_var) INTO contas_divergentes;

    IF contas_divergentes > 0 THEN
      RAISE EXCEPTION
        'ABORTADO no tenant %: % conta(s) com SUM(ledger) <> conta.valor_pago. Invariante violada — nada foi commitado.',
        schema_var, contas_divergentes;
    END IF;

    tenants_ok := tenants_ok + 1;
    RAISE NOTICE '  [%] OK  | baixas inseridas: %  | linkadas ao caixa: %  | contas conferidas',
      schema_var, baixas_neste, linkadas_neste;

  END LOOP;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Migration 069 — fin_baixas_pagar (ledger Contas a Pagar)';
  RAISE NOTICE '  Tenants processados (sem divergencia): % / 31', tenants_ok;
  RAISE NOTICE '  Movimentos BAIXA inseridos no total   : %', total_baixas_ins;
  RAISE NOTICE '  Invariante SUM(ledger)=conta.valor_pago: OK em todos';
  RAISE NOTICE '  Nada de parcelas/contas foi alterado. So o ledger nasceu.';
  RAISE NOTICE '============================================================';

  -- Para auditar 1 a 1 antes de confiar, troque a linha abaixo por COMMIT manual.
  -- Se quiser ROLLBACK de teste, rode dentro de BEGIN;...ROLLBACK; no pgAdmin.
END $outer$;
