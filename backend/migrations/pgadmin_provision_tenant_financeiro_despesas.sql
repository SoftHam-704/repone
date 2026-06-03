-- =============================================================================
-- pgadmin_provision_tenant_financeiro_despesas.sql
-- -----------------------------------------------------------------------------
-- OBJETIVO
--   Provisionar (ou COMPLETAR) num tenant as tabelas que NAO nascem pelo
--   001_create_base_tables.sql:
--     * Modulo financeiro  (fin_plano_contas, fin_centro_custo, fin_clientes,
--       fin_fornecedores, fin_contas_pagar, fin_parcelas_pagar,
--       fin_contas_receber, fin_parcelas_receber)
--     * despesas           (migration 059)
--
--   Garante que TODA tabela com PK serial nasca com a sequence LOCAL no schema
--   do tenant, DEFAULT qualificado e OWNED BY — exatamente o que `SERIAL` faz
--   quando criado SOB o search_path do tenant. NUNCA usa CREATE SEQUENCE manual
--   nem LIKE ... INCLUDING DEFAULTS (foi isso que torceu as sequences antes).
--
-- POR QUE ESTE SCRIPT EXISTE
--   O caminho oficial (create-tenant.ts) so roda 001_create_base_tables.sql.
--   financeiro_schema.sql e a 059 nunca foram plugados no provisionamento, entao
--   um tenant NOVO nasceria SEM financeiro e SEM despesas. Os tenants atuais so
--   tem essas tabelas porque foram aplicadas a mao — e foi nesse "a mao", via
--   clones/LIKE, que as sequences de fin_plano_contas/fin_centro_custo torceram.
--
--   Aqui o segredo e o `SET search_path TO <tenant>, public` ANTES dos
--   CREATE TABLE ... SERIAL: o Postgres cria a sequence implicita NO schema
--   corrente (o tenant), ja qualificada e ja OWNED BY a coluna. Sem clone.
--
-- USO
--   1. pgAdmin conectado em basesales (NAO no master).  SELECT current_database();
--   2. Editar :tenant abaixo (UMA vez) com o schema alvo, OU rodar via
--      psql -v tenant=novotenant -f este_arquivo.sql.
--      No pgAdmin sem variaveis: troque o literal em v_schema (linha marcada).
--   3. Rodar inteiro. Idempotente (IF NOT EXISTS em tudo). Asserts no final.
--
-- SEGURANCA
--   * Idempotente: 2a passada = no-op (todas as tabelas com IF NOT EXISTS).
--   * Transacional: BEGIN/COMMIT explicito + asserts. Falhou invariante -> ROLLBACK.
--   * NAO ha DROP/TRUNCATE/DELETE. Nao copia dados (modelo de plano de contas e
--     copiado por script separado, se desejado).
--
-- Autor: DBA RepOne (SoftHam) | Data: 2026-06-03
-- =============================================================================

BEGIN;

-- Trava: aborta se conectado no banco errado.
DO $guard$
BEGIN
  IF current_database() <> 'basesales' THEN
    RAISE EXCEPTION 'ABORTADO: conectado em "%" — rode APENAS em basesales', current_database();
  END IF;
END
$guard$;

DO $prov$
DECLARE
  -- >>> EDITAR AQUI o schema do tenant a provisionar <<<
  v_schema TEXT := 'NOVOTENANT';
