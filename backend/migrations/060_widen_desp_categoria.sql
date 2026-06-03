-- Migration 060: alarga despesas.desp_categoria de VARCHAR(30) para VARCHAR(50).
-- Motivo: a lista fixa de categorias inclui "Happy Hour com Cliente/Fornecedor" (33 chars),
-- que estourava o VARCHAR(30). Aumentar o limite de um VARCHAR é mudança só de catálogo
-- no Postgres (sem rewrite da tabela) — rápido e seguro em produção.
-- Idempotente/seguro rodar múltiplas vezes.
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema
      FROM information_schema.columns
     WHERE table_name = 'despesas' AND column_name = 'desp_categoria'
       AND table_schema NOT IN ('information_schema','pg_catalog','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format('ALTER TABLE %I.despesas ALTER COLUMN desp_categoria TYPE VARCHAR(50)', s);
    RAISE NOTICE 'Schema % — desp_categoria alargada para VARCHAR(50).', s;
  END LOOP;
END;
$$;
