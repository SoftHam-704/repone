-- Migration 029: Corrige get_industry_revenue
-- Problema: usava vend_metas (metas por vendedor) em vez de ind_metas (metas por indústria)
-- Efeito: indústrias sem entrada em vend_metas ficavam com total_meta=0 e eram excluídas
-- Correção: usa ind_metas com CASE para selecionar a coluna do mês correto
-- Também corrige: usa COALESCE(NULLIF(ped_totliq,0), ped_totbruto) em vez de só ped_totliq

DO $$
DECLARE
    v_schema text;
BEGIN
    FOR v_schema IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast')
          AND schema_name NOT LIKE 'pg_%'
    LOOP
        BEGIN
            EXECUTE format($func$
                DROP FUNCTION IF EXISTS %1$I.get_industry_revenue(integer, integer, integer, integer);
                CREATE FUNCTION %1$I.get_industry_revenue(
                    p_ano        integer,
                    p_mes        integer  DEFAULT NULL,
                    p_for_codigo integer  DEFAULT NULL,
                    p_cli_codigo integer  DEFAULT NULL
                )
                RETURNS TABLE(
                    for_codigo        integer,
                    industria_nome    text,
                    total_faturamento numeric,
                    total_meta        numeric
                )
                LANGUAGE plpgsql AS $fn$
                BEGIN
                    RETURN QUERY
                    SELECT
                        f.for_codigo,
                        COALESCE(f.for_nomered, f.for_nome)::text,
                        COALESCE(SUM(
                            COALESCE(NULLIF(p.ped_totliq, 0), p.ped_totbruto, 0)
                        ) FILTER (
                            WHERE p.ped_situacao IN ('P','F')
                              AND (p_cli_codigo IS NULL OR p.ped_cliente = p_cli_codigo)
                        ), 0)::numeric,
                        COALESCE(
                            CASE p_mes
                                WHEN 1  THEN MAX(im.met_jan)
                                WHEN 2  THEN MAX(im.met_fev)
                                WHEN 3  THEN MAX(im.met_mar)
                                WHEN 4  THEN MAX(im.met_abr)
                                WHEN 5  THEN MAX(im.met_mai)
                                WHEN 6  THEN MAX(im.met_jun)
                                WHEN 7  THEN MAX(im.met_jul)
                                WHEN 8  THEN MAX(im.met_ago)
                                WHEN 9  THEN MAX(im.met_set)
                                WHEN 10 THEN MAX(im.met_out)
                                WHEN 11 THEN MAX(im.met_nov)
                                WHEN 12 THEN MAX(im.met_dez)
                                ELSE MAX(
                                    COALESCE(im.met_jan,0) + COALESCE(im.met_fev,0) +
                                    COALESCE(im.met_mar,0) + COALESCE(im.met_abr,0) +
                                    COALESCE(im.met_mai,0) + COALESCE(im.met_jun,0) +
                                    COALESCE(im.met_jul,0) + COALESCE(im.met_ago,0) +
                                    COALESCE(im.met_set,0) + COALESCE(im.met_out,0) +
                                    COALESCE(im.met_nov,0) + COALESCE(im.met_dez,0)
                                )
                            END,
                        0)::numeric
                    FROM %1$I.fornecedores f
                    LEFT JOIN %1$I.pedidos p
                        ON p.ped_industria = f.for_codigo
                        AND EXTRACT(YEAR  FROM p.ped_data) = p_ano
                        AND (p_mes IS NULL OR EXTRACT(MONTH FROM p.ped_data) = p_mes)
                    LEFT JOIN %1$I.ind_metas im
                        ON im.met_industria = f.for_codigo
                        AND im.met_ano = p_ano
                    WHERE (p_for_codigo IS NULL OR f.for_codigo = p_for_codigo)
                      AND f.for_tipo2 = 'A'
                      AND (
                          im.met_industria IS NOT NULL
                          OR EXISTS (
                              SELECT 1 FROM %1$I.pedidos px
                              WHERE px.ped_industria = f.for_codigo
                                AND EXTRACT(YEAR FROM px.ped_data) = p_ano
                          )
                      )
                    GROUP BY f.for_codigo, f.for_nomered, f.for_nome
                    ORDER BY total_faturamento DESC;
                END;
                $fn$;
            $func$, v_schema);
            RAISE NOTICE 'get_industry_revenue OK: %', v_schema;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'get_industry_revenue ERRO em %: %', v_schema, SQLERRM;
        END;
    END LOOP;
END;
$$;
