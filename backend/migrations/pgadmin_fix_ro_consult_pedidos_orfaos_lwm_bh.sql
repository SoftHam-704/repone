-- =============================================================================
-- pgadmin_fix_ro_consult_pedidos_orfaos_lwm_bh.sql
-- -----------------------------------------------------------------------------
-- OBJETIVO
--   Limpar 12 pedidos DUPLICADOS/ORFAOS criados por race condition no frontend
--   no tenant ro_consult (basesales), cliente LWM BELO HORIZONTE (cli 161,
--   CNPJ 02.658.379/0003-19), OC 13963, data 11/06/2026, status COTACAO.
--
--   Sintoma: 13 cabecalhos sequenciais MA916324..MA916336 gerados no mesmo
--   instante. SO o ULTIMO (MA916336) recebeu itens e valor (R$ 6.126,88).
--   Os 12 anteriores (MA916324..MA916335) ficaram R$ 0,00 e SEM itens =
--   cabecalhos orfaos = lixo seguro de apagar.
--
--   Este script:
--     1) faz SELECT-preview do que vai sair e do que fica;
--     2) apaga SO os orfaos confirmados por filtro objetivo (tot=0 E sem itens),
--        nunca por lista hardcoded de numeros;
--     3) ASSERT aborta se a contagem a apagar != 12 (proteca contra apagar
--        algo a mais ou a menos do que o esperado);
--     4) ASSERT garante que MA916336 (o pedido bom) continua intacto com itens;
--     5) tudo numa UNICA transacao -> ROLLBACK total se qualquer invariante cair.
--
--   Idempotente: rodar 2x apos o sucesso => contagem a apagar = 0 != 12 =>
--   o assert da o ROLLBACK e nada acontece (ver bloco MODO no fim).
--
-- -----------------------------------------------------------------------------
-- COMO RODAR (pgAdmin)
--   1. Conecte no banco  : basesales
--   2. (pgAdmin ja roda em transacao; este script tambem abre BEGIN explicito)
--   3. Execute o bloco INTEIRO. Leia os NOTICE/preview.
--   4. Se o relatorio final disser "OK 12 apagados, MA916336 intacto" e voce
--      concordar com a lista do preview -> mantenha o COMMIT do fim.
--      Se quiser so AUDITAR sem apagar -> troque COMMIT por ROLLBACK no fim
--      (o preview e os asserts ja terao rodado).
-- -----------------------------------------------------------------------------
-- DEPENDENCIAS / FK
--   A exclusao definitiva do app (orders.controller deleteOrderHandler) apaga
--   itens_ped e DEPOIS pedidos, por ped_pedido, SEM depender de FK cascade.
--   Como os 12 alvos sao orfaos (ZERO linhas em itens_ped, por definicao do
--   filtro), o DELETE em itens_ped abaixo e apenas rede de seguranca (no-op).
--   Nenhuma parcela/financeiro nasce de COTACAO sem faturar, entao nao ha
--   contaspgrec/lan_clifor amarrados. O bloco 0 confirma isso em runtime.
-- =============================================================================

BEGIN;

-- guard de banco -------------------------------------------------------------
DO $g$
BEGIN
  IF current_database() <> 'basesales' THEN
    RAISE EXCEPTION 'ABORT: conecte no banco basesales (atual=%).', current_database();
  END IF;
END
$g$;

SET search_path TO ro_consult, public;

-- =============================================================================
-- BLOCO 0 (READ-ONLY) : panorama do conjunto e dependencias
-- =============================================================================
\echo '== 0a. Todos os pedidos do range MA916324..MA916336 (com contagem de itens) =='
SELECT
  TRIM(p.ped_pedido)                                   AS ped_pedido,
  p.ped_cliente,
  p.ped_industria,
  p.ped_situacao,
  p.ped_totbruto,
  p.ped_totliq,
  TRIM(COALESCE(p.ped_oc,''))                          AS ped_oc,
  p.ped_data,
  (SELECT COUNT(*) FROM itens_ped i
     WHERE TRIM(i.ite_pedido) = TRIM(p.ped_pedido))    AS n_itens
FROM pedidos p
WHERE TRIM(p.ped_pedido) BETWEEN 'MA916324' AND 'MA916336'
ORDER BY TRIM(p.ped_pedido);

