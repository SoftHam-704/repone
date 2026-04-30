-- Adiciona campo pro_linhaamarela (Linha Amarela — equipamentos de construção civil)
ALTER TABLE cad_prod
  ADD COLUMN IF NOT EXISTS pro_linhaamarela BOOLEAN DEFAULT FALSE;
