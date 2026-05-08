-- Migration 039 — Ampliar pro_conversao de VARCHAR(300) para TEXT
--
-- CONVERSÃO é um campo de códigos cruzados (equivalências) que pode conter
-- muitos códigos separados por espaço. VARCHAR(300) causa erro 500 na importação
-- quando o valor ultrapassa o limite.
ALTER TABLE cad_prod
  ALTER COLUMN pro_conversao TYPE TEXT;
