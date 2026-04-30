-- Migration 010: Setores vinculados a Cidade (não região) + cli_setor_id nos clientes
-- V1 acertou: setor pertence a uma cidade específica, não a uma região inteira
-- Ex: "Setor Bueno" pertence a Goiânia, "Vila Mariana" pertence a São Paulo

-- Upgrade da tabela setores
ALTER TABLE setores
  ADD COLUMN IF NOT EXISTS set_cidade_id INTEGER REFERENCES cidades(cid_codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS set_ordem     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS set_cor       VARCHAR(7) DEFAULT '#FFD200',
  ADD COLUMN IF NOT EXISTS set_ativo     BOOLEAN DEFAULT true;

-- Vincular cliente ao setor geográfico (separado de cli_atuacaoprincipal que é tipo comercial)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cli_setor_id INTEGER REFERENCES setores(set_codigo) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_setores_cidade   ON setores(set_cidade_id);
CREATE INDEX IF NOT EXISTS idx_setores_ativo     ON setores(set_ativo) WHERE set_ativo = true;
CREATE INDEX IF NOT EXISTS idx_clientes_setor    ON clientes(cli_setor_id);
