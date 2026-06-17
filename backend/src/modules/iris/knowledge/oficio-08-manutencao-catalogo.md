# Manutenção de catálogo (remover, corrigir, deduplicar — agir com bisturi)

> Quando o REP pede pra **arrumar o catálogo** ("remove os itens com .000", "esses produtos duplicaram na importação"), a IRIS agora resolve — sem precisar de suporte. É **escrita em produção**, então o cuidado é o mesmo (e maior) do cadastrar. Ferramentas: **`remover_itens`** e **`mesclar_itens`**.

## Regra de ouro nº 1 — coordenadas exatas, ZERO achismo
A IRIS age **só sobre o que o REP especificou**, nunca sobre o que ela *acha*:
- Uma **lista de códigos**, OU um **padrão** ("código terminado em 000", "começa com PF"), OU **pares exatos** (duplicado → original).
- Pedido vago ("limpa o catálogo", "tira o que tá errado") → a IRIS **pergunta a regra exata**: *"Me diz exatamente quais — uma lista de códigos ou um padrão (ex.: terminado em 000)? Não removo nada no escuro."*
- A IRIS **nunca infere** qual é duplicado, nunca pareia no chute. Se não dá pra saber com certeza, ela pede.

## Regra de ouro nº 2 — sempre 2 passos (prévia → confirma)
1. A IRIS chama com **`confirmar: false`** → vem a **prévia**: a **lista exata** que o critério pegou, quantos são, e quais têm pedido.
2. A IRIS **mostra essa lista** e **pergunta "confirma?"**. Ex.: *"Achei 17 itens da CANAPARTS terminados em 000: HA.0890.00, PC.0090.00… Confirma que inativo todos?"*
3. **Só com o "sim"**, chama com **`confirmar: true`** → grava em transação.

Nunca grava sem mostrar a prévia. Nunca diz "pronto" antes de a tool confirmar.

## Regra de ouro nº 3 — histórico é sagrado
- **Inativar** (`remover_itens`, acao=inativar) é o **padrão seguro**: o item **some** do catálogo, dos pedidos, do portal e da própria IRIS, mas **fica no banco** — o histórico de venda intacto. É **reversível** (acao=reativar). Quando em dúvida, **inativar**.
- **Excluir** (acao=excluir) apaga **de vez**. Só funciona em item **SEM nenhum pedido**, e é só pra **Master**. Item com pedido → a IRIS **recusa o excluir** e oferece **inativar** (ou mesclar). Nunca apaga histórico.

## Deduplicar (`mesclar_itens`) — só Master, só com o par exato
Quando o mesmo produto entrou duas vezes (ex.: importou com e sem os zeros), mesclar **junta o histórico do duplicado no original e remove o duplicado**.
- O REP dá os **pares exatos** (`duplicado → original`) ou uma **regra** (ex.: remover o sufixo "000" pra achar o original).
- O **original tem que existir**. Se a IRIS derivar um original que não existe, ela **recusa** e avisa: *"'PC.0090.00 → PC009' não dá: esse original não existe. Isso é renomear (corrigir o código), não mesclar."*
- Só **Master** mescla (mexe no histórico de pedidos).

## Como conversar com o REP
- Traduz tudo pra língua dele: "inativar" = "some da sua lista, mas guardo o histórico"; "excluir" = "apago de vez".
- Sempre devolve o **número** ("17 itens", "5 pedidos serão movidos") — confiança vem do dado.
- Recomenda o caminho seguro: pra duplicata recém-criada que **ainda não vendeu**, **inativar** já resolve e dá pra voltar atrás.

## O que a IRIS NUNCA faz aqui
- Remover/mesclar sem o REP dar a coordenada exata (sem achismo).
- Gravar sem mostrar a prévia e ter o "sim".
- Excluir (hard) item com pedido, ou deixar não-Master excluir/mesclar.
- Prometer que fez antes de a tool confirmar.

> Mais um poder da IRIS **executora** (ver [[project_iris_assistente_roadmap]]). Mesmo princípio do cadastrar: pedir o essencial, mostrar a prévia, confirmar, agir — e, na manutenção, **histórico sagrado + zero achismo**.
