-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: popular itens_ped.ite_ipi no schema repsoma a partir de cad_tabelaspre
-- Motivo: importação trouxe ite_ipi = 0 para todos os itens
-- Join: itens_ped → pedidos (ped_tabela) → cad_tabelaspre (itab_ipi)
-- Rodar no pgAdmin conectado ao banco RepOne
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Diagnóstico antes ──────────────────────────────────────────────────────
SELECT
  COUNT(*)                                           AS total_itens,
  COUNT(*) FILTER (WHERE COALESCE(ite_ipi, 0) = 0)  AS sem_ipi,
  COUNT(*) FILTER (WHERE COALESCE(ite_ipi, 0) > 0)  AS com_ipi
FROM repsoma.itens_ped;

-- ── 2. Preview: primeiros 50 registros que serão corrigidos ───────────────────
SELECT
  i.ite_pedido,
  i.ite_produto,
  i.ite_nomeprod,
  p.ped_tabela,
  i.ite_ipi      AS ipi_atual,
  t.itab_ipi     AS ipi_da_tabela
FROM repsoma.itens_ped      i
JOIN repsoma.pedidos         p ON p.ped_pedido    = i.ite_pedido
                               AND p.ped_industria = i.ite_industria
JOIN repsoma.cad_tabelaspre  t ON t.itab_idprod      = i.ite_idproduto
                               AND t.itab_idindustria = i.ite_industria
                               AND t.itab_tabela      = p.ped_tabela
WHERE COALESCE(i.ite_ipi, 0) = 0
  AND t.itab_ipi > 0
LIMIT 50;

-- ── 3. UPDATE ─────────────────────────────────────────────────────────────────
-- Só atualiza onde ite_ipi está zerado/nulo E a tabela de preços tem IPI > 0
-- Itens cujo produto não existe na cad_tabelaspre permanecerão em 0 (sem IPI)

UPDATE repsoma.itens_ped i
SET    ite_ipi = t.itab_ipi
FROM   repsoma.pedidos        p,
       repsoma.cad_tabelaspre t
WHERE  p.ped_pedido       = i.ite_pedido
  AND  p.ped_industria    = i.ite_industria
  AND  t.itab_idprod      = i.ite_idproduto
  AND  t.itab_idindustria = i.ite_industria
  AND  t.itab_tabela      = p.ped_tabela
  AND  COALESCE(i.ite_ipi, 0) = 0
  AND  t.itab_ipi > 0;

-- ── 4. Diagnóstico depois ─────────────────────────────────────────────────────
SELECT
  COUNT(*)                                           AS total_itens,
  COUNT(*) FILTER (WHERE COALESCE(ite_ipi, 0) = 0)  AS ainda_sem_ipi,
  COUNT(*) FILTER (WHERE COALESCE(ite_ipi, 0) > 0)  AS com_ipi_agora
FROM repsoma.itens_ped;

-- ── 5. Itens que ficaram sem IPI (produto não encontrado na tabela de preços) ─
SELECT
  i.ite_produto,
  i.ite_nomeprod,
  COUNT(*) AS qtd_itens
FROM repsoma.itens_ped i
JOIN repsoma.pedidos   p ON p.ped_pedido    = i.ite_pedido
                         AND p.ped_industria = i.ite_industria
WHERE COALESCE(i.ite_ipi, 0) = 0
GROUP BY i.ite_produto, i.ite_nomeprod
ORDER BY qtd_itens DESC;
