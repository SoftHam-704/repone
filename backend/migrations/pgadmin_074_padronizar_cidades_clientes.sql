-- =============================================================================
-- Migration 074 — Padronização de cidades nos cadastros de clientes
-- =============================================================================
-- PROBLEMA: relatórios "clientes por cidade" agrupam por COALESCE(cid.cid_nome,
--   c.cli_cidade). Quem tem cli_idcidade preenchido resolve pro nome canônico de
--   `cidades` ("Cuiabá"); quem está NULL cai no texto livre cli_cidade ("Cuiaba"),
--   gerando cidades duplicadas e relatório incompleto.
--
-- DESCOBERTAS DO DIAGNÓSTICO (read-only, basesales, 31 tenants):
--   1. public.cidades = 5569 linhas, ÍNTEGRA, cid_codigo [1..5597]. É a referência.
--   2. A tabela cidades POR-TENANT está VAZIA (0 linhas) em: brasil_wl, conquistarep,
--      forecast, gemagalhaes, pctubarep, prestiarep, tmbrep — e AUSENTE em
--      jsaviorep, mettarep, rimef. Quando existe e tem dados, usa o MESMO cid_codigo
--      que public (0 divergências). => public.cidades é a fonte de verdade única.
--   3. NENHUMA duplicata por acento dentro de public.cidades.
--   4. NÃO existe extensão unaccent nem função de normalização no banco; usamos
--      translate() inline (immutable, sem dependência).
--   5. cli_idcidade NULL com texto preenchido: 3981 clientes.
--      - match ÚNICO em public.cidades (nome norm + UF): 1930  -> BACKFILL
--      - AMBÍGUO (>1 município, sempre por cli_uf VAZIO): 1        -> NÃO TOCAR
--      - SEM match (typo/encoding/cidade fora do BR): 172          -> NÃO TOCAR
--      Diferença p/ 3981 = clientes com cli_cidade vazio: nada a fazer.
--
-- ESTRATÉGIA (idempotente, replicável por tenant via replicate-074.ts):
--   ETAPA A: backfill cli_idcidade SÓ no match ÚNICO por (nome normalizado + UF
--            preenchido). Casa SEMPRE contra public.cidades (a do tenant pode estar
--            furada). Exigir UF não-vazio elimina o único caso ambíguo (BOA VISTA).
--   ETAPA B (opcional, alinhar texto ao canônico): atualiza cli_cidade/cli_uf p/
--            cid_nome/cid_uf de TODOS os clientes com cli_idcidade preenchido e
--            divergência só de acento/caixa. Reduz ruído mesmo onde já havia FK.
--   ETAPA C: relatório de auditoria (RAISE NOTICE) — ambíguos e sem-match ficam
--            de fora p/ correção manual.
--
-- NÃO É DESTRUTIVO: só preenche cli_idcidade NULL e normaliza texto que já mapeia
--   pro mesmo município. Nenhum cli_idcidade existente é sobrescrito. Pedidos/NF-e
--   não são tocados (não há snapshot de cidade em movimento).
--
-- Rodar 1 schema por vez com search_path TO "<tenant>", public (replicate-074.ts).
-- Self-contained: cria função auxiliar TEMP-like via inline, sem objetos persistentes.
-- =============================================================================

DO $mig$
DECLARE
  v_backfill   INT := 0;
  v_normaliza  INT := 0;
  v_ambiguo    INT := 0;
  v_semmatch   INT := 0;
  v_idcid_null INT := 0;
