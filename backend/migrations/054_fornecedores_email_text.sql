-- Migration 054: for_email da fornecedores de VARCHAR(120) para TEXT (por tenant).
-- TEXT remove o limite de tamanho. Idempotente (TYPE TEXT quando já é TEXT = no-op).

ALTER TABLE fornecedores ALTER COLUMN for_email TYPE TEXT;
