# Decisões do ofício (o PORQUÊ das regras) — log append-only

> Aqui mora o *motivo* por trás das regras que a IRIS aplica. Sem isto, ela sabe o "o quê" mas não o "por quê" — e não consegue **explicar** ao REP nem evitar contradições. Formato append-only: nunca reescrever o passado, só adicionar. Não inventar — só registrar o que está decidido no produto.

---

## 2026-06-04 — Campanha mede sell-out, não sell-in
- **Decisão:** o progresso de campanha apura o que o lojista **VENDEU** (sell-out), nunca o que **COMPROU** (sell-in).
- **Motivo:** empurrar sell-in infla estoque na loja e mascara o resultado real; a indústria quer giro no balcão, não estoque parado.
- **Como a IRIS aplica:** ao falar de campanha, nunca somar pedido (sell-in) como progresso; usar o sell-out registrado.

## 2026-06-07 — Apurar financeiro pela PARCELA, nunca pelo cabeçalho
- **Decisão:** valor de um período soma as **parcelas** que vencem/pagam no intervalo (saldo = valor − pago), não o `valor_total` da conta.
- **Motivo:** uma conta pode ter parcelas em vários meses; somar o total pelo cabeçalho infla o período (bug real: jun aparecia R$ 635 mil em vez de R$ 60 mil).
- **Como a IRIS aplica:** ao comentar contas a pagar/receber por período, raciocinar por parcela.

## 2026-06-08 — Bonificação pendente (D) não conta em vendas/BI
- **Decisão:** o status **D** (bonificação pendente) fica fora de vendas, meta, BI e comissão até ser aprovado e virar **B**.
- **Motivo:** é um acordo ainda não confirmado; contar antes da aprovação distorce meta e comissão.
- **Como a IRIS aplica:** só **P** e **F** valem como venda; **E** nunca conta; **D** e cotações (C/A) ficam de fora da apuração.

## (regra antiga, sempre válida) — Status E = excluído, nunca conta
- **Decisão:** pedido com `ped_situacao = 'E'` é soft-delete: fica no banco mas **jamais** entra em vendas/estatística.
- **Motivo:** preservar histórico/auditoria sem poluir número.

## (regra antiga, sempre válida) — O banco calcula, o modelo não estima
- **Decisão:** todo número da IRIS vem de tool/relatório determinístico.
- **Motivo:** um número errado dito com confiança destrói a confiança do REP; precisão > esperteza.
- **Como a IRIS aplica:** sem tool pro número → admite que não tem, não chuta.

---

> **Como crescer este log:** quando uma nova regra de negócio for decidida (ou o porquê de uma existente for esclarecido), adicionar uma entrada `## AAAA-MM-DD — título`, com Decisão / Motivo / Como a IRIS aplica. Append-only.
