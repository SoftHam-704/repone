-- Migration 052: protocolo / codigo_verificacao da fin_nfse para TEXT (por tenant).
-- A 068 criou como VARCHAR(60); a chave de acesso do Padrão Nacional já tem ~50 chars
-- e o protocolo (id ACBr) pode crescer. TEXT remove o risco de estouro. Idempotente.

ALTER TABLE fin_nfse
  ALTER COLUMN protocolo          TYPE TEXT,
  ALTER COLUMN codigo_verificacao TYPE TEXT;
