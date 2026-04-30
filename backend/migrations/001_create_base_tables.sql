-- ============================================================
-- Migration 001: Tabelas base do tenant (estrutura V1 exata)
-- Todas as tabelas de negócio criadas em cada schema de tenant.
-- Funções compartilhadas e tabela cidades ficam em public.
-- ============================================================

CREATE TABLE IF NOT EXISTS _migrations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Fornecedores (Indústrias) ────────────────────────────────
CREATE TABLE IF NOT EXISTS fornecedores (
    for_codigo              SERIAL PRIMARY KEY,
    for_nome                VARCHAR(75),
    for_nomered             VARCHAR(15),
    for_cgc                 VARCHAR(18),
    for_inscricao           VARCHAR(20),
    for_endereco            VARCHAR(45),
    for_bairro              VARCHAR(25),
    for_cidade              VARCHAR(25),
    for_uf                  VARCHAR(2),
    for_cep                 VARCHAR(10),
    for_fone                VARCHAR(25),
    for_fone2               VARCHAR(25),
    for_fax                 VARCHAR(15),
    for_email               VARCHAR(120),
    for_contatorep          VARCHAR(50),
    for_codrep              INTEGER,
    for_percom              DOUBLE PRECISION DEFAULT 0,
    for_comissao            DOUBLE PRECISION DEFAULT 0,
    for_comissaofreio       DOUBLE PRECISION DEFAULT 0,
    for_comissaooutro       DOUBLE PRECISION DEFAULT 0,
    for_comissaoporgrupo    BOOLEAN DEFAULT FALSE,
    for_comissaogrupofreio  INTEGER,
    for_comissaogrupooutro  INTEGER,
    for_tipocomissao        VARCHAR(1),
    for_des1                DOUBLE PRECISION DEFAULT 0,
    for_des2                DOUBLE PRECISION DEFAULT 0,
    for_des3                DOUBLE PRECISION DEFAULT 0,
    for_des4                DOUBLE PRECISION DEFAULT 0,
    for_des5                DOUBLE PRECISION DEFAULT 0,
    for_des6                DOUBLE PRECISION DEFAULT 0,
    for_des7                DOUBLE PRECISION DEFAULT 0,
    for_des8                DOUBLE PRECISION DEFAULT 0,
    for_des9                DOUBLE PRECISION DEFAULT 0,
    for_des10               DOUBLE PRECISION DEFAULT 0,
    for_tipofrete           CHAR(1) DEFAULT 'C',
    for_tabela              VARCHAR(20),
    for_homepage            VARCHAR(150),
    for_logo                VARCHAR(200),
    for_logotipo            TEXT,
    observacoes             TEXT,
    for_obs2                TEXT,
    for_tipo2               CHAR(1) DEFAULT 'A',
    gid                     VARCHAR(38),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Vendedores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedores (
    ven_codigo      SERIAL PRIMARY KEY,
    ven_nome        VARCHAR(45),
    ven_endereco    VARCHAR(50),
    ven_bairro      VARCHAR(25),
    ven_cidade      VARCHAR(25),
    ven_cep         VARCHAR(11),
    ven_uf          VARCHAR(2),
    ven_fone1       VARCHAR(20),
    ven_fone2       VARCHAR(20),
    ven_cpf         VARCHAR(14),
    ven_rg          VARCHAR(30),
    ven_ctps        VARCHAR(30),
    ven_filiacao    VARCHAR(100),
    ven_pis         VARCHAR(20),
    ven_filhos      INTEGER,
    ven_aniversario VARCHAR(6),
    ven_comissao    DOUBLE PRECISION DEFAULT 0,
    ven_email       VARCHAR(60),
    ven_nomeusu     VARCHAR(50),
    ven_codusu      INTEGER,
    ven_obs         VARCHAR(400),
    ven_imagem      VARCHAR(200),
    ven_status      CHAR(1) DEFAULT 'A',
    gid             VARCHAR(38),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Vendedor x Indústria ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedor_ind (
    vin_industria   INTEGER NOT NULL REFERENCES fornecedores(for_codigo) ON DELETE CASCADE,
    vin_codigo      INTEGER NOT NULL REFERENCES vendedores(ven_codigo) ON DELETE CASCADE,
    vin_percom      DOUBLE PRECISION DEFAULT 0,
    gid             VARCHAR(38),
    PRIMARY KEY (vin_industria, vin_codigo)
);

-- ── Regiões ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regioes (
    reg_codigo  SERIAL PRIMARY KEY,
    reg_nome    VARCHAR(50),
    reg_obs     VARCHAR(200),
    gid         VARCHAR(38)
);

-- ── Transportadoras ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transportadora (
    tra_codigo    SERIAL PRIMARY KEY,
    tra_nome      VARCHAR(60),
    tra_endereco  VARCHAR(45),
    tra_bairro    VARCHAR(25),
    tra_cidade    VARCHAR(25),
    tra_uf        VARCHAR(2),
    tra_cep       VARCHAR(10),
    tra_fone      VARCHAR(25),
    tra_cgc       VARCHAR(18),
    tra_inscricao VARCHAR(20),
    tra_email     VARCHAR(60),
    tra_contato   VARCHAR(45),
    tra_obs       VARCHAR(300),
    gid           VARCHAR(38)
);

-- ── Áreas de Atuação ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS area_atu (
    atu_id        SERIAL PRIMARY KEY,
    atu_descricao VARCHAR(60) NOT NULL,
    atu_sel       VARCHAR(1),
    gid           VARCHAR(38)
);

-- ── Clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
    cli_codigo          SERIAL PRIMARY KEY,
    cli_cnpj            VARCHAR(18),
    cli_inscricao       VARCHAR(18),
    cli_tipopes         VARCHAR(1),
    cli_nome            VARCHAR(75),
    cli_nomred          VARCHAR(30),
    cli_fantasia        VARCHAR(45),
    cli_endereco        VARCHAR(200),
    cli_endnum          VARCHAR(15),
    cli_complemento     VARCHAR(50),
    cli_bairro          VARCHAR(100),
    cli_cidade          VARCHAR(25),
    cli_uf              VARCHAR(2),
    cli_cep             VARCHAR(11),
    cli_ptoref          VARCHAR(250),
    cli_fone1           VARCHAR(20),
    cli_fone2           VARCHAR(20),
    cli_fone3           VARCHAR(20),
    cli_endcob          VARCHAR(45),
    cli_baicob          VARCHAR(25),
    cli_cidcob          VARCHAR(25),
    cli_cepcob          VARCHAR(11),
    cli_ufcob           VARCHAR(2),
    cli_email           VARCHAR(200),
    cli_emailnfe        VARCHAR(60),
    cli_skype           VARCHAR(150),
    cli_refcome         VARCHAR(600),
    cli_suframa         VARCHAR(15),
    cli_vencsuf         DATE,
    cli_caixapostal     VARCHAR(20),
    cli_vendedor        INTEGER REFERENCES vendedores(ven_codigo),
    cli_regiao          INTEGER REFERENCES regioes(reg_codigo),
    cli_situacao        VARCHAR(1) DEFAULT 'A',
    cli_datacad         DATE DEFAULT CURRENT_DATE,
    cli_ultcompra       DATE,
    cli_ultvisita       DATE,
    cli_ultcontato      DATE,
    cli_obs             TEXT,
    cli_obsparticular   VARCHAR(600),
    cli_obsped          VARCHAR(600),
    cli_imp             CHAR(1),
    cli_dtnasc          DATE,
    cli_rg              VARCHAR(20),
    cli_orgaorg         VARCHAR(15),
    cli_pai             VARCHAR(60),
    cli_mae             VARCHAR(60),
    cli_conjuge         VARCHAR(60),
    cli_dtcasamento     DATE,
    cli_naturalidade    VARCHAR(30),
    cli_nacionalidade   VARCHAR(30),
    cli_estadocivil     VARCHAR(1),
    cli_profissao       VARCHAR(30),
    cli_rendamensal     DOUBLE PRECISION DEFAULT 0,
    cli_temporesid      VARCHAR(15),
    cli_nomeref1        VARCHAR(60),
    cli_foneref1        VARCHAR(20),
    cli_nomeref2        VARCHAR(60),
    cli_foneref2        VARCHAR(20),
    cli_nomeref3        VARCHAR(60),
    cli_foneref3        VARCHAR(20),
    cli_limcredito      DOUBLE PRECISION DEFAULT 0,
    cli_saldodevedor    DOUBLE PRECISION DEFAULT 0,
    cli_ultpagamento    DATE,
    cli_ultapontamento  DATE,
    cli_contato         VARCHAR(55),
    cli_funcao          VARCHAR(35),
    cli_diaaniv         SMALLINT,
    cli_mes             SMALLINT,
    cli_niver           DATE,
    cli_fonecontato     VARCHAR(15),
    cli_emailcontato    VARCHAR(80),
    cli_imagem          VARCHAR(200),
    cli_latitude        VARCHAR(30),
    cli_longitude       VARCHAR(30),
    cli_codmunicipio    INTEGER,
    cli_idcidade        INTEGER,
    cli_regiao2         INTEGER,
    cli_redeloja        VARCHAR(100),
    cli_atuacaoprincipal VARCHAR(60),
    cli_emailfinanc     VARCHAR(100),
    cli_dtabertura      DATE,
    cli_obspedido       VARCHAR(600),
    gid                 VARCHAR(38),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Contatos Aniversariantes do Cliente ──────────────────────
CREATE TABLE IF NOT EXISTS cli_aniv (
    ani_lancto              SERIAL PRIMARY KEY,
    ani_cliente             INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
    ani_nome                VARCHAR(55) NOT NULL,
    ani_funcao              VARCHAR(35),
    ani_fone                VARCHAR(15),
    ani_email               VARCHAR(60),
    ani_diaaniv             SMALLINT,
    ani_mes                 SMALLINT,
    ani_niver               DATE,
    ani_obs                 VARCHAR(600),
    ani_sel                 VARCHAR(1) DEFAULT ' ',
    ani_timequetorce        VARCHAR(50),
    ani_esportepreferido    VARCHAR(50),
    ani_hobby               VARCHAR(50),
    gid                     VARCHAR(38)
);

-- ── Áreas de Atuação do Cliente ──────────────────────────────
CREATE TABLE IF NOT EXISTS atua_cli (
    atu_idcli   INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
    atu_atuaid  INTEGER NOT NULL REFERENCES area_atu(atu_id),
    atu_sel     VARCHAR(1),
    gid         VARCHAR(38),
    PRIMARY KEY (atu_idcli, atu_atuaid)
);

-- ── Grupos de Produtos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos (
    gru_codigo    SERIAL PRIMARY KEY,
    gru_nome      VARCHAR(50),
    gru_industria INTEGER REFERENCES fornecedores(for_codigo),
    gru_desc1     DOUBLE PRECISION DEFAULT 0,
    gru_desc2     DOUBLE PRECISION DEFAULT 0,
    gru_desc3     DOUBLE PRECISION DEFAULT 0,
    gru_desc4     DOUBLE PRECISION DEFAULT 0,
    gru_desc5     DOUBLE PRECISION DEFAULT 0,
    gru_desc6     DOUBLE PRECISION DEFAULT 0,
    gru_desc7     DOUBLE PRECISION DEFAULT 0,
    gru_desc8     DOUBLE PRECISION DEFAULT 0,
    gru_desc9     DOUBLE PRECISION DEFAULT 0,
    gid           VARCHAR(38)
);

-- ── Grupos de Desconto ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupo_desc (
    gde_id          SERIAL PRIMARY KEY,
    gde_industria   INTEGER REFERENCES fornecedores(for_codigo),
    gde_nome        VARCHAR(50),
    gde_desc1       DOUBLE PRECISION DEFAULT 0,
    gde_desc2       DOUBLE PRECISION DEFAULT 0,
    gde_desc3       DOUBLE PRECISION DEFAULT 0,
    gde_desc4       DOUBLE PRECISION DEFAULT 0,
    gde_desc5       DOUBLE PRECISION DEFAULT 0,
    gde_desc6       DOUBLE PRECISION DEFAULT 0,
    gde_desc7       DOUBLE PRECISION DEFAULT 0,
    gde_desc8       DOUBLE PRECISION DEFAULT 0,
    gde_desc9       DOUBLE PRECISION DEFAULT 0,
    gid             VARCHAR(38)
);

-- ── Produtos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cad_prod (
    pro_id                  SERIAL PRIMARY KEY,
    pro_industria           INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    pro_codprod             VARCHAR(25),
    pro_codigooriginal      VARCHAR(50),
    pro_codigonormalizado   VARCHAR(40),
    pro_nome                VARCHAR(100),
    pro_produtolancamento   BOOLEAN DEFAULT FALSE,
    pro_datalancamento      DATE,
    pro_curvaindustria      CHAR(1),
    pro_codbarras           VARCHAR(13),
    pro_grupo               INTEGER REFERENCES grupos(gru_codigo),
    pro_setor               VARCHAR(30),
    pro_linha               VARCHAR(50),
    pro_embalagem           INTEGER,
    pro_peso                DOUBLE PRECISION,
    pro_conversao           VARCHAR(300),
    pro_ncm                 VARCHAR(10),
    pro_aplicacao           VARCHAR(300),
    pro_aplicacao2          VARCHAR(800),
    pro_linhaleve           BOOLEAN DEFAULT FALSE,
    pro_linhapesada         BOOLEAN DEFAULT FALSE,
    pro_linhaagricola       BOOLEAN DEFAULT FALSE,
    pro_linhautilitarios    BOOLEAN DEFAULT FALSE,
    pro_offroad             BOOLEAN DEFAULT FALSE,
    pro_motocicletas        BOOLEAN DEFAULT FALSE,
    pro_origem              CHAR(1),
    pro_status              BOOLEAN DEFAULT TRUE,
    gid                     VARCHAR(38),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Tabelas de Preço ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cad_tabelaspre (
    itab_idprod         INTEGER NOT NULL REFERENCES cad_prod(pro_id),
    itab_industria      INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    itab_tabela         VARCHAR(20) NOT NULL,
    itab_grupodesconto  INTEGER REFERENCES grupo_desc(gde_id),
    itab_descontoadd    DOUBLE PRECISION DEFAULT 0,
    itab_ipi            DOUBLE PRECISION DEFAULT 0,
    itab_st             DOUBLE PRECISION DEFAULT 0,
    itab_prepeso        DOUBLE PRECISION DEFAULT 0,
    itab_precobruto     DOUBLE PRECISION DEFAULT 0,
    itab_precopromo     DOUBLE PRECISION DEFAULT 0,
    itab_precoespecial  DOUBLE PRECISION DEFAULT 0,
    itab_datatabela     DATE,
    itab_datavencimento DATE,
    itab_status         BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (itab_idprod, itab_tabela)
);

-- ── Pedidos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
    ped_numero          SERIAL PRIMARY KEY,
    ped_pedido          VARCHAR(15) UNIQUE,
    ped_tabela          VARCHAR(25),
    ped_data            DATE DEFAULT CURRENT_DATE,
    ped_datacad         DATE DEFAULT CURRENT_DATE,
    ped_horacad         VARCHAR(8),
    ped_industria       INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    ped_cliente         INTEGER NOT NULL REFERENCES clientes(cli_codigo),
    ped_transp          INTEGER REFERENCES transportadora(tra_codigo),
    ped_vendedor        INTEGER REFERENCES vendedores(ven_codigo),
    ped_cliind          VARCHAR(15),
    ped_situacao        VARCHAR(1) DEFAULT 'P',
    ped_condpag         VARCHAR(100),
    ped_tipofrete       VARCHAR(1) DEFAULT 'C',
    ped_comprador       VARCHAR(30),
    ped_emailcomp       VARCHAR(60),
    ped_fonecomp        VARCHAR(20),
    ped_pri             DOUBLE PRECISION DEFAULT 0,
    ped_seg             DOUBLE PRECISION DEFAULT 0,
    ped_ter             DOUBLE PRECISION DEFAULT 0,
    ped_qua             DOUBLE PRECISION DEFAULT 0,
    ped_qui             DOUBLE PRECISION DEFAULT 0,
    ped_sex             DOUBLE PRECISION DEFAULT 0,
    ped_set             DOUBLE PRECISION DEFAULT 0,
    ped_oit             DOUBLE PRECISION DEFAULT 0,
    ped_nov             DOUBLE PRECISION DEFAULT 0,
    ped_dez             DOUBLE PRECISION DEFAULT 0,
    ped_descadic        DOUBLE PRECISION DEFAULT 0,
    ped_coeficiente     DOUBLE PRECISION DEFAULT 1,
    ped_totbruto        DOUBLE PRECISION DEFAULT 0,
    ped_acrescimo       DOUBLE PRECISION DEFAULT 0,
    ped_totalipi        DOUBLE PRECISION DEFAULT 0,
    ped_valorst         DOUBLE PRECISION DEFAULT 0,
    ped_valorfrete      DOUBLE PRECISION DEFAULT 0,
    ped_totliq          DOUBLE PRECISION DEFAULT 0,
    ped_pesobruto       DOUBLE PRECISION DEFAULT 0,
    ped_pesoliquido     DOUBLE PRECISION DEFAULT 0,
    ped_volumes         INTEGER DEFAULT 0,
    ped_especie         VARCHAR(15),
    ped_marca           VARCHAR(15),
    ped_comissao        DOUBLE PRECISION DEFAULT 0,
    ped_percentual      DOUBLE PRECISION DEFAULT 0,
    ped_porgrupo        BOOLEAN DEFAULT FALSE,
    ped_tipocomissao    VARCHAR(1),
    ped_grupofreio      DOUBLE PRECISION DEFAULT 0,
    ped_grupooutro      DOUBLE PRECISION DEFAULT 0,
    ped_datafat         DATE,
    ped_numnf           VARCHAR(15),
    ped_numped          VARCHAR(15),
    ped_obs             TEXT,
    ped_obsind          VARCHAR(600),
    ped_ramoatv         VARCHAR(50),
    ped_obra_nome       VARCHAR(150),
    ped_obra_endereco   VARCHAR(200),
    ped_obra_contato    VARCHAR(100),
    ped_fase_projeto    VARCHAR(30),
    ped_area_m2         NUMERIC(15,2),
    ped_pe_direito      NUMERIC(6,2),
    ped_tipo_piso       VARCHAR(50),
    ped_obs_tecnicas    TEXT,
    gid                 VARCHAR(38),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Itens do Pedido ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_ped (
    ite_lancto          SERIAL PRIMARY KEY,
    ite_pedido          VARCHAR(15) NOT NULL REFERENCES pedidos(ped_pedido) ON DELETE CASCADE,
    ite_industria       INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    ite_seq             INTEGER DEFAULT 0,
    ite_produto         VARCHAR(25),
    ite_embuch          VARCHAR(15),
    ite_nomeprod        VARCHAR(100),
    ite_grupo           SMALLINT,
    ite_data            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ite_quant           DOUBLE PRECISION DEFAULT 0,
    ite_puni            DOUBLE PRECISION DEFAULT 0,
    ite_puniliq         DOUBLE PRECISION DEFAULT 0,
    ite_totliquido      DOUBLE PRECISION DEFAULT 0,
    ite_descadic        DOUBLE PRECISION DEFAULT 0,
    ite_des1            DOUBLE PRECISION DEFAULT 0,
    ite_des2            DOUBLE PRECISION DEFAULT 0,
    ite_des3            DOUBLE PRECISION DEFAULT 0,
    ite_des4            DOUBLE PRECISION DEFAULT 0,
    ite_des5            DOUBLE PRECISION DEFAULT 0,
    ite_des6            DOUBLE PRECISION DEFAULT 0,
    ite_des7            DOUBLE PRECISION DEFAULT 0,
    ite_des8            DOUBLE PRECISION DEFAULT 0,
    ite_des9            DOUBLE PRECISION DEFAULT 0,
    ite_des10           DOUBLE PRECISION DEFAULT 0,
    ite_des11           DOUBLE PRECISION DEFAULT 0,
    ite_descontos       VARCHAR(200),
    ite_totbruto        DOUBLE PRECISION DEFAULT 0,
    ite_valcomipi       DOUBLE PRECISION DEFAULT 0,
    ite_ipi             NUMERIC(7,2) DEFAULT 0,
    ite_st              DOUBLE PRECISION DEFAULT 0,
    ite_valcomst        DOUBLE PRECISION DEFAULT 0,
    ite_valtotal        DOUBLE PRECISION DEFAULT 0,
    ite_precokg         DOUBLE PRECISION DEFAULT 0,
    ite_pesoitem        DOUBLE PRECISION DEFAULT 0,
    ite_qtdfat          DOUBLE PRECISION DEFAULT 0,
    ite_qtddev          DOUBLE PRECISION DEFAULT 0,
    ite_saldo           DOUBLE PRECISION DEFAULT 0,
    ite_obs             VARCHAR(300),
    ite_bonificacao     BOOLEAN DEFAULT FALSE,
    ite_codbarras       VARCHAR(13),
    ite_ncm             VARCHAR(10),
    ite_cst             VARCHAR(3),
    ite_cfop            VARCHAR(4),
    ite_unidade         VARCHAR(6),
    ite_origem          CHAR(1),
    ite_dimensoes       VARCHAR(100),
    ite_acabamento      VARCHAR(100),
    ite_carga_kg        NUMERIC(15,2),
    ite_ambiente        VARCHAR(50),
    gid                 VARCHAR(38)
);

-- ── Faturamento ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fatura_ped (
    fat_lancto       SERIAL PRIMARY KEY,
    fat_pedido       VARCHAR(15) NOT NULL REFERENCES pedidos(ped_pedido),
    fat_industria    INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    fat_datafat      DATE DEFAULT CURRENT_DATE,
    fat_valorfat     DOUBLE PRECISION DEFAULT 0,
    fat_nf           VARCHAR(10),
    fat_obs          VARCHAR(100),
    fat_percent      NUMERIC(5,2) DEFAULT 0,
    fat_comissao     NUMERIC(9,2) DEFAULT 0,
    fat_percomissind CHAR(1) DEFAULT 'E',
    gid              VARCHAR(38),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Cliente x Indústria (condições comerciais) ───────────────
CREATE TABLE IF NOT EXISTS cli_ind (
    cli_lancamento      SERIAL PRIMARY KEY,
    cli_codigo          INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
    cli_forcodigo       INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    cli_desc1           NUMERIC(10,2) DEFAULT 0,
    cli_desc2           NUMERIC(10,2) DEFAULT 0,
    cli_desc3           NUMERIC(10,2) DEFAULT 0,
    cli_desc4           NUMERIC(10,2) DEFAULT 0,
    cli_desc5           NUMERIC(10,2) DEFAULT 0,
    cli_desc6           NUMERIC(10,2) DEFAULT 0,
    cli_desc7           NUMERIC(10,2) DEFAULT 0,
    cli_desc8           NUMERIC(10,2) DEFAULT 0,
    cli_desc9           NUMERIC(10,2) DEFAULT 0,
    cli_desc10          NUMERIC(10,2) DEFAULT 0,
    cli_desc11          NUMERIC(10,2) DEFAULT 0,
    cli_transportadora  INTEGER REFERENCES fornecedores(for_codigo),
    cli_prazopg         VARCHAR(100),
    cli_ipi             VARCHAR(10),
    cli_tabela          VARCHAR(50),
    cli_codcliind       VARCHAR(100),
    cli_obsparticular   TEXT,
    cli_comprador       VARCHAR(100),
    cli_frete           VARCHAR(50),
    cli_emailcomprador  VARCHAR(200),
    cli_grupodesc       INTEGER REFERENCES grupo_desc(gde_id)
);

-- ── Descontos por Grupo de Produto do Cliente ─────────────────
CREATE TABLE IF NOT EXISTS cli_descpro (
    cli_codigo      INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
    cli_forcodigo   INTEGER NOT NULL REFERENCES fornecedores(for_codigo),
    cli_grupo       INTEGER NOT NULL REFERENCES grupos(gru_codigo),
    cli_desc1       DOUBLE PRECISION DEFAULT 0,
    cli_desc2       DOUBLE PRECISION DEFAULT 0,
    cli_desc3       DOUBLE PRECISION DEFAULT 0,
    cli_desc4       DOUBLE PRECISION DEFAULT 0,
    cli_desc5       DOUBLE PRECISION DEFAULT 0,
    cli_desc6       DOUBLE PRECISION DEFAULT 0,
    cli_desc7       DOUBLE PRECISION DEFAULT 0,
    cli_desc8       DOUBLE PRECISION DEFAULT 0,
    cli_desc9       DOUBLE PRECISION DEFAULT 0,
    gid             VARCHAR(38),
    PRIMARY KEY (cli_codigo, cli_forcodigo, cli_grupo)
);

-- ── Usuários do Tenant ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_nomes (
    usr_id       SERIAL PRIMARY KEY,
    usr_usuario  VARCHAR(50) NOT NULL UNIQUE,
    usr_senha    VARCHAR(200) NOT NULL,
    usr_nome     VARCHAR(200),
    usr_email    VARCHAR(200),
    usr_nivel    INTEGER DEFAULT 1,
    usr_ativo    BOOLEAN DEFAULT TRUE,
    gid          VARCHAR(38),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Contatos da Indústria ────────────────────────────────────
CREATE TABLE IF NOT EXISTS contato_for (
    con_codigo              SERIAL PRIMARY KEY,
    con_fornec              INTEGER NOT NULL REFERENCES fornecedores(for_codigo) ON DELETE CASCADE,
    con_nome                VARCHAR(60),
    con_cargo               VARCHAR(50),
    con_telefone            VARCHAR(20),
    con_celular             VARCHAR(20),
    con_email               VARCHAR(100),
    con_dtnasc              DATE,
    con_obs                 VARCHAR(300),
    con_timequetorce        VARCHAR(50),
    con_esportepreferido    VARCHAR(50),
    con_hobby               VARCHAR(100),
    gid                     VARCHAR(38)
);

-- ── Metas Anuais por Indústria ───────────────────────────────
CREATE TABLE IF NOT EXISTS ind_metas (
    met_codigo      SERIAL PRIMARY KEY,
    met_industria   INTEGER NOT NULL REFERENCES fornecedores(for_codigo) ON DELETE CASCADE,
    met_ano         INTEGER NOT NULL,
    met_jan         NUMERIC DEFAULT 0,
    met_fev         NUMERIC DEFAULT 0,
    met_mar         NUMERIC DEFAULT 0,
    met_abr         NUMERIC DEFAULT 0,
    met_mai         NUMERIC DEFAULT 0,
    met_jun         NUMERIC DEFAULT 0,
    met_jul         NUMERIC DEFAULT 0,
    met_ago         NUMERIC DEFAULT 0,
    met_set         NUMERIC DEFAULT 0,
    met_out         NUMERIC DEFAULT 0,
    met_nov         NUMERIC DEFAULT 0,
    met_dez         NUMERIC DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (met_industria, met_ano)
);

-- ── Conhecimento IA por Indústria ────────────────────────────
CREATE TABLE IF NOT EXISTS ia_conhecimento (
    id              SERIAL PRIMARY KEY,
    for_codigo      INTEGER REFERENCES fornecedores(for_codigo) ON DELETE CASCADE,
    nome_marca      TEXT NOT NULL,
    palavras_chave  TEXT,
    resumo_negocio  TEXT,
    persona_ia      TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (for_codigo)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fornecedores_tipo2      ON fornecedores(for_tipo2);
CREATE INDEX IF NOT EXISTS idx_vendedores_status       ON vendedores(ven_status);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj           ON clientes(cli_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_situacao       ON clientes(cli_situacao);
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor       ON clientes(cli_vendedor);
CREATE INDEX IF NOT EXISTS idx_cli_ind_cliente         ON cli_ind(cli_codigo);
CREATE INDEX IF NOT EXISTS idx_cli_ind_fornecedor      ON cli_ind(cli_forcodigo);
CREATE INDEX IF NOT EXISTS idx_cli_aniv_cliente        ON cli_aniv(ani_cliente);
CREATE INDEX IF NOT EXISTS idx_cli_descpro_cliente     ON cli_descpro(cli_codigo);
CREATE INDEX IF NOT EXISTS idx_atua_cli_cliente        ON atua_cli(atu_idcli);
CREATE INDEX IF NOT EXISTS idx_grupos_industria        ON grupos(gru_industria);
CREATE INDEX IF NOT EXISTS idx_grupo_desc_industria    ON grupo_desc(gde_industria);
CREATE INDEX IF NOT EXISTS idx_cad_prod_industria      ON cad_prod(pro_industria);
CREATE INDEX IF NOT EXISTS idx_cad_prod_codprod        ON cad_prod(pro_codprod);
CREATE INDEX IF NOT EXISTS idx_cad_tabelaspre_ind      ON cad_tabelaspre(itab_industria);
CREATE INDEX IF NOT EXISTS idx_pedidos_industria       ON pedidos(ped_industria);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente         ON pedidos(ped_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor        ON pedidos(ped_vendedor);
CREATE INDEX IF NOT EXISTS idx_pedidos_situacao        ON pedidos(ped_situacao);
CREATE INDEX IF NOT EXISTS idx_pedidos_data            ON pedidos(ped_data);
CREATE INDEX IF NOT EXISTS idx_itens_pedido            ON itens_ped(ite_pedido);
CREATE INDEX IF NOT EXISTS idx_itens_industria         ON itens_ped(ite_industria);
CREATE INDEX IF NOT EXISTS idx_fatura_pedido           ON fatura_ped(fat_pedido);
CREATE INDEX IF NOT EXISTS idx_fatura_industria        ON fatura_ped(fat_industria);
CREATE INDEX IF NOT EXISTS idx_contato_for_fornec      ON contato_for(con_fornec);
CREATE INDEX IF NOT EXISTS idx_ind_metas_industria     ON ind_metas(met_industria);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_for     ON ia_conhecimento(for_codigo);
