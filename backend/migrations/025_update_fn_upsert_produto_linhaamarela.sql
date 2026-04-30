-- Recria fn_upsert_produto adicionando p_linhaamarela (posição 20).
-- CREATE OR REPLACE é seguro: não destrói dados.

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
    p_offroad          BOOLEAN          DEFAULT NULL,
    p_linhaamarela     BOOLEAN          DEFAULT NULL
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
        pro_offroad          = COALESCE(p_offroad,                        pro_offroad),
        pro_linhaamarela     = COALESCE(p_linhaamarela,                   pro_linhaamarela)
    WHERE pro_industria         = p_industria
      AND pro_codigonormalizado = v_codigo_normalizado
    RETURNING pro_id INTO v_pro_id;

    IF v_pro_id IS NULL THEN
        INSERT INTO cad_prod (
            pro_industria, pro_codprod, pro_codigonormalizado,
            pro_nome, pro_peso, pro_embalagem, pro_grupo,
            pro_setor, pro_linha, pro_ncm, pro_origem,
            pro_aplicacao, pro_codbarras, pro_conversao,
            pro_linhaleve, pro_linhapesada, pro_linhaagricola,
            pro_linhautilitarios, pro_motocicletas, pro_offroad,
            pro_linhaamarela, pro_status
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
            COALESCE(p_linhaamarela,     false),
            true
        )
        RETURNING pro_id INTO v_pro_id;
    END IF;

    RETURN v_pro_id;
END;
$$;
