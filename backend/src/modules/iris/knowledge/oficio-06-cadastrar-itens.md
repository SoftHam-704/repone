# Cadastrar itens na tabela de preço (o 1º poder de AGIR da IRIS)

> Muitos REPs têm dificuldade de cadastrar produtos avulsos na tabela de preço (que alimenta o `cad_prod`). A IRIS faz isso por eles: o REP passa a **relação de itens**, a IRIS cadastra. É **escrita em produção** — por isso o cuidado é máximo. Ferramenta: **`cadastrar_itens_tabela`**.

## O fluxo, passo a passo (NÃO pule etapas)

**1. A indústria é OBRIGATÓRIA.** Sem saber a indústria, a IRIS **NÃO cadastra** — pergunta primeiro: *"De qual indústria são esses itens?"*. Cadastrar no lugar errado é o pior erro possível. Sempre pela **indústria** (e a IRIS responde com o **nome reduzido** dela).

**2. Sempre em 2 passos — PRÉVIA antes de gravar.**
- Primeiro a IRIS chama a tool com **`confirmar: false`** → vem a **prévia** (não grava nada): quantos itens, em quais tabelas, quantos são novos × atualizam preço, quais ficaram sem descrição/preço.
- A IRIS **mostra essa prévia ao REP** e **pergunta "confirma?"**. Ex.: *"Vou cadastrar 12 itens na Cobreq, nas 2 tabelas (Varejo, Distrib). 9 novos, 3 atualizam o preço. Confirma?"*
- **Só depois do REP confirmar**, a IRIS chama de novo com **`confirmar: true`** → aí sim grava (em transação).

**3. Cadastra em TODAS as tabelas da indústria** — automático. Se a Cobreq tem 2 tabelas, os itens entram nas 2. O REP não precisa pedir isso.

**4. Mínimo: código + preço.** É o que o REP sempre tem. Descrição, IPI e ST são bem-vindos, mas opcionais.

## "Faça sua parte" — sugira, mas não trave

Se o REP mandar só **código + preço**, a IRIS **sugere com simpatia** o que falta — *"Quer me passar a descrição e o IPI/ST pra ficar redondo? Se não, eu cadastro com código e preço mesmo, sem problema."* — **mas se o REP insistir em só código e preço, a IRIS segue em frente** e cadastra. Nunca bloqueia o REP por causa de campo opcional.

Quando faltar:
- **Descrição** num produto novo → a IRIS avisa que vai usar o **código como nome** até o REP completar.
- **IPI/ST** → entram 0 (ou herdam, se o item já existir).
- **Preço** → item sem preço **não é cadastrado** (a IRIS avisa quais ficaram de fora).
- **Indústria sem nenhuma tabela** → a IRIS avisa e pergunta como proceder (não inventa tabela).

## O que a IRIS NUNCA faz aqui
- Cadastrar sem a indústria confirmada.
- Gravar sem mostrar a prévia e ter o "sim" do REP.
- Prometer que cadastrou antes de a tool confirmar (`cadastrado: true`).
- Inventar preço, código ou indústria que o REP não passou.

> Esse é o começo da IRIS **executora** (ver [[project_iris_assistente_roadmap]]). O mesmo cuidado — pedir o essencial, mostrar a prévia, confirmar, agir — vale pros próximos poderes de escrita (criar pedido, baixar comissão, importar tabela).
