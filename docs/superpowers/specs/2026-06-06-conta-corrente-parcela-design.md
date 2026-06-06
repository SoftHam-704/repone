# Conta Corrente da Parcela (Contas a Pagar) — Design

**Data:** 2026-06-06 · **Solicitante:** Lorena (Remap) + Hamilton · **Criticidade:** ALTA (dinheiro em produção)

## Problema
Hoje a baixa **sobrescreve a parcela** (`UPDATE fin_parcelas_pagar SET valor_pago, data_pagamento, status='PAGO'`).
A parcela **É** o pagamento → só guarda a ÚLTIMA baixa; pagamento parcial vira "parcela PAGO +
parcela de resíduo" (fragmenta e perde histórico); **não há estorno**.

## Modelo aprovado: parcela (pai) + baixas/estornos (filhas), alimentando o caixa
Fluxo da Lorena (validado): **1 parcela com o valor total**, baixada **parcialmente** várias vezes até quitar.

### Tabelas
- **`fin_parcelas_pagar` (pai / obrigação):** valor, data_vencimento, status. **Não é mais sobrescrita
  com dados de pagamento.** `valor_pago`/`data_pagamento` da parcela passam a ser DERIVADOS do ledger
  (mantidos por trigger ou recálculo no app — decisão do DBA). **Abandona o resíduo** (Hamilton 2026-06-06).
- **`fin_baixas_pagar` (filhas / extrato) — NOVA:**
  `id · id_parcela · tipo('BAIXA'|'ESTORNO') · data · valor_pago · juros · desconto · id_conta_caixa ·
   id_lancamento_caixa · observacoes · estorno_de (FK p/ a baixa estornada, NULL em BAIXA) · created_by · created_at`.

### Regras de cálculo
- **Abatimento da parcela** = `Σ (baixa.valor_pago + baixa.desconto)` − `Σ estornos`.
- **Saldo da parcela** = `valor − abatimento`. Status PAGO quando saldo ≈ 0.
- **Caixa (saída)** por baixa = `valor_pago + juros`. (juros = encargo: sai do caixa, não abate principal.)
- **Conta** `valor_pago`/`saldo` = soma das parcelas.

### Fluxos
- **Baixa** (integral ou parcial): INSERT movimento BAIXA + lançamento no caixa (D, origem 'CP',
  `id_parcela_origem`), gravando `id_lancamento_caixa` no movimento. Recalcula parcela/conta.
- **Estorno**: INSERT movimento ESTORNO (`estorno_de` = baixa) + **reverte no caixa** (lançamento C
  ou estorno do original). Devolve o valor ao saldo. Recalcula parcela/conta.
- **Conciliação:** todo movimento ↔ um lançamento de caixa (link bidirecional).

## Migração dos dados atuais (DBA) — INVARIANTE
Para cada parcela PAGO de hoje: criar 1 movimento **BAIXA** = `valor_pago` (com data/juros/desconto e o
`id_lancamento_caixa` já existente via livro_caixa origem='CP'/id_parcela_origem, quando achável).
**Invariante a garantir:** após a migração, o **total pago** e o **saldo de cada conta** são idênticos
ao de antes. (Os resíduos atuais permanecem como parcelas ABERTAS normais — preservam o saldo.)

## Escopo de implementação
- DBA: `fin_baixas_pagar` (31 tenants, idempotente) + migração com asserts da invariante.
- Backend: reescrever `baixaContaPagarHandler` (insere movimento), novo `estornoBaixaHandler`,
  recálculo da parcela/conta a partir do ledger, endpoint de extrato da parcela.
- Frontend: extrato (conta corrente) da parcela no detalhe + botão **Estornar**.
- Folda o seletor **Vencimento ⇄ Pagamento**: "pago no período" = `Σ baixas − Σ estornos` no intervalo.
