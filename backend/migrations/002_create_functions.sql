-- ============================================================
-- Migration 002: Functions compartilhadas no schema public
-- Estas ficam APENAS no public e são acessíveis por todos os
-- tenants via search_path.
-- ============================================================

-- Normalizar código de produto (remover zeros à esquerda, espaços)
CREATE OR REPLACE FUNCTION fn_normalizar_codigo(p_codigo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_codigo IS NULL OR TRIM(p_codigo) = '' THEN
        RETURN NULL;
    END IF;
    -- Remove espaços e zeros à esquerda
    RETURN LTRIM(TRIM(p_codigo), '0');
END;
$$;

-- Calcular preço efetivo (hierarquia: Promo > Especial > Bruto)
-- NUNCA dividir por quantidade!
CREATE OR REPLACE FUNCTION fn_preco_efetivo(
    p_bruto NUMERIC,
    p_promo NUMERIC,
    p_especial NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- P2 (Promo) > P3 (Especial) > P1 (Bruto)
    IF COALESCE(p_promo, 0) > 0 THEN
        RETURN p_promo;
    ELSIF COALESCE(p_especial, 0) > 0 THEN
        RETURN p_especial;
    ELSE
        RETURN COALESCE(p_bruto, 0);
    END IF;
END;
$$;

-- Calcular comissão sobre valor faturado
CREATE OR REPLACE FUNCTION fn_calcular_comissao(
    p_valor_faturado NUMERIC,
    p_percentual NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN ROUND(COALESCE(p_valor_faturado, 0) * COALESCE(p_percentual, 0) / 100, 2);
END;
$$;

-- Verificar se pedido está totalmente faturado
CREATE OR REPLACE FUNCTION fn_check_pedido_faturado(p_pedido INTEGER)
RETURNS CHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_ped NUMERIC;
    v_total_fat NUMERIC;
BEGIN
    SELECT COALESCE(ped_totliq, 0) INTO v_total_ped
    FROM pedidos WHERE ped_pedido = p_pedido;

    SELECT COALESCE(SUM(fat_valorfat), 0) INTO v_total_fat
    FROM fatura_ped WHERE fat_pedido = p_pedido;

    IF v_total_fat >= v_total_ped AND v_total_ped > 0 THEN
        RETURN 'F'; -- Faturado
    ELSE
        RETURN 'P'; -- Pendente
    END IF;
END;
$$;
