-- Migration 047: índice para fila de pedidos WhatsApp (status J)
-- Usa ped_numero DESC (PK serial — existe em todos os schemas V1 e V2).

DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema
      FROM information_schema.tables
     WHERE table_name = 'pedidos'
       AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
     ORDER BY table_schema
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_pedidos_situacao_j
       ON %I.pedidos(ped_numero DESC) WHERE ped_situacao = ''J''',
      s
    );
    RAISE NOTICE 'Schema % — índice J criado.', s;
  END LOOP;
END;
$$;
