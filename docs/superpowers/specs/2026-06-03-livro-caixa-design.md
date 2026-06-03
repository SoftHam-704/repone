# Livro Caixa — Design

**Data:** 2026-06-03
**Módulo:** Financeiro (RepOne / SalesMasters V2)
**Autor:** Hamilton × Claude (bambambam do financeiro)

## Objetivo

Construir um **Livro Caixa** de verdade: contas (caixa físico + bancos + PIX), cada uma com
saldo inicial e lançamentos de crédito/débito formando uma **conta corrente** com saldo corrido,
e **passagem de saldo de um mês para o outro**. Os lançamentos vêm de **duas fontes**: manuais
(aporte, retirada, tarifa, transferência) e **automáticos das baixas** do Contas a Pagar/Receber
("tudo vai pro caixa").

## Decisões travadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Origem dos lançamentos | **Manual + automático das baixas** (CP/CR) |
| Quantidade de caixas | **Vários** (Caixa, bancos, PIX…) — conta corrente por conta, com transferência entre elas |
| Passagem de saldo | **Sempre calculado** (saldo inicial + Σ lançamentos). Sem fechamento/ritual. SALDO ANTERIOR por mês exibido no topo |
| Classificação | Plano de Contas + Centro de Custo **opcionais** por lançamento; baixas **herdam** os da conta de origem |
| Permissão | **Gerência + Master** (herda `requireLevel(LEVEL.GERENCIA)` do Financeiro) |
| Plataforma | **Web só** (ferramenta de escritório, não de campo) |
| Pagamento com/sem imposto + teto | Baixa do **Contas a Pagar** registra split `sem imposto`/`com imposto`; teto **mensal configurável por empresa** (default 0 = desligado); ao ultrapassar, **só avisa** (não trava) |

## Modelo de dados (2 tabelas novas, por tenant)

### `livro_caixa_contas`
As contas/caixas da empresa.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | SERIAL PK | |
| `conta_nome` | VARCHAR(100) NOT NULL | "Caixa", "Banco do Brasil", "PIX"… |
| `conta_tipo` | VARCHAR(20) NOT NULL DEFAULT 'caixa' | `caixa` / `banco` / `pix` / `outro` |
| `saldo_inicial` | NUMERIC(14,2) NOT NULL DEFAULT 0 | saldo de abertura da conta |
| `data_saldo_inicial` | DATE NOT NULL | data a que o saldo inicial se refere |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | inativar em vez de excluir se já tiver lançamento |
| `criado_em` | TIMESTAMP DEFAULT now() | |

### `livro_caixa_lancamentos`
Os movimentos.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | SERIAL PK | |
| `conta_id` | INTEGER NOT NULL REFERENCES livro_caixa_contas(id) | |
| `data` | DATE NOT NULL | data do movimento (define a ordem do saldo) |
| `historico` | TEXT NOT NULL | descrição livre |
| `tipo` | CHAR(1) NOT NULL CHECK (tipo IN ('C','D')) | C = crédito (entra) / D = débito (sai) |
| `valor` | NUMERIC(14,2) NOT NULL CHECK (valor > 0) | sempre positivo; o sinal vem do `tipo` |
| `id_plano_contas` | INTEGER NULL REFERENCES fin_plano_contas(id) | opcional |
| `id_centro_custo` | INTEGER NULL REFERENCES fin_centro_custo(id) | opcional |
| `documento` | VARCHAR(60) NULL | nº NF, cheque, comprovante… |
| `origem` | CHAR(2) NOT NULL DEFAULT 'MA' | `MA` manual / `CP` conta a pagar / `CR` conta a receber / `TR` transferência |
| `id_parcela_origem` | INTEGER NULL | parcela CP/CR que gerou (p/ rastreio e estorno) |
| `id_transferencia` | INTEGER NULL | agrupa o par de uma transferência |
| `criado_em` | TIMESTAMP DEFAULT now() | |

Índices: `(conta_id, data, id)` para o saldo corrido; `(origem, id_parcela_origem)` para o estorno
das baixas.

