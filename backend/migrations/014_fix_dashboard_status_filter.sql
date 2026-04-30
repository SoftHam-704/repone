-- ============================================================================
-- Migration 014: Correção do filtro de status nas funções do dashboard
--
-- PROBLEMA: As funções get_dashboard_metrics_v4, get_industry_revenue,
-- fn_comparacao_vendas_mensais e fn_comparacao_quantidades_mensais filtravam
-- pedidos de indústrias inativas (for_tipo2 <> 'A'). Isso causava divergência
-- nos totais — pedidos existentes eram ignorados nos relatórios.
--
-- REGRA: Status (ativo/inativo) é dado cadastral. NUNCA deve excluir pedidos
-- históricos de relatórios e dashboards.
--
-- Aplica em TODOS os schemas de tenant.
-- ============================================================================

DO $$
DECLARE
    r        RECORD;
    v_schema TEXT;
BEGIN
    RAISE NOTICE '=== Migration 014: Fix dashboard status filter ===';

    FOR r IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')
          AND nspname NOT LIKE 'pg_temp_%'
          AND nspname NOT LIKE 'pg_%'
        ORDER BY nspname
    LOOP
        v_schema := r.nspname;

        -- Só aplica se o schema tem as tabelas necessárias
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = v_schema AND table_name = 'pedidos'
        ) THEN
            RAISE NOTICE 'Schema % sem tabela pedidos — pulando', v_schema;
            CONTINUE;
        END IF;

        RAISE NOTICE 'Aplicando em schema: %', v_schema;

        -- ── 1. get_dashboard_metrics_v4 ──────────────────────────────────────
        BEGIN
            EXECUTE format($func$
                CREATE OR REPLACE FUNCTION %1$I.get_dashboard_metrics_v4(
                    p_year       integer,
                    p_month      integer DEFAULT 0,
                    p_industry_id integer DEFAULT NULL,
                    p_cli_codigo  integer DEFAULT NULL
                )
                RETURNS TABLE(
                    total_vendido_current       numeric,
                    vendas_mom                  numeric,
                    vendas_yoy                  numeric,
                    quantidade_vendida_current  numeric,
                    quantidade_mom              numeric,
                    quantidade_yoy              numeric,
                    clientes_atendidos_current  integer,
                    clientes_mom                numeric,
                    clientes_yoy                numeric,
                    total_pedidos_current       integer,
                    pedidos_mom                 numeric,
                    pedidos_yoy                 numeric,
                    ticket_medio_current        numeric,
                    ticket_mom                  numeric,
                    ticket_yoy                  numeric
                )
                LANGUAGE plpgsql AS $fn$
                DECLARE
                    v_curr_start DATE; v_curr_end DATE;
                    v_mom_start  DATE; v_mom_end  DATE;
                    v_yoy_start  DATE; v_yoy_end  DATE;
                BEGIN
                    IF p_month IS NULL OR p_month = 0 THEN
                        v_curr_start := make_date(p_year, 1, 1);
                        v_curr_end   := make_date(p_year, 12, 31);
                        v_mom_start  := make_date(p_year - 1, 1, 1);
                        v_mom_end    := make_date(p_year - 1, 12, 31);
                        v_yoy_start  := make_date(p_year - 1, 1, 1);
                        v_yoy_end    := make_date(p_year - 1, 12, 31);
                    ELSE
                        v_curr_start := make_date(p_year, p_month, 1);
                        v_curr_end   := (v_curr_start + INTERVAL '1 month - 1 day')::DATE;
                        v_mom_start  := (v_curr_start - INTERVAL '1 month')::DATE;
                        v_mom_end    := (v_curr_start - INTERVAL '1 day')::DATE;
                        v_yoy_start  := (v_curr_start - INTERVAL '1 year')::DATE;
                        v_yoy_end    := (v_curr_end   - INTERVAL '1 year')::DATE;
                    END IF;

                    RETURN QUERY
                    WITH metrics_agg AS (
                        SELECT
                            SUM(p.ped_totliq) FILTER (WHERE p.ped_data >= v_curr_start AND p.ped_data <= v_curr_end) AS v_curr,
                            SUM(p.ped_totliq) FILTER (WHERE p.ped_data >= v_mom_start  AND p.ped_data <= v_mom_end)  AS v_mom,
                            SUM(p.ped_totliq) FILTER (WHERE p.ped_data >= v_yoy_start  AND p.ped_data <= v_yoy_end)  AS v_yoy,
                            COUNT(DISTINCT p.ped_cliente) FILTER (WHERE p.ped_data >= v_curr_start AND p.ped_data <= v_curr_end) AS c_curr,
                            COUNT(DISTINCT p.ped_cliente) FILTER (WHERE p.ped_data >= v_mom_start  AND p.ped_data <= v_mom_end)  AS c_mom,
                            COUNT(DISTINCT p.ped_cliente) FILTER (WHERE p.ped_data >= v_yoy_start  AND p.ped_data <= v_yoy_end)  AS c_yoy,
                            COUNT(*) FILTER (WHERE p.ped_data >= v_curr_start AND p.ped_data <= v_curr_end) AS p_curr,
                            COUNT(*) FILTER (WHERE p.ped_data >= v_mom_start  AND p.ped_data <= v_mom_end)  AS p_mom,
                            COUNT(*) FILTER (WHERE p.ped_data >= v_yoy_start  AND p.ped_data <= v_yoy_end)  AS p_yoy
                        FROM %1$I.pedidos p
                        WHERE p.ped_data >= LEAST(v_curr_start, v_mom_start, v_yoy_start)
                          AND p.ped_data <= GREATEST(v_curr_end, v_mom_end, v_yoy_end)
                          AND p.ped_situacao IN ('P', 'F')
                          AND (p_industry_id IS NULL OR p.ped_industria = p_industry_id)
                          AND (p_cli_codigo  IS NULL OR p.ped_cliente   = p_cli_codigo)
                    ),
                    qtd_agg AS (
                        SELECT
                            SUM(i.ite_quant) FILTER (WHERE p.ped_data >= v_curr_start AND p.ped_data <= v_curr_end) AS q_curr,
                            SUM(i.ite_quant) FILTER (WHERE p.ped_data >= v_mom_start  AND p.ped_data <= v_mom_end)  AS q_mom,
                            SUM(i.ite_quant) FILTER (WHERE p.ped_data >= v_yoy_start  AND p.ped_data <= v_yoy_end)  AS q_yoy
                        FROM %1$I.pedidos p
                        INNER JOIN %1$I.itens_ped i ON i.ite_pedido = p.ped_pedido
                        WHERE p.ped_data >= LEAST(v_curr_start, v_mom_start, v_yoy_start)
                          AND p.ped_data <= GREATEST(v_curr_end, v_mom_end, v_yoy_end)
                          AND p.ped_situacao IN ('P', 'F')
                          AND (p_industry_id IS NULL OR p.ped_industria = p_industry_id)
                          AND (p_cli_codigo  IS NULL OR p.ped_cliente   = p_cli_codigo)
                    ),
                    tm_calc AS (
                        SELECT
                            m.v_curr, m.v_mom, m.v_yoy,
                            m.c_curr, m.c_mom, m.c_yoy,
                            m.p_curr, m.p_mom, m.p_yoy,
                            q.q_curr, q.q_mom, q.q_yoy,
                            CASE WHEN COALESCE(m.c_curr, 0) = 0 THEN 0 ELSE m.v_curr / m.c_curr END AS tm_curr,
                            CASE WHEN COALESCE(m.c_mom,  0) = 0 THEN 0 ELSE m.v_mom  / m.c_mom  END AS tm_mom,
                            CASE WHEN COALESCE(m.c_yoy,  0) = 0 THEN 0 ELSE m.v_yoy  / m.c_yoy  END AS tm_yoy
                        FROM metrics_agg m, qtd_agg q
                    )
                    SELECT
                        COALESCE(tm.v_curr, 0)::numeric,
                        CASE WHEN COALESCE(tm.v_mom, 0)=0 THEN 0 ELSE ((tm.v_curr-tm.v_mom)/tm.v_mom*100) END::numeric,
                        CASE WHEN COALESCE(tm.v_yoy, 0)=0 THEN 0 ELSE ((tm.v_curr-tm.v_yoy)/tm.v_yoy*100) END::numeric,
                        COALESCE(tm.q_curr, 0)::numeric,
                        CASE WHEN COALESCE(tm.q_mom, 0)=0 THEN 0 ELSE ((tm.q_curr-tm.q_mom)/tm.q_mom*100) END::numeric,
                        CASE WHEN COALESCE(tm.q_yoy, 0)=0 THEN 0 ELSE ((tm.q_curr-tm.q_yoy)/tm.q_yoy*100) END::numeric,
                        COALESCE(tm.c_curr, 0)::integer,
                        CASE WHEN COALESCE(tm.c_mom, 0)=0 THEN 0 ELSE ((tm.c_curr-tm.c_mom)::numeric/tm.c_mom*100) END::numeric,
                        CASE WHEN COALESCE(tm.c_yoy, 0)=0 THEN 0 ELSE ((tm.c_curr-tm.c_yoy)::numeric/tm.c_yoy*100) END::numeric,
                        COALESCE(tm.p_curr, 0)::integer,
                        CASE WHEN COALESCE(tm.p_mom, 0)=0 THEN 0 ELSE ((tm.p_curr-tm.p_mom)::numeric/tm.p_mom*100) END::numeric,
                        CASE WHEN COALESCE(tm.p_yoy, 0)=0 THEN 0 ELSE ((tm.p_curr-tm.p_yoy)::numeric/tm.p_yoy*100) END::numeric,
                        COALESCE(tm.tm_curr, 0)::numeric,
                        CASE WHEN COALESCE(tm.tm_mom, 0)=0 THEN 0 ELSE ((tm.tm_curr-tm.tm_mom)/tm.tm_mom*100) END::numeric,
                        CASE WHEN COALESCE(tm.tm_yoy, 0)=0 THEN 0 ELSE ((tm.tm_curr-tm.tm_yoy)/tm.tm_yoy*100) END::numeric
                    FROM tm_calc tm;
                END;
                $fn$;
            $func$, v_schema);
            RAISE NOTICE '  get_dashboard_metrics_v4 OK';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  get_dashboard_metrics_v4 ERRO: %', SQLERRM;
        END;

        -- ── 2. get_industry_revenue ───────────────────────────────────────────
        BEGIN
            EXECUTE format($func$
                CREATE OR REPLACE FUNCTION %1$I.get_industry_revenue(
                    p_ano        integer,
                    p_mes        integer  DEFAULT NULL,
                    p_for_codigo integer  DEFAULT NULL,
                    p_cli_codigo integer  DEFAULT NULL
                )
                RETURNS TABLE(
                    for_codigo       integer,
                    industria_nome   text,
                    total_faturamento numeric,
                    total_meta        numeric
                )
                LANGUAGE plpgsql AS $fn$
                BEGIN
                    RETURN QUERY
                    SELECT
                        f.for_codigo,
                        COALESCE(f.for_nomered, f.for_nome)::text AS industria_nome,
                        COALESCE(SUM(p.ped_totliq) FILTER (
                            WHERE p.ped_situacao IN ('P', 'F')
                              AND (p_cli_codigo IS NULL OR p.ped_cliente = p_cli_codigo)
                        ), 0)::numeric AS total_faturamento,
                        COALESCE(MAX(vm.met_valor), 0)::numeric AS total_meta
                    FROM %1$I.fornecedores f
                    LEFT JOIN %1$I.pedidos p
                        ON p.ped_industria = f.for_codigo
                        AND EXTRACT(YEAR  FROM p.ped_data) = p_ano
                        AND (p_mes IS NULL OR EXTRACT(MONTH FROM p.ped_data) = p_mes)
                    LEFT JOIN %1$I.vend_metas vm
                        ON vm.met_industria = f.for_codigo
                        AND vm.met_ano = p_ano
                        AND (p_mes IS NULL OR vm.met_mes = p_mes)
                    WHERE (p_for_codigo IS NULL OR f.for_codigo = p_for_codigo)
                      AND EXISTS (
                          SELECT 1 FROM %1$I.pedidos px
                          WHERE px.ped_industria = f.for_codigo
                            AND EXTRACT(YEAR FROM px.ped_data) = p_ano
                      )
                    GROUP BY f.for_codigo, f.for_nomered, f.for_nome
                    ORDER BY total_faturamento DESC;
                END;
                $fn$;
            $func$, v_schema);
            RAISE NOTICE '  get_industry_revenue OK';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  get_industry_revenue ERRO: %', SQLERRM;
        END;

        -- ── 3. fn_comparacao_vendas_mensais ───────────────────────────────────
        BEGIN
            EXECUTE format($func$
                CREATE OR REPLACE FUNCTION %1$I.fn_comparacao_vendas_mensais(
                    p_ano_atual    integer,
                    p_ano_anterior integer,
                    p_for_codigo   integer DEFAULT NULL,
                    p_cli_codigo   integer DEFAULT NULL
                )
                RETURNS TABLE(
                    mes       integer,
                    mes_nome  text,
                    vendas_ano_atual     numeric,
                    vendas_ano_anterior  numeric
                )
                LANGUAGE plpgsql AS $fn$
                BEGIN
                    RETURN QUERY
                    SELECT
                        gs.m::integer AS mes,
                        TO_CHAR(make_date(2000, gs.m, 1), 'TMMonth')::text AS mes_nome,
                        COALESCE(SUM(p.ped_totliq) FILTER (
                            WHERE EXTRACT(YEAR FROM p.ped_data) = p_ano_atual
                              AND p.ped_situacao IN ('P', 'F')
                        ), 0)::numeric AS vendas_ano_atual,
                        COALESCE(SUM(p.ped_totliq) FILTER (
                            WHERE EXTRACT(YEAR FROM p.ped_data) = p_ano_anterior
                              AND p.ped_situacao IN ('P', 'F')
                        ), 0)::numeric AS vendas_ano_anterior
                    FROM generate_series(1, 12) AS gs(m)
                    LEFT JOIN %1$I.pedidos p
                        ON EXTRACT(MONTH FROM p.ped_data) = gs.m
                        AND EXTRACT(YEAR FROM p.ped_data) IN (p_ano_atual, p_ano_anterior)
                        AND p.ped_situacao IN ('P', 'F')
                        AND (p_for_codigo IS NULL OR p.ped_industria = p_for_codigo)
                        AND (p_cli_codigo IS NULL OR p.ped_cliente   = p_cli_codigo)
                    GROUP BY gs.m
                    ORDER BY gs.m;
                END;
                $fn$;
            $func$, v_schema);
            RAISE NOTICE '  fn_comparacao_vendas_mensais OK';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  fn_comparacao_vendas_mensais ERRO: %', SQLERRM;
        END;

        -- ── 4. fn_comparacao_quantidades_mensais ──────────────────────────────
        BEGIN
            EXECUTE format($func$
                CREATE OR REPLACE FUNCTION %1$I.fn_comparacao_quantidades_mensais(
                    p_ano_atual    integer,
                    p_ano_anterior integer,
                    p_for_codigo   integer DEFAULT NULL,
                    p_cli_codigo   integer DEFAULT NULL
                )
                RETURNS TABLE(
                    mes                    integer,
                    mes_nome               text,
                    quantidade_ano_atual   numeric,
                    quantidade_ano_anterior numeric
                )
                LANGUAGE plpgsql AS $fn$
                BEGIN
                    RETURN QUERY
                    SELECT
                        gs.m::integer AS mes,
                        TO_CHAR(make_date(2000, gs.m, 1), 'TMMonth')::text AS mes_nome,
                        COALESCE(SUM(i.ite_quant) FILTER (
                            WHERE EXTRACT(YEAR FROM p.ped_data) = p_ano_atual
                        ), 0)::numeric AS quantidade_ano_atual,
                        COALESCE(SUM(i.ite_quant) FILTER (
                            WHERE EXTRACT(YEAR FROM p.ped_data) = p_ano_anterior
                        ), 0)::numeric AS quantidade_ano_anterior
                    FROM generate_series(1, 12) AS gs(m)
                    LEFT JOIN %1$I.pedidos p
                        ON EXTRACT(MONTH FROM p.ped_data) = gs.m
                        AND EXTRACT(YEAR FROM p.ped_data) IN (p_ano_atual, p_ano_anterior)
                        AND p.ped_situacao IN ('P', 'F')
                        AND (p_for_codigo IS NULL OR p.ped_industria = p_for_codigo)
                        AND (p_cli_codigo IS NULL OR p.ped_cliente   = p_cli_codigo)
                    LEFT JOIN %1$I.itens_ped i ON i.ite_pedido = p.ped_pedido
                    GROUP BY gs.m
                    ORDER BY gs.m;
                END;
                $fn$;
            $func$, v_schema);
            RAISE NOTICE '  fn_comparacao_quantidades_mensais OK';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  fn_comparacao_quantidades_mensais ERRO: %', SQLERRM;
        END;

    END LOOP;

    RAISE NOTICE '=== Migration 014 concluída ===';
END;
$$;
