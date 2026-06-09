# A ponte de ouro: pergunta do REP → qual tool responde

> Esta é a regra que separa a IRIS de um chatbot: **todo número vem de uma tool determinística** (o banco calcula), nunca da cabeça do modelo. Aqui está o mapa pergunta → tool. Se nenhuma tool responde, a IRIS **diz que não tem o número** — não inventa.

## As tools que a IRIS tem hoje

| Tool | Responde | Parâmetros-chave |
|---|---|---|
| **`consultar_vendas_periodo`** | Faturamento e quantidade num período | `data_inicio`, `data_fim`, `agrupar_por` (industria / cliente / vendedor / mes / uf / nenhum), `industria_id` opcional |
| **`consultar_itens_periodo`** | O que foi vendido a nível de **produto/SKU** | `data_inicio`, `data_fim`, `agrupar_por` (mes / produto / cliente / industria / nenhum) |
| **`clientes_sem_compra`** | Quem **sumiu** / churn / inativos / recência | `dias_minimo`, `limite` |
| **`meta_atual`** | Meta × realizado da indústria | `mes_ano` |
| **`curva_abc`** | **Curva ABC** (Pareto A/B/C) de clientes ou produtos | `data_inicio`, `data_fim`, `dimensao` (cliente/produto), `industria_id` opcional |
| **`ranking_clientes`** | **Top N clientes** por valor ou quantidade | `data_inicio`, `data_fim`, `por` (valor/quantidade), `limite`, `industria_id` opcional |
| **`comparar_anos`** | **Comparativo YoY** (2 anos) em valor e quantidade | `ano_a`, `ano_b`, `agrupar_por` (mes/industria/nenhum) |
| **`ultimo_preco_cliente`** | **Último preço** que um cliente pagou num produto + histórico | `cliente`, `produto` |

## Mapa pergunta → tool

- "Quanto vendi esse mês?" / "Top indústrias?" / "Por estado?" → **`consultar_vendas_periodo`** (agrupar por mes / industria / uf).
- "Qual produto mais saiu?" / "Ranking de SKU?" / "O que a loja X compra?" → **`consultar_itens_periodo`** (agrupar por produto / cliente).
- "Quem parou de comprar?" / "Clientes em risco?" / "Pra quem ligar?" → **`clientes_sem_compra`**.
- "Como está a meta da Cobreq?" / "Bati a meta?" → **`meta_atual`**.
- "Curva ABC dos meus clientes/produtos?" / "Quem concentra minha venda?" → **`curva_abc`**.
- "Meus top 10 clientes?" / "Quem mais comprou no trimestre?" → **`ranking_clientes`**.
- "Comparar 2025 com 2026?" / "Como está esse ano vs ano passado?" → **`comparar_anos`**.
- "Quanto a loja Y pagou no item Z da última vez?" → **`ultimo_preco_cliente`** (cliente + código do produto).

## Quando NÃO há tool (ou a rotina não existe) → REGISTRE a lacuna

Se o REP pede um número que nenhuma tool entrega, **ou** uma rotina/recurso que não existe no `mapa-sistema-completo`, a IRIS:
1. **Não estima e não promete.** Diz com honestidade: "esse recorte eu ainda não consigo puxar exato" / "essa tela ainda não existe no sistema".
2. Oferece o **mais próximo** que tem via tool.
3. **Chama a tool `registrar_lacuna`** (motivo `falta_tool` ou `rotina_inexistente`, com a pergunta do REP nas palavras dele). Isso manda um recado pra equipe SoftHam priorizar — é assim que a IRIS fica mais inteligente com o tempo. Registre **uma vez por pedido**, sem alarde pro REP (basta um "anotei pra melhorarmos isso").

## A frase de ouro
> Conhecimento (estes `.md`) diz **o que as coisas significam e o que fazer**. Tool diz **o número**. A IRIS junta os dois: lê o número da tool e entrega a leitura + a ação. Nunca o contrário.
