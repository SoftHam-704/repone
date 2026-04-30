-- ============================================================================
-- MIGRATION 027 — Deduplicação cad_prod + UNIQUE INDEX + fn_upsert refatorado
-- Execute no pgAdmin conectado ao banco principal (basesales).
-- Aplica em todos os schemas de tenant automaticamente.
-- ============================================================================

DO $outer$
DECLARE
  _schema TEXT;
BEGIN

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
    RAISE NOTICE ' Schema: %', _schema;
    RAISE NOTICE '════════════════════════════════════════';

    PERFORM set_config('search_path', _schema || ', public', false);

    -- ── Garante _migrations ───────────────────────────────────────────────────
    BEGIN
      EXECUTE '
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ⚠ _migrations: %', SQLERRM;
    END;

    -- ── Migration 027 ─────────────────────────────────────────────────────────
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM _migrations WHERE name = '027_dedup_cad_prod_unique_index.sql') THEN

        -- Passo 1: redirecionar cad_tabelaspre das duplicatas para o pro_id canônico
        EXECUTE '
          UPDATE cad_tabelaspre tp
          SET    itab_idprod = canon.pro_id
          FROM (
            SELECT pro_industria, pro_codigonormalizado, MIN(pro_id) AS pro_id
            FROM   cad_prod
            WHERE  pro_codigonormalizado IS NOT NULL
            GROUP  BY pro_industria, pro_codigonormalizado
            HAVING COUNT(*) > 1
          ) canon
          JOIN cad_prod dup
            ON  dup.pro_industria         = canon.pro_industria
            AND dup.pro_codigonormalizado = canon.pro_codigonormalizado
            AND dup.pro_id                > canon.pro_id
          WHERE tp.itab_idprod = dup.pro_id';

        RAISE NOTICE '  ✅ Passo 1 — FKs de cad_tabelaspre redirecionadas';

        -- Passo 2: excluir duplicatas (mantém o de menor pro_id por grupo)
        EXECUTE '
          DELETE FROM cad_prod
          WHERE pro_id IN (
            SELECT dup.pro_id
            FROM   cad_prod dup
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
          )';

        RAISE NOTICE '  ✅ Passo 2 — Duplicatas excluídas';

        -- Passo 3: criar UNIQUE INDEX
        EXECUTE '
          CREATE UNIQUE INDEX IF NOT EXISTS uq_cad_prod_industria_codigo
            ON cad_prod (pro_industria, pro_codigonormalizado)';

        RAISE NOTICE '  ✅ Passo 3 — UNIQUE INDEX criado';

        -- Passo 4: recriar fn_upsert_produto com INSERT ... ON CONFLICT
        EXECUTE $fn$
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
              pro_linhaamarela     = COALESCE(p_linhaamarela,                       cad_prod.pro_linhaamarela),
              updated_at           = CURRENT_TIMESTAMP
            RETURNING pro_id INTO v_pro_id;

            RETURN v_pro_id;
          END;
          $$
        $fn$;

        RAISE NOTICE '  ✅ Passo 4 — fn_upsert_produto recriada com ON CONFLICT';

        INSERT INTO _migrations (name) VALUES ('027_dedup_cad_prod_unique_index.sql');
        RAISE NOTICE '  ✅ Migration 027 registrada em %', _schema;

      ELSE
        RAISE NOTICE '  ⏭  027 já aplicada — pulando';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ ERRO em %: %', _schema, SQLERRM;
    END;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE ' Migration 027 concluída em todos os schemas!';
  RAISE NOTICE '════════════════════════════════════════';

END $outer$;
