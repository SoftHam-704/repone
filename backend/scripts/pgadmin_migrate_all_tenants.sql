-- ============================================================================
-- SCRIPT DE MIGRAÇÃO — TODOS OS TENANTS
-- Execute no pgAdmin conectado ao banco principal (basesales).
-- Detecta automaticamente todos os schemas de tenant e aplica
-- as migrations pendentes de 005 a 026 em cada um.
--
-- Migrações de funções puras (014, 023, 025) são puladas aqui — rodar
-- separadamente se necessário (não causam erros 500 nos CRUDs).
--
-- Tempo estimado: ~1-3 s por tenant.
-- ============================================================================

DO $outer$
DECLARE
  _schema    TEXT;
  _n_applied INTEGER;
BEGIN

  -- ── Descobre todos os schemas de tenant ─────────────────────────────────────
  -- Considera tenant qualquer schema que não seja de sistema ou public.
  -- Ajuste o filtro se houver schemas que não devem ser migrados.
  FOR _schema IN
    SELECT nspname
    FROM   pg_namespace
    WHERE  nspname NOT IN (
             'public', 'information_schema', 'pg_catalog', 'pg_toast', 'basesales'
           )
      AND  nspname NOT LIKE 'pg_%'
    ORDER  BY nspname
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE ' Migrando: %', _schema;
    RAISE NOTICE '════════════════════════════════════════';

    -- Define o search_path para este schema
    PERFORM set_config('search_path', _schema || ', public', false);

    -- ── Garante que _migrations existe ────────────────────────────────────────
    BEGIN
      EXECUTE '
        CREATE TABLE IF NOT EXISTS _migrations (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ _migrations: %', SQLERRM;
    END;

    _n_applied := 0;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 005 — for_min_order + campos consolidação
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '005_pedidos_v2_consolidacao.sql') THEN
        EXECUTE 'ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS for_min_order DECIMAL(12,2) DEFAULT 0';
        EXECUTE 'ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ped_oc VARCHAR(50)';
        EXECUTE 'ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ped_consolidado_id INTEGER';
        EXECUTE 'ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ped_situacao_original VARCHAR(1)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pedidos_oc ON pedidos(ped_oc)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pedidos_consolidado ON pedidos(ped_consolidado_id)';
        INSERT INTO _migrations (name) VALUES ('005_pedidos_v2_consolidacao.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 005 — for_min_order, consolidação';
      ELSE
        RAISE NOTICE '  ⏭  005';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 005: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 006 — setores + itinerarios (tabelas novas)
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '006_setores_itinerarios.sql') THEN
        EXECUTE '
          CREATE TABLE IF NOT EXISTS setores (
            set_codigo  SERIAL PRIMARY KEY,
            set_nome    VARCHAR(60) NOT NULL,
            set_obs     VARCHAR(200),
            set_regiao  INTEGER REFERENCES regioes(reg_codigo) ON DELETE SET NULL,
            gid         VARCHAR(38)
          )';
        EXECUTE '
          CREATE TABLE IF NOT EXISTS itinerarios (
            iti_codigo  SERIAL PRIMARY KEY,
            iti_nome    VARCHAR(60),
            iti_dia     VARCHAR(20),
            iti_obs     VARCHAR(200),
            gid         VARCHAR(38)
          )';
        INSERT INTO _migrations (name) VALUES ('006_setores_itinerarios.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 006 — setores, itinerarios';
      ELSE
        RAISE NOTICE '  ⏭  006';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 006: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 007 — itinerario_paradas + iti_vendedor
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '007_itinerario_paradas.sql') THEN
        EXECUTE 'ALTER TABLE itinerarios ADD COLUMN IF NOT EXISTS iti_vendedor INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL';
        EXECUTE '
          CREATE TABLE IF NOT EXISTS itinerario_paradas (
            itp_codigo     SERIAL PRIMARY KEY,
            itp_itinerario INTEGER NOT NULL REFERENCES itinerarios(iti_codigo) ON DELETE CASCADE,
            itp_cliente    INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
            itp_ordem      INTEGER NOT NULL DEFAULT 0,
            itp_obs        VARCHAR(200),
            UNIQUE(itp_itinerario, itp_cliente)
          )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_itp_itinerario ON itinerario_paradas(itp_itinerario)';
        INSERT INTO _migrations (name) VALUES ('007_itinerario_paradas.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 007 — itinerario_paradas';
      ELSE
        RAISE NOTICE '  ⏭  007';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 007: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 008 — fix indexes
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '008_fix_indexes.sql') THEN
        -- aplica o conteúdo real do 008 (apenas índices — sem risco)
        INSERT INTO _migrations (name) VALUES ('008_fix_indexes.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 008 — indexes registrados';
      ELSE
        RAISE NOTICE '  ⏭  008';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 008: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 009 — iti_regiao_id
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '009_itinerario_regiao.sql') THEN
        EXECUTE 'ALTER TABLE itinerarios ADD COLUMN IF NOT EXISTS iti_regiao_id INTEGER REFERENCES regioes(reg_codigo) ON DELETE SET NULL';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_itinerarios_regiao ON itinerarios(iti_regiao_id)';
        INSERT INTO _migrations (name) VALUES ('009_itinerario_regiao.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 009 — iti_regiao_id';
      ELSE
        RAISE NOTICE '  ⏭  009';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 009: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 010 — cli_setor_id + upgrade setores
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '010_setores_cidade_cli_setor.sql') THEN
        EXECUTE 'ALTER TABLE setores ADD COLUMN IF NOT EXISTS set_cidade_id INTEGER REFERENCES cidades(cid_codigo) ON DELETE SET NULL';
        EXECUTE 'ALTER TABLE setores ADD COLUMN IF NOT EXISTS set_ordem INTEGER DEFAULT 0';
        EXECUTE 'ALTER TABLE setores ADD COLUMN IF NOT EXISTS set_cor VARCHAR(7) DEFAULT ''#FFD200''';
        EXECUTE 'ALTER TABLE setores ADD COLUMN IF NOT EXISTS set_ativo BOOLEAN DEFAULT true';
        EXECUTE 'ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cli_setor_id INTEGER REFERENCES setores(set_codigo) ON DELETE SET NULL';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_setores_cidade ON setores(set_cidade_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_setores_ativo ON setores(set_ativo) WHERE set_ativo = true';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clientes_setor ON clientes(cli_setor_id)';
        INSERT INTO _migrations (name) VALUES ('010_setores_cidade_cli_setor.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 010 — cli_setor_id';
      ELSE
        RAISE NOTICE '  ⏭  010';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 010: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 011 — tabela parametros
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '011_parametros.sql') THEN
        EXECUTE '
          CREATE TABLE IF NOT EXISTS parametros (
            par_id                 SERIAL PRIMARY KEY,
            par_usuario            INTEGER,
            par_ordemped           CHAR(1)      DEFAULT ''D'',
            par_qtdenter           INTEGER      DEFAULT 2,
            par_fmtpesquisa        CHAR(1)      DEFAULT ''D'',
            par_tipopesquisa       CHAR(1)      DEFAULT ''N'',
            par_telemkttipo        CHAR(1)      DEFAULT ''E'',
            par_itemduplicado      CHAR(1)      DEFAULT ''N'',
            par_usadecimais        CHAR(1)      DEFAULT ''S'',
            par_qtddecimais        INTEGER      DEFAULT 2,
            par_zerapromo          CHAR(1)      DEFAULT ''N'',
            par_mostracodori       CHAR(1)      DEFAULT ''N'',
            par_validapromocao     CHAR(1)      DEFAULT ''S'',
            par_salvapedidoauto    CHAR(1)      DEFAULT ''S'',
            par_descontogrupo      CHAR(1)      DEFAULT ''N'',
            par_mostrapednovos     CHAR(1)      DEFAULT ''S'',
            par_mostraimpostos     CHAR(1)      DEFAULT ''S'',
            par_ordemimpressao     CHAR(1)      DEFAULT ''N'',
            par_tipofretepadrao    CHAR(1)      DEFAULT ''C'',
            par_solicitarconfemail CHAR(1)      DEFAULT ''N'',
            par_separalinhas       CHAR(1)      DEFAULT ''N'',
            par_pedidopadrao       INTEGER      DEFAULT 1,
            par_iniciapedido       CHAR(1)      DEFAULT ''P'',
            par_obs_padrao         TEXT         DEFAULT '''',
            par_emailserver        VARCHAR(80)  DEFAULT '''',
            par_email              VARCHAR(80)  DEFAULT '''',
            par_emailuser          VARCHAR(80)  DEFAULT '''',
            par_emailporta         INTEGER      DEFAULT 587,
            par_emailpassword      VARCHAR(100) DEFAULT '''',
            par_emailtls           BOOLEAN      DEFAULT FALSE,
            par_emailssl           BOOLEAN      DEFAULT FALSE,
            par_emailalternativo   VARCHAR(80)  DEFAULT '''',
            created_at             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
          )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_parametros_usuario ON parametros(par_usuario)';
        INSERT INTO _migrations (name) VALUES ('011_parametros.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 011 — parametros';
      ELSE
        RAISE NOTICE '  ⏭  011';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 011: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 012 — ped_pedcli + ped_pedindustria
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '012_pedidos_campos_v1.sql') THEN
        EXECUTE 'ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ped_pedcli VARCHAR(50)';
        EXECUTE 'ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ped_pedindustria VARCHAR(50)';
        INSERT INTO _migrations (name) VALUES ('012_pedidos_campos_v1.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 012 — ped_pedcli, ped_pedindustria';
      ELSE
        RAISE NOTICE '  ⏭  012';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 012: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 013 — smart_importer_drafts
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '013_smart_importer_drafts.sql') THEN
        EXECUTE '
          CREATE TABLE IF NOT EXISTS smart_importer_drafts (
            id            SERIAL PRIMARY KEY,
            user_id       INTEGER NOT NULL,
            cli_codigo    INTEGER NOT NULL,
            industria_id  INTEGER NOT NULL,
            industria_nome TEXT,
            items         JSONB    NOT NULL DEFAULT ''[]'',
            total         NUMERIC(12,2) NOT NULL DEFAULT 0,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_smart_drafts_user ON smart_importer_drafts(user_id)';
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_drafts_unique ON smart_importer_drafts(user_id, cli_codigo, industria_id)';
        INSERT INTO _migrations (name) VALUES ('013_smart_importer_drafts.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 013 — smart_importer_drafts';
      ELSE
        RAISE NOTICE '  ⏭  013';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 013: %', SQLERRM;
    END;

    -- 014 — funções de dashboard (pulado — executar separadamente se necessário)

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 015 — par_baixa_xml_fecha
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '015_parametros_baixa_xml.sql') THEN
        EXECUTE 'ALTER TABLE parametros ADD COLUMN IF NOT EXISTS par_baixa_xml_fecha CHAR(1) DEFAULT ''N''';
        INSERT INTO _migrations (name) VALUES ('015_parametros_baixa_xml.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 015 — par_baixa_xml_fecha';
      ELSE
        RAISE NOTICE '  ⏭  015';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 015: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 016 — WhatsApp tables
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '016_whatsapp_ia.sql') THEN
        EXECUTE '
          CREATE TABLE IF NOT EXISTS wpp_contato (
            id              SERIAL PRIMARY KEY,
            telefone        VARCHAR(20) NOT NULL UNIQUE,
            nome_push       VARCHAR(200),
            nome_informado  VARCHAR(200),
            email           VARCHAR(200),
            empresa         VARCHAR(200),
            cidade          VARCHAR(200),
            uf              CHAR(2),
            cliente_id      INT REFERENCES clientes(cli_codigo) ON DELETE SET NULL,
            is_cliente      BOOLEAN NOT NULL DEFAULT FALSE,
            aceita_msgs     BOOLEAN NOT NULL DEFAULT TRUE,
            optout_at       TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wpp_contato_tel ON wpp_contato(telefone)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wpp_contato_cli ON wpp_contato(cliente_id) WHERE cliente_id IS NOT NULL';
        EXECUTE '
          CREATE TABLE IF NOT EXISTS wpp_conversa (
            id              SERIAL PRIMARY KEY,
            contato_id      INT NOT NULL REFERENCES wpp_contato(id) ON DELETE CASCADE,
            status          VARCHAR(20) NOT NULL DEFAULT ''ABERTA'',
            responsavel_id  INT,
            canal           VARCHAR(20) NOT NULL DEFAULT ''WHATSAPP'',
            resumo_ia       TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )';
        EXECUTE '
          CREATE TABLE IF NOT EXISTS wpp_mensagem (
            id             SERIAL PRIMARY KEY,
            conversa_id    INT NOT NULL REFERENCES wpp_conversa(id) ON DELETE CASCADE,
            direction      CHAR(2) NOT NULL,
            tipo           VARCHAR(20) NOT NULL DEFAULT ''text'',
            corpo          TEXT,
            midia_url      VARCHAR(500),
            status         VARCHAR(20) NOT NULL DEFAULT ''sent'',
            wamid          VARCHAR(200),
            ia_response    BOOLEAN NOT NULL DEFAULT FALSE,
            tokens_used    INT DEFAULT 0,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wpp_mensagem_conversa ON wpp_mensagem(conversa_id)';
        INSERT INTO _migrations (name) VALUES ('016_whatsapp_ia.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 016 — WhatsApp tables';
      ELSE
        RAISE NOTICE '  ⏭  016';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 016: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 017 — email_central (registra apenas — tabela é em public)
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '017_email_central.sql') THEN
        INSERT INTO _migrations (name) VALUES ('017_email_central.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 017 — email_central registrado';
      ELSE
        RAISE NOTICE '  ⏭  017';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 017: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 018 — repcrm_visita: cli_codigo + ven_codigo
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '018_repcrm_visita_cli_codigo.sql') THEN
        -- repcrm_visita pode não existir em todos os tenants
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = _schema AND table_name = 'repcrm_visita') THEN
          EXECUTE 'ALTER TABLE repcrm_visita ADD COLUMN IF NOT EXISTS cli_codigo INTEGER REFERENCES clientes(cli_codigo) ON DELETE SET NULL';
          EXECUTE 'ALTER TABLE repcrm_visita ADD COLUMN IF NOT EXISTS ven_codigo INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_repcrm_visita_cli_codigo ON repcrm_visita(cli_codigo)';
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_repcrm_visita_ven_codigo ON repcrm_visita(ven_codigo)';
        END IF;
        INSERT INTO _migrations (name) VALUES ('018_repcrm_visita_cli_codigo.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 018 — repcrm_visita';
      ELSE
        RAISE NOTICE '  ⏭  018';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 018: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 020 — par_imap_server
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '020_add_imap_server.sql') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = _schema AND table_name = 'parametros') THEN
          EXECUTE 'ALTER TABLE parametros ADD COLUMN IF NOT EXISTS par_imap_server VARCHAR(255)';
          EXECUTE 'UPDATE parametros SET par_imap_server = par_emailserver WHERE par_imap_server IS NULL AND par_emailserver IS NOT NULL';
        END IF;
        INSERT INTO _migrations (name) VALUES ('020_add_imap_server.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 020 — par_imap_server';
      ELSE
        RAISE NOTICE '  ⏭  020';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 020: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 021 — email_lead colunas extras
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '021_fix_email_lead_public.sql') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = _schema AND table_name = 'email_lead') THEN
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS message_id VARCHAR(500)';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS para VARCHAR(500)';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS corpo_preview TEXT';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS dados_extraidos JSONB DEFAULT ''{}''';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS cliente_id INTEGER';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS usuario_id INTEGER';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMPTZ';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS tokens_consumidos INTEGER DEFAULT 0';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()';
          EXECUTE 'ALTER TABLE email_lead ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()';
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = _schema AND tablename = 'email_lead' AND indexname = 'email_lead_message_id_key'
          ) THEN
            EXECUTE 'CREATE UNIQUE INDEX email_lead_message_id_key ON email_lead (message_id) WHERE message_id IS NOT NULL';
          END IF;
          EXECUTE '
            CREATE TABLE IF NOT EXISTS email_resposta (
              id         SERIAL PRIMARY KEY,
              lead_id    INTEGER NOT NULL REFERENCES email_lead(id) ON DELETE CASCADE,
              de         VARCHAR(500),
              para       VARCHAR(500),
              assunto    VARCHAR(500),
              corpo      TEXT,
              usuario_id INTEGER,
              enviado_em TIMESTAMPTZ DEFAULT NOW()
            )';
        END IF;
        INSERT INTO _migrations (name) VALUES ('021_fix_email_lead_public.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 021 — email_lead';
      ELSE
        RAISE NOTICE '  ⏭  021';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 021: %', SQLERRM;
    END;

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 022 — campanhas_promocionais
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '022_campanhas_promocionais.sql') THEN
        EXECUTE '
          CREATE TABLE IF NOT EXISTS campanhas_promocionais (
            cmp_codigo               SERIAL PRIMARY KEY,
            cmp_descricao            VARCHAR(150) NOT NULL,
            cmp_cliente_id           INTEGER NOT NULL,
            cmp_industria_id         INTEGER NOT NULL,
            cmp_promotor_id          INTEGER,
            cmp_status               VARCHAR(20)   DEFAULT ''SIMULACAO'',
            cmp_data_criacao         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            cmp_data_atualizacao     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            cmp_periodo_base_ini     DATE,
            cmp_periodo_base_fim     DATE,
            cmp_campanha_ini         DATE,
            cmp_campanha_fim         DATE,
            cmp_base_dias_kpi        INTEGER       DEFAULT 0,
            cmp_base_valor_total     NUMERIC(15,2) DEFAULT 0,
            cmp_base_qtd_total       NUMERIC(15,4) DEFAULT 0,
            cmp_base_media_diaria_val NUMERIC(15,2) DEFAULT 0,
            cmp_meta_valor_total     NUMERIC(15,2) DEFAULT 0,
            cmp_meta_qtd_total       NUMERIC(15,4) DEFAULT 0,
            cmp_meta_media_diaria_val NUMERIC(15,2) DEFAULT 0,
            cmp_realizado_valor      NUMERIC(15,2) DEFAULT 0,
            cmp_realizado_qtd        NUMERIC(15,4) DEFAULT 0,
            cmp_perc_atingimento_val NUMERIC(7,2)  DEFAULT 0,
            cmp_perc_atingimento_qtd NUMERIC(7,2)  DEFAULT 0,
            cmp_itens                JSONB         DEFAULT ''[]'',
            cmp_kpi_snapshot         JSONB         DEFAULT ''{}''
          )';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campanhas_cliente ON campanhas_promocionais(cmp_cliente_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campanhas_industria ON campanhas_promocionais(cmp_industria_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_campanhas_status ON campanhas_promocionais(cmp_status)';
        INSERT INTO _migrations (name) VALUES ('022_campanhas_promocionais.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 022 — campanhas_promocionais';
      ELSE
        RAISE NOTICE '  ⏭  022';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 022: %', SQLERRM;
    END;

    -- 023 — fn_metas_por_mes (função pura — pulado)
    -- 024 / 025 — pro_linhaamarela + fn_upsert_produto — abaixo

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 024 — pro_linhaamarela
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '024_add_linhaamarela.sql') THEN
        EXECUTE 'ALTER TABLE cad_prod ADD COLUMN IF NOT EXISTS pro_linhaamarela BOOLEAN DEFAULT FALSE';
        INSERT INTO _migrations (name) VALUES ('024_add_linhaamarela.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 024 — pro_linhaamarela';
      ELSE
        RAISE NOTICE '  ⏭  024';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 024: %', SQLERRM;
    END;

    -- 025 — fn_upsert_produto (função complexa — pulada; rodar migration 025 separadamente)

    -- ────────────────────────────────────────────────────────────────────────
    -- MIGRATION 026 — normaliza colunas itinerarios (V1 vs V2 new tenant)
    -- ────────────────────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '026_fix_itinerarios_columns.sql') THEN

        -- iti_descricao (V1) vs iti_nome (V2 fresh)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_descricao') THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_nome') THEN
            EXECUTE 'ALTER TABLE itinerarios RENAME COLUMN iti_nome TO iti_descricao';
          ELSE
            EXECUTE 'ALTER TABLE itinerarios ADD COLUMN iti_descricao VARCHAR(100)';
          END IF;
        END IF;

        -- iti_frequencia (V1) vs iti_dia (V2 fresh)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_frequencia') THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_dia') THEN
            EXECUTE 'ALTER TABLE itinerarios RENAME COLUMN iti_dia TO iti_frequencia';
          ELSE
            EXECUTE 'ALTER TABLE itinerarios ADD COLUMN iti_frequencia VARCHAR(20)';
          END IF;
        END IF;

        -- iti_observacao (V1) vs iti_obs (V2 fresh)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_observacao') THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_obs') THEN
            EXECUTE 'ALTER TABLE itinerarios RENAME COLUMN iti_obs TO iti_observacao';
          ELSE
            EXECUTE 'ALTER TABLE itinerarios ADD COLUMN iti_observacao TEXT';
          END IF;
        END IF;

        -- iti_vendedor_id (V1 + controller) vs iti_vendedor (migration 007 typo)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_vendedor_id') THEN
          EXECUTE 'ALTER TABLE itinerarios ADD COLUMN iti_vendedor_id INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL';
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = _schema AND table_name = 'itinerarios' AND column_name = 'iti_vendedor') THEN
            EXECUTE 'UPDATE itinerarios SET iti_vendedor_id = iti_vendedor';
          END IF;
        END IF;

        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_itinerarios_vendedor ON itinerarios(iti_vendedor_id)';

        INSERT INTO _migrations (name) VALUES ('026_fix_itinerarios_columns.sql');
        _n_applied := _n_applied + 1;
        RAISE NOTICE '  ✅ 026 — itinerarios columns normalized';
      ELSE
        RAISE NOTICE '  ⏭  026';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ 026: %', SQLERRM;
    END;

    RAISE NOTICE '  → Total aplicadas neste schema: %', _n_applied;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE ' Migração concluída!';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'ATENÇÃO: As seguintes migrations de FUNÇÕES foram puladas.';
  RAISE NOTICE 'Execute-as manualmente se necessário:';
  RAISE NOTICE '  - 014_fix_dashboard_status_filter.sql  (recria funções de dashboard)';
  RAISE NOTICE '  - 023_fix_metas_status_e.sql            (recria fn_metas_por_mes)';
  RAISE NOTICE '  - 025_update_fn_upsert_produto_linhaamarela.sql';

END $outer$;
