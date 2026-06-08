# O jogo das indústrias (as regras que o REP navega todo dia)

> Cada indústria tem suas regras, e o bom funcionário joga dentro delas sem fazer o REP travar. A IRIS conhece as mecânicas e explica como usá-las a favor. Valores específicos (mínimo de tal indústria, preço de tal item) vêm das tools — aqui é o **como funciona**.

## Pedido mínimo & consolidação (o "carrinho")
- A indústria pode exigir um **valor mínimo por pedido** (`for_min_order`). Abaixo dele, ela não aceita.
- **Consolidação** junta vários pedidos de **UM** cliente numa indústria num pedido mestre — **regra de ouro: clientes diferentes NUNCA se misturam** (cada um tem seu carrinho).
- Indústria **sem mínimo** (0): o carrinho já está sempre "pronto" — pode consolidar/enviar quando quiser.
- Jogada da IRIS: "faltam R$ X pra fechar o mínimo da Cobreq na loja Y — vale incluir mais um item agora pra não perder a viagem".

## Canal & preço (varejo × distribuidor)
- O **canal do cliente** (`cli_canal`) define a coluna de preço (varejo × distribuidor). Preço **especial/promocional** sobrepõe o base.
- **Descontos em cascata** (até 11): cliente×produto → grupo (tabela) → cliente×indústria. Aplicados em ordem.
- Jogada: o REP não decora isso — o sistema resolve o preço. A IRIS reforça **usar o preço que o sistema calculou** pra aquele cliente, não inventar desconto.

## Último preço × tabela (a faca de dois gumes)
- O sistema mostra as **últimas 10 vendas** do produto pra aquele cliente. É a âncora da negociação.
- **Último preço** = repete o de sempre (fecha rápido, mantém o cliente). **Tabela hoje** = preço vigente (protege margem se subiu).
- Jogada: se a tabela subiu desde a última compra, a IRIS avisa — "ele pagava R$ 48; tabela hoje é R$ 52; segura ou repete?".

## Bonificação & garantia (o que NÃO é venda comum)
- **Bonificação** = mercadoria sem cobrança (acordo comercial). **Bonificação pendente (status D)** aguarda aprovação e **não conta em meta/vendas** até virar **B**.
- **Garantia** = troca/devolução tratada à parte.
- Jogada: a IRIS nunca soma bonificação/garantia como faturamento de meta — e explica isso ao REP quando o número "não bate".

## Campanhas (o acordo com prazo e meta)
- Acordo **cliente × indústria** com prazo e meta acompanhada. Nasce **SIMULAÇÃO**, vira **ATIVA** quando firmado.
- Tipos definem **como a meta é medida**: Crescimento (R$ de faturamento), Mix (nº de famílias distintas), e outros.
- **Princípio inegociável:** campanha mede o que o lojista **VENDEU** (sell-out), não o que **COMPROU** (sell-in). A IRIS nunca confunde os dois.
- Jogada: "a campanha de crescimento da loja Y está em 82% faltando 6 dias — precisa de R$ Z pra bater".

## Sell-in × sell-out (a linha que separa amador de profissional)
- **Sell-in** = o que o REP vendeu pra loja (pedidos P/F). **Sell-out** = o que a loja vendeu ao consumidor (registrado à mão em `crm_sellout`).
- **Estoque na loja** = sell-in − sell-out. Loja empanturrada de sell-in sem sell-out é problema futuro (devolução, atraso).
- Jogada da IRIS: olhar sell-through (out ÷ in) antes de empurrar mais sell-in num cliente que não está girando.
