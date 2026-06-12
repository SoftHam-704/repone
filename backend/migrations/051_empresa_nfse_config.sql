-- Migration 051: config fiscal de NFS-e na empresa (por tenant)
-- Aditiva, nullable, IF NOT EXISTS. Defaults = caso mais comum no RepOne
-- (comissão de representação comercial: LC116 10.09.01 / cTribNac 100901 / cNBS 102010000).
-- A identidade fiscal (IM, regime, IBGE, ambiente) e a numeração ficam aqui;
-- o fluxo de emissão (fin_nfse) passa a ler desta tabela.

ALTER TABLE empresa_status
  -- Prestador (identidade fiscal)
  ADD COLUMN IF NOT EXISTS emp_im                  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS emp_regime              VARCHAR(20)  DEFAULT 'SIMPLES_MEEPP',
  ADD COLUMN IF NOT EXISTS emp_ibge                VARCHAR(7),
  ADD COLUMN IF NOT EXISTS emp_nfse_ambiente       VARCHAR(12)  DEFAULT 'HOMOLOGACAO',
  -- Numeração (continua a sequência da empresa)
  ADD COLUMN IF NOT EXISTS emp_nfse_proximo_numero INTEGER      DEFAULT 1,
  ADD COLUMN IF NOT EXISTS emp_nfse_serie          VARCHAR(5)   DEFAULT '1',
  -- Códigos do serviço (default = representação comercial)
  ADD COLUMN IF NOT EXISTS emp_ctribnac            VARCHAR(10)  DEFAULT '100901',
  ADD COLUMN IF NOT EXISTS emp_cnbs                VARCHAR(12)  DEFAULT '102010000',
  ADD COLUMN IF NOT EXISTS emp_item_lc116          VARCHAR(12)  DEFAULT '10.09.01',
  ADD COLUMN IF NOT EXISTS emp_ctribmun            VARCHAR(10),
  ADD COLUMN IF NOT EXISTS emp_cnae                VARCHAR(12),
  ADD COLUMN IF NOT EXISTS emp_iss_pct             NUMERIC(6,2) DEFAULT 0;
