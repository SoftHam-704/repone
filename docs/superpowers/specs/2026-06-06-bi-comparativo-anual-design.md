# BI — Comparativo Anual (mês a mês) — Design

**Data:** 2026-06-06 · **Aba:** BI → Estatísticos · **Pedido por:** tenant **Target**
(exemplo enviado: matriz cliente×mês×ano da VIEMAR — formato ilustrativo, não a fonte da verdade)

## Objetivo
Comparar dois anos **mês a mês**, em **valor (R$)** ou **quantidade**, mostrando os
**números** (o rep quer ler os valores, não só ver a forma), com um indicador de
**evolução ou queda** de produção ao final.

## Decisões (aprovadas por Hamilton 2026-06-06)
- Dimensão: **apenas mês × ano (total)** — sem quebra por cliente (a planilha de exemplo
  tinha clientes, mas não é a fonte da verdade).
- Local: **card novo na aba Estatísticos** (`EstatisticasTab.tsx`).
- Os **valores visíveis** são o coração; o gráfico é reforço visual.

## UI
1. **Controles:** toggle **Valor (R$) ⇄ Quantidade**; par de anos (atual vs anterior, via
   PeriodSelector/ano selecionável).
2. **Tabela-matriz (hero):** linhas = meses Jan→Dez + **TOTAL**; colunas =
   `Ano anterior · Ano atual · Δ · Δ%`. Δ verde (cresceu) / vermelho (caiu).
3. **Mini-gráfico:** barras agrupadas por ano **com rótulo de valor**, ao lado/acima da
   tabela (ECharts, tokens do BI). Não substitui os números.
4. **Resumo de evolução:** rodapé com "Produção {ano} vs {ano-1}: ▲/▼ ±X% (R$ A → R$ B)"
   + frase do `InsightNarrative`.

## Dados
- Endpoint novo: `GET /bi/comparativo-anual?ano=YYYY[&industria=&vendedor=]`.
- Regra da casa (mesma do fix recém-feito): **só `ped_situacao IN ('P','F')`**.
  - **Valor** = `SUM(ped_totliq)` do cabeçalho (padrão do sistema; não soma de itens).
  - **Quantidade** = `SUM(ite_quant)` dos itens dos mesmos pedidos.
- Retorna **valor E quantidade** por (ano, mês) dos dois anos → o toggle é client-side
  (sem refetch). Frontend pivota nos 12 meses e calcula Δ/Δ%.
- Respeita os filtros globais do BI (indústria/vendedor) quando presentes.

## Visão 2 — Matriz por Cliente (modelo Target / planilha VIEMAR)
Aprovada 2026-06-06: reproduz a planilha da Target — **clientes (linhas) × meses (colunas) ×
2 anos lado a lado**, TOTAL por ano (destacado) + linha TOTAL. Comparação **YTD** (mostra
Jan→último mês com dado no ano atual, nos dois anos). Toggle Valor/Qtd, escopo pela indústria.
- Endpoint `GET /bi/matriz-clientes-anual` (mesma regra: P/F, `ped_totliq`/`ite_quant`).
- Componente `MatrizClientesAnual.tsx` (coluna Cliente sticky, rolagem horizontal).
- Ordenado pelo total do ano atual (desc). Resumo de evolução da carteira no rodapé.

## Fora de escopo (futuro)
- Mais de 2 anos simultâneos.
- Export Excel da matriz (se a Target pedir).

## Arquivos
- Backend: handler `comparativoAnualHandler` em `bi.controller.ts` + rota em `bi.routes.ts`.
- Frontend: componente `ComparativoAnual.tsx` (tabela + mini-chart + resumo) montado na
  `EstatisticasTab.tsx`.
