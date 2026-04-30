-- Migration 023: Corrige fn_metas_por_mes
-- Usa COALESCE(ped_totliq, ped_totbruto) para cobrir pedidos com totliq zerado
-- NOTA: 'E' = Excluído — NÃO deve ser contabilizado. Apenas 'P' e 'F' são válidos.

CREATE OR REPLACE FUNCTION fn_metas_por_mes(
    p_ano       INTEGER,
    p_industria INTEGER DEFAULT NULL
)
RETURNS TABLE (
    industria_codigo     INTEGER,
    industria_nome       VARCHAR,
    mes                  INTEGER,
    mes_nome             VARCHAR,
    ano_anterior         NUMERIC,
    meta_ano_corrente    NUMERIC,
    vendas_ano_corrente  NUMERIC,
    perc_atingimento     NUMERIC,
    perc_relacao_ano_ant NUMERIC
)
LANGUAGE sql
AS $$
    WITH meses AS (
        SELECT
            m.num AS mes,
            CASE m.num
                WHEN 1  THEN 'janeiro'
                WHEN 2  THEN 'fevereiro'
                WHEN 3  THEN 'março'
                WHEN 4  THEN 'abril'
                WHEN 5  THEN 'maio'
                WHEN 6  THEN 'junho'
                WHEN 7  THEN 'julho'
                WHEN 8  THEN 'agosto'
                WHEN 9  THEN 'setembro'
                WHEN 10 THEN 'outubro'
                WHEN 11 THEN 'novembro'
                WHEN 12 THEN 'dezembro'
            END AS mes_nome
        FROM generate_series(1, 12) AS m(num)
    ),
    industrias AS (
        SELECT f.for_codigo, f.for_nomered
        FROM fornecedores f
        WHERE ($2 IS NULL OR f.for_codigo = $2)
          AND f.for_tipo2 = 'A'
    ),
    vendas_ano_ant AS (
        SELECT
            ped_industria,
            EXTRACT(MONTH FROM ped_data)::INTEGER AS mes,
            SUM(COALESCE(NULLIF(ped_totliq, 0), ped_totbruto, 0)) AS total
        FROM pedidos
        WHERE ped_data >= make_date($1 - 1, 1, 1)
          AND ped_data <= make_date($1 - 1, 12, 31)
          AND ped_situacao IN ('P', 'F')
          AND ($2 IS NULL OR ped_industria = $2)
        GROUP BY ped_industria, EXTRACT(MONTH FROM ped_data)
    ),
    vendas_ano_cor AS (
        SELECT
            ped_industria,
            EXTRACT(MONTH FROM ped_data)::INTEGER AS mes,
            SUM(COALESCE(NULLIF(ped_totliq, 0), ped_totbruto, 0)) AS total
        FROM pedidos
        WHERE ped_data >= make_date($1, 1, 1)
          AND ped_data <= make_date($1, 12, 31)
          AND ped_situacao IN ('P', 'F')
          AND ($2 IS NULL OR ped_industria = $2)
        GROUP BY ped_industria, EXTRACT(MONTH FROM ped_data)
    ),
    metas_data AS (
        SELECT
            met_industria,
            UNNEST(ARRAY[met_jan, met_fev, met_mar, met_abr, met_mai, met_jun,
                         met_jul, met_ago, met_set, met_out, met_nov, met_dez]) AS meta_valor,
            UNNEST(ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]) AS mes
        FROM ind_metas
        WHERE met_ano = $1
          AND ($2 IS NULL OR met_industria = $2)
    )
    SELECT
        i.for_codigo::INTEGER,
        i.for_nomered::VARCHAR,
        m.mes::INTEGER,
        m.mes_nome::VARCHAR,
        COALESCE(vaa.total, 0)::NUMERIC,
        COALESCE(mt.meta_valor, 0)::NUMERIC,
        COALESCE(vac.total, 0)::NUMERIC,
        CASE
            WHEN COALESCE(mt.meta_valor, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(vac.total, 0) / mt.meta_valor * 100)::NUMERIC, 2)
        END::NUMERIC,
        CASE
            WHEN COALESCE(vaa.total, 0) = 0 THEN
                CASE WHEN COALESCE(vac.total, 0) > 0 THEN 100.0 ELSE 0.0 END
            ELSE
                ROUND(((COALESCE(vac.total, 0) - vaa.total) / vaa.total * 100)::NUMERIC, 2)
        END::NUMERIC
    FROM industrias i
    CROSS JOIN meses m
    LEFT JOIN vendas_ano_ant vaa ON vaa.ped_industria = i.for_codigo AND vaa.mes = m.mes
    LEFT JOIN vendas_ano_cor vac ON vac.ped_industria = i.for_codigo AND vac.mes = m.mes
    LEFT JOIN metas_data mt      ON mt.met_industria  = i.for_codigo AND mt.mes  = m.mes
    ORDER BY i.for_nomered, m.mes;
$$;
