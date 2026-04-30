-- ============================================================================
-- FIX EMERGENCIAL — Remove updated_at de fn_upsert_produto
-- A coluna updated_at não existe em cad_prod.
-- Execute no pgAdmin conectado ao basesales.
-- ============================================================================

DO $outer$
DECLARE
  _schema TEXT;
  _fn     TEXT;
BEGIN
  _fn := $fn_text$
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
AS $func$
DECLARE
    v_codigo_normalizado TEXT;
    v_pro_id             INTEGER;
BEGIN
    v_codigo_normalizado := fn_normalizar_codigo(p_codprod);

    IF v_codigo_normalizado IS NULL THEN
        RAISE EXCEPTION 'Código do produto não pode ser vazio.';
    END IF;

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
    ON CONFLICT (pro_industria, pro_codigonormalizado) DO UPDATE SET
        pro_nome             = COALESCE(NULLIF(TRIM(p_nome), ''),             cad_prod.pro_nome),
        pro_peso             = COALESCE(NULLIF(p_peso, 0),                    cad_prod.pro_peso),
        pro_embalagem        = COALESCE(p_embalagem,                          cad_prod.pro_embalagem),
        pro_grupo            = COALESCE(p_grupo,                              cad_prod.pro_grupo),
        pro_setor            = COALESCE(NULLIF(TRIM(p_setor), ''),            cad_prod.pro_setor),
        pro_linha            = COALESCE(NULLIF(TRIM(p_linha), ''),            cad_prod.pro_linha),
        pro_ncm              = COALESCE(NULLIF(TRIM(p_ncm), ''),              cad_prod.pro_ncm),
        pro_origem           = COALESCE(p_origem,                             cad_prod.pro_origem),
        pro_aplicacao        = COALESCE(NULLIF(TRIM(p_aplicacao), ''),        cad_prod.pro_aplicacao),
        pro_codbarras        = COALESCE(NULLIF(TRIM(p_codbarras), ''),        cad_prod.pro_codbarras),
        pro_conversao        = COALESCE(NULLIF(TRIM(p_conversao), ''),        cad_prod.pro_conversao),
        pro_linhaleve        = COALESCE(p_linhaleve,                          cad_prod.pro_linhaleve),
        pro_linhapesada      = COALESCE(p_linhapesada,                        cad_prod.pro_linhapesada),
        pro_linhaagricola    = COALESCE(p_linhaagricola,                      cad_prod.pro_linhaagricola),
        pro_linhautilitarios = COALESCE(p_linhautilitarios,                   cad_prod.pro_linhautilitarios),
        pro_motocicletas     = COALESCE(p_motocicletas,                       cad_prod.pro_motocicletas),
        pro_offroad          = COALESCE(p_offroad,                            cad_prod.pro_offroad),
        pro_linhaamarela     = COALESCE(p_linhaamarela,                       cad_prod.pro_linhaamarela)
    RETURNING pro_id INTO v_pro_id;

    RETURN v_pro_id;
END;
$func$
$fn_text$;

  FOR _schema IN
    SELECT nspname FROM pg_namespace
    WHERE  nspname NOT IN (
             'public','information_schema','pg_catalog','pg_toast','basesales'
           )
      AND  nspname NOT LIKE 'pg_%'
    ORDER  BY nspname
  LOOP
    BEGIN
      EXECUTE format('SET search_path TO %I, public', _schema);
      EXECUTE _fn;
      RAISE WARNING '✅ %', _schema;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ %: %', _schema, SQLERRM;
    END;
  END LOOP;

  RAISE WARNING '════ Fix concluído ════';
END $outer$;
