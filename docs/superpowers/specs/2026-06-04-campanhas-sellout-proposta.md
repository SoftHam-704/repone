# Campanhas — Virada de apuração SELL-IN → SELL-OUT

**Data:** 2026-06-04
**Autor:** Agente `campanhas-autopecas`
**Status:** PROPOSTA — aguarda aprovação do Hamilton. NADA implementado. Sem código, sem migration, sem mexer em produção.
**Princípio inegociável:** campanha mede o que o lojista **VENDEU** (sell-out), não o que ele **COMPROU** (sell-in).

---

## 0. O que foi lido / medido (não é de cabeça)

- `backend/src/modules/campaigns/campaigns.controller.ts` — handlers `simulate`, `create`, `update`, `auto-progress` (apuração), tracking.
- `backend/src/modules/sellout/sellout.controller.ts` — CRUD + import Excel + ranking + pendências.
- `src/modules/campanhas/pages/CampanhasPage.tsx` — 4 tipos, simulação histórica, monitoramento/alerta. **Zero referência a sell-out hoje.**
- Banco real `basesales` (read-only, SELECT apenas).

### Colunas reais `campanhas_promocionais` (schema alcarep, idêntico nos tenants)
`cmp_codigo, cmp_descricao, cmp_cliente_id, cmp_industria_id, cmp_promotor_id, cmp_status, cmp_data_criacao, cmp_data_atualizacao, cmp_periodo_base_ini, cmp_periodo_base_fim, cmp_campanha_ini, cmp_campanha_fim, cmp_base_dias_kpi, cmp_base_valor_total, cmp_base_qtd_total, cmp_base_media_diaria_val, cmp_base_media_diaria_qtd, cmp_perc_crescimento, cmp_meta_valor_total, cmp_meta_qtd_total, cmp_meta_diaria_val, cmp_meta_diaria_qtd, cmp_real_valor_total, cmp_real_qtd_total, cmp_percentual_atingido_val, cmp_percentual_atingido_qtd, cmp_observacao, cmp_ai_insight, cmp_setor, cmp_regiao, cmp_equipe_vendas, cmp_verba_solicitada, cmp_tema, cmp_justificativa, cmp_premiacoes, cmp_tipo_periodo, cmp_tipo`

