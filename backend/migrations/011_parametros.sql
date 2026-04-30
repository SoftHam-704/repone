-- ─── 011_parametros.sql ──────────────────────────────────────────────────────
-- Tabela de parâmetros por usuário (configurações de comportamento do sistema)

CREATE TABLE IF NOT EXISTS parametros (
  par_id                 SERIAL PRIMARY KEY,
  par_usuario            INTEGER,

  -- Interface & Operação
  par_ordemped           CHAR(1)      DEFAULT 'D',   -- D=Data, N=Numérico
  par_qtdenter           INTEGER      DEFAULT 2,      -- 1=Explosivo 2=Rápido 3=Padrão 4=Cuidadoso
  par_fmtpesquisa        CHAR(1)      DEFAULT 'D',   -- C=Só código, D=Código+Descrição
  par_tipopesquisa       CHAR(1)      DEFAULT 'N',   -- R=Razão Social, N=Nome Reduzido
  par_telemkttipo        CHAR(1)      DEFAULT 'E',   -- E=Efetivo, P=Prospectando

  -- Regras de Negócio
  par_itemduplicado      CHAR(1)      DEFAULT 'N',   -- S=Permitir, N=Bloquear
  par_usadecimais        CHAR(1)      DEFAULT 'S',   -- S=Ativo, N=Inativo
  par_qtddecimais        INTEGER      DEFAULT 2,      -- 2, 3 ou 4
  par_zerapromo          CHAR(1)      DEFAULT 'N',   -- S=Zerar, N=Manter
  par_mostracodori       CHAR(1)      DEFAULT 'N',   -- S=Mostrar, N=Ocultar
  par_validapromocao     CHAR(1)      DEFAULT 'S',   -- S=Ativo, N=Inativo
  par_salvapedidoauto    CHAR(1)      DEFAULT 'S',   -- S=Sim, N=Não
  par_descontogrupo      CHAR(1)      DEFAULT 'N',   -- S=Ativo, N=Inativo
  par_mostrapednovos     CHAR(1)      DEFAULT 'S',   -- S=Mostrar, N=Ocultar
  par_mostraimpostos     CHAR(1)      DEFAULT 'S',   -- S=Mostrar, N=Ocultar

  -- Processamento & Logística
  par_ordemimpressao     CHAR(1)      DEFAULT 'N',   -- N=Numérico, D=Entrada
  par_tipofretepadrao    CHAR(1)      DEFAULT 'C',   -- C=CIF, F=FOB
  par_solicitarconfemail CHAR(1)      DEFAULT 'N',   -- S=Solicitar, N=Ignorar
  par_separalinhas       CHAR(1)      DEFAULT 'N',   -- S=Ativo, N=Inativo
  par_pedidopadrao       INTEGER      DEFAULT 1,      -- Layout 1-14
  par_iniciapedido       CHAR(1)      DEFAULT 'P',   -- P=Pedido, C=Cotação
  par_obs_padrao         TEXT         DEFAULT '',

  -- Config E-mail (SMTP)
  par_emailserver        VARCHAR(80)  DEFAULT '',
  par_email              VARCHAR(80)  DEFAULT '',
  par_emailuser          VARCHAR(80)  DEFAULT '',
  par_emailporta         INTEGER      DEFAULT 587,
  par_emailpassword      VARCHAR(100) DEFAULT '',
  par_emailtls           BOOLEAN      DEFAULT FALSE,
  par_emailssl           BOOLEAN      DEFAULT FALSE,
  par_emailalternativo   VARCHAR(80)  DEFAULT '',

  created_at             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parametros_usuario ON parametros(par_usuario);
