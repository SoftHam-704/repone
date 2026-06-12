-- Migration 053: cadastro de serviços da NFS-e + referência no lançamento (por tenant).
CREATE TABLE IF NOT EXISTS fin_nfse_servicos (
  id          SERIAL PRIMARY KEY,
  descricao   VARCHAR(120) NOT NULL,
  item_lc116  VARCHAR(12),
  ctribnac    VARCHAR(10),
  cnbs        VARCHAR(12),
  ctribmun    VARCHAR(10),
  iss_pct     NUMERIC(6,2) DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMP DEFAULT NOW()
);

ALTER TABLE fin_nfse ADD COLUMN IF NOT EXISTS servico_id INTEGER;

-- Seed dos serviços com códigos já validados ao vivo (idempotente por descricao).
INSERT INTO fin_nfse_servicos (descricao, item_lc116, ctribnac, cnbs, iss_pct)
SELECT 'Representação comercial', '10.09.01', '100901', '102010000', 0
WHERE NOT EXISTS (SELECT 1 FROM fin_nfse_servicos WHERE descricao = 'Representação comercial');

INSERT INTO fin_nfse_servicos (descricao, item_lc116, ctribnac, cnbs, iss_pct)
SELECT 'Suporte técnico em TI', '01.07.01', '010701', '115013000', 0
WHERE NOT EXISTS (SELECT 1 FROM fin_nfse_servicos WHERE descricao = 'Suporte técnico em TI');
