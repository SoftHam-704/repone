-- Migration 028: Remove NOT NULL constraint from ite_embuch
-- O campo ite_embuch (embalagem unitária) não é mais obrigatório.
-- Bancos legados do V1 podem ter a constraint, impedindo INSERT sem esse campo.

ALTER TABLE itens_ped ALTER COLUMN ite_embuch DROP NOT NULL;
ALTER TABLE itens_ped ALTER COLUMN ite_embuch SET DEFAULT '';
