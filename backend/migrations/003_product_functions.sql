-- ============================================================
-- Migration 003: Funções críticas de Produtos e Tabelas de Preço
-- Ficam no schema public e são acessíveis por todos os tenants
-- via search_path configurado pelo middleware de tenant.
-- ============================================================

-- ─── fn_normalizar_codigo ────────────────────────────────────────────────────
-- SOBRESCREVE a versão da 002 (que só removia zeros à esquerda).
-- Remove tudo que não for alfanumérico e converte para uppercase.
-- É a base do UPSERT: garante que "ABC-123", "abc 123" e "ABC123"
-- sejam tratados como o mesmo produto.
CREATE OR REPLACE FUNCTION fn_normalizar_codigo(p_codigo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_codigo IS NULL OR TRIM(p_codigo) = '' THEN
        RETURN NULL;
    END IF;
    RETURN UPPER(REGEXP_REPLACE(TRIM(p_codigo), '[^A-Z0-9]', '', 'g'));
END;
$$;


-- ─── fn_upsert_produto ───────────────────────────────────────────────────────
-- Tenta UPDATE. Se nenhuma linha afetada, faz INSERT.
-- Usa COALESCE para nunca sobrescrever dados existentes com NULL/vazio.
-- Retorna pro_id do produto criado ou atualizado.
CREATE OR REPLACE FUNCTION fn_upsert_produto(
    p_industria        INTEGER,
    p_codprod          TEXT,
    p_nome             TEXT,
    p_peso             DOUBLE PRECISION DEFAULT NULL,
    p_embalagem        INTEGER          DEFAULT NULL,
    p_grupo            INTEGER          DEFAULT NULL,
    p_setor            TEXT             DEFAULT NULL,
    p_linha            TEXT             DEFAULT NULL,
    p_ncm              TEXT             DEFAULT NULL,
    p_origem           CHAR(1)          DEFAULT NULL,
    p_aplicacao        TEXT             DEFAULT NULL,
    p_codbarras        TEXT             DEFAULT NULL,
    p_conversao        TEXT             DEFAULT NULL,
    p_linhaleve        BOOLEAN          DEFAULT NULL,
    p_linhapesada      BOOLEAN          DEFAULT NULL,
    p_linhaagricola    BOOLEAN          DEFAULT NULL,
    p_linhautilitarios BOOLEAN          DEFAULT NULL,
    p_motocicletas     BOOLEAN          DEFAULT NULL,
    p_offroad          BOOLEAN          DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pro_id             INTEGER;
    v_codigo_normalizado TEXT;
BEGIN
    v_codigo_normalizado := fn_normalizar_codigo(p_codprod);

    IF v_codigo_normalizado IS NULL THEN
        RAISE EXCEPTION 'Código do produto não pode ser vazio.';
    END IF;

    -- Tenta atualizar o produto existente
    UPDATE cad_prod SET
        pro_nome             = COALESCE(NULLIF(TRIM(p_nome), ''),         pro_nome),
        pro_peso             = COALESCE(NULLIF(p_peso, 0),                pro_peso),
        pro_embalagem        = COALESCE(p_embalagem,                      pro_embalagem),
        pro_grupo            = COALESCE(p_grupo,                          pro_grupo),
        pro_setor            = COALESCE(NULLIF(TRIM(p_setor), ''),        pro_setor),
        pro_linha            = COALESCE(NULLIF(TRIM(p_linha), ''),        pro_linha),
        pro_ncm              = COALESCE(NULLIF(TRIM(p_ncm), ''),          pro_ncm),
        pro_origem           = COALESCE(p_origem,                         pro_origem),
        pro_aplicacao        = COALESCE(NULLIF(TRIM(p_aplicacao), ''),    pro_aplicacao),
        pro_codbarras        = COALESCE(NULLIF(TRIM(p_codbarras), ''),    pro_codbarras),
        pro_conversao        = COALESCE(NULLIF(TRIM(p_conversao), ''),    pro_conversao),
        pro_linhaleve        = COALESCE(p_linhaleve,                      pro_linhaleve),
        pro_linhapesada      = COALESCE(p_linhapesada,                    pro_linhapesada),
        pro_linhaagricola    = COALESCE(p_linhaagricola,                  pro_linhaagricola),
        pro_linhautilitarios = COALESCE(p_linhautilitarios,               pro_linhautilitarios),
        pro_motocicletas     = COALESCE(p_motocicletas,                   pro_motocicletas),
        pro_offroad          = COALESCE(p_offroad,                        pro_offroad)
    WHERE pro_industria         = p_industria
      AND pro_codigonormalizado = v_codigo_normalizado
    RETURNING pro_id INTO v_pro_id;

    -- Se não existia, insere
    IF v_pro_id IS NULL THEN
        INSERT INTO cad_prod (
            pro_industria, pro_codprod, pro_codigonormalizado,
            pro_nome, pro_peso, pro_embalagem, pro_grupo,
            pro_setor, pro_linha, pro_ncm, pro_origem,
            pro_aplicacao, pro_codbarras, pro_conversao,
            pro_linhaleve, pro_linhapesada, pro_linhaagricola,
            pro_linhautilitarios, pro_motocicletas, pro_offroad,
            pro_status
        ) VALUES (
            p_industria, p_codprod, v_codigo_normalizado,
            p_nome, p_peso, p_embalagem, p_grupo,
            p_setor, p_linha, p_ncm, p_origem,
            p_aplicacao, p_codbarras, p_conversao,
            COALESCE(p_linhaleve,        false),
            COALESCE(p_linhapesada,      false),
            COALESCE(p_linhaagricola,    false),
            COALESCE(p_linhautilitarios, false),
            COALESCE(p_motocicletas,     false),
            COALESCE(p_offroad,          false),
            true
        )
        RETURNING pro_id INTO v_pro_id;
    END IF;

    RETURN v_pro_id;
END;
$$;


-- ─── fn_upsert_preco ─────────────────────────────────────────────────────────
-- INSERT com ON CONFLICT na chave composta (itab_idprod, itab_tabela).
-- COALESCE no DO UPDATE garante que preços existentes não sejam zerados
-- acidentalmente ao importar um item sem preço promo/especial.
CREATE OR REPLACE FUNCTION fn_upsert_preco(
    p_pro_id         INTEGER,
    p_industria      INTEGER,
    p_tabela         TEXT,
    p_precobruto     DOUBLE PRECISION,
    p_precopromo     DOUBLE PRECISION    DEFAULT NULL,
    p_precoespecial  DOUBLE PRECISION    DEFAULT NULL,
    p_ipi            DOUBLE PRECISION    DEFAULT 0,
    p_st             DOUBLE PRECISION    DEFAULT 0,
    p_grupodesconto  INTEGER             DEFAULT NULL,
    p_descontoadd    DOUBLE PRECISION    DEFAULT 0,
    p_datatabela     DATE                DEFAULT CURRENT_DATE,
    p_datavencimento DATE                DEFAULT NULL,
    p_prepeso        DOUBLE PRECISION    DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO cad_tabelaspre (
        itab_idprod, itab_idindustria, itab_tabela,
        itab_precobruto, itab_precopromo, itab_precoespecial,
        itab_ipi, itab_st, itab_grupodesconto, itab_descontoadd,
        itab_datatabela, itab_datavencimento, itab_prepeso, itab_status
    ) VALUES (
        p_pro_id, p_industria, p_tabela,
        COALESCE(p_precobruto, 0),
        p_precopromo,
        p_precoespecial,
        COALESCE(p_ipi, 0),
        COALESCE(p_st, 0),
        p_grupodesconto,
        COALESCE(p_descontoadd, 0),
        COALESCE(p_datatabela, CURRENT_DATE),
        p_datavencimento,
        COALESCE(p_prepeso, 0),
        true
    )
    ON CONFLICT (itab_idprod, itab_tabela)
    DO UPDATE SET
        itab_precobruto    = CASE
                                WHEN EXCLUDED.itab_precobruto > 0
                                THEN EXCLUDED.itab_precobruto
                                ELSE cad_tabelaspre.itab_precobruto
                             END,
        itab_precopromo    = COALESCE(NULLIF(EXCLUDED.itab_precopromo,    0), cad_tabelaspre.itab_precopromo),
        itab_precoespecial = COALESCE(NULLIF(EXCLUDED.itab_precoespecial, 0), cad_tabelaspre.itab_precoespecial),
        -- NULL = campo não informado na importação → preserva o valor existente
        -- 0 explícito = usuário quer zerar → sobrescreve
        itab_ipi           = COALESCE(EXCLUDED.itab_ipi,          cad_tabelaspre.itab_ipi),
        itab_st            = COALESCE(EXCLUDED.itab_st,           cad_tabelaspre.itab_st),
        itab_grupodesconto = COALESCE(EXCLUDED.itab_grupodesconto, cad_tabelaspre.itab_grupodesconto),
        itab_descontoadd   = COALESCE(EXCLUDED.itab_descontoadd,   cad_tabelaspre.itab_descontoadd),
        itab_datatabela    = COALESCE(EXCLUDED.itab_datatabela,    cad_tabelaspre.itab_datatabela),
        itab_datavencimento= COALESCE(EXCLUDED.itab_datavencimento, cad_tabelaspre.itab_datavencimento),
        itab_prepeso       = COALESCE(EXCLUDED.itab_prepeso,       cad_tabelaspre.itab_prepeso),
        itab_idindustria   = EXCLUDED.itab_idindustria;
END;
$$;


-- DROP obrigatório antes de recrear funções com RETURNS TABLE (Postgres não permite
-- alterar OUT params com CREATE OR REPLACE, precisa dropar e recriar)
DROP FUNCTION IF EXISTS fn_listar_tabelas_industria(INTEGER);
DROP FUNCTION IF EXISTS fn_listar_produtos_tabela(INTEGER, TEXT);

-- ─── fn_listar_tabelas_industria ─────────────────────────────────────────────
-- Retorna resumo das tabelas de preço de uma indústria.
-- Usada em: GET /api/products/tables/:industria
CREATE OR REPLACE FUNCTION fn_listar_tabelas_industria(p_industria INTEGER)
RETURNS TABLE (
    itab_idindustria    INTEGER,
    itab_tabela         TEXT,
    itab_datatabela     DATE,
    itab_datavencimento DATE,
    itab_status         BOOLEAN,
    total_produtos      BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ct.itab_idindustria::INTEGER,
        ct.itab_tabela::TEXT,
        MIN(ct.itab_datatabela)::DATE,
        MAX(ct.itab_datavencimento)::DATE,
        BOOL_AND(COALESCE(ct.itab_status, true)),
        COUNT(*)
    FROM cad_tabelaspre ct
    WHERE ct.itab_idindustria = p_industria
    GROUP BY ct.itab_idindustria, ct.itab_tabela
    ORDER BY ct.itab_tabela;
END;
$$;


-- ─── fn_listar_produtos_tabela ───────────────────────────────────────────────
-- Retorna produtos com preços de uma tabela específica.
-- Usada em: GET /api/products/:industria/:tabela
CREATE OR REPLACE FUNCTION fn_listar_produtos_tabela(
    p_industria INTEGER,
    p_tabela    TEXT
)
RETURNS TABLE (
    itab_idprod         INTEGER,
    itab_idindustria    INTEGER,
    itab_tabela         TEXT,
    pro_codprod         TEXT,
    pro_nome            TEXT,
    pro_codigonormalizado TEXT,
    pro_conversao       TEXT,
    pro_embalagem       INTEGER,
    itab_grupodesconto  INTEGER,
    itab_descontoadd    DOUBLE PRECISION,
    itab_ipi            DOUBLE PRECISION,
    itab_st             DOUBLE PRECISION,
    itab_prepeso        DOUBLE PRECISION,
    itab_precobruto     DOUBLE PRECISION,
    itab_precopromo     DOUBLE PRECISION,
    itab_precoespecial  DOUBLE PRECISION,
    itab_datatabela     DATE,
    itab_datavencimento DATE,
    itab_status         BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ct.itab_idprod::INTEGER,
        ct.itab_idindustria::INTEGER,
        ct.itab_tabela::TEXT,
        cp.pro_codprod::TEXT,
        cp.pro_nome::TEXT,
        cp.pro_codigonormalizado::TEXT,
        cp.pro_conversao::TEXT,
        cp.pro_embalagem::INTEGER,
        ct.itab_grupodesconto::INTEGER,
        ct.itab_descontoadd,
        ct.itab_ipi,
        ct.itab_st,
        ct.itab_prepeso,
        ct.itab_precobruto,
        ct.itab_precopromo,
        ct.itab_precoespecial,
        ct.itab_datatabela,
        ct.itab_datavencimento,
        COALESCE(ct.itab_status, true)
    FROM cad_tabelaspre ct
    INNER JOIN cad_prod cp ON ct.itab_idprod = cp.pro_id
    WHERE ct.itab_idindustria = p_industria
      AND ct.itab_tabela      = p_tabela
    ORDER BY cp.pro_codprod;
END;
$$;
