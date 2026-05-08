-- 032_campanhas_tipo.sql
ALTER TABLE campanhas_promocionais ADD COLUMN IF NOT EXISTS cmp_tipo VARCHAR(20) DEFAULT 'CRESCIMENTO';