**Migration:** SQL idempotente para pgAdmin, no padrão `DO $$ FOR s IN (schemas dos tenants) LOOP
EXECUTE format('CREATE TABLE IF NOT EXISTS %I.livro_caixa_contas …') … END LOOP`. Hamilton roda no
`basesales`. Numeração após a 062 (provavelmente `063`/`064`).

## Saldo / conta corrente

Tudo derivado — nada gravado por mês:

- **Saldo de uma conta numa data D** = `saldo_inicial + Σ(crédito) − Σ(débito)` de todos os
  lançamentos com `data <= D`, ordenados por `(data, id)`.
- **SALDO ANTERIOR de um mês** = saldo no último dia do mês anterior (= soma de tudo antes do 1º
  dia do mês selecionado).
- **Saldo por linha** (extrato): saldo acumulado até aquela linha, calculado no backend e devolvido
  junto de cada lançamento (não recalcular no front).
- **Saldo atual da conta** = saldo até hoje. Usado nos cards de resumo.

O cálculo do saldo anterior + corrido é feito no SQL da listagem (window function
`SUM(...) OVER (ORDER BY data, id)`), com um SELECT separado para o saldo anterior ao período.

## Origem dos lançamentos

### 1. Manuais (`origem='MA'`)
Aporte, retirada, tarifa bancária, ajuste. CRUD completo no Livro Caixa — criar/editar/excluir
livremente. Escolhem conta, data, histórico, tipo C/D, valor, e opcionalmente plano/centro/documento.

### 2. Baixa de Conta a Pagar (`origem='CP'`, tipo `D`)
Quando uma parcela do Contas a Pagar é baixada (paga), gera **automaticamente** um lançamento de
**débito** no caixa. **Só-leitura** no Livro Caixa — para alterar/estornar, mexe-se na conta a pagar.

### 3. Baixa de Conta a Receber (`origem='CR'`, tipo `C`)
Quando uma parcela do Contas a Receber é baixada (recebida), gera **automaticamente** um lançamento
de **crédito** no caixa. **Só-leitura** no Livro Caixa.

### 4. Transferência entre contas (`origem='TR'`)
Transferir de uma conta para outra gera **um par de lançamentos vinculados** pelo mesmo
`id_transferencia`: **débito** na conta origem + **crédito** na conta destino, mesmo valor e data.
Editar/excluir trata o par junto. Não altera o saldo total da empresa, só migra entre contas.

## Integração com a baixa existente

A baixa já existe e roda **por parcela**, dentro de `db.transaction`. Pontos exatos:

- `baixaContaPagarHandler` (`financeiro.controller.ts:434`) — dentro da transação, **após** marcar a
  parcela `PAGO`, INSERT em `livro_caixa_lancamentos` com `tipo='D'`, `origem='CP'`,
  `id_parcela_origem=id_parcela`, `valor` = **valor da baixa** (ver regra abaixo),
  `conta_id` = caixa escolhido, herdando `id_plano_contas`/`id_centro_custo` da `fin_contas_pagar`,
  `historico` = descrição da conta + documento.
- `baixaContaReceberHandler` (`financeiro.controller.ts:681`) — análogo, `tipo='C'`, `origem='CR'`,
  herda da `fin_contas_receber`.
- **Reabertura/estorno** (`fin_parcelas_*` → `status='ABERTO'`, `~financeiro.controller.ts:390/637`)
  — DELETE do lançamento de caixa correspondente (`origem` + `id_parcela_origem`) dentro da mesma
  transação, para nunca ficar órfão nem duplicar.

**Novos campos na requisição de baixa:**
- `id_conta_caixa` (em qual caixa o dinheiro entrou/saiu) — **obrigatório** para a baixa concluir;
  sem caixa, não há para onde lançar. O modal de baixa (em `ContasPagarPage.tsx` e
  `ContasReceberPage.tsx`) ganha um **SearchCombobox de conta de caixa**.
- `valor_sem_imposto` / `valor_com_imposto` (**só Contas a Pagar**) — split do `valor_pago`; ver a
  seção "Pagamento com imposto / teto mensal". A resposta pode incluir `aviso_teto_imposto`.

