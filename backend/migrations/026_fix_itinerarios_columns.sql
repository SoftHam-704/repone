-- Migration 026: Normaliza colunas da tabela itinerarios
-- V1 criava: iti_descricao, iti_vendedor_id, iti_frequencia, iti_observacao
-- Migration 006 criou (para novos tenants): iti_nome, iti_dia, iti_obs
-- Migration 007 criou (para novos tenants): iti_vendedor
-- O controller V2 usa os nomes da V1 — esta migration garante que existam.

DO $$
BEGIN
  -- iti_descricao (V1) vs iti_nome (V2 new tenant)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'itinerarios'
      AND column_name = 'iti_descricao'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'itinerarios'
        AND column_name = 'iti_nome'
    ) THEN
      ALTER TABLE itinerarios RENAME COLUMN iti_nome TO iti_descricao;
    ELSE
      ALTER TABLE itinerarios ADD COLUMN iti_descricao VARCHAR(100);
    END IF;
  END IF;

  -- iti_frequencia (V1) vs iti_dia (V2 new tenant)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'itinerarios'
      AND column_name = 'iti_frequencia'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'itinerarios'
        AND column_name = 'iti_dia'
    ) THEN
      ALTER TABLE itinerarios RENAME COLUMN iti_dia TO iti_frequencia;
    ELSE
      ALTER TABLE itinerarios ADD COLUMN iti_frequencia VARCHAR(20);
    END IF;
  END IF;

  -- iti_observacao (V1) vs iti_obs (V2 new tenant)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'itinerarios'
      AND column_name = 'iti_observacao'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'itinerarios'
        AND column_name = 'iti_obs'
    ) THEN
      ALTER TABLE itinerarios RENAME COLUMN iti_obs TO iti_observacao;
    ELSE
      ALTER TABLE itinerarios ADD COLUMN iti_observacao TEXT;
    END IF;
  END IF;

  -- iti_vendedor_id (V1 + controller) vs iti_vendedor (migration 007 typo)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'itinerarios'
      AND column_name = 'iti_vendedor_id'
  ) THEN
    ALTER TABLE itinerarios ADD COLUMN iti_vendedor_id INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL;
    -- Migra dados da coluna errada, se existir
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'itinerarios'
        AND column_name = 'iti_vendedor'
    ) THEN
      UPDATE itinerarios SET iti_vendedor_id = iti_vendedor;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_itinerarios_vendedor ON itinerarios(iti_vendedor_id);
