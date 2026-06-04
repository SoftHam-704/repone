# GPS de navegação do RepOne (onde está cada tela, relatório e mapa)

Use isto para responder "onde está X?" / "como chego em Y?". Dê SEMPRE o caminho exato do menu (ex.: "**Cadastros → Clientes**" ou "**Central de Estatísticos → Mapa Itens × Clientes**"), sem prometer prazo nem falar de tecnologia. Se houver mais de uma tela parecida, ofereça a mais provável e cite a alternativa.

## Menu principal

**Topo (acesso rápido):** Dashboard · Business Intelligence (BI) · Central Estatísticos · Minha Agenda · Metas.

**Cadastros:** Indústrias · Clientes · Vendedores · Tabela de Preços (em *Cadastros → Tabela de Preços*) · Grupos de Produtos · Grupos de Descontos · Regiões · Setores/Bairros · Itinerários de Visita · Área de Atuação · Transportadoras.

**Movimentações:** Pedidos de Venda · Carrinho em Lote (importador de pedidos) · Campanhas · Baixa via XML · Sell-Out · Despesas de Viagem · Envio de Emails.

**Financeiro** (Gerência/Master — ver também a base *Financeiro*): Dashboard Hub · Contas a Receber · Contas a Pagar · Plano de Contas · Centro de Custo · Clientes (financeiros) · Fornecedores. *Livro Caixa, Fluxo de Caixa e DRE ficam dentro do Dashboard Hub (Master).*

**CRM:** Radar do Rep · Carteira · Atividades · Relacionamentos · Pipeline · Visitas · Campo Ao Vivo · Aftermarket (cadastro de oficinas/auto-elétricas).

**Relatórios:** Central de Relatórios (ver lista completa abaixo).

**Utilitários:** Catálogo Digital · Centro de Aprendizado (tutoriais) · Vincular WhatsApp · Usuários · Parâmetros · Configurações · IRIS (Assistente Pessoal).

---

## Central de Estatísticos (Topo → Central Estatísticos)
Hub de mapas e relatórios analíticos. Cada item abre dentro da própria Central:

- **Mapa por Indústria** — faturamento mensal por indústria (valor e quantidade).
- **Mapa de Vendas** — visão geral do faturamento por indústria e cliente.
- **Sellin por Período** — sell-in (pedidos do rep) no período.
- **Sellout por Período** — sell-out real registrado manualmente.
- **Mapa CLI / Indústria** — cruzamento de clientes atendidos por indústria.
- **Clientes Ano a Ano** — comparativo YoY de clientes por indústria.
- **Mapa Mensal de Itens** — quantidade de itens vendidos mês a mês.
- **Mapa Itens × Clientes** — quantidade de cada peça por cliente (de uma indústria).
- **Comparativo Clientes** — compara o desempenho entre clientes no período.
- **Grupo de Lojas** — consolidado de clientes por rede/grupo.
- **Itens Nunca Comprados** — produtos do catálogo sem nenhuma venda.
- **Mapa 3 Anos** — evolução comparativa dos últimos 3 anos.
- **Últimas Compras** — clientes ordenados pela data da última compra.
- **Clientes Inativos** — clientes sem compra no período.
- **Prod. Única Compra** — produtos comprados só uma vez.
- **Venda Mensal Indústria** — faturamento mensal consolidado por indústria.
- **Mapa de Pedidos** — pedidos por status e período.
- **Client Insight** — visão 360° da carteira (faturamento, mix, inatividade).
- **Curva ABC Produtos** — classificação Pareto de SKUs por faturamento.
- **Mapa de Oportunidades** — portfólio da indústria × compras do cliente (frequência e gap).
- **Portfólio por Indústria** — itens vendidos da indústria + quem comprou cada um.
- **Vendas × Churn Trimestral** — pedidos do período × clientes que sumiram.
- **Gap de Catálogo (Cross-sell)** — itens ABC da indústria que o cliente nunca comprou.
- **Indústrias Adormecidas** — clientes que pararam de comprar de indústrias do próprio histórico.

## Business Intelligence (Topo → Business Intelligence) — por abas
- **Visão Geral** — resumo do período: faturamento, pedidos, clientes ativos, crescimento, evolução mensal.
- **Indústrias** — comparativo de desempenho entre as representadas e participação de cada uma.
- **Clientes** — carteira: quem comprou mais, inativos, curva ABC, ticket médio, cross-sell.
- **Estatísticas** — KPIs com variação (trending) entre períodos.
- **Curva ABC** — classifica clientes e produtos em A/B/C com sparklines.
- **Metas** — acompanhamento de metas por indústria/período, % de atingimento.
- **Equipe** — performance de vendedores: ranking, carteira, atividades, metas.
- **Produtos** — ranking de produtos/famílias mais vendidas; SKUs parados; cobertura.
- **Sell In/Out** — pedidos (sell-in) × vendas ao cliente final (sell-out), sell-through, estoque.

> Obs.: o BI exclui vendedor que não conta meta, então pode divergir do Dashboard — é esperado.

## Central de Relatórios (Relatórios → Central de Relatórios) — por categoria

**Cadastros:** Clientes (simplificada) · Clientes (selecionável, com filtros) · Indústrias · Transportadoras · Tabela de preços com descontos · Tabela de preços completa · Tabela de preço reduzida · Relação clientes por indústria · Promoção de produtos · Clientes por área de atuação.

**Vendas Realizadas:** Cotações pendentes · Vendas no período · Vendas no período (sintético) · Vendas por cliente/indústria · Vendas por cidade/estado · Produtos vendidos · Produtos por grupo/clientes.

**Faturamento:** Comissão de vendedores · Faturamento no período · Pedidos faturados no período · Faturamento pendente · Produtos não faturados.

**Financeiro:** Contas a pagar/receber por vencimento.

---

Regra: ao perguntarem "onde vejo/imprimo X", aponte o caminho exato. Relatórios formais (listas, comissão, faturamento) → **Central de Relatórios**. Análises e mapas (curva ABC, oportunidades, inativos, itens×clientes) → **Central de Estatísticos**. Visão executiva por abas → **BI**.
