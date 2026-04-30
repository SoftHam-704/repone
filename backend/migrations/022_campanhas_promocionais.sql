-- Migration 022: Campanhas Promocionais
-- Cria a tabela de campanhas caso não exista no schema do tenant

CREATE TABLE IF NOT EXISTS campanhas_promocionais (
    cmp_codigo            SERIAL PRIMARY KEY,
    cmp_descricao         VARCHAR(150) NOT NULL,
    cmp_cliente_id        INTEGER NOT NULL,
    cmp_industria_id      INTEGER NOT NULL,
    cmp_promotor_id       INTEGER,
    cmp_status            VARCHAR(20)  DEFAULT 'SIMULACAO',
    cmp_data_criacao      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    cmp_data_atualizacao  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    cmp_periodo_base_ini  DATE,
    cmp_periodo_base_fim  DATE,
    cmp_campanha_ini      DATE,
    cmp_campanha_fim      DATE,
    cmp_base_dias_kpi     INTEGER      DEFAULT 0,
    cmp_base_valor_total  NUMERIC(15,2) DEFAULT 0,
    cmp_base_qtd_total    NUMERIC(15,4) DEFAULT 0,
    cmp_base_media_diaria_val NUMERIC(15,2) DEFAULT 0,
    cmp_base_media_diaria_qtd NUMERIC(15,4) DEFAULT 0,
    cmp_perc_crescimento  NUMERIC(5,2)  DEFAULT 0,
    cmp_meta_valor_total  NUMERIC(15,2) DEFAULT 0,
    cmp_meta_qtd_total    NUMERIC(15,4) DEFAULT 0,
    cmp_meta_diaria_val   NUMERIC(15,2) DEFAULT 0,
    cmp_meta_diaria_qtd   NUMERIC(15,4) DEFAULT 0,
    cmp_real_valor_total  NUMERIC(15,2) DEFAULT 0,
    cmp_real_qtd_total    NUMERIC(15,4) DEFAULT 0,
    cmp_percentual_atingido_val NUMERIC(5,2) DEFAULT 0,
    cmp_percentual_atingido_qtd NUMERIC(5,2) DEFAULT 0,
    cmp_observacao        TEXT,
    cmp_ai_insight        TEXT,
    cmp_setor             VARCHAR(100),
    cmp_regiao            VARCHAR(100),
    cmp_equipe_vendas     INTEGER       DEFAULT 0,
    cmp_verba_solicitada  NUMERIC(15,2) DEFAULT 0,
    cmp_tema              VARCHAR(200),
    cmp_justificativa     TEXT,
    cmp_premiacoes        TEXT,
    cmp_tipo_periodo      VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS campanhas_tracking (
    tra_codigo       SERIAL PRIMARY KEY,
    tra_campanha_id  INTEGER NOT NULL REFERENCES campanhas_promocionais(cmp_codigo) ON DELETE CASCADE,
    tra_data         DATE    NOT NULL DEFAULT CURRENT_DATE,
    tra_vlr_acumulado NUMERIC(15,2) DEFAULT 0,
    tra_qtd_acumulada NUMERIC(15,4) DEFAULT 0,
    tra_observacao   TEXT,
    tra_criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
