# Inativar clientes e indústrias sem movimento (limpar os dormentes)

> Carteira de autopeças incha de cadastro frio — cliente que sumiu, representada que não gira mais. Quando o REP pede pra **limpar os parados** ("inativa quem não compra há 2 anos", "tira as indústrias que não vendem mais"), a IRIS resolve com a tool **`inativar_sem_movimento`**. É **escrita em massa em produção** — mesmo cuidado (e maior) do remover/cadastrar.

## Regra de ouro nº 1 — o REP dá os ANOS, a IRIS nunca chuta
O prazo é a **coordenada** — vem do REP. Se ele já disse ("há 3 anos", "2 anos parados"), use. Se vier vago ("limpa os clientes mortos", "tira quem não compra"), **pergunte**: *"Há quantos anos sem comprar? (ex.: 2, 3)"*. **Sem o prazo, não inativa nada.**

## Regra de ouro nº 2 — sempre 2 passos (prévia → confirma)
1. Chame com **`confirmar: false`** → vem a **prévia**: quantos são, **separados em "nunca compraram" × "compraram e pararam"**, e a lista de nomes.
2. **Mostre isso** ao REP e **pergunte "confirma?"**. Ex.: *"Achei 138 clientes sem pedido há mais de 3 anos — 96 que nunca compraram e 42 que pararam: Auto Center X, Peças Y… Confirma que inativo todos?"*
3. **Só com o "sim"**, chame com **`confirmar: true`** → grava em transação.

Nunca grava sem mostrar a prévia. O número (quantos, e quantos "nunca × pararam") é o que dá confiança — sempre devolva.

## O critério (o que conta como "sem movimento")
- Base = **data do último pedido** válido (P/F). Pedido excluído (E) nunca conta.
- **Cliente** que **nunca comprou** cai pela **data de cadastro** — então prospect cadastrado mês passado **não** é varrido; só os antigos de verdade.
- **Indústria** que **nunca vendeu** entra direto (não tem data de cadastro). Por isso a prévia importa: o REP vê a lista antes.
- **Filial de rede** e cadastro marcado "fora de estatística" **não são tocados** (não compram direto — é o CD que compra).

## Reversível — fala a língua do REP
- "Inativar" = **some dos filtros e listas**, mas o **histórico de pedido fica intacto**. É **reversível**: pra trazer de volta, é só reativar no cadastro do cliente/indústria.
- Traduz: *"eles somem das suas listas, mas não perco nada — se precisar, reativo um a um no cadastro."*

## Permissão
- Inativar em massa é **Gerência ou Master**. A prévia qualquer um com acesso à IRIS vê; **a gravação** precisa desse nível.

## O que a IRIS NUNCA faz aqui
- Inativar sem o REP dar os anos (sem achismo de prazo).
- Gravar sem mostrar a prévia e ter o "sim".
- Prometer que inativou antes de a tool confirmar.

> Mais um poder da IRIS **executora** (ver [[project_iris_assistente_roadmap]]). Mesmo princípio do remover/cadastrar: pedir o essencial (o prazo), mostrar a prévia com os números, confirmar, agir — e aqui também, **reversível e protegendo quem não deve sair**.
