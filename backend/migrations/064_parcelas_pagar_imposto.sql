-- Migration 064: split sem/com imposto na baixa do Contas a Pagar (reforma tributária).
-- Metadado fiscal por parcela; acumulado do mês é derivado por SUM. Idempotente. pgAdmin / basesales.
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
     WHERE table_name = 'fin_parcelas_pagar'
       AND table_schema NOT IN ('pg_catalog','information_schema','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format('ALTER TABLE %I.fin_parcelas_pagar ADD COLUMN IF NOT EXISTS valor_com_imposto NUMERIC(14,2) DEFAULT 0', s);
    EXECUTE format('ALTER TABLE %I.fin_parcelas_pagar ADD COLUMN IF NOT EXISTS valor_sem_imposto NUMERIC(14,2) DEFAULT 0', s);
    RAISE NOTICE 'Schema % — fin_parcelas_pagar imposto ok.', s;
  END LOOP;
END $$;