> **NÃO existe** `cmp_base_apuracao`. É a coluna a criar (mandamento #5: o critério tem que estar gravado NA campanha).

### Colunas reais `crm_sellout`
`id, cli_codigo, for_codigo, periodo (date, YYYY-MM-01), valor (numeric), quantidade (numeric), criado_em`. PK lógica `(cli_codigo, for_codigo, periodo)`, upsert acumulativo. **Mensal e agregado por cliente×indústria. Sem SKU/família.**

### Apuração de hoje (`auto-progress`) — 100% sell-in, lê `itens_ped JOIN pedidos WHERE ped_situacao IN ('P','F')`
| `cmp_tipo` | Métrica atual (sell-in) |
|---|---|
| CRESCIMENTO | `SUM(ite_totliquido)` |
| MIX | `COUNT(DISTINCT pro_grupo)` |
| POSITIVACAO | `COUNT(DISTINCT mês de ped_data)` |
| VOLUME | `SUM(ite_quant)` |

### Cobertura de sell-out medida (varredura dos 33 schemas)
Tenants com dado real de sell-out:

| Tenant | linhas | pares (cli,for) | meses | janela |
|---|---|---|---|---|
| ro_consult | 1005 | 158 | 41 | 2023-01 .. 2026-05 |
| softham | 978 | 155 | 40 | 2023-01 .. 2026-04 |
| brasil_wl | 117 | 9 | 13 | 2025-01 .. 2026-01 |
| jsaviorep | 116 | 58 | 2 | 2026-04 .. 2026-05 |
| borcatorep | 6 | 6 | 1 | 2026-04 |
| damarep | 4 | 3 | 4 | 2026-01 .. 2026-06 |
| public/markpress | poucas | — | — | — |
| **alcarep, remap** | **0** | 0 | 0 | — |

Campanhas: quase todas em `SIMULACAO`. **Apenas `ro_consult` e `softham` têm 1 campanha `ATIVA`.** A maioria dos tenants **não usa sell-out ainda** (cobertura zero ou rasa). Isso muda a estratégia de transição (ver §4 e §5): a virada não pode quebrar quem não reporta.

### Sell-in × sell-out de um par real (ro_consult, cli 119 × ind 3, 24 meses)
| mês | sell-in R$ | sell-out R$ | sell-through% |
|---|---|---|---|
| 2024-02 | 63.899 | 242.730 | 380% |
| 2024-07 | 711.428 | 300.559 | 42% |
| 2025-02 | 0 | 339.772 | s/ sell-in |
| 2025-05 | 3.117 | 305.349 | 9796% |
| 2026-05 | 364.772 | 382.865 | 105% |
| **TOTAL** | **4.158.882** | **7.239.594** | **174%** |

**Leitura comercial:** o sell-in oscila de R$ 0 a R$ 711k/mês — pura compra em lote (estoque empurrado). O sell-out é estável em ~R$ 280-380k/mês — o **giro real na ponta**. Mês com sell-in zero teve sell-out de R$ 339k (vendeu do estoque). Mês de R$ 711k de compra vendeu R$ 300k (encalhou R$ 400k). **Uma campanha de CRESCIMENTO medida por sell-in premiaria o mês de compra-em-lote e puniria o mês de venda real — exatamente o avesso do que a indústria quer.**

---

## 1. Diagnóstico comercial (por tipo)

**CRESCIMENTO (sell-in R$).** Induz o lojista a **antecipar compra no fim da campanha** pra bater meta. O número infla, a indústria paga premiação sobre caixa parada, e no período seguinte ele não compra (já estocado) → a campanha quebra a recorrência. Os dados do par 119×3 escancaram: sell-in serra-elétrica, sell-out reta.

**VOLUME (sell-in unidades).** Pior caso de empurrar: a meta é só quantidade, então a jogada ótima é **um pedido grande de uma peça barata** no fechamento. Premia tonelagem de depósito, não saída de prateleira. Risco de ruptura mascarada (estoque alto na loja, zero giro).

**POSITIVACAO (meses com pedido).** Induz **micro-pedido mensal só pra marcar presença** ("comprei pra não perder a campanha"). Conta meses em que ele *comprou*, não meses em que ele *vendeu*. Um lojista pode positivar 6/6 meses comprando R$ 50 e não girar nada.

**MIX (famílias distintas via `pro_grupo`).** Aqui o sell-in **não é o vilão principal** — a meta é diversidade de catálogo, e a jogada de "comprar 1 peça de cada família no fim" é cara e pouco atraente, então distorce menos. **Porém o dado de sell-out atual não tem família** — não dá pra apurar Mix por giro hoje sem mudar o grão (ver §3).

**Resumo:** os três tipos quantitativos (CRESCIMENTO, VOLUME, POSITIVACAO) premiam comportamento de compra que pode não virar venda. MIX é o menos distorcido mas o mais difícil de virar (falta dado).

---

## 2. Proposta de apuração sell-out (a regra nova, com SQL)

Premissa: a campanha é de um par `cli_codigo × for_codigo`, janela `[cmp_campanha_ini, cmp_campanha_fim]`. `crm_sellout.periodo` é o 1º dia do mês; a campanha conta os meses cuja `periodo` cai dentro da janela. Como hoje o controller usa `cmp_cliente_id`/`cmp_industria_id`, a query nova só troca a fonte de `itens_ped/pedidos` por `crm_sellout`.

### CRESCIMENTO (R$ vendido na ponta)
```sql
SELECT COALESCE(SUM(s.valor), 0) AS realizado
FROM crm_sellout s
WHERE s.cli_codigo = $1            -- cmp_cliente_id
  AND s.for_codigo = $2            -- cmp_industria_id
  AND s.periodo >= DATE_TRUNC('month', $3::date)   -- cmp_campanha_ini
  AND s.periodo <= DATE_TRUNC('month', $4::date);  -- cmp_campanha_fim
```
`meta = cmp_meta_valor_total`. label: **"R$ vendido na ponta (sell-out)"**.

### VOLUME (unidades vendidas na ponta)
```sql
SELECT COALESCE(SUM(s.quantidade), 0) AS realizado
FROM crm_sellout s
WHERE s.cli_codigo = $1 AND s.for_codigo = $2
  AND s.periodo >= DATE_TRUNC('month', $3::date)
  AND s.periodo <= DATE_TRUNC('month', $4::date);
```
`meta = cmp_meta_qtd_total`. label: **"unidades vendidas (sell-out)"**.

### POSITIVACAO (meses com VENDA reportada — não com pedido)
Muda a semântica de "ativação" para o conceito correto: meses em que o produto **girou** na ponta. Conta mês com sell-out > 0.
```sql
SELECT COUNT(*) AS realizado
FROM crm_sellout s
WHERE s.cli_codigo = $1 AND s.for_codigo = $2
  AND s.periodo >= DATE_TRUNC('month', $3::date)
  AND s.periodo <= DATE_TRUNC('month', $4::date)
  AND s.valor > 0;
```
`meta = cmp_meta_qtd_total`. label: **"meses com venda na ponta (sell-out)"**.

### MIX
**Não migra agora.** Sell-out atual não tem família. Ver decisão §3.

### Sell-through (KPI de transparência, dual-view — não é meta, é diagnóstico)
```sql
-- sell_in (R$) no mesmo par/janela, do jeito que o auto-progress já faz hoje
-- sell_through% = sell_out / sell_in * 100
```
Exibir os três lado a lado em toda campanha: **comprou (sell-in) · vendeu (sell-out) · giro (sell-through%)**. É o que denuncia estoque empurrado na tela do REP.

---

## 3. Decisão de dados do MIX (recomendação)

**Problema:** Mix conta famílias distintas (`pro_grupo`). `crm_sellout` é agregado por cliente×indústria×mês — **não tem produto nem família**. Não dá pra fazer `COUNT(DISTINCT família)` de um número que não carrega família. Não inventar granularidade (mandamento #2).

**Opção A — capturar sell-out por SKU (grão novo).** Tabela filha `crm_sellout_item` (ou coluna de produto em `crm_sellout`), import Excel passa a aceitar coluna produto/família. Dono: `dba` (DDL/índice/migration). **Trade-off:** libera Mix por sell-out + relatórios finos (ruptura por SKU, ABC de giro, cross-sell real) — mas **exige que o lojista reporte sell-out detalhado por item**, o que poucos fazem; cobertura por SKU será baixíssima no início (hoje a maioria dos tenants nem reporta agregado).

**Opção B — manter Mix como sell-in declarado, rotulado.** Mix continua `COUNT(DISTINCT pro_grupo)` do pedido, marcado explicitamente `cmp_base_apuracao = SELL_IN` (exceção honesta, mandamento #1). **Trade-off:** zero trabalho de dado, mas Mix nunca mede giro de família.

**Recomendação:** **B agora, A como roadmap.** Mix é o tipo que **menos distorce** em sell-in (diversificar comprando-pra-estocar é caro e raro) e o que **mais custa** capturar por sell-out. Vira-se CRESCIMENTO/VOLUME/POSITIVACAO já (dado existe), mantém-se Mix como sell-in rotulado, e a captura por SKU entra como fase futura **quando houver lojista pedindo Mix por giro** — não se constrói grão novo antes da demanda. A tela deve mostrar selo "apurado por sell-in — giro não confirmado" em toda campanha Mix.

---

## 4. Cobertura como pré-requisito (com os números medidos)

Sell-out só é justo se o lojista reporta. A medição mostra **cobertura muito desigual**: `ro_consult`/`softham` têm anos de histórico (158/155 pares, 40+ meses); `brasil_wl`/`jsaviorep` têm início; **`alcarep` e `remap` têm zero**. Não dá pra impor sell-out global.

**Regra de tratamento do par sem reporte (na janela da campanha):**
1. **Par COM sell-out no período** → apura por sell-out (régua).
2. **Par SEM sell-out no período, mas o lojista reporta normalmente** (tem histórico recente em `crm_sellout`) → tratar como **pendência de reporte** (reusar `GET /api/sellout/pendencies`, que já lista quem reportou antes e parou). A campanha mostra "aguardando reporte do mês X", não zera o realizado caladamente.
3. **Par/tenant que não reporta sell-out** → a campanha **cai em sell-in declarado** (`cmp_base_apuracao = SELL_IN`), com selo visível "apurado por sell-in — giro não confirmado". Onboarding de reporte vira pré-condição pra ele acessar campanha por sell-out.

**Gate na criação:** ao escolher `SELL_OUT`, a tela checa a cobertura do par (últimos N meses do `crm_sellout`) e avisa: "Este cliente não reporta sell-out — a campanha será apurada por sell-in (proxy) ou faça o onboarding de reporte primeiro." Decisão consciente do REP, nunca silenciosa.

---

## 5. Plano de transição (PRODUÇÃO VIVA — 30+ REPs)

1. **Gravar o critério NA campanha.** Nova coluna `cmp_base_apuracao VARCHAR(8) NOT NULL DEFAULT 'SELL_IN'` com CHECK `IN ('SELL_OUT','SELL_IN')`. Cada campanha sabe como foi/é medida — não um flag global volátil (mandamento #5). Dono: `dba`.
2. **Preservar histórico de acordo firmado.** Toda campanha existente nasce `SELL_IN` (default) — **nenhum número de campanha já firmada muda**. A virada vale só pra campanhas novas (ou re-opt-in explícito de uma campanha em SIMULACAO, nunca de uma ATIVA/CONCLUIDA com acordo).
3. **`auto-progress` ramifica por `cmp_base_apuracao`.** `SELL_OUT` → queries §2; `SELL_IN` → queries de hoje (intactas). MIX sempre cai em SELL_IN enquanto não houver grão por SKU.
4. **Dual-view na tela.** Monitoramento mostra sempre **Comprou (sell-in) · Vendeu (sell-out) · Giro (sell-through%)** + selo da base de apuração da campanha. Para campanha SELL_OUT sem reporte no mês: estado "aguardando reporte" (não "0%").
5. **Default de campanhas novas = SELL_OUT** quando o par tem cobertura; senão sugere SELL_IN com aviso. O REP confirma.
6. **Comunicação:** post na Central de Notícias explicando a virada ("agora a campanha mede o giro real, não o estoque") + atualização do `docs/manual-repone.md` e do Guia de Campanhas embutido na tela.

---

## 6. Fases de implementação (roteiro — sem escrever código)

**Fase 0 — dado/estrutura (dono: `dba`, pgAdmin, migration idempotente replicada nos tenants)**
- `ALTER TABLE campanhas_promocionais ADD COLUMN cmp_base_apuracao` (default `SELL_IN`, CHECK).
- Índice em `crm_sellout (cli_codigo, for_codigo, periodo)` se ainda não cobrir bem a query de apuração (validar plano).
- (Roadmap, só quando Mix por giro for demandado) modelar `crm_sellout_item` / grão por SKU.

**Fase 1 — backend (dono: app / controller)**
- `auto-progress`: ramificar por `cmp_base_apuracao`; adicionar queries sell-out §2; calcular sell-through; retornar `sell_in`, `sell_out`, `sell_through`, `base_apuracao`, estado de cobertura.
- `create`/`update`: aceitar e gravar `cmp_base_apuracao`.
- Endpoint/uso de cobertura do par na criação (reaproveitar lógica de `sellout/pendencies`).

**Fase 2 — frontend (dono: app / `CampanhasPage.tsx`)**
- Seletor de base de apuração no Planejamento (default por cobertura do par + aviso).
- Monitoramento dual-view (comprou/vendeu/giro) + selos "sell-out" / "sell-in — giro não confirmado" / "aguardando reporte".
- Atualizar Guia de Campanhas e copy dos 4 tipos.

**Fase 3 — comunicação**
- Post Central de Notícias + manual.

**Roadmap (pós-aprovação separada): Mix por sell-out** = Fase 0-A (grão SKU, `dba`) + import detalhado + apuração `COUNT(DISTINCT família)` sobre `crm_sellout_item`.

---

## 7. Riscos

1. **Cobertura baixa = campanha "travada em 0%".** Maioria dos tenants não reporta. Mitigação: gate na criação + estado "aguardando reporte" + fallback sell-in rotulado. Nunca zerar silenciosamente.
2. **Sell-out depende de input manual/Excel do lojista** → atraso/erro de reporte afeta o realizado. Mitigação: pendências já existentes, dual-view deixa o gap visível, prazo de fechamento por mês.
3. **Quebra de confiança se mudar número de acordo firmado.** Mitigação dura: default SELL_IN nas existentes, virada só em campanha nova/SIMULACAO.
4. **Semântica de POSITIVACAO muda** (de "comprou no mês" para "vendeu no mês"). Tecnicamente mais correto, mas é mudança conceitual — comunicar bem no Guia e na Central de Notícias.
5. **Mix gera expectativa de "sell-out" que o dado não entrega.** Mitigação: selo explícito de sell-in; não prometer giro de família antes do grão SKU.
6. **Mês de borda** (sell-out reportado no início do mês seguinte ao fim da campanha) pode ficar de fora. Definir regra de corte por `periodo` do mês e janela de reporte.

---

## Decisões que dependem do Hamilton (com recomendação)

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Virar CRESCIMENTO/VOLUME/POSITIVACAO para sell-out? | **Sim** — dado existe e o par 119×3 prova a distorção do sell-in. |
| D2 | POSITIVACAO passa a contar "meses com venda" em vez de "meses com pedido"? | **Sim** — é o conceito correto de giro; comunicar a mudança. |
| D3 | MIX: capturar por SKU agora (A) ou manter sell-in rotulado (B)? | **B agora, A no roadmap** — Mix distorce pouco e custa muito capturar. |
| D4 | Coluna `cmp_base_apuracao` gravada na campanha (vs flag global)? | **Sim, na campanha** — preserva histórico e dá rastreabilidade. |
| D5 | Default de campanha nova = SELL_OUT quando há cobertura? | **Sim**, com fallback automático para SELL_IN + aviso quando não há reporte. |
| D6 | Par sem reporte: bloquear, ou cair em sell-in rotulado? | **Cair em sell-in rotulado** + oferecer onboarding; nunca bloquear o REP. |
| D7 | Campanhas já ATIVAS/CONCLUÍDAS são reescritas? | **Não** — ficam SELL_IN; virada só pra novas/SIMULACAO. |
