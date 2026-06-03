-- Migration 062: toggle de "carteira por vendedor" no empresa_status (config do tenant).
--   true  (DEFAULT) → operador vê SÓ a própria carteira (cli_vendedor = ele). Comportamento atual.
--   false            → "todos atendem todos": operador vê TODOS os clientes (ex.: damarep).
-- Default true preserva o comportamento dos 30 reps; só quem virar false muda.
-- Idempotente (IF NOT EXISTS). Roda no pgAdmin em basesales.
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema
      FROM information_schema.tables
     WHERE table_name = 'empresa_status'
       AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
     ORDER BY table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.empresa_status ADD COLUMN IF NOT EXISTS emp_carteira_por_vendedor BOOLEAN DEFAULT true',
      s
    );
    EXECUTE format(
      'UPDATE %I.empresa_status SET emp_carteira_por_vendedor = true WHERE emp_carteira_por_vendedor IS NULL',
      s
    );
    RAISE NOTICE 'Schema % — emp_carteira_por_vendedor garantido.', s;
  END LOOP;
END;
$$;

-- Depois de rodar, desligar a carteira no damarep (todos atendem todos):
--   UPDATE damarep.empresa_status SET emp_carteira_por_vendedor = false WHERE emp_id = 1;
