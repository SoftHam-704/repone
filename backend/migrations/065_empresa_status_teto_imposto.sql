-- Migration 065: teto mensal de pagamento "com imposto" por empresa (configurável).
-- 0 (default) = recurso desligado → não afeta os demais reps. Idempotente. pgAdmin / basesales.
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
     WHERE table_name = 'empresa_status'
       AND table_schema NOT IN ('pg_catalog','information_schema','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format('ALTER TABLE %I.empresa_status ADD COLUMN IF NOT EXISTS emp_teto_com_imposto_mensal NUMERIC(14,2) DEFAULT 0', s);
    EXECUTE format('UPDATE %I.empresa_status SET emp_teto_com_imposto_mensal = 0 WHERE emp_teto_com_imposto_mensal IS NULL', s);
    RAISE NOTICE 'Schema % — teto com imposto ok.', s;
  END LOOP;
END $$;
