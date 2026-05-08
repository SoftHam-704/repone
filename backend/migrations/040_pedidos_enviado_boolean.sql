-- 040: Converte ped_enviado de varchar(1) para boolean
-- 'S' → true, qualquer outro valor (NULL, 'N', '') → false/NULL

ALTER TABLE pedidos
  ALTER COLUMN ped_enviado TYPE boolean
  USING (ped_enviado = 'S');
