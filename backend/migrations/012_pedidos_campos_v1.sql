-- Migration 012: Adiciona campos ped_pedcli e ped_pedindustria à tabela pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS ped_pedcli      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ped_pedindustria VARCHAR(50);
