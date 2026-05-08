-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 031 — Comissão por grupo de produto em grupos
--
-- gru_percomiss     = percentual de comissão própria do grupo
-- gru_usa_percomiss = flag: se TRUE, usa gru_percomiss em vez do % padrão do vendedor
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE grupos
  ADD COLUMN IF NOT EXISTS gru_percomiss     DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gru_usa_percomiss BOOLEAN          DEFAULT FALSE;
