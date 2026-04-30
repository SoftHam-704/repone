-- Migration 009: Vincular itinerário à região
-- Permite que o mapa centralize nas cidades da região ao selecionar o itinerário

ALTER TABLE itinerarios
  ADD COLUMN IF NOT EXISTS iti_regiao_id INTEGER REFERENCES regioes(reg_codigo) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_itinerarios_regiao ON itinerarios(iti_regiao_id);
