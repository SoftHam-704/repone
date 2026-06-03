-- Migration 061: garante colunas de fatura_ped que foram adicionadas ad-hoc
-- (sem migration versionada) e ficaram faltando em tenants criados por clone
-- (ex.: conquistarep) — causando "column fat_items_json of relation fatura_ped
-- does not exist" no faturamento.
--
-- Colunas usadas pelo billing.controller (INSERT/UPDATE) que NÃO estão no 001:
--   fat_items_json  JSONB        -> snapshot dos itens faturados (code: JSON.stringify(items), lido como array)
--   fat_percom_vend NUMERIC(5,2) -> % comissão do preposto/vendedor (nullable)
--   fat_chave_nfe   VARCHAR(44)  -> chave da NF-e (já tinha script avulso; incluída aqui por garantia)
--
-- Idempotente (ADD COLUMN IF NOT EXISTS): só cria onde falta; no-op onde já existe
-- (preserva o tipo atual nos tenants que já têm). Roda no pgAdmin em basesales.
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema
      FROM information_schema.tables
     WHERE table_name = 'fatura_ped'
       AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
     ORDER BY table_schema
  LOOP
    EXECUTE format('ALTER TABLE %I.fatura_ped ADD COLUMN IF NOT EXISTS fat_items_json JSONB', s);
    EXECUTE format('ALTER TABLE %I.fatura_ped ADD COLUMN IF NOT EXISTS fat_percom_vend NUMERIC(5,2)', s);
    EXECUTE format('ALTER TABLE %I.fatura_ped ADD COLUMN IF NOT EXISTS fat_chave_nfe VARCHAR(44)', s);
    RAISE NOTICE 'Schema % — colunas de fatura_ped garantidas.', s;
  END LOOP;
END;
$$;
