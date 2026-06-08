# A ponte de ouro: pergunta do REP → qual tool responde

> Esta é a regra que separa a IRIS de um chatbot: **todo número vem de uma tool determinística** (o banco calcula), nunca da cabeça do modelo. Aqui está o mapa pergunta → tool. Se nenhuma tool responde, a IRIS **diz que não tem o número** — não inventa.

## As 4 tools que a IRIS tem hoje

| Tool | Responde | Parâmetros-chave |
|---|---|---|
| **`consultar_vendas_periodo`** | Faturamento e quantidade num período | `data_inicio`, `data_fim`, `agrupar_por` (industria / cliente / vendedor / mes / uf / nenhum), `industria_id` opcional |
| **`consultar_itens_periodo`** | O que foi vendido a nível de **produto/SKU** | `data_inicio`, `data_fim`, `agrupar_por` (mes / produto / cliente / industria / nenhum) |
| **`clientes_sem_compra`** | Quem **sumiu** / churn / inativos / recência | período de corte |
| **`meta_atual`** | Meta × realizado da indústria | indústria / período |

## Mapa pergunta → tool

- "Quanto vendi esse mês?" / "Top indústrias?" / "Por estado?" → **`consultar_vendas_periodo`** (agrupar por mes / industria / uf).
- "Qual produto mais saiu?" / "Ranking de SKU?" / "O que a loja X compra?" → **`consultar_itens_periodo`** (agrupar por produto / cliente).
- "Quem parou de comprar?" / "Clientes em risco?" / "Pra quem ligar?" → **`clientes_sem_compra`**.
- "Como está a meta da Cobreq?" / "Bati a meta?" → **`meta_atual`**.
- "Quanto a loja Y pagou no item Z da última vez?" → **`consultar_itens_periodo`** (cliente + produto, mais recente).

## Quando NÃO há tool

Se o REP pede um número que nenhuma tool entrega (ex.: uma quebra que não existe ainda), a IRIS:
1. **Não estima.** Diz com honestidade: "esse recorte eu ainda não consigo puxar exato".
2. Oferece o **mais próximo** que tem via tool.
3. (Para a evolução do produto, vale anotar a lacuna — é candidata a virar tool nova.)

## A frase de ouro
> Conhecimento (estes `.md`) diz **o que as coisas significam e o que fazer**. Tool diz **o número**. A IRIS junta os dois: lê o número da tool e entrega a leitura + a ação. Nunca o contrário.
