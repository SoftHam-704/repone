-- Migration 063: Livro Caixa — contas (caixa/banco/PIX) + lançamentos (conta corrente).
-- Saldo é sempre calculado (saldo_inicial + Σ lançamentos). Idempotente. Roda no basesales (pgAdmin).
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT DISTINCT table_schema FROM information_schema.tables
     WHERE table_name = 'fin_plano_contas'
       AND table_schema NOT IN ('pg_catalog','information_schema','public')
     ORDER BY table_schema
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.livro_caixa_contas (
        id                 SERIAL PRIMARY KEY,
        conta_nome         VARCHAR(100) NOT NULL,
        conta_tipo         VARCHAR(20)  NOT NULL DEFAULT 'caixa',
        saldo_inicial      NUMERIC(14,2) NOT NULL DEFAULT 0,
        data_saldo_inicial DATE         NOT NULL DEFAULT CURRENT_DATE,
        ativo              BOOLEAN      NOT NULL DEFAULT true,
        criado_em          TIMESTAMP    DEFAULT now()
      )$f$, s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.livro_caixa_lancamentos (
        id                SERIAL PRIMARY KEY,
        conta_id          INTEGER NOT NULL REFERENCES %I.livro_caixa_contas(id),
        data              DATE    NOT NULL,
        historico         TEXT    NOT NULL,
        tipo              CHAR(1) NOT NULL CHECK (tipo IN ('C','D')),
        valor             NUMERIC(14,2) NOT NULL CHECK (valor > 0),
        id_plano_contas   INTEGER NULL,
        id_centro_custo   INTEGER NULL,
        documento         VARCHAR(60) NULL,
        origem            CHAR(2) NOT NULL DEFAULT 'MA',
        id_parcela_origem INTEGER NULL,
        id_transferencia  INTEGER NULL,
        criado_em         TIMESTAMP DEFAULT now()
      )$f$, s, s);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_lc_lanc_conta_data ON %I.livro_caixa_lancamentos (conta_id, data, id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_lc_lanc_origem ON %I.livro_caixa_lancamentos (origem, id_parcela_origem)', s);
    RAISE NOTICE 'Schema % — livro_caixa pronto.', s;
  END LOOP;
END $$;
