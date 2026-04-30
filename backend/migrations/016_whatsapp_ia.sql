-- ============================================================
-- Migration 016: Módulo WhatsApp + IA
-- Tabelas para conversas, mensagens, contatos e campanhas.
-- ============================================================

-- ── Contatos de WhatsApp (leads e clientes) ─────────────────
CREATE TABLE IF NOT EXISTS wpp_contato (
  id              SERIAL PRIMARY KEY,
  telefone        VARCHAR(20) NOT NULL UNIQUE,
  nome_push       VARCHAR(200),
  nome_informado  VARCHAR(200),
  email           VARCHAR(200),
  empresa         VARCHAR(200),
  cidade          VARCHAR(200),
  uf              CHAR(2),

  -- Vínculo CRM
  cliente_id      INT REFERENCES clientes(cli_codigo) ON DELETE SET NULL,
  is_cliente      BOOLEAN NOT NULL DEFAULT FALSE,

  -- LGPD
  aceita_msgs     BOOLEAN NOT NULL DEFAULT TRUE,
  optout_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpp_contato_tel    ON wpp_contato(telefone);
CREATE INDEX IF NOT EXISTS idx_wpp_contato_cli    ON wpp_contato(cliente_id) WHERE cliente_id IS NOT NULL;

-- ── Conversas (threads) ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE wpp_conversa_estado AS ENUM (
    'nova','ia_ativa','ia_qualificou',
    'humano_ativo','convertida','encerrada','perdida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS wpp_conversa (
  id                    SERIAL PRIMARY KEY,
  contato_id            INT NOT NULL REFERENCES wpp_contato(id) ON DELETE CASCADE,
  estado                wpp_conversa_estado NOT NULL DEFAULT 'nova',
  origem                VARCHAR(20) NOT NULL DEFAULT 'inbound',

  -- Qualificação (preenchida progressivamente pela IA)
  dados_qualificacao    JSONB,
  resumo_ia             TEXT,

  -- Atendimento humano
  usuario_id            INT REFERENCES usuarios(usu_codigo),
  assumida_em           TIMESTAMPTZ,

  -- Vínculo CRM
  pedido_id             INT,

  -- Métricas
  total_msgs_lead       INT NOT NULL DEFAULT 0,
  total_msgs_ia         INT NOT NULL DEFAULT 0,
  total_msgs_humano     INT NOT NULL DEFAULT 0,
  tokens_consumidos     INT NOT NULL DEFAULT 0,
  tempo_primeira_resp_seg INT,

  -- Timestamps
  primeira_msg_at       TIMESTAMPTZ,
  ultima_msg_at         TIMESTAMPTZ,
  qualificada_at        TIMESTAMPTZ,
  encerrada_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpp_conv_contato ON wpp_conversa(contato_id);
CREATE INDEX IF NOT EXISTS idx_wpp_conv_estado  ON wpp_conversa(estado);
CREATE INDEX IF NOT EXISTS idx_wpp_conv_ativa   ON wpp_conversa(estado, ultima_msg_at)
  WHERE estado NOT IN ('convertida','perdida','encerrada');

-- ── Mensagens ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE wpp_msg_remetente AS ENUM ('lead','ia','humano','sistema');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS wpp_mensagem (
  id                SERIAL PRIMARY KEY,
  conversa_id       INT NOT NULL REFERENCES wpp_conversa(id) ON DELETE CASCADE,
  contato_id        INT NOT NULL REFERENCES wpp_contato(id)  ON DELETE CASCADE,
  wpp_message_id    VARCHAR(100),
  direcao           VARCHAR(10)  NOT NULL,  -- inbound | outbound
  tipo              VARCHAR(20)  NOT NULL DEFAULT 'texto',
  remetente         wpp_msg_remetente NOT NULL,
  conteudo          TEXT NOT NULL,
  -- Metadata IA
  tokens_prompt     INT,
  tokens_resposta   INT,
  tempo_resposta_ms INT,
  dados_extraidos   JSONB,
  -- Status
  status            VARCHAR(20)  NOT NULL DEFAULT 'recebida',
  erro_detalhe      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpp_msg_conv ON wpp_mensagem(conversa_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wpp_msg_wppid ON wpp_mensagem(wpp_message_id)
  WHERE wpp_message_id IS NOT NULL;

-- ── Templates de mensagem ────────────────────────────────────
CREATE TABLE IF NOT EXISTS wpp_template (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(50)  NOT NULL UNIQUE,
  nome        VARCHAR(200) NOT NULL,
  categoria   VARCHAR(50)  NOT NULL,
  conteudo    TEXT NOT NULL,
  variaveis   TEXT[],
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campanhas ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wpp_campanha (
  id              SERIAL PRIMARY KEY,
  nome            VARCHAR(200) NOT NULL,
  template_id     INT NOT NULL REFERENCES wpp_template(id),
  tipo            VARCHAR(50)  NOT NULL,
  filtros         JSONB,
  status          VARCHAR(20)  NOT NULL DEFAULT 'rascunho',
  agendada_para   TIMESTAMPTZ,
  total_contatos  INT,
  total_enviados  INT NOT NULL DEFAULT 0,
  total_erros     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executada_at    TIMESTAMPTZ
);

-- ── Log de envio individual ──────────────────────────────────
CREATE TABLE IF NOT EXISTS wpp_campanha_envio (
  id            SERIAL PRIMARY KEY,
  campanha_id   INT NOT NULL REFERENCES wpp_campanha(id) ON DELETE CASCADE,
  contato_id    INT NOT NULL REFERENCES wpp_contato(id),
  status        VARCHAR(20)  NOT NULL DEFAULT 'pendente',
  erro_detalhe  TEXT,
  enviado_at    TIMESTAMPTZ,
  respondido_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wpp_camp_envio ON wpp_campanha_envio(campanha_id, status);

-- ── Seeds de templates iniciais ──────────────────────────────
INSERT INTO wpp_template (codigo, nome, categoria, conteudo, variaveis) VALUES
('boas_vindas',  'Boas-vindas',       'saudacao',
 'Olá, {nome}! 👋 Sou o assistente virtual do representante. Como posso te ajudar?',
 ARRAY['nome']),
('followup_3d',  'Follow-up 3 dias',  'followup',
 'Oi, {nome}! Passando para saber se ainda tem interesse. Posso te ajudar com mais informações?',
 ARRAY['nome']),
('followup_7d',  'Follow-up 7 dias',  'followup',
 'Olá, {nome}! Faz uma semana que conversamos. Gostaria de retomar? Estou à disposição! 😊',
 ARRAY['nome']),
('aniversario',  'Aniversário',       'aniversario',
 'Parabéns, {nome}! 🎉 A equipe deseja um feliz aniversário! Que esse ano traga muitas conquistas.',
 ARRAY['nome']),
('reativacao',   'Reativação',        'reativacao',
 'Olá, {nome}! Faz um tempo que não conversamos. Tem novidades em produtos. Interesse em saber mais?',
 ARRAY['nome'])
ON CONFLICT (codigo) DO NOTHING;
