-- Migration 059: Despesas de viagem lançadas em campo pelo vendedor/promotor.
-- Sem fluxo de aprovação (decisão Hamilton 2026-06-03): lançamento + relatório.
-- desp_vendedor = vendedores.ven_codigo (mesma convenção de ped_vendedor; sem FK rígida).
-- desp_comprovante = nome do arquivo da foto em uploads/despesas/<schema>/ (nulo = sem foto).
-- Seguro rodar múltiplas vezes (IF NOT EXISTS).
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast','public')
       AND schema_name NOT LIKE 'pg_temp_%'
       AND schema_name NOT LIKE 'pg_toast_temp_%'
     ORDER BY schema_name
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.despesas (
        desp_id          SERIAL PRIMARY KEY,
        desp_vendedor    INTEGER NOT NULL,
        desp_data        DATE NOT NULL,
        desp_categoria   VARCHAR(30) NOT NULL,
        desp_valor       NUMERIC(12,2) NOT NULL,
        desp_descricao   TEXT,
        desp_km          INTEGER,
        desp_comprovante VARCHAR(255),
        desp_criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_despesas_vendedor ON %I.despesas (desp_vendedor)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_despesas_data ON %I.despesas (desp_data)', s);
    RAISE NOTICE 'Schema % — tabela despesas garantida.', s;
  END LOOP;
END;
$$;
