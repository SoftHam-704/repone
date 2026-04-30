-- Migration 015: Parâmetro para fechar pedido automaticamente na baixa via XML
-- Por padrão 'N' — pedido permanece aberto após baixa parcial ou total via XML.
-- O usuário pode ativar 'S' para fechar automaticamente quando o saldo zerar.

ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS par_baixa_xml_fecha CHAR(1) DEFAULT 'N';
