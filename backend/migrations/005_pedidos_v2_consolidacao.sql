-- Migration 005: Suporte a Consolidação e Valor Mínimo
-- Replicado em todos os schemas de tenant

-- 1. Valor mínimo de pedido por indústria (faturamento mínimo)
ALTER TABLE fornecedores 
ADD COLUMN IF NOT EXISTS for_min_order DECIMAL(12,2) DEFAULT 0;

-- 2. Campos para Ordens de Compra e Consolidação
-- ped_oc: Número da Ordem de Compra original que gerou o pedido (ou parte dele)
-- ped_consolidado_id: ID do pedido principal em que este foi fundido (se houver)
-- ped_situacao_original: Para backup da situação antes de entrar na fila 'Q'
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS ped_oc VARCHAR(50),
ADD COLUMN IF NOT EXISTS ped_consolidado_id INTEGER,
ADD COLUMN IF NOT EXISTS ped_situacao_original VARCHAR(1);

-- 3. Índices para performance na busca de consolidados
CREATE INDEX IF NOT EXISTS idx_pedidos_oc ON pedidos(ped_oc);
CREATE INDEX IF NOT EXISTS idx_pedidos_consolidado ON pedidos(ped_consolidado_id);
