-- ══════════════════════════════════════════════════════════════════
-- MIGRATION 030 — Índices corretos em cad_tabelaspre
--
-- Problema: a migration 001 criou um índice em `itab_industria`,
-- mas toda a codebase usa `itab_idindustria` (coluna diferente).
-- Resultado: full scan em todas as queries de tabela de preços.
--
-- Fix: índice composto (itab_idindustria, itab_tabela) + auxiliares.
-- ══════════════════════════════════════════════════════════════════

-- 1. Índice composto — cobre o WHERE principal de TODOS os endpoints:
--    WHERE itab_idindustria = $1 AND itab_tabela = $2
CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_ind_tab
  ON cad_tabelaspre(itab_idindustria, itab_tabela);

-- 2. Índice simples — cobre GROUP BY / listagens por indústria:
--    WHERE itab_idindustria = $1   (sem filtro de tabela)
CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_idindustria
  ON cad_tabelaspre(itab_idindustria);

-- 3. Índice na FK do join — cobre INNER JOIN cad_prod ON pro_id = itab_idprod
CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_idprod
  ON cad_tabelaspre(itab_idprod);

-- 4. Índice em pro_nome para o ORDER BY p.pro_nome
CREATE INDEX IF NOT EXISTS idx_cad_prod_nome
  ON cad_prod(pro_nome);

-- 5. Remove o índice que aponta para a coluna errada (itab_industria)
--    Se a coluna ainda existir, o índice era inútil; se não existir, já foi removido.
DROP INDEX IF EXISTS idx_cad_tabelaspre_ind;
