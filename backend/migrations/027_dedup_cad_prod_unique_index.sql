-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 027 — Deduplicação de cad_prod + UNIQUE INDEX + fn_upsert refatorado
--
-- Problema: sem constraint de unicidade em (pro_industria, pro_codigonormalizado),
-- ao cadastrar o mesmo produto em outra lista da indústria o sistema criava um
-- segundo registro em cad_prod (duplicata).
--
-- Etapas:
--   1. Redirecionar FKs de cad_tabelaspre das duplicatas para o pro_id canônico
--   2. Excluir os registros duplicados de cad_prod
--   3. Criar UNIQUE INDEX em (pro_industria, pro_codigonormalizado)
--   4. Recriar fn_upsert_produto usando INSERT ... ON CONFLICT DO UPDATE
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Passo 1: redirecionar cad_tabelaspre para o pro_id mais antigo do grupo ──
UPDATE cad_tabelaspre tp
SET    itab_idprod = canonical.pro_id
FROM (
    SELECT
        pro_industria,
        pro_codigonormalizado,
        MIN(pro_id) AS pro_id
    FROM cad_prod
    WHERE pro_codigonormalizado IS NOT NULL
    GROUP BY pro_industria, pro_codigonormalizado
    HAVING COUNT(*) > 1
) canonical
JOIN cad_prod dup
  ON  dup.pro_industria         = canonical.pro_industria
  AND dup.pro_codigonormalizado = canonical.pro_codigonormalizado
  AND dup.pro_id                > canonical.pro_id   -- só as duplicatas
WHERE tp.itab_idprod = dup.pro_id;

-- ── Passo 2: excluir os registros duplicados (mantém o de menor pro_id) ──────
DELETE FROM cad_prod
WHERE pro_id IN (
    SELECT dup.pro_id
    FROM cad_prod dup
    JOIN (
        SELECT pro_industria, pro_codigonormalizado, MIN(pro_id) AS pro_id_keep
        FROM   cad_prod
        WHERE  pro_codigonormalizado IS NOT NULL
        GROUP  BY pro_industria, pro_codigonormalizado
        HAVING COUNT(*) > 1
    ) canon
      ON  dup.pro_industria         = canon.pro_industria
      AND dup.pro_codigonormalizado = canon.pro_codigonormalizado
      AND dup.pro_id                > canon.pro_id_keep
);

-- ── Passo 3: UNIQUE INDEX ─────────────────────────────────────────────────────
-- Garante unicidade no banco e habilita ON CONFLICT na função de upsert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cad_prod_industria_codigo
    ON cad_prod (pro_industria, pro_codigonormalizado);

-- ── Passo 4: recriar fn_upsert_produto com INSERT ... ON CONFLICT DO UPDATE ──
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
$$;
