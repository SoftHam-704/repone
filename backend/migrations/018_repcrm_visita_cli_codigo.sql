-- Migration 018: Adiciona cli_codigo (integer) em repcrm_visita
-- Permite vincular visita a cliente ERP existente OU a prospecto (cliente_id uuid)

ALTER TABLE repcrm_visita
  ADD COLUMN IF NOT EXISTS cli_codigo  INTEGER REFERENCES clientes(cli_codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ven_codigo  INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repcrm_visita_cli_codigo ON repcrm_visita(cli_codigo);
CREATE INDEX IF NOT EXISTS idx_repcrm_visita_ven_codigo ON repcrm_visita(ven_codigo);