BEGIN
  IF v_schema = 'NOVOTENANT' THEN
    RAISE EXCEPTION 'Defina v_schema com o nome real do tenant antes de rodar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = v_schema) THEN
    RAISE EXCEPTION 'Schema "%" nao existe. Crie o tenant base antes (create-tenant.ts).', v_schema;
  END IF;

  -- O PULO DO GATO: search_path no tenant. Todo SERIAL abaixo cria a sequence
  -- implicita NESTE schema, qualificada e OWNED BY a coluna. Zero clone manual.
  EXECUTE format('SET LOCAL search_path TO %I, public', v_schema);

  -- ─────────────────────────────────────────────────────────────────────────
  -- MODULO FINANCEIRO
  -- ─────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS fin_plano_contas (
    id            SERIAL PRIMARY KEY,
    codigo        VARCHAR(20)  UNIQUE NOT NULL,
    descricao     VARCHAR(200) NOT NULL,
    tipo          CHAR(1)      NOT NULL CHECK (tipo IN ('R','D')),
    nivel         INTEGER      NOT NULL CHECK (nivel BETWEEN 1 AND 3),
    id_pai        INTEGER      REFERENCES fin_plano_contas(id),
    ativo         BOOLEAN      DEFAULT true,
    criado_em     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fin_plano_tipo  ON fin_plano_contas(tipo);
  CREATE INDEX IF NOT EXISTS idx_fin_plano_ativo ON fin_plano_contas(ativo);
  CREATE INDEX IF NOT EXISTS idx_fin_plano_pai   ON fin_plano_contas(id_pai);

  CREATE TABLE IF NOT EXISTS fin_centro_custo (
    id            SERIAL PRIMARY KEY,
    codigo        VARCHAR(20)  UNIQUE,
    descricao     VARCHAR(100) NOT NULL,
    ativo         BOOLEAN      DEFAULT true,
    criado_em     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fin_centro_ativo ON fin_centro_custo(ativo);

  CREATE TABLE IF NOT EXISTS fin_clientes (
    id            SERIAL PRIMARY KEY,
    tipo_pessoa   CHAR(1)      NOT NULL CHECK (tipo_pessoa IN ('F','J')),
    cpf_cnpj      VARCHAR(18),
    nome_razao    VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    endereco      VARCHAR(200),
    numero        VARCHAR(20),
    complemento   VARCHAR(100),
    bairro        VARCHAR(100),
    cidade        VARCHAR(100),
    uf            CHAR(2),
    cep           VARCHAR(10),
    telefone      VARCHAR(20),
    celular       VARCHAR(20),
    email         VARCHAR(100),
    observacoes   TEXT,
    ativo         BOOLEAN      DEFAULT true,
    criado_em     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fin_cli_nome  ON fin_clientes(nome_razao);
  CREATE INDEX IF NOT EXISTS idx_fin_cli_ativo ON fin_clientes(ativo);

  CREATE TABLE IF NOT EXISTS fin_fornecedores (
    id            SERIAL PRIMARY KEY,
    tipo_pessoa   CHAR(1)      NOT NULL CHECK (tipo_pessoa IN ('F','J')),
    cpf_cnpj      VARCHAR(18),
    nome_razao    VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    endereco      VARCHAR(200),
    numero        VARCHAR(20),
    complemento   VARCHAR(100),
    bairro        VARCHAR(100),
    cidade        VARCHAR(100),
    uf            CHAR(2),
    cep           VARCHAR(10),
    telefone      VARCHAR(20),
    celular       VARCHAR(20),
    email         VARCHAR(100),
    observacoes   TEXT,
    ativo         BOOLEAN      DEFAULT true,
    criado_em     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fin_for_nome  ON fin_fornecedores(nome_razao);
  CREATE INDEX IF NOT EXISTS idx_fin_for_ativo ON fin_fornecedores(ativo);

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

  -- Triggers de atualizado_em (funcao compartilhada em public via search_path).
  CREATE OR REPLACE FUNCTION atualizar_timestamp()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                 JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname=v_schema AND t.tgname='trg_fin_plano_atualizado') THEN
    EXECUTE format('CREATE TRIGGER trg_fin_plano_atualizado BEFORE UPDATE ON %I.fin_plano_contas FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp()', v_schema);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                 JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname=v_schema AND t.tgname='trg_fin_centro_atualizado') THEN
    EXECUTE format('CREATE TRIGGER trg_fin_centro_atualizado BEFORE UPDATE ON %I.fin_centro_custo FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp()', v_schema);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                 JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname=v_schema AND t.tgname='trg_fin_cp_atualizado') THEN
    EXECUTE format('CREATE TRIGGER trg_fin_cp_atualizado BEFORE UPDATE ON %I.fin_contas_pagar FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp()', v_schema);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                 JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname=v_schema AND t.tgname='trg_fin_cr_atualizado') THEN
    EXECUTE format('CREATE TRIGGER trg_fin_cr_atualizado BEFORE UPDATE ON %I.fin_contas_receber FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp()', v_schema);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- DESPESAS (migration 059 + alargamento 060)
  -- ─────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS despesas (
    desp_id          SERIAL PRIMARY KEY,
    desp_vendedor    INTEGER NOT NULL,
    desp_data        DATE NOT NULL,
    desp_categoria   VARCHAR(30) NOT NULL,
    desp_valor       NUMERIC(12,2) NOT NULL,
    desp_descricao   TEXT,
    desp_km          INTEGER,
    desp_comprovante VARCHAR(255),
    desp_criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_despesas_vendedor ON despesas (desp_vendedor);
  CREATE INDEX IF NOT EXISTS idx_despesas_data     ON despesas (desp_data);

  -- Registrar migrations aplicadas (se a tabela de controle existir).
  IF to_regclass(format('%I._migrations', v_schema)) IS NOT NULL THEN
    EXECUTE format($m$INSERT INTO %I._migrations (name) VALUES
      ('financeiro_schema.sql'),('059_create_despesas.sql'),('060_widen_desp_categoria.sql')
      ON CONFLICT (name) DO NOTHING$m$, v_schema);
  END IF;

  RAISE NOTICE 'Tenant % provisionado: financeiro + despesas (sequences locais).', v_schema;
END
$prov$;

-- -----------------------------------------------------------------------------
-- ASSERTS: toda PK serial provisionada deve ter sequence LOCAL + DEFAULT
-- qualificado no schema do tenant + OWNED BY resolvivel. Falhou -> ROLLBACK.
-- -----------------------------------------------------------------------------
DO $assert$
DECLARE
  v_schema  TEXT := 'NOVOTENANT';  -- >>> MESMO valor do bloco acima <<<
  t         TEXT;
  pkcol     TEXT;
  tbls      TEXT[] := ARRAY[
    'fin_plano_contas','fin_centro_custo','fin_clientes','fin_fornecedores',
    'fin_contas_pagar','fin_parcelas_pagar','fin_contas_receber',
    'fin_parcelas_receber','despesas'
  ];
  owned     TEXT;
  def       TEXT;
  want_seq  TEXT;
  n         INT := 0;
BEGIN
  IF v_schema = 'NOVOTENANT' THEN
    RAISE EXCEPTION 'Defina v_schema no bloco de asserts com o mesmo tenant.';
  END IF;

  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass(format('%I.%I', v_schema, t)) IS NULL THEN
      RAISE EXCEPTION 'ASSERT FALHOU: %.% nao foi criada.', v_schema, t;
    END IF;
    pkcol := CASE WHEN t = 'despesas' THEN 'desp_id' ELSE 'id' END;

    owned := pg_get_serial_sequence(format('%I.%I', v_schema, t), pkcol);
    IF owned IS NULL THEN
      RAISE EXCEPTION 'ASSERT FALHOU: %.%.% sem OWNED BY (sequence nao vinculada).', v_schema, t, pkcol;
    END IF;
    -- A sequence local correta vive no schema do tenant.
    IF owned NOT LIKE v_schema || '.%' THEN
      RAISE EXCEPTION 'ASSERT FALHOU: %.%.% aponta para sequence FORA do tenant: %', v_schema, t, pkcol, owned;
    END IF;

    SELECT pg_get_expr(d.adbin, d.adrelid) INTO def
      FROM pg_attribute a
      JOIN pg_class cl ON cl.oid = a.attrelid
      JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE nsp.nspname = v_schema AND cl.relname = t AND a.attname = pkcol;
    IF def IS NULL OR def NOT LIKE 'nextval(%' OR def NOT LIKE '%' || v_schema || '.%' THEN
      RAISE EXCEPTION 'ASSERT FALHOU: %.%.% DEFAULT nao qualificado no tenant: %', v_schema, t, pkcol, COALESCE(def,'<null>');
    END IF;
    n := n + 1;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'ASSERTS OK: % tabelas com sequence LOCAL + DEFAULT qualificado + OWNED BY.', n;
  RAISE NOTICE 'Seguro para COMMIT.';
  RAISE NOTICE '====================================================';
END
$assert$;

COMMIT;
