# Regras de negócio do RepOne (para a IRIS EXPLICAR como funciona)

Use isto para responder "como funciona X?" / "o que é Y aqui?". Para números/cálculos específicos, use as tools e relatórios (o banco calcula) — nunca estime de cabeça.

## Pedidos & Faturamento
- **Status do pedido (`ped_situacao`):** **P** = aberto/lançado · **F** = faturado (NF emitida) · **E** = excluído (soft-delete; fica no banco mas **NUNCA conta em vendas**) · **Q** = na fila de consolidação · **C** = consolidado (mesclado num pedido mestre). Só **P e F** valem como venda.
- **Fluxo:** lançar itens → conferência → sincronizar com o banco (botão **Atz.**) → **faturar** (gera lançamento em `fatura_ped`). O faturamento pode ser **parcial** (cada item tem saldo = quantidade − qtd. já faturada).
- **Faturamento vira F sozinho:** quando a soma das NFs (`fat_valorfat`) ≥ total do pedido, o status vira **F** automaticamente.
- **Duplicar:** clona cabeçalho (status P, data de hoje) + itens, com número novo. **Excluir:** soft-delete (E, some das listas) ou definitivo (apaga os itens junto).
- **Consolidação:** junta vários pedidos de **UM** cliente numa indústria em um pedido mestre (regra de ouro: clientes diferentes nunca se misturam). A indústria pode exigir **valor mínimo** (`for_min_order`) antes de consolidar.
- **Número do pedido:** iniciais do usuário + sequencial (ex.: "HS000123").

## Preço & descontos
- **Preço por canal:** o campo `cli_canal` do cliente (ex.: varejo × distribuidor) define a coluna de preço. Preço **especial/promocional** sobrepõe o base.
- **Descontos em cascata (até 11 posições):** Prio 1 = desconto do cliente por produto → Prio 2 = desconto por grupo (tabela) → Prio 3 = desconto do cliente por indústria (`cli_ind.cli_desc1..11`).
- **Histórico de preço:** o sistema mostra as **últimas 10 vendas** daquele produto para o cliente, para sugerir o preço no novo lançamento.

## Comissão
- **Dois tipos:** **Escritório** (o representante) = % fixo (`for_percom`) sobre o valor faturado, **sem** regra de grupo. **Preposto** (o vendedor) = % por indústria (`vendedor_ind.vin_percom`), calculado **item a item**.
- **Override por grupo:** se o grupo do produto tem `gru_usa_percomiss` = sim, o % do grupo (`gru_percomiss`) substitui o do vendedor **só** para os itens daquele grupo.
- **Override flat:** `fat_percom_vend` (na fatura) pode fixar um % do preposto sobre o faturado, ignorando o cálculo por grupo.
- **Sempre sobre o faturado:** a comissão sai sobre `fat_valorfat` (valor da NF), proporcional quando a NF é parcial.

## Carteira, vendedor & promotor
- **Titular da carteira:** o vendedor do **último pedido** do cliente nos **últimos 180 dias** (não necessariamente quem visitou).
- **Modo de atribuição:** **1x1** (1 vendedor por cliente, `cli_vendedor`) ou **1xN** (1 vendedor por indústria, via `vendedor_ind`) — config `emp_mapas_modo_vendedor`.
- **Carteira por vendedor (toggle `emp_carteira_por_vendedor`):** ligada (padrão) = cada operador vê só a sua carteira; desligada = "**todos atendem todos**" (ex.: damarep).
- **Promotor de vendas (`ven_cumpremetas`=N):** **não vende** — só lança despesas; fica **fora** de metas, rankings e KPIs; no mobile, pedidos/catálogo/BI/smart-mix ficam ocultos para ele.
- **Visita:** quem visita (`vis_promotor_id`) ≠ titular; a métrica **atribui a visita ao titular** da carteira (deixa gerente/promotor apoiar sem distorcer número).

## Métricas de cliente (definições)
- **Inativo:** sem compra no período. **Churn:** comprou no trimestre anterior e parou no atual. **Em risco:** última compra entre 30 e 90 dias. **Reativado:** voltou após +60 dias parado.
- **Recência:** dias desde a última compra. **Positivação:** clientes que compraram ÷ base atendida (cobertura). **Mix:** quantas indústrias distintas o cliente compra. **Ticket médio:** faturamento ÷ nº de pedidos.
- **Curva ABC (por faturamento):** **A** = top até 80% acumulado · **B** = 80–95% · **C** = o resto.
- **Exclusões das estatísticas:** **filial de rede** e cliente com `cli_ignora_estat` não entram em inatividade/churn (quem compra é o CD). Status **E** nunca entra. Sempre usar **nome reduzido** nos labels.

## Sell-in × Sell-out
- **Sell-in:** o que o **REP vendeu para a loja** (pedidos P/F). **Sell-out:** o que a **loja vendeu ao consumidor** — registrado **manualmente** (`crm_sellout`), por cliente×indústria×mês; **não** vem de pedido.
- **Sell-through** = sell-out ÷ sell-in. **Fulfillment** = sell-in faturado ÷ sell-in total. **Estoque gap** = faturado − sell-out (estoque retido na loja).

## Campanhas promocionais (Movimentações → Campanhas)
- **O que é:** acordo comercial com **prazo, meta e acompanhamento** entre o REP, a indústria e um lojista — sempre um par **cliente × indústria**. A campanha nasce como **SIMULAÇÃO**; quando o acordo é firmado, vira **ATIVA**.
- **4 tipos (cada um define COMO a meta é medida):**
  - **Crescimento (R$):** meta de **faturamento** com a indústria no período. A meta pode ser calculada por **simulação histórica** — média diária dos últimos dias × **% de crescimento** desejado.
  - **Mix (famílias):** nº de **famílias/grupos de produto distintos** que o lojista deve comprar (diversificação — quem só leva rolamento passar a levar cubo, homocinética…).
  - **Ativação/Positivação (meses):** o lojista deve comprar em **X meses distintos** dentro do período (transforma comprador esporádico em regular).
  - **Volume (unidades):** total de **unidades**, independente do valor (bonificação/desconto por volume).
- **Como o progresso é apurado HOJE = sell-in:** o realizado é calculado **automaticamente a partir dos pedidos** (P/F) do par no período — ou seja, mede o que o lojista **comprou**. ⚠️ A régua **correta** de campanha é **sell-out** (o que o lojista **vendeu** na ponta): basear só na compra pode inflar o número (estoque empurrado que não girou). A virada para sell-out **está em evolução** — por ora, o número da campanha reflete **compra, não giro**.
- **Monitoramento:** barra de progresso (realizado × meta) com **alerta de atraso** (laranja) quando o realizado fica abaixo do ritmo esperado para o tempo decorrido. Ao ver o alerta, falar com o lojista e registrar a visita na agenda.

---

**Por que o BI pode divergir do Dashboard:** o BI **exclui** vendedores que não cumprem meta (`ven_cumpremetas`=N) de rankings/KPIs — é esperado. Para qualquer número exato, a IRIS usa as tools/relatórios; estas regras servem para ela **explicar o conceito**, não para calcular de cabeça.