**Regra do valor do lançamento (confirmar com Hamilton no review):** o caixa registra o **dinheiro
que efetivamente se moveu**. Proposta: `valor_lançado = valor_pago + juros` para CP (débito) e
`valor_recebido + juros` para CR (crédito); `desconto` **não** entra no caixa (é abatimento da
dívida, não saída/entrada de dinheiro). Se Hamilton preferir, usa-se apenas `valor_pago` /
`valor_recebido` puro.

## Pagamento com imposto / teto mensal (Contas a Pagar)

**Contexto (pesquisado):** não existe teto legal universal sobre "pagamento com imposto" na reforma
tributária — o *split payment* (separação automática de IBS/CBS no pagamento) **não tem teto**, e
2026 é ano-teste (CBS 0,9% / IBS 0,1%, sem recolhimento). Os únicos tetos com número fixo são
**anuais** e do Simples Nacional (sublimite R$ 3,6 mi / limite R$ 4,8 mi de **faturamento**). Logo, o
"teto mensal com imposto, quando atinge para" da REMAP é **regra interna/contábil deles**, não lei.
**Decisão:** modelar como **parâmetro configurável**, não como número fixo no código.

**Mecânica:**
- Na baixa do Contas a Pagar, o valor pago é informado em **duas parcelas**: `valor_sem_imposto` +
  `valor_com_imposto` (somam o `valor_pago`). O débito no caixa continua sendo o total — o split é
  **metadado fiscal**, não muda o saldo.
- Persistência: colunas novas em `fin_parcelas_pagar` — `valor_com_imposto NUMERIC(14,2) DEFAULT 0`
  e `valor_sem_imposto NUMERIC(14,2) DEFAULT 0`. (Cada baixa grava na própria parcela; baixa parcial
  já gera resíduo em parcela nova com 0/0 até ser baixada.)
- **Acumulador do mês = derivado** (nada redundante): `SUM(valor_com_imposto)` das parcelas com
  `status='PAGO'` e `data_pagamento` no mês corrente.
- **Teto:** parâmetro por empresa — `emp_teto_com_imposto_mensal NUMERIC(14,2) DEFAULT 0` em
  `empresa_status`. **0 (default) = recurso desligado** → não afeta os demais reps. Configurável na
  tela de Parâmetros (campo "Teto mensal de pagamento com imposto").
- **Comportamento ao ultrapassar:** **só avisa** (não trava). Se `teto > 0` e
  `acumulado_do_mês + valor_com_imposto_desta_baixa > teto`, o backend devolve um flag
  `aviso_teto_imposto` na resposta da baixa; o front mostra um alerta ("Você ultrapassou o teto do
  mês: R$ X de R$ Teto") mas conclui a baixa normalmente.
- **UI na baixa:** o modal de baixa do Contas a Pagar ganha os dois campos (sem/com imposto,
  mascarados pt-BR, com a soma travada no valor pago) + um indicador discreto "Com imposto no mês:
  R$ X de R$ Teto" quando o teto está ligado. **Só aparece quando `teto > 0`** (senão, baixa segue
  como hoje, sem nada novo na tela).
- **Escopo:** apenas **Contas a Pagar** (Contas a Receber fora deste escopo).

## Backend — módulo `livro-caixa`

Arquivos novos:
- `backend/src/modules/livro-caixa/livro-caixa.controller.ts`
- `backend/src/modules/livro-caixa/livro-caixa.routes.ts` (montado em `app.ts` sob
  `/api/livro-caixa`, com `authMiddleware, tenantMiddleware, requireLevel(LEVEL.GERENCIA)`)