\echo '== 0b. Tudo que casa OC 13963 (sanity: confirmar que nao ha nada fora do range) =='
SELECT TRIM(p.ped_pedido) AS ped_pedido, p.ped_cliente, p.ped_situacao,
       p.ped_totbruto, p.ped_totliq, TRIM(COALESCE(p.ped_oc,'')) AS ped_oc, p.ped_data,
       (SELECT COUNT(*) FROM itens_ped i WHERE TRIM(i.ite_pedido)=TRIM(p.ped_pedido)) AS n_itens
FROM pedidos p
WHERE TRIM(COALESCE(p.ped_oc,'')) = '13963'
ORDER BY TRIM(p.ped_pedido);

\echo '== 0c. FKs apontando para ro_consult.pedidos (se vazio, nao ha cascade) =='
SELECT conrelid::regclass AS tabela_filha, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype='f' AND confrelid = 'ro_consult.pedidos'::regclass;

-- =============================================================================
-- BLOCO 1 (PREVIEW) : exatamente os que VAO SAIR
--   Filtro objetivo:
--     - dentro do range dos 12 primeiros (MA916324..MA916335) -> exclui o bom
--     - mesmo cliente (161) e mesma OC (13963) -> trava o escopo no incidente
--     - tot bruto e liq = 0
--     - ZERO itens em itens_ped
-- =============================================================================
\echo '== 1. PREVIEW dos pedidos que serao APAGADOS =='
SELECT
  TRIM(p.ped_pedido) AS ped_pedido, p.ped_cliente, p.ped_situacao,
  p.ped_totbruto, p.ped_totliq, TRIM(COALESCE(p.ped_oc,'')) AS ped_oc, p.ped_data
FROM pedidos p
WHERE TRIM(p.ped_pedido) BETWEEN 'MA916324' AND 'MA916335'
  AND p.ped_cliente = 161
  AND TRIM(COALESCE(p.ped_oc,'')) = '13963'
  AND COALESCE(p.ped_totbruto,0) = 0
  AND COALESCE(p.ped_totliq,0)   = 0
  AND NOT EXISTS (SELECT 1 FROM itens_ped i WHERE TRIM(i.ite_pedido) = TRIM(p.ped_pedido))
ORDER BY TRIM(p.ped_pedido);

-- =============================================================================
-- BLOCO 2 : ASSERT de escopo + DELETE + ASSERT de preservacao
-- =============================================================================
DO $del$
DECLARE
  v_alvos   INT;
  v_keep_n  INT;
  v_keep_it INT;
  v_del_it  INT;
  v_del_ped INT;
