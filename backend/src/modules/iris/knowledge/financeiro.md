# Financeiro do RepOne (área administrativa — Master / Gerência)

O módulo Financeiro **não é do REP vendedor** — é a área administrativa de gestão do dinheiro da empresa. Acesso: **Gerência+** (operador não entra); e **Livro Caixa, Fluxo de Caixa e DRE são só do MASTER** (acessados pelo Dashboard Hub do Financeiro). Não confunda com o mundo de vendas do REP.

## Telas
- **Dashboard Hub (Financeiro)** — painel administrativo: a receber, a pagar, saldo previsto, inadimplência, gráfico receitas × despesas, alertas de vencimento, e os atalhos das ferramentas (Livro Caixa, Fluxo de Caixa, DRE, e NFSe em breve).
- **Contas a Receber / Contas a Pagar** — títulos com vencimento e parcelas. São as **previsões**: em aberto = previsto, **baixado = realizado**. Dá pra agrupar por **centro de custo** e usar o **Lançamento em Lote** (gerar várias parcelas de uma vez). **Dar baixa** = registrar o recebimento/pagamento — e isso já lança no Livro Caixa.
- **Livro Caixa** (conta corrente) — o coração do caixa. Tem **várias contas** (Caixa, bancos, PIX), cada uma com **saldo inicial** e **lançamentos de crédito (entrada) e débito (saída)**, formando uma conta corrente com **saldo corrido**; o saldo passa de um mês para o outro automaticamente. Faz **transferência entre contas**. Os lançamentos vêm de dois lugares: **manuais** (aporte, retirada, tarifa) e **automáticos das baixas** (Contas a Pagar pago → débito; Contas a Receber recebido → crédito). Filtra por período (de/até), o extrato é ordenado pela **sequência** (não aceita lançamento retroativo) e o saldo é **sempre calculado** (nunca desbate).
- **Fluxo de Caixa** — relatório de entradas e saídas projetadas por período.
- **DRE Gerencial** — demonstrativo de resultado: receitas − despesas = resultado / margem.
- **Plano de Contas** — estrutura de contas. **Sintética** = conta-grupo/totalizadora; **analítica** = folha. Só se **lança movimento em conta analítica** (nunca em sintética).
- **Centro de Custo** — classifica receitas e despesas por área.

## Imposto (reforma tributária)
Na baixa do **Contas a Pagar** dá pra separar quanto foi pago **com imposto** e **sem imposto**. Há um **teto mensal de "com imposto"** configurável por empresa — ao ultrapassar, o sistema **só avisa** (não trava). **NFSe das comissões:** em desenvolvimento (emitir a nota de serviço das comissões e separar os impostos a pagar).

## Glossário rápido
- **Previsão** = conta a pagar/receber em aberto (o que vai entrar/sair).
- **Realizado** ("pintar de amarelo" na planilha antiga) = título baixado (pago/recebido).
- **Baixa** = registrar o pagamento/recebimento; gera o lançamento no caixa.
- **Crédito** = entrada de dinheiro · **Débito** = saída.
- **Conta sintética × analítica** = grupo × folha (lança só na analítica).
- **Saldo anterior** = saldo da conta antes do período; **saldo final** = depois.

Regra: o Financeiro é área de gestão (Master/Gerência). Oriente o gestor para a tela certa ("isso você vê em **Financeiro → Livro Caixa**", ou pelo **Dashboard Hub do Financeiro**), sem prometer prazo nem falar de tecnologia.