Endpoints:
| Método | Rota | Função |
|--------|------|--------|
| GET | `/contas` | lista contas + saldo atual de cada uma |
| POST | `/contas` | cria conta (com saldo inicial) |
| PUT | `/contas/:id` | edita conta |
| DELETE | `/contas/:id` | inativa (ou exclui se sem lançamento) |
| GET | `/lancamentos?conta_id=&mes=&ano=` | extrato do período: saldo anterior + lançamentos com saldo corrido |
| POST | `/lancamentos` | cria lançamento manual |
| PUT | `/lancamentos/:id` | edita lançamento manual (bloqueia se `origem != 'MA'`) |
| DELETE | `/lancamentos/:id` | exclui manual / par de transferência (bloqueia CP/CR) |
| POST | `/transferencia` | cria o par (D origem + C destino) |
| GET | `/resumo` | saldo de todas as contas + total geral (cards) |

Modificações:
- `financeiro.controller.ts` — gancho de INSERT/DELETE de lançamento de caixa nos handlers de baixa
  e de reabertura (CP e CR). Helper compartilhado p/ não duplicar
  (`lancarBaixaNoCaixa(client, {...})` / `estornarBaixaDoCaixa(client, {...})`).

Toda query usa `req.db!`. Transações via `db.transaction` (padrão da casa). Coerção de NUMERIC com
`Number()` ao devolver pro front.

## Frontend — `LivroCaixaPage.tsx`

`src/modules/financeiro/pages/LivroCaixaPage.tsx`, no menu Financeiro, padrão Areia+Navy
(tokens `G` locais, hero navy, KPI strip, tabela, modais — igual `PlanoContasPage`/`ContasPagarPage`).

Layout:
- **Hero navy**: título + SearchCombobox de **conta** + seletor de **mês/ano**.
- **KPI strip** (margin-top negativo): cards de **saldo atual por conta** + **total geral**.
- **Faixa de período**: **SALDO ANTERIOR** (grande) da conta selecionada no mês.
- **Tabela conta-corrente**: Data · Histórico · (Plano/Centro, discretos) · Documento · **Débito** ·
  **Crédito** · **Saldo** (corrido). Linhas de baixa com selo de origem (CP/CR) e visual "só-leitura".
- **Botões**: **Novo lançamento** (modal: conta, data, histórico, tipo C/D, valor mascarado pt-BR,
  plano/centro opcionais, documento) e **Transferência** (modal: conta origem, conta destino, valor,
  data, histórico).
- **Cadastro de contas**: modal/seção simples (nome, tipo, saldo inicial, data, ativo) — pode ser um
  botão "Contas" abrindo a lista CRUD.

Reusa os componentes de modal/máscara já criados (CustomCombobox/SearchCombobox,
`maskBRLFromDigits`/`digitsToReais`).

## Migrations necessárias (SQL idempotente p/ pgAdmin, loop nos schemas de tenant)

Numeração após a 062 — provavelmente `063`–`065`. Hamilton roda no `basesales`.

1. `CREATE TABLE IF NOT EXISTS livro_caixa_contas` (+ índices).
2. `CREATE TABLE IF NOT EXISTS livro_caixa_lancamentos` (+ índices
   `(conta_id, data, id)` e `(origem, id_parcela_origem)`).
3. `ALTER TABLE fin_parcelas_pagar ADD COLUMN IF NOT EXISTS valor_com_imposto NUMERIC(14,2) DEFAULT 0`
   e `valor_sem_imposto NUMERIC(14,2) DEFAULT 0`.
4. `ALTER TABLE empresa_status ADD COLUMN IF NOT EXISTS emp_teto_com_imposto_mensal NUMERIC(14,2)
   DEFAULT 0`.

Todas no padrão `DO $$ FOR s IN (SELECT schema_name … tenants) LOOP EXECUTE format(...) END LOOP`,
com `IF NOT EXISTS` para rodar sem medo em produção viva.

## Fora de escopo (YAGNI)

- Mobile (é ferramenta de escritório).
- Fechamento mensal com trava (decidido: saldo sempre calculado).
- Conciliação bancária / importação OFX.
- Multi-moeda.
- Relatórios novos de caixa além do extrato (o Fluxo de Caixa/DRE já existem; integração futura
  possível via `id_plano_contas`).

## Pontos a confirmar no review

1. **Regra do valor do lançamento na baixa** (valor_pago+juros vs valor_pago puro) — ver seção
   de integração.
2. Numeração final das migrations (063/064).
