-- 041: Campo dedicado para autorização de e-mail automático via IRIS
-- ped_iris_autoriza = true  → rep compartilhou via WhatsApp, IRIS deve enviar e-mail
-- ped_iris_enviado_em       → timestamp em que a IRIS efetivamente enviou o e-mail
-- Separado de ped_enviado (flag legada "enviado à indústria", mantida intacta)

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS ped_iris_autoriza   boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS ped_iris_enviado_em timestamp DEFAULT NULL;
