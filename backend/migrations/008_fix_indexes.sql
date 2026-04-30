-- ══════════════════════════════════════════════════════════════════
-- MIGRATION 008 — Limpeza de índices duplicados + índices ausentes
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Corrigir itinerarios: remover coluna redundante iti_vendedor
--       (a coluna correta já existia: iti_vendedor_id)
ALTER TABLE itinerarios DROP COLUMN IF EXISTS iti_vendedor;

-- ── 2. Remover índices duplicados em clientes
--       (mantemos os originais do V1; removemos os criados pelo V2)
DROP INDEX IF EXISTS idx_clientes_cnpj;
DROP INDEX IF EXISTS idx_clientes_cli_regiao2;
DROP INDEX IF EXISTS idx_clientes_cli_idcidade;
DROP INDEX IF EXISTS idx_clientes_cli_atuacaoprincipal;

-- ── 3. Remover índices duplicados em vendedores
DROP INDEX IF EXISTS idx_vendedores_codigo;
DROP INDEX IF EXISTS idx_vendedores_cpf;
DROP INDEX IF EXISTS idx_vendedores_nome;
DROP INDEX IF EXISTS vendedores_ven_codigo_idx;
DROP INDEX IF EXISTS vendedores_ven_cpf_idx;
DROP INDEX IF EXISTS vendedores_ven_nome_idx;

-- ── 4. Remover índice duplicado em itinerarios
DROP INDEX IF EXISTS itinerarios_iti_vendedor_id_idx;

-- ── 5. Índices ausentes em clientes
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes(cli_vendedor);
CREATE INDEX IF NOT EXISTS idx_clientes_ativos   ON clientes(cli_tipopes) WHERE cli_tipopes = 'A';

-- ── 6. Busca por texto (ILIKE) — trigrama
--       pg_trgm é uma extensão de servidor criada no schema public (uma vez).
--       Os índices GIN funcionam em qualquer schema após a extensão estar no public.
CREATE INDEX IF NOT EXISTS idx_clientes_nomred_trgm ON clientes USING GIN (cli_nomred gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_cidade_trgm ON clientes USING GIN (cli_cidade gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_bairro_trgm ON clientes USING GIN (cli_bairro gin_trgm_ops);

-- ── 7. Índices ausentes em itinerarios (colunas reais do V1)
CREATE INDEX IF NOT EXISTS idx_itinerarios_descricao  ON itinerarios(iti_descricao);
CREATE INDEX IF NOT EXISTS idx_itinerarios_frequencia ON itinerarios(iti_frequencia);

-- ── 8. Índice ausente em regioes (ORDER BY reg_descricao)
CREATE INDEX IF NOT EXISTS idx_regioes_descricao ON regioes(reg_descricao);