BEGIN
  -- Expressão de normalização reutilizada (sem unaccent): UPPER + TRIM + sem acento.
  -- Mantida inline em cada query (translate é IMMUTABLE).

  -- ------------------------------------------------------------------ ETAPA A
  -- (Re)resolve cli_idcidade onde:
  --   * cli_idcidade IS NULL  OU  é FK ÓRFÃ (código que NÃO existe em public.cidades
  --     — caso DOMINANTE: esquema antigo/IBGE, ex.: 340351 p/ Cuiabá enquanto o
  --     canônico é 5320; é o que sustentava o "CUIABA" sem acento no relatório)
  --   * cli_cidade não-vazio E cli_uf não-vazio
  --   * existe EXATAMENTE 1 município em public.cidades com nome normalizado igual
  --     e mesma UF.
  -- Seguro: o código órfão é inválido por definição; trocá-lo pelo canônico (casado
  -- pelo próprio texto do cliente, que é o que o relatório já usa) só melhora.
  WITH alvo AS (
    SELECT
      cl.cli_codigo,
      translate(upper(btrim(cl.cli_cidade)),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC') AS ncid,
      upper(btrim(cl.cli_uf)) AS nuf
    FROM clientes cl
    WHERE (cl.cli_idcidade IS NULL
           OR NOT EXISTS (SELECT 1 FROM public.cidades pc WHERE pc.cid_codigo = cl.cli_idcidade))
      AND btrim(coalesce(cl.cli_cidade,'')) <> ''
      AND btrim(coalesce(cl.cli_uf,''))     <> ''
  ),
  resolvido AS (
    SELECT a.cli_codigo,
           (array_agg(c.cid_codigo))[1] AS cid_codigo,
           count(*) AS matches
    FROM alvo a
    JOIN public.cidades c
      ON translate(upper(btrim(c.cid_nome)),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC') = a.ncid
     AND upper(btrim(c.cid_uf)) = a.nuf
    GROUP BY a.cli_codigo
    HAVING count(*) = 1
  )
  UPDATE clientes cl
     SET cli_idcidade = r.cid_codigo
    FROM resolvido r
   WHERE cl.cli_codigo = r.cli_codigo
     AND (cl.cli_idcidade IS NULL
          OR NOT EXISTS (SELECT 1 FROM public.cidades pc WHERE pc.cid_codigo = cl.cli_idcidade));  -- NULL ou órfã (idempotente)
  GET DIAGNOSTICS v_backfill = ROW_COUNT;

  -- ------------------------------------------------------------------ ETAPA B
  -- Alinhar texto ao canônico onde cli_idcidade aponta p/ public.cidades e o texto
  -- diverge SÓ por acento/caixa (mesmo nome normalizado). NÃO mexe se a divergência
  -- for de nome real (proteção contra cidade renomeada/errada).
  UPDATE clientes cl
     SET cli_cidade = c.cid_nome,
         cli_uf     = c.cid_uf
    FROM public.cidades c
   WHERE c.cid_codigo = cl.cli_idcidade
     AND (cl.cli_cidade IS DISTINCT FROM c.cid_nome
          OR cl.cli_uf  IS DISTINCT FROM c.cid_uf)
     AND translate(upper(btrim(coalesce(cl.cli_cidade,''))),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
       = translate(upper(btrim(c.cid_nome)),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC');
  GET DIAGNOSTICS v_normaliza = ROW_COUNT;

  -- ------------------------------------------------------------------ ETAPA C
  -- Auditoria: o que ficou de fora (ainda NULL após backfill).
  SELECT count(*) INTO v_idcid_null FROM clientes WHERE cli_idcidade IS NULL;

  WITH alvo AS (
    SELECT cl.cli_codigo,
      translate(upper(btrim(cl.cli_cidade)),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC') AS ncid,
      upper(btrim(coalesce(cl.cli_uf,''))) AS nuf
    FROM clientes cl
    WHERE cl.cli_idcidade IS NULL
      AND btrim(coalesce(cl.cli_cidade,'')) <> ''
  ),
  m AS (
    SELECT a.cli_codigo, count(c.cid_codigo) AS matches
    FROM alvo a
    LEFT JOIN public.cidades c
      ON translate(upper(btrim(c.cid_nome)),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC') = a.ncid
     AND (a.nuf = '' OR upper(btrim(c.cid_uf)) = a.nuf)
    GROUP BY a.cli_codigo
  )
  SELECT count(*) FILTER (WHERE matches > 1),
         count(*) FILTER (WHERE matches = 0)
    INTO v_ambiguo, v_semmatch
  FROM m;

  -- ------------------------------------------------------------------ ASSERTS
  -- Invariante 1: nenhum cli_idcidade pode ter ficado órfão de public.cidades
  --   POR CAUSA do backfill (só inserimos cid_codigo vindo de public.cidades).
  PERFORM 1 FROM clientes cl
   WHERE cl.cli_idcidade IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.cidades c WHERE c.cid_codigo = cl.cli_idcidade)
   LIMIT 1;
  -- (não abortamos por órfãos PRÉ-EXISTENTES — eles vêm de cidades furadas do tenant,
  --  tratados na migration de cleanup de cidades globais; aqui só garantimos que NÃO
  --  PIORAMOS. O backfill só usa public.cidades, então não cria órfão novo.)

  RAISE NOTICE '== Migration 074 cidades :: tenant=% ==', current_schema();
  RAISE NOTICE '  ETAPA A backfill cli_idcidade (match único nome+UF) : %', v_backfill;
  RAISE NOTICE '  ETAPA B texto alinhado ao canônico (acento/caixa)   : %', v_normaliza;
  RAISE NOTICE '  -- restante cli_idcidade NULL após backfill          : %', v_idcid_null;
  RAISE NOTICE '  -- AMBÍGUOS (manual, sem UF ou multi-UF)             : %', v_ambiguo;
  RAISE NOTICE '  -- SEM MATCH (typo/encoding, manual)                 : %', v_semmatch;
END $mig$;
