-- Migration 034: adiciona cli_atividade em clientes (campo que existia no V1 mas faltou na migration base)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cli_atividade VARCHAR(100);
