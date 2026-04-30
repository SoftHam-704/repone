-- ============================================================
-- MÓDULO FINANCEIRO — MIGRAÇÃO POR TENANT SCHEMA
-- Executar em cada schema de tenant (após SET search_path TO tenant_xxx)
-- ============================================================

-- 1. PLANO DE CONTAS (Hierárquico)
CREATE TABLE IF NOT EXISTS fin_plano_contas (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(20)  UNIQUE NOT NULL,
    descricao   VARCHAR(200) NOT NULL,
    tipo        CHAR(1)      NOT NULL CHECK (tipo IN ('R', 'D')),
    nivel       INTEGER      NOT NULL CHECK (nivel BETWEEN 1 AND 3),
    id_pai      INTEGER      REFERENCES fin_plano_contas(id),
    ativo       BOOLEAN      DEFAULT true,
    criado_em   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_plano_tipo  ON fin_plano_contas(tipo);
CREATE INDEX IF NOT EXISTS idx_fin_plano_ativo ON fin_plano_contas(ativo);
CREATE INDEX IF NOT EXISTS idx_fin_plano_pai   ON fin_plano_contas(id_pai);

-- 2. CENTRO DE CUSTO
CREATE TABLE IF NOT EXISTS fin_centro_custo (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(20) UNIQUE,
    descricao   VARCHAR(100) NOT NULL,
    ativo       BOOLEAN      DEFAULT true,
    criado_em   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_centro_ativo ON fin_centro_custo(ativo);

-- 3. CLIENTES FINANCEIROS (separado de clientes da representação)
CREATE TABLE IF NOT EXISTS fin_clientes (
    id           SERIAL PRIMARY KEY,
    tipo_pessoa  CHAR(1)      NOT NULL CHECK (tipo_pessoa IN ('F', 'J')),
    cpf_cnpj     VARCHAR(18),
    nome_razao   VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    endereco     VARCHAR(200),
    numero       VARCHAR(20),
    complemento  VARCHAR(100),
    bairro       VARCHAR(100),
    cidade       VARCHAR(100),
    uf           CHAR(2),
    cep          VARCHAR(10),
    telefone     VARCHAR(20),
    celular      VARCHAR(20),
    email        VARCHAR(100),
    observacoes  TEXT,
    ativo        BOOLEAN      DEFAULT true,
    criado_em    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_cli_nome  ON fin_clientes(nome_razao);
CREATE INDEX IF NOT EXISTS idx_fin_cli_ativo ON fin_clientes(ativo);

-- 4. FORNECEDORES FINANCEIROS (separado das indústrias)
CREATE TABLE IF NOT EXISTS fin_fornecedores (
    id           SERIAL PRIMARY KEY,
    tipo_pessoa  CHAR(1)      NOT NULL CHECK (tipo_pessoa IN ('F', 'J')),
    cpf_cnpj     VARCHAR(18),
    nome_razao   VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    endereco     VARCHAR(200),
    numero       VARCHAR(20),
    complemento  VARCHAR(100),
    bairro       VARCHAR(100),
    cidade       VARCHAR(100),
    uf           CHAR(2),
    cep          VARCHAR(10),
    telefone     VARCHAR(20),
    celular      VARCHAR(20),
    email        VARCHAR(100),
    observacoes  TEXT,
    ativo        BOOLEAN      DEFAULT true,
    criado_em    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_for_nome  ON fin_fornecedores(nome_razao);
CREATE INDEX IF NOT EXISTS idx_fin_for_ativo ON fin_fornecedores(ativo);

-- 5. CONTAS A PAGAR
CREATE TABLE IF NOT EXISTS fin_contas_pagar (
    id               SERIAL PRIMARY KEY,
    descricao        VARCHAR(200) NOT NULL,
    id_fornecedor    INTEGER      REFERENCES fin_fornecedores(id),
    numero_documento VARCHAR(50),
    valor_total      DECIMAL(15,2) NOT NULL CHECK (valor_total >= 0),
    valor_pago       DECIMAL(15,2) DEFAULT 0,
    data_emissao     DATE          NOT NULL,
    data_vencimento  DATE          NOT NULL,
    data_pagamento   DATE,
    status           VARCHAR(20)   DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','PAGO','VENCIDO','CANCELADO')),
    observacoes      TEXT,
    id_plano_contas  INTEGER       REFERENCES fin_plano_contas(id),
    id_centro_custo  INTEGER       REFERENCES fin_centro_custo(id),
    criado_em        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    criado_por       VARCHAR(100),
    atualizado_em    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_cp_vencimento ON fin_contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_cp_status     ON fin_contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_fin_cp_fornecedor ON fin_contas_pagar(id_fornecedor);

-- 6. PARCELAS DE CONTAS A PAGAR
CREATE TABLE IF NOT EXISTS fin_parcelas_pagar (
    id              SERIAL PRIMARY KEY,
    id_conta_pagar  INTEGER       NOT NULL REFERENCES fin_contas_pagar(id) ON DELETE CASCADE,
    numero_parcela  INTEGER       NOT NULL,
    valor           DECIMAL(15,2) NOT NULL,
    data_vencimento DATE          NOT NULL,
    data_pagamento  DATE,
    valor_pago      DECIMAL(15,2),
    juros           DECIMAL(15,2) DEFAULT 0,
    desconto        DECIMAL(15,2) DEFAULT 0,
    status          VARCHAR(20)   DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','PAGO','VENCIDO','CANCELADO')),
    observacoes     TEXT,
    criado_em       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_pp_conta      ON fin_parcelas_pagar(id_conta_pagar);
CREATE INDEX IF NOT EXISTS idx_fin_pp_vencimento ON fin_parcelas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_pp_status     ON fin_parcelas_pagar(status);

-- 7. CONTAS A RECEBER
CREATE TABLE IF NOT EXISTS fin_contas_receber (
    id               SERIAL PRIMARY KEY,
    descricao        VARCHAR(200) NOT NULL,
    id_cliente       INTEGER      REFERENCES fin_clientes(id),
    numero_documento VARCHAR(50),
    valor_total      DECIMAL(15,2) NOT NULL CHECK (valor_total >= 0),
    valor_recebido   DECIMAL(15,2) DEFAULT 0,
    data_emissao     DATE          NOT NULL,
    data_vencimento  DATE          NOT NULL,
    data_recebimento DATE,
    status           VARCHAR(20)   DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','RECEBIDO','VENCIDO','CANCELADO')),
    observacoes      TEXT,
    id_plano_contas  INTEGER       REFERENCES fin_plano_contas(id),
    id_centro_custo  INTEGER       REFERENCES fin_centro_custo(id),
    criado_em        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    criado_por       VARCHAR(100),
    atualizado_em    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_cr_vencimento ON fin_contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_cr_status     ON fin_contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_fin_cr_cliente    ON fin_contas_receber(id_cliente);

-- 8. PARCELAS DE CONTAS A RECEBER
CREATE TABLE IF NOT EXISTS fin_parcelas_receber (
    id               SERIAL PRIMARY KEY,
    id_conta_receber INTEGER       NOT NULL REFERENCES fin_contas_receber(id) ON DELETE CASCADE,
    numero_parcela   INTEGER       NOT NULL,
    valor            DECIMAL(15,2) NOT NULL,
    data_vencimento  DATE          NOT NULL,
    data_recebimento DATE,
    valor_recebido   DECIMAL(15,2),
    juros            DECIMAL(15,2) DEFAULT 0,
    desconto         DECIMAL(15,2) DEFAULT 0,
    status           VARCHAR(20)   DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','RECEBIDO','VENCIDO','CANCELADO')),
    observacoes      TEXT,
    criado_em        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_pr_conta      ON fin_parcelas_receber(id_conta_receber);
CREATE INDEX IF NOT EXISTS idx_fin_pr_vencimento ON fin_parcelas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_pr_status     ON fin_parcelas_receber(status);

-- ============================================================
-- TRIGGER para atualizar atualizado_em (reutiliza função existente)
-- Cria a função se não existir
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_plano_atualizado') THEN
    CREATE TRIGGER trg_fin_plano_atualizado BEFORE UPDATE ON fin_plano_contas FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_centro_atualizado') THEN
    CREATE TRIGGER trg_fin_centro_atualizado BEFORE UPDATE ON fin_centro_custo FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_cp_atualizado') THEN
    CREATE TRIGGER trg_fin_cp_atualizado BEFORE UPDATE ON fin_contas_pagar FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_cr_atualizado') THEN
    CREATE TRIGGER trg_fin_cr_atualizado BEFORE UPDATE ON fin_contas_receber FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
  END IF;
END $$;