BEGIN
  -- 2.1 conta os alvos pelo MESMO filtro do preview
  SELECT COUNT(*) INTO v_alvos
  FROM pedidos p
  WHERE TRIM(p.ped_pedido) BETWEEN 'MA916324' AND 'MA916335'
    AND p.ped_cliente = 161
    AND TRIM(COALESCE(p.ped_oc,'')) = '13963'
    AND COALESCE(p.ped_totbruto,0) = 0
    AND COALESCE(p.ped_totliq,0)   = 0
    AND NOT EXISTS (SELECT 1 FROM itens_ped i WHERE TRIM(i.ite_pedido) = TRIM(p.ped_pedido));

  RAISE NOTICE 'Pedidos orfaos que casam o filtro: %', v_alvos;

  -- 2.2 PROTECAO: tem que ser exatamente 12. Qualquer outro numero = aborta.
  IF v_alvos <> 12 THEN
    RAISE EXCEPTION 'ABORT: esperados 12 orfaos, encontrados %. Nada apagado (rollback).', v_alvos;
  END IF;

  -- 2.3 PROTECAO: o pedido BOM precisa existir e ter itens ANTES de mexer
  SELECT COUNT(*) INTO v_keep_n  FROM pedidos    WHERE TRIM(ped_pedido) = 'MA916336';
  SELECT COUNT(*) INTO v_keep_it FROM itens_ped  WHERE TRIM(ite_pedido) = 'MA916336';
  IF v_keep_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: MA916336 nao encontrado (n=%). Algo errado, rollback.', v_keep_n;
  END IF;
  IF v_keep_it < 1 THEN
    RAISE EXCEPTION 'ABORT: MA916336 sem itens (n=%). Nao bate com o esperado, rollback.', v_keep_it;
  END IF;

  -- 2.4 rede de seguranca: apaga itens dos orfaos (deve ser 0 por definicao)
  WITH alvos AS (
    SELECT TRIM(p.ped_pedido) AS pp
    FROM pedidos p
    WHERE TRIM(p.ped_pedido) BETWEEN 'MA916324' AND 'MA916335'
      AND p.ped_cliente = 161
      AND TRIM(COALESCE(p.ped_oc,'')) = '13963'
      AND COALESCE(p.ped_totbruto,0) = 0
      AND COALESCE(p.ped_totliq,0)   = 0
      AND NOT EXISTS (SELECT 1 FROM itens_ped i WHERE TRIM(i.ite_pedido) = TRIM(p.ped_pedido))
  )
  DELETE FROM itens_ped i
  USING alvos a
  WHERE TRIM(i.ite_pedido) = a.pp;
  GET DIAGNOSTICS v_del_it = ROW_COUNT;
  RAISE NOTICE 'itens_ped apagados (esperado 0): %', v_del_it;
  IF v_del_it <> 0 THEN
    RAISE EXCEPTION 'ABORT: orfao tinha itens (del_it=%)?! Filtro inconsistente, rollback.', v_del_it;
  END IF;

  -- 2.5 apaga os 12 cabecalhos orfaos
  WITH alvos AS (
    SELECT TRIM(p.ped_pedido) AS pp
    FROM pedidos p
    WHERE TRIM(p.ped_pedido) BETWEEN 'MA916324' AND 'MA916335'
      AND p.ped_cliente = 161
      AND TRIM(COALESCE(p.ped_oc,'')) = '13963'
      AND COALESCE(p.ped_totbruto,0) = 0
      AND COALESCE(p.ped_totliq,0)   = 0
      AND NOT EXISTS (SELECT 1 FROM itens_ped i WHERE TRIM(i.ite_pedido) = TRIM(p.ped_pedido))
  )
  DELETE FROM pedidos p
  USING alvos a
  WHERE TRIM(p.ped_pedido) = a.pp;
  GET DIAGNOSTICS v_del_ped = ROW_COUNT;
  RAISE NOTICE 'pedidos orfaos apagados: %', v_del_ped;

  -- 2.6 PROTECAO final: apagou exatamente 12
  IF v_del_ped <> 12 THEN
    RAISE EXCEPTION 'ABORT: deletei % pedidos, esperava 12. Rollback total.', v_del_ped;
  END IF;

  -- 2.7 PROTECAO final: MA916336 continua vivo e com itens
  SELECT COUNT(*) INTO v_keep_n  FROM pedidos    WHERE TRIM(ped_pedido) = 'MA916336';
  SELECT COUNT(*) INTO v_keep_it FROM itens_ped  WHERE TRIM(ite_pedido) = 'MA916336';
  IF v_keep_n <> 1 OR v_keep_it < 1 THEN
    RAISE EXCEPTION 'ABORT: MA916336 ficou ferido (ped=%, itens=%). Rollback total.', v_keep_n, v_keep_it;
  END IF;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'OK: 12 cabecalhos orfaos apagados.';
  RAISE NOTICE 'OK: MA916336 intacto (1 pedido, % itens).', v_keep_it;
  RAISE NOTICE 'Revise o COMMIT/ROLLBACK abaixo antes de finalizar.';
  RAISE NOTICE '====================================================';
END
$del$;

-- =============================================================================
-- BLOCO 3 (READ-ONLY) : foto pos-delete do range (deve sobrar SO MA916336)
-- =============================================================================
\echo '== 3. POS-DELETE: o que sobrou no range (esperado: so MA916336) =='
SELECT TRIM(ped_pedido) AS ped_pedido, ped_situacao, ped_totbruto, ped_totliq,
       (SELECT COUNT(*) FROM itens_ped i WHERE TRIM(i.ite_pedido)=TRIM(p.ped_pedido)) AS n_itens
FROM pedidos p
WHERE TRIM(ped_pedido) BETWEEN 'MA916324' AND 'MA916336'
ORDER BY TRIM(ped_pedido);

-- =============================================================================
-- FINALIZACAO
--   Se concorda com o preview e os NOTICE: mantenha COMMIT.
--   Para apenas auditar (rollback): troque a linha abaixo por  ROLLBACK;
-- =============================================================================
COMMIT;
-- ROLLBACK;
