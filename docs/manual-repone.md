# Manual do Usuário — RepOne
**Sistema de Gestão para Representantes Comerciais**
Versão 2.0 · Atualizado em 28/05/2026 · Softham Sistemas

---

## Sumário

1. [Introdução](#introdução)
2. [Primeiros Passos](#primeiros-passos)
3. [Cadastros](#cadastros)
   - [Indústrias](#indústrias)
   - [Clientes](#clientes)
   - [Vendedores](#vendedores)
   - [Tabelas de Preço](#tabelas-de-preço)
   - [Grupos de Produtos](#grupos-de-produtos)
   - [Grupos de Desconto](#grupos-de-desconto)
   - [Regiões](#regiões)
   - [Setores / Bairros](#setores--bairros)
   - [Itinerários de Visita](#itinerários-de-visita)
   - [Área de Atuação](#área-de-atuação)
   - [Transportadoras](#transportadoras)
4. [Pedidos de Venda](#pedidos)
5. [Carrinho em Lote](#carrinho-em-lote)
6. [Campanhas](#campanhas)
7. [Baixa via XML](#baixa-via-xml)
8. [Sell-Out](#sell-out)
9. [Produtos](#produtos)
10. [Central Estatísticos](#central-estatísticos)
11. [BI — Business Intelligence](#bi--business-intelligence)
12. [CRM — Relacionamento com Clientes](#crm--relacionamento-com-clientes)
   - [Radar do Rep](#radar-do-rep)
   - [Carteira](#carteira)
   - [Atividades](#atividades)
   - [Relacionamentos](#relacionamentos)
   - [Pipeline](#pipeline)
   - [Visitas — Check-in / Check-out](#visitas--check-in--check-out)
   - [Campo Digital — O Promotor em Ação](#campo-digital--o-promotor-em-ação)
   - [Campo Ao Vivo — Painel do Diretor](#campo-ao-vivo--painel-do-diretor)
13. [Agenda](#agenda)
14. [Financeiro](#financeiro)
15. [Relatórios](#relatórios)
16. [Importador de Preços](#importador-de-preços)
17. [Configurações da Empresa](#configurações-da-empresa)
18. [IRIS — Assistente de IA](#iris--assistente-de-ia)
19. [Dúvidas Frequentes](#dúvidas-frequentes)

---

## Introdução

O **RepOne** é o sistema de gestão completo para representantes comerciais. Ele reúne em um único lugar tudo o que você precisa para o dia a dia: fazer pedidos, acompanhar clientes, analisar resultados, planejar visitas e muito mais.

O sistema foi desenvolvido pensando no ritmo do representante — funciona no computador, tablet e celular, e foi projetado para ser rápido e direto ao ponto.

### O que você vai encontrar neste manual

Este manual explica como usar cada parte do RepOne, passo a passo. Se você é novo no sistema, comece pelo [Primeiros Passos](#primeiros-passos). Se já usa e quer aprender uma funcionalidade específica, vá direto ao capítulo que precisa.

---

## Primeiros Passos

### Acessando o sistema

1. Abra o navegador e acesse o endereço fornecido pelo seu gestor
2. Digite **CNPJ da revenda**, seu **e-mail** e **senha**
3. Clique em **Entrar**

> **Dica:** Salve o endereço nos favoritos do navegador para acessar mais rápido.

### Já estou logado em outro lugar — e agora?

O sistema permite **2 sessões ativas** por usuário (ex.: web no escritório + mobile no campo). Se já houver 2 sessões abertas e você tentar entrar em uma terceira, aparece um modal **"Deslogar todas as sessões e entrar aqui"** — clique nele para liberar acesso no novo dispositivo.

### Instalar o RepOne como aplicativo (mobile)

O RepOne é um PWA — funciona como aplicativo nativo se você instalar na tela inicial:

**No Android:**
1. Abra o RepOne no Chrome
2. Vai aparecer uma faixa azul no topo: **"Instalar RepOne"**
3. Toque em **Instalar** → confirma → ícone fica na tela inicial

**No iPhone/iPad (somente Safari):**
1. Abra o RepOne no Safari (não funciona pelo Chrome no iOS)
2. Toque na faixa azul **"Instalar RepOne"** → segue o passo-a-passo
3. Ou manualmente: toque em **⎙ Compartilhar** (em baixo) → **Adicionar à Tela de Início** → **Adicionar**

Após instalado, o ícone do RepOne fica na tela inicial igual a um app, abre em tela cheia, e funciona offline para visitas no campo.

> **Não está aparecendo a faixa?** Ou você já instalou, ou já dispensou. Para reinstalar, limpe os dados do navegador e abra de novo.

### Navegação principal

Após entrar, você verá o menu lateral com todos os módulos disponíveis. Os itens visíveis dependem do seu nível de acesso (vendedor, gerente ou administrador). A sidebar pode ser fixada ou ocultada automaticamente — use o ícone de pin se preferir mantê-la sempre visível.

### Atualização forçada (caso o sistema mostre dados antigos)

Se o sistema ficar travado mostrando informação desatualizada após uma atualização recente, use o botão **🔄 Atualizar** no rodapé da sidebar. Ele limpa todo o cache do navegador (Service Workers + armazenamento local) e recarrega do zero — útil principalmente em iPad onde o `Ctrl+Shift+R` tradicional nem sempre resolve.

### Alterar sua senha

Clique no ícone do seu perfil no canto superior direito e selecione **Alterar Senha**.

---

## Cadastros

O módulo de Cadastros é a base de todo o sistema. Aqui você registra todas as informações que o RepOne vai usar em pedidos, relatórios e análises: indústrias que você representa, clientes da sua carteira, vendedores da equipe, tabelas de preço, grupos, regiões e muito mais.

> **Importante:** Quanto mais completo e atualizado for o cadastro, mais o sistema vai trabalhar por você — calculando preços automaticamente, organizando visitas e gerando análises precisas.

---

### Indústrias

As **Indústrias** são os fabricantes ou fornecedores que você representa. Cada indústria tem sua própria tabela de preço, política comercial e clientes vinculados.

#### Listagem

Ao acessar **Cadastros → Indústrias**, você vê a lista de todos os fornecedores cadastrados. Use a barra de busca para localizar por nome.

#### Ficha da Indústria

Clique em qualquer indústria para abrir a ficha completa. Ela é dividida em duas seções superiores e cinco abas inferiores.

**Seção Principal — dados fundamentais:**
- **Nome Completo** e **Nome Reduzido** (usado em listas, etiquetas e relatórios)
- **CNPJ** e **Inscrição Estadual**
- **Endereço completo:** rua, bairro, cidade, CEP, UF
- **Telefone** e **E-mail**
- **Site**
- **Logotipo:** faça o upload da imagem da indústria. Ela aparece nas impressões de pedidos
- **Pedido Mínimo (R$):** valor mínimo que o pedido deve atingir para essa indústria
- **Política de Menor Preço:** quando ativada, o sistema sempre aplica o menor preço disponível para o cliente

**Seção Complemento — dados adicionais:**
- Campos extras de endereço e informações complementares do fornecedor

#### Aba: Contatos

Lista de contatos da indústria (comprador, financeiro, suporte comercial etc.). Para cada contato você registra:
- Nome, cargo, telefone, e-mail

#### Aba: Clientes que Compraram

Visão dos clientes da sua carteira que já fizeram pedido desta indústria. Útil para saber quem compra de cada fornecedor.

#### Aba: Política Comercial

Define as regras de desconto para esta indústria, usando a tabela de descontos **D1 a D10** — dez colunas de desconto que se aplicam aos clientes conforme a negociação. Cada coluna D representa uma faixa ou condição de desconto negociada com o fornecedor.

#### Aba: Meta Anual

Lançamento da meta de faturamento anual para esta indústria, mês a mês (janeiro a dezembro).

#### Aba: IA / WhatsApp (IRIS)

Configurações para a IRIS se comportar como especialista nesta indústria. Você preenche:
- **Nome da Marca:** como a IRIS deve se referir ao fornecedor
- **Persona da IA:** como a IRIS deve se apresentar ao falar sobre esta indústria
- **Palavras-chave:** termos, produtos e categorias desta linha
- **Resumo do Negócio:** descrição do portfólio e diferenciais

Essas informações são usadas pela IRIS para responder perguntas sobre produtos e pedidos desta indústria via WhatsApp.

---

### Clientes

Os **Clientes** são os compradores da sua carteira — lojistas, distribuidores e outros. O cadastro de clientes no RepOne é completo: armazena dados cadastrais, contatos, vínculo com cada indústria, descontos negociados, histórico de prospecção e áreas de atuação.

#### Listagem

Acesse **Cadastros → Clientes** (ou pelo menu principal **Clientes**). Você pode buscar por nome, CNPJ ou cidade. Filtre por **ativos** ou **inativos**.

#### Ficha do Cliente — 6 abas

##### Aba: GERAL

Dados cadastrais completos:
- **Razão Social** e **Nome Reduzido** (nome de exibição nas listas e pedidos)
- **CNPJ** e **Inscrição Estadual**
- **Endereço:** rua, número, complemento, bairro, cidade, CEP, UF
- **Telefone(s)** e **E-mail**
- **Site**
- **Observações**
- **Status:** Ativo ou Inativo. Clientes inativos não aparecem na seleção de pedidos
- **Classificação:** define como o cliente é tratado nos relatórios e mapas. As opções incluem:
  - Cliente padrão (escolha mais comum)
  - **Filial de Rede** — quando o cliente é uma loja-filial de uma rede já cadastrada como cliente-sede. Filiais de rede ficam excluídas por padrão dos relatórios de inatividade, churn, adormecidas e últimas compras (evita ruído estatístico, já que a rede-sede concentra os indicadores)
  - Outras classificações conforme configuração do escritório
- **Compra?:** toggle ao lado da Classificação, no mesmo estilo do Status. **Por padrão vem ligado em "COMPRA"** (verde) — todo lojista é tratado como comprador e aparece normalmente nos relatórios de inatividade, churn, adormecidas e últimas compras. **Desligue para "NÃO COMPRA" só quando o lojista realmente não compra de você** — por exemplo, uma filial abastecida pelo CD da rede, ou um ponto cujo mix não tem nada a ver com as suas indústrias. Desligado, ele sai desses relatórios estatísticos e para de poluir a sua lista de reativação. Você manda: liga e desliga quando quiser.

##### Aba: CONTATOS

Lista de contatos do cliente (comprador, financeiro, sócio etc.):
- Nome, cargo, telefone, celular, e-mail

##### Aba: INDÚSTRIAS

Define quais indústrias este cliente compra e as condições negociadas em cada uma. Para cada vínculo você informa:

- **Indústria** (fornecedor)
- **Código do cliente na indústria** (o código que o fornecedor usa internamente para este cliente)
- **Tabela de preço** vigente para este cliente
- **Comprador responsável** na loja e seu e-mail
- **Descontos D1 a D11:** onze colunas de desconto personalizadas por cliente e por indústria
- **Tipo de frete:** define como o frete é calculado nos pedidos desta combinação cliente + indústria. As opções são:
  - **CIF** — frete por conta da indústria
  - **FOB** — frete por conta do cliente
  - **CIF + IPI** — frete da indústria mais IPI destacado
  - **FOB + IPI** — frete do cliente mais IPI destacado
  - **CIF + IPI + ST** — frete da indústria com IPI e Substituição Tributária
  - **FOB + IPI + ST** — frete do cliente com IPI e Substituição Tributária

##### Aba: DESCONTOS

Grupos de desconto aplicados a este cliente. Aqui você vincula o cliente a um ou mais **Grupos de Desconto**, que definem descontos globais por linha de produto.

##### Aba: PROSPECÇÃO

Informações de prospecção comercial:
- Data do primeiro contato, fonte da indicação, estágio no funil de vendas, observações sobre o processo de conquista deste cliente

##### Aba: ÁREAS

Vincula o cliente a uma ou mais **Áreas de Atuação** (ex: INDÚSTRIA, COMÉRCIO, CONSTRUÇÃO CIVIL). Usado para segmentação em relatórios e campanhas.

#### Histórico do Cliente

Na listagem de clientes, clique no ícone de **relógio** (histórico) ao lado do cliente para abrir um painel com duas abas:

- **Indústrias:** lista de todos os fornecedores com os quais o cliente já realizou pedidos (status P ou F), ordenada da compra mais recente para a mais antiga. Útil para ver de quem o cliente compra e com que frequência.
- **Pedidos:** histórico completo de pedidos — número, data, indústria e valor total — em ordem decrescente de data.

> **Uso prático:** consulte o histórico antes de uma visita para ver quais indústrias o cliente já comprou e quanto gastou, chegando na conversa com mais contexto.

#### Cadastrando um Novo Cliente

1. Clique em **Novo Cliente**
2. Preencha os dados obrigatórios: **Nome**, **CNPJ**, **Endereço**
3. Clique em **Salvar**
4. Após salvar, acesse as demais abas para vincular indústrias e definir os descontos

#### Ativando / Inativando Clientes

Na aba **GERAL**, altere o campo **Status** para Ativo ou Inativo. Clientes inativos não aparecem na seleção de pedidos.

---

### Vendedores

Os **Vendedores** são os representantes da equipe. Cada vendedor tem login no sistema, regiões e indústrias que atende, e metas de faturamento definidas por mês.

#### Listagem

Acesse **Cadastros → Vendedores**. A lista exibe: Código, Nome, Cidade/UF, Telefone, E-mail, Usuário (login) e Status (Ativo/Inativo).

#### Ficha do Vendedor — 4 abas

##### Aba: DADOS

Dividida em quatro seções:

**I — Identificação:**
- Nome completo
- CPF, RG, CTPS
- Data de aniversário (DD/MM)
- Filiação (nome dos pais)

**II — Endereço:**
- Endereço, Bairro, Cidade, CEP, UF

**III — Contato:**
- Telefone, Celular, E-mail
- **Usuário (login de acesso ao sistema):** nome de usuário que este vendedor usa para entrar no RepOne

**IV — Vínculo Empregatício:**
- Data de admissão e data de demissão
- **Status:** Ativo ou Inativo
- **Cumpre Metas:** Sim ou Não — define se este vendedor participa do controle de metas no BI
- Observações

##### Aba: INDÚSTRIAS

Vincula as indústrias que este vendedor atende e define o **percentual de comissão** por indústria. A comissão é usada nos relatórios de faturamento.

Para vincular: clique em **Vincular Indústria**, selecione a indústria e informe o % de comissão.

##### Aba: REGIÕES

Define quais regiões geográficas este vendedor atende. Clique em **Vincular Região** e selecione na lista.

##### Aba: METAS

Lançamento de metas de faturamento por indústria e por mês. Você seleciona o **ano** (navega com as setas ◀▶), depois cria uma meta por indústria informando o valor em reais para cada mês (janeiro a dezembro).

O total anual é calculado automaticamente. As metas aparecem no BI na aba **Metas** e no cockpit de equipe.

---

### Tabelas de Preço

As **Tabelas de Preço** armazenam os preços de cada produto por indústria. Quando você faz um pedido, o sistema busca automaticamente o preço correto na tabela vigente.

Para importar ou atualizar uma tabela de preços, veja o capítulo [Importador de Preços](#importador-de-preços).

#### Gerenciando uma tabela ativa

No menu **Cadastros → Tabela de Preços** (também acessível pelo módulo Produtos), depois de selecionar uma indústria e uma tabela, você encontra a barra de ações:

- **🔄 Atualizar** — recarrega a lista do servidor
- **✏️ Renomear** — muda o nome da tabela mantendo todos os produtos
- **Ações da Tabela** (dropdown):
  - **Exportar para Excel** — baixa a lista completa
  - **Atualizar percentual de IPI** — aplica um % de IPI em massa pra todos os produtos da tabela
  - **Atualizar percentual de ST** — idem para Substituição Tributária
  - **Zerar preço bruto** — define `R$ 0,00` no preço bruto de todos os produtos da tabela
  - **Zerar preço promo** — idem para o preço promocional
  - **Zerar preço especial** — idem para o preço especial
  - **Excluir tabela de preço** — remove a tabela inteira (irreversível)

> **Quando usar as ações de "Zerar preço"?** Quando uma promoção expira e você quer limpar todos os preços promocionais de uma só vez, ou quando o fornecedor mudou a estrutura de descontos e o nível "especial" não vale mais. Cada ação pede confirmação porque afeta todos os produtos da tabela escolhida.

---

### Grupos de Produtos

Os **Grupos de Produtos** organizam os produtos em categorias (ex: Suspensão, Freios, Motor, Filtros). Cada produto pertence a um grupo.

#### Campos do Grupo

- **Nome do Grupo**
- **Usa % Comissão Própria:** quando ativado, este grupo usa uma comissão diferente da comissão padrão do vendedor
- **% Comissão Preposto:** percentual de comissão específico para este grupo (quando a opção acima estiver ativa)

Os grupos são usados para filtros em relatórios e para cálculo de comissão diferenciada por linha de produto.

---

### Grupos de Desconto

Os **Grupos de Desconto** definem descontos por tipo de cliente, aplicados de forma global (independente da indústria). Por exemplo: "Rede de lojas com 5% em todas as compras" ou "Cliente premium com desconto especial em D1 e D2".

#### Campos do Grupo

- **Identificador:** código ou sigla do grupo (ex: PREMIUM, REDE, ATACADO)
- **Descrição:** nome completo do grupo
- **D1 a D9:** nove colunas de desconto. Cada coluna representa um nível de desconto que pode ser configurado para clientes deste grupo

Os clientes são vinculados ao grupo na aba **Descontos** da ficha do cliente.

---

### Regiões

As **Regiões** organizam sua área de atuação geograficamente. Cada região pode conter uma ou mais cidades, e é usada para vincular clientes, vendedores e itinerários.

#### Campos da Região

- **Nome da Região** (ex: ZONA SUL, LITORAL NORTE, INTERIOR)

#### Aba: Cidades

Dentro de cada região você adiciona as cidades que fazem parte dela. Quando um cliente é cadastrado com uma determinada cidade, o sistema pode sugerir automaticamente a região correspondente.

---

### Setores / Bairros

Os **Setores** são subdivisões dentro de uma região — geralmente bairros ou zonas de uma cidade. São usados principalmente para organizar o roteiro de visitas no mapa.

#### Campos do Setor

- **Nome do Setor** (ex: CENTRO, ZONA NORTE, BAIRRO INDUSTRIAL)
- **Cidade:** cidade à qual este setor pertence (busca por nome)
- **Ordem de Visita:** número que define a sequência de visita neste setor
- **Cor:** cor em hexadecimal para exibição no mapa de rotas (ex: #FF5733)

---

### Itinerários de Visita

Os **Itinerários** definem as rotas de visita planejadas — qual vendedor vai a quais clientes, em qual dia da semana, em qual ordem.

#### Campos do Itinerário

- **Nome do Itinerário** (ex: SEGUNDA — ZONA SUL)
- **Vendedor:** quem realiza este roteiro
- **Região:** região geográfica coberta
- **Dia da Semana:** qual dia da semana este roteiro é executado
- **Observações:** instruções ou particularidades da rota

#### Paradas

Cada itinerário tem uma lista de **paradas** — os clientes visitados e a ordem de visita. Você pode reordenar as paradas arrastando e soltando (drag-and-drop) para ajustar a sequência conforme o trajeto mais eficiente.

---

### Área de Atuação

As **Áreas de Atuação** categorizam os clientes pelo segmento de mercado em que atuam. São usadas para segmentação em relatórios e campanhas.

#### Campos

- **Descrição:** nome do segmento (ex: INDÚSTRIA, COMÉRCIO VAREJISTA, CONSTRUÇÃO CIVIL, OFICINA MECÂNICA, DISTRIBUIDORA)
- **Ativa:** Sim ou Não

Os clientes são vinculados a uma ou mais áreas de atuação na aba **ÁREAS** da ficha do cliente.

---

### Transportadoras

As **Transportadoras** são as empresas de frete utilizadas nos pedidos. O cadastro serve como referência para inclusão no pedido e para relatórios.

#### Campos

- **Nome da Transportadora**
- **CNPJ**
- **Inscrição Estadual (IE)**
- **Telefone**
- **E-mail**
- **Contato** (nome da pessoa de contato)
- **Endereço completo**

---

## Pedidos

O módulo de Pedidos é o coração do RepOne. É aqui que você registra as vendas, acompanha o status e gerencia todo o ciclo comercial.

### Listagem de Pedidos

Ao entrar em **Pedidos**, você verá a lista de todos os seus pedidos com as seguintes informações:

- **Número** do pedido
- **Cliente** (nome reduzido)
- **Indústria** / Fornecedor
- **Data** de emissão
- **Valor total**
- **Situação** do pedido

Use a barra de busca no topo para encontrar um pedido por cliente, número ou indústria. Você também pode filtrar por período e por situação.

### Estrutura do Pedido — 4 seções

O pedido é organizado em quatro seções acessadas pela barra lateral:

| Atalho | Seção | O que faz |
|--------|-------|-----------|
| **F1** | Principal | Dados do cabeçalho — cliente, indústria, tabela, descontos |
| **F3** | Itens | Inclusão e edição dos produtos |
| **F4** | Faturas | Informações de faturamento junto à indústria |
| **F5** | Conferência | Revisão final dos totais antes de salvar |

---

### F1 — Principal (Cabeçalho)

Esta é a primeira tela ao criar ou editar um pedido. Contém todas as informações que definem as condições comerciais.

**Identificação e controle:**
- **Data do Pedido** — data de emissão (editável)
- **Status Operacional** — situação atual do pedido (veja tabela abaixo)
- **Indústria** — fornecedor deste pedido
- **Tabela de Preço** — lista de preços a ser usada. O sistema carrega automaticamente as tabelas disponíveis para a indústria selecionada
- **Nº da OC** — número da Ordem de Compra do cliente (referência do lado do lojista)

**Descontos progressivos (cabeçalho):**
O cabeçalho tem 8 colunas de desconto (D1 a D8) aplicadas em cascata sobre todos os itens do pedido. Esses valores são carregados automaticamente em dois passos:
1. O sistema busca os descontos padrão cadastrados na indústria
2. Em seguida, busca os descontos negociados especificamente para este cliente + indústria (da aba INDÚSTRIAS da ficha do cliente) e sobrescreve quando o valor for maior que zero

Você pode ajustar manualmente antes de salvar.

**Cliente:**
- Campo de busca inteligente — digite o nome ou parte do nome para localizar
- **Vendedor** — carregado automaticamente pelo cliente; pode ser alterado

**Transportadora:**
- **Tipo de Frete:** CIF (por conta da indústria) ou FOB (por conta do cliente)
- **Transportadora** — empresa de transporte (select do cadastro)

**Dados do Pedido:**
- **Condição de Pagamento** — prazo negociado (ex: 28/35/42 dias)
- **Contato / Comprador** — nome do responsável pela compra no cliente
- **Pedido do Cliente** — número interno do pedido no sistema do lojista
- **Pedido da Indústria** — número que a indústria atribui ao pedido após confirmação
- **Observações** — campo livre para instruções especiais, endereço de entrega alternativo etc.

---

### F3 — Itens

Tela de inclusão de produtos. Para cada item você informa:
- **Código** do produto (busca por código ou descrição)
- **Quantidade** (respeitando o múltiplo de embalagem)
- **Preço unitário** — carregado automaticamente da tabela selecionada no F1
- **Descontos por item (D1 a D9)** — colunas de desconto individuais por linha
- O sistema calcula automaticamente: preço unitário líquido, total bruto, total líquido e valor com impostos (IPI/ST)

#### Importando itens em lote

Em vez de digitar produto por produto, você pode importar de quatro formas:

**XLS — Planilha Excel**
Upload de planilha com colunas de código e quantidade. Ideal para reposição periódica.

**TXT — Arquivo de Texto**
Importa arquivos de sistemas de gestão do cliente. Formatos suportados: **PP2** (Prime), **Stahl**, **Arca**, **KV** (Kaizen).

**XML — Nota Fiscal Eletrônica**
Importa um arquivo XML de NF-e. O sistema lê os itens, cruza com o catálogo e monta o pedido automaticamente. Útil para faturar com base numa NF recebida.

**Magic Load — IA (qualquer formato)**
Lê qualquer tipo de documento e extrai produtos e quantidades automaticamente:
- Aceita: **PDF**, **XLS**, **XLSX**, **DOCX**, **JPG**, **PNG**
- Funciona com listas enviadas por foto, tabelas escaneadas, planilhas personalizadas
- Revise os itens identificados antes de confirmar

---

### F5 — Conferência

Resumo completo do pedido antes de salvar:
- Total bruto, total de descontos, total líquido
- Total de IPI e ST
- Total geral com impostos
- Lista de todos os itens com preços e quantidades

---

### Criando um Pedido — Passo a Passo

1. Clique no botão **Novo Pedido**
2. Em **F1 — Principal:** selecione a **Indústria** e o **Cliente**. O sistema carregará automaticamente a tabela de preços, os descontos e as condições comerciais negociadas
3. Em **F3 — Itens:** adicione os produtos digitando o código ou nome, informe a quantidade. O preço é carregado automaticamente
4. Em **F5 — Conferência:** revise os totais
5. Clique em **Salvar**

> O sistema aplica o preço da tabela vigente. Se o produto tiver promoção ativa e a indústria usar a política de menor preço, o melhor preço é aplicado automaticamente.

### Editando um Pedido

Clique no pedido na lista e selecione **Editar**. Pedidos faturados (F) não podem ser editados.

### Duplicando um Pedido

Abra o pedido e clique em **Duplicar**. Um novo pedido é criado com os mesmos itens e cabeçalho — ajuste o que precisar antes de salvar.

### Imprimindo e Compartilhando

- **Imprimir:** gera PDF formatado com logo da empresa
- **Enviar por E-mail:** envia o PDF diretamente para o e-mail do cliente
- **Compartilhar:** gera arquivo ou link para envio por WhatsApp

### Situações do Pedido

| Código | Situação | Significado |
|--------|----------|-------------|
| **P** | Pedido | Em aberto, aguardando faturamento |
| **C** | Cotação | Orçamento enviado, ainda não confirmado |
| **CC** | Cotação Confirmada | Cotação aprovada pelo cliente |
| **F** | Faturado | Confirmado e faturado pela indústria |
| **Q** | Fila | Na fila de processamento da indústria |
| **G** | Garantia | Pedido de reposição por garantia |
| **B** | Bonificação | Pedido de bonificação (sem cobrança) |
| **X** | Cancelado | Pedido cancelado |

> **Atenção:** Pedidos excluídos (E) não aparecem na listagem e não são contabilizados em nenhum relatório ou análise.

### Painel de Faturamento

No menu de Pedidos, acesse **Faturamento** para visualizar o status de confirmação dos pedidos junto às indústrias — o que já foi faturado e o que está pendente.

Ao registrar um novo faturamento (clique em **Faturar** num pedido), você abre o formulário **Registrar Pagamento**, dividido em duas abas:

- **Lançamentos** — onde você informa o valor da NF e a comissão
- **Itens Faturados** — onde você detalha quais produtos e quantidades a NF cobre

#### Aba Lançamentos — campos

- **Número da NF** (obrigatório)
- **Data de Faturamento**
- **Valor Faturado (R$)** — pode ser menor que o valor do pedido em caso de faturamento parcial
- **Comissão Escritório** — % e valor calculado automaticamente
- **Comissão Preposto** — derivada automaticamente das indústrias do vendedor (configuradas na ficha de Vendedor → Indústrias)
- **Observações** (opcional, até 100 caracteres)

> **Dica de produtividade:** o formulário aceita **Enter** como Tab — pressione Enter para pular ao próximo campo, ao invés de usar o mouse. Funciona em todos os campos, inclusive na grade de baixa manual de itens.

#### Aba Itens Faturados — Baixa Manual

Use essa grade quando o faturamento for **parcial** (valor da NF menor que o valor do pedido). Para cada produto do pedido, informe a quantidade efetivamente faturada nesta NF.

> **⚠️ Importante (impacto na comissão):** se o valor faturado for menor que o pedido **e** você não preencher as quantidades dos itens, o sistema mostra um aviso amarelo: "Faturamento parcial sem detalhe — a comissão será calculada **proporcionalmente** ao valor faturado." Isso é uma aproximação. Para precisão real (cada produto com seu % de comissão por grupo), preencha a coluna **A Faturar Agora** com as quantidades corretas.

#### Cálculo da comissão na prática

- **Faturamento total** (valor da NF = valor do pedido): comissão é calculada item-a-item respeitando overrides por grupo
- **Faturamento parcial com itens detalhados**: comissão é calculada exatamente sobre os itens informados
- **Faturamento parcial sem itens detalhados** (acionou o warning amarelo): comissão é proporcional — `comissao_total × (valor_faturado / valor_pedido)`

---

## Carrinho em Lote

O **Carrinho em Lote** (também chamado de **Smart Importer**) permite criar pedidos para vários clientes ao mesmo tempo — ideal para períodos de grande volume, reposição automática de estoque ou quando a indústria envia uma lista de produtos para distribuição.

Acesse pelo menu **Movimentações → Carrinho em Lote**.

A página oferece dois modos de trabalho:

---

### Modo 1: Rascunho Rápido

O modo mais ágil. Você informa um cliente e digita (ou cola) os códigos dos produtos diretamente. O sistema cuida de tudo o mais.

#### Como usar

1. Selecione o **Cliente** no campo de busca
2. No campo de texto, informe os produtos — um por linha — no formato:
   ```
   CÓDIGO QUANTIDADE
   ```
   Exemplo:
   ```
   TRW1234 10
   FREMAX5500 5
   COFAP99 20
   ```
3. Clique em **Distribuir**

O sistema analisa os produtos, identifica a qual **Indústria** cada um pertence e organiza os itens em **buckets** (baldes). Cada bucket representa um pedido independente por fabricante.

#### Buckets e Pedidos

Após a distribuição, você verá um painel com os buckets criados. Cada card mostra:

- Nome da **Indústria**
- Número de itens incluídos
- **Valor total** estimado do pedido
- Lista dos produtos com código, quantidade e preço

Você pode revisar cada bucket individualmente antes de confirmar.

#### Confirmando os Pedidos

No topo da tela aparece um botão flutuante **Faturar N Carrinhos** (onde N é o número de buckets prontos). Ao clicar:

- Os pedidos são criados automaticamente para cada indústria
- Cada pedido fica com status **P (Pedido)** e pode ser editado normalmente em seguida

> **Atenção:** Produtos não encontrados no catálogo ficam sinalizados em vermelho. Verifique o código ou a tabela de preços da indústria.

#### Limpando o rascunho

Clique em **Limpar Tudo** para zerar o rascunho e começar de novo — útil quando precisar mudar de cliente ou corrigir um engano.

---

### Modo 2: Importar por Arquivo

Importação em 3 passos via planilha Excel ou arquivo TXT. Ideal quando a indústria envia uma lista de reposição ou quando o arquivo já está pronto.

#### Formatos suportados

| Formato | Extensão | Uso |
|---------|----------|-----|
| Planilha Excel | `.xlsx` | Formato universal — colunas CNPJ, pedido, código, quantidade |
| Texto Patral | `.txt` | Arquivo padrão do sistema Patral (detecção automática) |

#### Passo 1 — Upload do arquivo

Arraste o arquivo para a área indicada ou clique para selecionar. O sistema detecta automaticamente o formato e identifica as colunas:

- **CNPJ** ou **código do cliente**
- **Número de pedido** (referência)
- **Código do produto**
- **Quantidade**

#### Passo 2 — Pré-visualização

Antes de confirmar, o sistema exibe uma prévia completa:

- **Grupos de itens** organizados por cliente e indústria
- **Produtos encontrados** com código, descrição e preço
- **Itens não encontrados** — você pode baixar um arquivo CSV com a lista dos itens não localizados para verificar e corrigir

Revise a distribuição. Se algum grupo não estiver correto, você pode desmarcá-lo antes de prosseguir.

#### Passo 3 — Concluído

Após confirmar, o sistema cria os pedidos e exibe o resultado:

- **Números dos pedidos** criados
- **Resumo por indústria:** quantidade de itens e valor de cada pedido
- Botão para **ir direto à tela de Pedidos** e revisar

---

### Erros comuns

| Situação | Causa | O que fazer |
|----------|-------|-------------|
| Produto não encontrado | Código diferente do cadastro | Verifique o código na tabela da indústria |
| Sem tabela de preço | Indústria sem tabela vigente | Atualize a tabela de preços da indústria |
| Cliente não identificado | CNPJ inativo ou não cadastrado | Verifique o cadastro do cliente |
| Quantidade inválida | Abaixo do múltiplo de embalagem | Ajuste para múltiplos da embalagem |

---

## Campanhas

O módulo de **Campanhas** permite criar e acompanhar ações de incentivo comercial com clientes — metas de crescimento, expansão de mix, positivação e volume. É a ferramenta para transformar acordos comerciais em acompanhamento sistemático.

Acesse pelo menu **Movimentações → Campanhas**.

A tela é dividida em três abas: **Planejamento**, **Monitoramento** e **Auditoria**.

---

### Tipos de Campanha

O RepOne suporta quatro tipos de campanha, cada um com sua métrica e lógica de apuração:

#### Crescimento (R$)

Campanha baseada em valor faturado. A meta é crescer um percentual em relação a um período base.

- **Período Base:** intervalo de referência (ex: Jan–Dez 2024)
- **Período da Campanha:** intervalo atual que será comparado
- **% de Crescimento:** quanto o cliente precisa crescer sobre o período base
- O sistema calcula automaticamente:
  - **Faturamento base** do cliente no período de referência
  - **Meta em R$** = faturamento base × (1 + % crescimento)
  - **Meta diária** = meta total ÷ número de dias úteis do período
  - **Verba estimada** = 2% da meta (referência para orçamento de premiação)

Use o botão **Simular** antes de salvar para ver a meta calculada e ajustar os parâmetros.

#### Mix (famílias de produto)

Meta de expansão de portfólio. O objetivo é que o cliente compre de um número mínimo de **famílias de produto** diferentes.

- Defina o **número de famílias** que o cliente precisa atingir
- O sistema acompanha quantas famílias distintas foram compradas no período
- Incentiva o cliente a diversificar o mix em vez de concentrar em poucos produtos

#### Positivação (meses com pedidos)

Meta de regularidade de compras. O cliente precisa ter pedidos em um número mínimo de meses dentro do período.

- Defina o **número de meses** que o cliente precisa comprar
- Ideal para reativar clientes com compras irregulares
- Conta apenas meses com pelo menos um pedido faturado (status F)

#### Volume (unidades)

Meta de quantidade física. O objetivo é vender um número mínimo de peças/unidades.

- Defina a **quantidade de unidades** a atingir
- Pode ser geral ou por produto/grupo específico
- Útil para campanhas de lançamento ou queima de estoque

---

### Visão Geral — listagem em cards

Cada campanha aparece como um **card colorido** com a faixa lateral indicando o tipo (Crescimento, Mix, Positivação ou Volume) e badges de status no canto superior direito (SIMULAÇÃO / ATIVA / CONCLUÍDA / CANCELADA).

Dentro de cada card você vê em uma só olhada:
- Nome da campanha + cliente vinculado
- **Indústria** com ícone amarelo
- **📅 Vigência** (`DD/MM/AA → DD/MM/AA`) — período de execução da campanha
- **Meta diária** ou meta total (depende do tipo)
- **Verba** comprometida
- **Barra de progresso** com % atingido
- Alerta de **"Campanha atrasada"** quando ritmo está abaixo do esperado

Use a barra de busca do topo para filtrar por cliente, indústria ou nome da campanha.

### Aba Planejamento — Criando uma Campanha

1. Clique em **Nova Campanha**
2. Preencha os dados:
   - **Nome** da campanha (ex: "Crescimento Q1 2026 — TRW")
   - **Tipo** (Crescimento / Mix / Positivação / Volume)
   - **Indústria** vinculada
   - **Cliente** (ou grupo de clientes)
   - **Período** de início e fim — a vigência aparece no card depois
   - **Meta** (conforme o tipo: R$, nº de famílias, meses ou unidades)
   - **Premiação / Incentivo** — descrição do prêmio (opcional)
3. Para campanhas de Crescimento, clique em **Simular** para ver a meta calculada antes de salvar
4. Salve como **SIMULAÇÃO** para revisão, ou diretamente como **ATIVA**

#### Status das Campanhas

| Status | Significado |
|--------|-------------|
| **SIMULAÇÃO** | Criada mas ainda não ativada — pode ser editada livremente |
| **ATIVA** | Em execução — acompanhamento em tempo real |
| **CONCLUÍDA** | Período encerrado — resultado apurado |
| **CANCELADA** | Interrompida antes do fim |

---

### Aba Monitoramento — Acompanhando o Progresso

Para cada campanha ativa, o Monitoramento exibe:

- **% do período decorrido** — quanto do prazo da campanha já passou
- **% da meta atingida** — quanto o cliente já realizou em relação à meta
- **Barra de progresso dupla:** compara o ritmo atual com o ritmo necessário para atingir a meta

> **Alerta de atraso:** Se a % da meta atingida estiver significativamente abaixo da % do período decorrido, a barra fica destacada em laranja — sinal de que o cliente precisa de atenção.

Exemplo: se o período está 60% decorrido mas o cliente só atingiu 30% da meta, o sistema sinaliza risco de não cumprimento.

Use o Monitoramento para priorizar contatos comerciais — foque nos clientes que estão com ritmo abaixo do esperado.

---

### Aba Auditoria

Registro histórico de todas as campanhas — ativas, concluídas e canceladas. Permite:

- Consultar o resultado final de campanhas passadas
- Verificar qual cliente atingiu a meta e qual não atingiu
- Analisar a efetividade de cada tipo de campanha ao longo do tempo

---

## Baixa via XML

O módulo **Baixa via XML** (também chamado de **NF-e**) automatiza o processo de confirmação de faturamento. Quando a indústria emite a Nota Fiscal Eletrônica (NF-e), você faz o upload do arquivo XML e o sistema identifica quais pedidos foram faturados, conferindo item por item.

Acesse pelo menu **Movimentações → Baixa via XML**.

O processo funciona em **3 passos**:

---

### Passo 1 — Upload do XML

Arraste o arquivo `.xml` da NF-e para a área indicada, ou clique para selecionar.

> O sistema aceita arquivos XML no padrão SEFAZ (NF-e versão 4.0). Um arquivo por vez.

---

### Passo 2 — Pré-visualização e Conferência

Após o upload, o sistema processa o XML e exibe uma tela de conferência com:

**Informações da NF-e:**
- **Indústria emitente** (identificada pelo CNPJ)
- **Destinatário / Cliente**
- **Número da Nota** e data de emissão
- **Valor total da NF**

**Alocação de itens (OrderCards):**

Para cada pedido que o sistema identificou como relacionado a esta NF, é exibido um card com:
- Número do pedido
- Lista de itens alocados: código, descrição, quantidade na NF vs. quantidade no pedido
- **Barra de cobertura:** progresso visual mostrando qual % do pedido está coberto pela nota

**Itens não alocados:**

Itens que constam na NF mas não foram encontrados em nenhum pedido são exibidos em vermelho ao final. Isso pode ocorrer quando:
- O produto foi incluído diretamente pela indústria (bonificação, brinde)
- O código da NF é diferente do código no pedido
- O pedido ainda não está cadastrado no sistema

> **Dica:** Revise os itens não alocados antes de confirmar. Se um item importante estiver sem pedido vinculado, crie o pedido antes de aplicar a baixa.

---

### Passo 3 — Confirmar a Baixa

Após revisar, clique em **Confirmar Baixa**. O sistema:

1. Altera o status dos pedidos identificados de **P → F (Faturado)**
2. Registra o número e a data da NF-e em cada pedido
3. Exibe uma tela de confirmação com o resumo da operação

Os pedidos faturados ficam disponíveis nos relatórios de faturamento e no painel do BI.

---

### Quando usar

| Situação | Recomendação |
|----------|-------------|
| Indústria enviou a NF por e-mail | Baixe o XML anexo e faça o upload |
| Faturamento chegou via DANFE | Solicite o XML à indústria para fazer a baixa corretamente |
| Múltiplas NFs do mesmo pedido | Faça o upload de cada XML separadamente |
| NF de bonificação ou garantia | Use normalmente — o sistema identifica pelo status do pedido |

---

## Sell-Out

O módulo **Sell-Out** registra o que os seus clientes (lojistas) vendem ao consumidor final. Enquanto os Pedidos registram o que você vendeu *ao* lojista (sell in), o Sell-Out registra o que o lojista vendeu *para o mercado* (sell out).

Acesse pelo menu **Movimentações → Sell-Out**.

Essa informação é fundamental para:
- Entender o **giro real** dos produtos na prateleira do cliente
- Identificar produtos com **alta venda** ao consumidor mas **baixa reposição** (oportunidade de venda)
- Calcular a **eficiência de estoque** do cliente

---

### Painel de Indicadores

No topo da página, quatro cards exibem os principais indicadores do período selecionado:

- **Total de Registros** — quantas entradas de sell-out foram importadas
- **Valor Total** — soma de todo o sell-out registrado
- **Quantidade Total** — total de peças vendidas pelo mercado
- **Clientes Ativos** — quantos clientes enviaram dados de sell-out no período

Abaixo dos cards, dois gráficos complementam a visão:

- **Evolução Mensal** (gráfico de área): tendência do sell-out mês a mês
- **Ranking** (gráfico de barras): alterne entre ranking de clientes ou ranking por indústria

---

### Aba: Registros

Lista completa de todos os registros de sell-out. Para cada linha você vê:

- **Cliente** (nome reduzido)
- **Indústria / Fornecedor**
- **Período** (mês e ano — formato MM/AAAA)
- **Valor** (R$)
- **Quantidade** (unidades vendidas)
- Botões de **Editar** e **Excluir**

#### Como registrar o Sell-Out de um cliente

**Opção A — Manual (um registro por vez):**
1. Clique em **Novo Registro**
2. Selecione o **Cliente**
3. Selecione a **Indústria**
4. Informe o **Período** (MM/AAAA)
5. Informe o **Valor** (R$) e a **Quantidade**
6. Salve

> **Detecção de duplicata:** Se já existir um registro para o mesmo cliente + indústria + período, o sistema avisa antes de salvar. Você pode optar por **somar** ao registro existente ou **substituir**.

**Opção B — Importação via planilha (em lote):**

1. Clique em **Baixar Gabarito** para obter a planilha modelo com as colunas corretas
2. Preencha o gabarito com os dados do período
3. Clique em **Importar** e selecione o arquivo preenchido
4. O sistema processa e exibe um resumo da importação (inseridos / atualizados / erros)

A planilha gabarito tem as colunas: **Código do Cliente**, **Código da Indústria**, **Período (MM/AAAA)**, **Valor**, **Quantidade**.

---

### Aba: Pendências

Lista os clientes que enviaram dados de sell-out no mês anterior mas **ainda não enviaram no mês atual**. Serve como agenda de cobranças — você sabe exatamente quem precisa enviar o relatório.

Para cada cliente pendente, você vê:
- Nome do cliente
- Última data de envio
- Quantos meses consecutivos de histórico existem

> **Boa prática:** Use a aba Pendências no início de cada mês para contatar os clientes que ainda não enviaram e manter o histórico completo.

---

## Produtos

### Catálogo de Produtos

O módulo de Produtos exibe todos os itens disponíveis para venda. Você pode buscar por **código**, **descrição** ou **NCM**.

> **Destaque:** O código do produto é sempre exibido em evidência — é a referência principal no setor de autopeças. Em qualquer lista ou tabela, o código aparece em destaque (maior, negrito) antes da descrição.

### Informações do Produto

Cada produto exibe:

- **Código** (referência principal — exibido em destaque)
- **Descrição**
- **Linha:** Leve, Pesada, Agrícola, Utilitários, Motos, Off-Road, Amarela
- **Embalagem** e unidade de venda
- **Grupo de produtos** (categoria)
- **Tabela de preços** por indústria
- **Histórico de compras** por cliente
- **Promoções ativas**

### Tabelas de Preço

As tabelas de preço são carregadas automaticamente ao fazer um pedido, de acordo com a indústria selecionada. O sistema verifica se há preço especial para o cliente ou promoção vigente e aplica o melhor preço automaticamente.

---

## Central Estatísticos

A **Central Estatísticos** é o módulo de mapas analíticos do RepOne. Diferente do BI (que traz visão executiva consolidada), aqui você encontra **mapas operacionais** prontos pra usar no dia a dia — listagens com filtros, exportação Excel e foco em ação imediata.

### Como acessar

Menu lateral → **Central Estatísticos**. A tela é dividida em duas partes:
- **Esquerda:** lista das rotinas disponíveis (cards clicáveis)
- **Direita:** painel da rotina selecionada com filtros e resultados

### Filtros gerais (topo da rotina)

Toda rotina tem filtros padrão no cabeçalho:
- **Período** (De / Até) — datas editáveis, sempre presentes
- **Indústria** — uma específica ou todas
- **Vendedor** — uma específica (com restrições por permissão) ou todos
- **Cliente** — busca livre quando aplicável

> **Modo "Considerar Rede":** muitas rotinas têm um checkbox **Agrupar por rede** que consolida lojas-filiais com a sede. Útil quando você cadastra filiais separadas mas quer ver o resultado consolidado da bandeira.

### Rotinas disponíveis

| Rotina | O que faz | Quando usar |
|---|---|---|
| **Mapa por Indústria** | Faturamento mensal por indústria — valor e quantidade | Visão consolidada da performance por fornecedor |
| **Mapa de Vendas** | Visão geral de faturamento por indústria e cliente, mês a mês, com coluna TOTAL destacada | Diagnóstico amplo do período |
| **Sellin por Período** | Sell-in do rep (pedidos colocados) | Cobertura de pedidos do mês |
| **Sellout por Período** | Sell-out real (vendas do cliente para o consumidor) | Quando o cliente envia relatório de sell-out |
| **Mapa CLI / Indústria** | Cruzamento de clientes atendidos por indústria | Identificar gaps de cobertura |
| **Clientes Ano a Ano** | Comparativo YoY por indústria — valor e quantidade | Análise de evolução |
| **Mapa Mensal de Itens** | Quantidade de itens vendidos mês a mês | Volume operacional |
| **Comparativo Clientes** | Comparação lado-a-lado entre clientes no período | Ranking direto |
| **Grupo de Lojas** | Consolidado de clientes agrupados por rede | Rede com várias filiais |
| **Itens Nunca Comprados** | Produtos do catálogo sem nenhuma venda registrada | Identificar SKUs parados |
| **Mapa 3 Anos** | Evolução comparativa dos últimos 3 anos | Visão de longo prazo |
| **Últimas Compras** | Clientes ordenados pela data da última compra | Cobrar clientes silenciosos |
| **Clientes Inativos** | Clientes sem compra no período selecionado | Lista de reativação |
| **Prod. Única Compra** | Produtos comprados apenas uma vez no período | Identificar produtos de oportunidade pontual |
| **Venda Mensal Indústria** | Faturamento mensal consolidado por indústria | Fechamento de período |
| **Mapa de Pedidos** | Visão geral de pedidos por status e período | Acompanhamento operacional |
| **Client Insight** | Visão 360° da carteira — faturamento, mix, inatividade | Análise individual profunda |
| **Curva ABC Produtos** | Classificação Pareto de SKUs por faturamento | Decisões de mix |
| **Mapa de Oportunidades** | Portfólio da indústria × compras do cliente | Cross-sell — disponível apenas em escritórios habilitados |

### 4 mapas recentes (lançados em 26/27 de maio)

#### Portfólio por Indústria

Escolha uma indústria → vê todos os itens vendidos no período (lado esquerdo, ordenados por quantidade) e ao clicar em um item, vê todos os clientes que o compraram (lado direito).

**Útil para:** identificar campeões de venda da indústria, descobrir quem compra cada SKU, e direcionar reposição ou cross-sell.

> **Filtro de produtos:** no painel esquerdo (Portfólio da Indústria), há uma busca com ícone de lupa. Filtra por código OU descrição em tempo real — essencial para indústrias com 3.000+ itens. O Excel exporta apenas o que estiver filtrado.

#### Vendas × Churn Trimestral

Lado esquerdo: pedidos do período atual (pedido a pedido). Lado direito: clientes que compraram nos 3 meses imediatamente anteriores **mas não compraram dentro do período atual** — ou seja, sumiram.

**Útil para:** identificar churn silencioso enquanto ainda dá tempo de reativar.

#### Gap de Catálogo (Cross-sell ABC)

Escolha uma indústria + um cliente → lista os itens da indústria com curva ABC (A=80% do faturamento, B=15%, C=5%) **que esse cliente NUNCA comprou**.

**Útil para:** argumentar visita com lista pronta de oportunidades — começar pelos da curva A (maior potencial) e mostrar "Pontos de Venda" pra evidenciar quantos concorrentes já compram aquele item.

#### Indústrias Adormecidas

Lista clientes ATIVOS na carteira (ainda compram alguma coisa) mas que **pararam de comprar de indústrias que historicamente compravam**. Você define o "limite de silêncio" em dias (padrão 90).

Lado esquerdo: lista de clientes com pelo menos 1 indústria adormecida. Lado direito: ao clicar num cliente, vê TODAS as indústrias compradas com status (ATIVA / ADORMECIDA).

**Útil para:** insight diferente de "clientes inativos" (que pararam tudo) — mostra perda de share por fornecedor enquanto o cliente ainda está vivo.

> **Exportação Excel:** essa rotina gera Excel com 3 abas — Resumo por cliente, Detalhamento (par cliente × indústria adormecida) e, se você clicou em um cliente específico, uma aba só com a visão dele.

### Boas práticas

- **Use filtros antes de processar** — quanto mais específico, mais rápido o resultado
- **Exporte para Excel** quando precisar trabalhar em planilha (botão verde no topo de cada rotina)
- **Filiais de Rede** ficam excluídas por padrão de Clientes Inativos, Churn Trimestral, Indústrias Adormecidas e Últimas Compras — pra ver com elas, marque o cliente raiz da rede
- **Lojistas que não compram** — na Ficha do Cliente, desligue o toggle **"Compra?"** (deixe em "NÃO COMPRA") pra tirar dos relatórios estatísticos aqueles lojistas que nunca compram de você (ex.: filial abastecida pelo CD) ou cujo mix não combina com as suas indústrias. O padrão é todo cliente contar como comprador; você desliga só as exceções

---

## BI — Business Intelligence

O BI é o painel de análise de resultados do RepOne. Aqui você transforma os dados de vendas em informação visual para tomar decisões melhores.

### Como acessar

Clique em **BI** no menu lateral. O sistema carregará o painel com base nos filtros de período selecionados.

### Filtros de Período

No topo do BI você encontra o seletor de período. Você pode escolher:

- Um mês específico
- Um trimestre
- Um ano completo
- Intervalos personalizados
- **Modo comparação (YoY):** selecione 2 anos para o BI mostrar variação ano-a-ano em cada gráfico

Os filtros se aplicam a todas as abas do BI simultaneamente.

### Filtros adicionais (acima das abas)

- **Métrica:** alterna o que está sendo medido nos gráficos e drill-downs:
  - **Financeiro (R$)** — padrão, soma de `ite_totliquido`
  - **Volume (Qtd)** — quantidade vendida
  - **Unidades (SKU)** — número de produtos distintos
- **Indústria** — filtra para uma indústria específica
- **Cliente** — filtra para um cliente específico
- **Vendedor** — filtra para um vendedor específico (com restrições conforme permissão)
- **Considerar Rede** — checkbox que consolida lojas-filiais com o cliente-sede

### Drill-down (clicar em qualquer gráfico)

A maioria dos gráficos do BI tem **drill-down** — clique em uma barra/segmento para aprofundar. O drill-down respeita a métrica selecionada (Financeiro / Volume / SKUs).

Quando você está dentro do drill-down num nível com clientes (nível 2), aparece o toggle **🏢 Agrupar por rede** — quando ativo, agrupa lojas-filiais sob o nome da rede em vez de mostrar cada loja separada. Útil pra ver consolidado por bandeira.

---

### Aba: Visão Geral

Painel executivo com os principais números do seu negócio:

- **Receita total** do período
- **Volume de pedidos**
- **Clientes ativos** (que compraram no período)
- **Ticket médio** por pedido
- **Comparativo** com o mesmo período anterior (crescimento ou queda %)
- **Gráfico de evolução mensal** da receita
- **Ranking de indústrias** por faturamento
- **Distribuição por cliente** (curva de Pareto)

> **IRIS BI:** O sistema exibe uma análise em linguagem natural gerada por IA — uma leitura automática dos seus números, destacando pontos de atenção e oportunidades.

---

### Aba: Indústrias

Análise detalhada por fornecedor/indústria:

- **Ranking** de indústrias por faturamento no período
- **Evolução mensal** de cada indústria (gráfico de linha)
- **Comparativo** com período anterior
- **Positivação:** quantos clientes compraram de cada indústria
- **Ticket médio** por indústria
- **Alertas de queda:** indústrias com queda significativa em relação ao histórico
- **Mix de categorias:** distribuição dos produtos por categoria dentro de cada indústria

---

### Aba: Clientes

Análise detalhada da sua carteira:

- **Ranking de clientes** por volume de compras
- **Curva ABC:** quais clientes representam 80% da sua receita (classe A), 15% (classe B) e 5% (classe C)
- **Queda MoM (Month over Month):** clientes que compraram menos este mês comparado ao mês anterior — sinal de alerta
- **Ciclo de compras:** frequência média de recompra por cliente
- **Ticket médio** por cliente
- **Grupos de lojas:** clientes agrupados por rede/grupo comercial

---

### Aba: Estatísticas

Visão estatística geral:

- **Curva ABC completa** de clientes e produtos
- **Última compra:** quantos dias faz desde a última compra de cada cliente
- **Faturamento por indústria/mês** em formato de tabela
- **Classificação de produtos:** os mais e menos vendidos
- **Status de clientes:** ativos, em risco, inativos (por recência de compra)

---

### Aba: Curva ABC

Análise de Pareto aprofundada:

- **Overview:** distribuição percentual entre classes A, B e C
- **Ticket médio por classe:** quanto cada faixa de cliente gasta em média
- **Ranking ABC:** lista ordenada de todos os clientes com sua classificação

Use esta aba para priorizar visitas — clientes A precisam de atenção prioritária, clientes B têm potencial de crescimento, clientes C merecem análise de custo x benefício.

---

### Aba: Equipe

*Disponível para gestores e administradores*

- **Performance por vendedor:** faturamento, número de pedidos, clientes ativos
- **Atingimento de metas:** comparativo realizado vs. meta por rep
- **Ranking da equipe**
- **Cockpit de equipe:** visão consolidada de todos os vendedores

---

### Aba: Metas

- **Metas por indústria:** o que foi definido vs. o que foi realizado
- **Progresso mensal:** gráfico de acompanhamento ao longo do mês
- **Gap de meta:** quanto falta para atingir a meta do período

---

### Aba: Produtos

Análise do mix de produtos:

- **Top SKUs:** produtos mais vendidos por quantidade e por receita
- **Produtos por grupo:** desempenho por linha/categoria de produto
- **Curva de produtos:** quais representam o maior volume de faturamento

---

### Aba: Sell In / Out

Análise específica para representantes que trabalham com portais de cliente (sell out):

- **KPIs:** comparativo entre o que foi vendido ao cliente (sell in) e o que o cliente vendeu ao consumidor final (sell out)
- **Ranking:** clientes com maior/menor giro
- **Cruzamento:** análise de eficiência de estoque

---

## CRM — Relacionamento com Clientes

O CRM do RepOne centraliza toda a gestão de relacionamento comercial. Acesse pelo menu **CRM** no menu lateral — ele é dividido em seis sub-módulos, cada um com um papel específico.

---

### Radar do Rep

O **Radar do Rep** é o painel de alerta precoce da sua carteira. Ele responde a pergunta mais importante do dia: *quem está sumindo?*

Acesse pelo menu **CRM → Radar do Rep**.

#### Indicadores do topo

| Indicador | O que mede |
|-----------|-----------|
| **Visitas esta semana** | Quantas visitas você registrou nos últimos 7 dias |
| **Visitas com pedido** | Das visitas desta semana, quantas geraram pedido |
| **Clientes em risco** | Quantos clientes compraram no trimestre anterior e sumiram no atual |

#### Clientes em Risco

Lista de clientes que **compraram no trimestre passado mas não compraram ainda no trimestre atual**. Para cada um você vê:

- Nome e cidade
- Dias sem comprar
- Valor comprado no trimestre anterior (referência de quanto você pode estar perdendo)
- Botão de telefone — clique para ligar direto pelo celular

> **Como usar:** Percorra esta lista diariamente e entre em contato com os clientes em risco. Um cliente que some por um trimestre pode estar migrando para a concorrência.

#### Metas por Indústria — Trimestre Atual

Painel de progresso das suas metas:

- Nome da indústria
- Barra de progresso com percentual atingido
- Valores: realizado (R$) vs. meta (R$)
- **Verde** ≥ 100% | **Amarelo** ≥ 60% | **Vermelho** < 60%

As metas são cadastradas na ficha de cada indústria (aba **Meta Anual**) e o sistema calcula automaticamente o realizado com base nos pedidos faturados.

---

### Carteira

A **Carteira** é a visão de saúde de todos os seus clientes. Filtre pelo status de cada um e acesse a ficha completa de relacionamento.

Acesse pelo menu **CRM → Carteira**.

#### Filtros de status

| Status | Quem está aqui |
|--------|---------------|
| **Todos** | Todos os clientes cadastrados |
| **Ativo** | Compraram recentemente |
| **Em Risco** | Compraram antes, mas sumiram |
| **Inativo** | Sem compras há mais tempo |
| **Perdido** | Sem qualquer atividade recente |

Cada linha exibe: nome do cliente, cidade/UF, status, dias desde a última compra, dias desde a última visita e valor no último trimestre.

#### Ficha do Cliente (painel lateral)

Ao clicar em qualquer cliente, abre um painel lateral com:

**Últimos Pedidos:** lista dos pedidos mais recentes com indústria, data e valor.

**Produtos Favoritos:** os produtos que o cliente mais compra (código + nome + número de pedidos).

**Histórico de Visitas:** todas as visitas registradas com data, observações e resultado.

**Registrar Visita:** formulário rápido diretamente na ficha. Preencha:
- **Data** da visita
- **Resultado:** Pedido Gerado / Sem Pedido / Reagendou / Não Encontrado
- **Nº do pedido** (aparece apenas se o resultado for "Pedido Gerado")
- **Observações** — o que aconteceu na visita

Clique em **Salvar** para registrar. A visita aparece imediatamente no histórico.

---

### Atividades

O módulo de **Atividades** é onde você gerencia seus compromissos futuros (follow-ups) e registra o histórico de atendimentos já realizados.

Acesse pelo menu **CRM → Atividades**.

#### Indicadores do topo

- **Atrasados** — follow-ups que passaram da data sem serem concluídos (alerta em vermelho)
- **Para hoje** — compromissos programados para hoje
- **Esta semana** — compromissos da semana atual
- **Total pendente** — todos os follow-ups aguardando ação

#### Aba: Pendentes

Lista de todos os follow-ups ainda não concluídos, com: data/hora, cliente, assunto, prioridade (Alta/Média/Baixa) e botões de ação.

**Para cada follow-up você pode:**
- **✓ Concluir** — abre confirmação. Você pode marcar a opção *"Criar próximo follow-up automaticamente"* — se marcada, o sistema cria um novo follow-up para 7 dias depois, com o mesmo cliente e assunto
- **✏ Editar** — alterar assunto, data, hora, prioridade ou descrição
- **🗑 Excluir** — remover o follow-up

#### Aba: Histórico

Registro de todos os atendimentos já realizados. Para cada interação: data, cliente, tipo, canal, descrição e resultado.

#### Criando um novo item

Clique em **Nova Atividade** e escolha o modo:

**Agendar Compromisso** — agenda um follow-up futuro:
- Cliente, Assunto, Data, Hora (opcional), Prioridade, Descrição

**Registrar Atendimento** — documenta algo que já aconteceu:
- Cliente, Tipo de interação, Canal, Resultado (opcional)
- Indústrias Abordadas (selecione uma ou mais — útil para registrar quais linhas foram apresentadas)
- Data, Descrição/Resumo

> **Dica:** Sempre registre o que aconteceu imediatamente após a visita ou ligação — enquanto os detalhes estão frescos. O histórico é uma ferramenta poderosa para futuras negociações.

---

### Relacionamentos

O módulo de **Relacionamentos** é a ferramenta mais completa para documentar cada interação com seus clientes. Interface em três colunas: contexto do cliente, linha do tempo e formulário de registro.

Acesse pelo menu **CRM → Relacionamentos**.

#### Como funciona

**Coluna esquerda — Contexto do cliente:**
Selecione um cliente no campo de busca. O painel exibe automaticamente:
- Últimos pedidos (até 5, com indústria, data e valor)
- Atividade principal do cliente
- Áreas de atuação
- Top produtos (os mais comprados, com código e frequência)
- Contador de registros de relacionamento já salvos

**Coluna central — Linha do tempo:**
Todo o histórico de interações com o cliente selecionado, em ordem cronológica. Cada card exibe: tipo, resultado, canal, data e descrição. Clique no card para ver detalhes completos, incluindo as indústrias abordadas naquele contato.

**Coluna direita — Formulário de registro:**
Documente um novo momento de contato:

1. **Tipo de Interação** — selecione o tipo (os botões ficam coloridos conforme o tipo)
2. **Canal** — como o contato aconteceu
3. **Resultado** — qual foi o desfecho
4. **Data**
5. **Indústrias Abordadas** — quais linhas foram apresentadas ou discutidas
6. **Descrição** — campo livre. Use para registrar: como estava o humor do cliente, quais produtos foram mencionados, objeções levantadas, próximo passo combinado

Clique em **Registrar este Momento** para salvar.

#### Relatório de Relacionamentos

Clique no botão **Relatório** no topo da página. Defina o período (data início + data fim) e a indústria (opcional) e clique em **Buscar**.

O relatório exibe todos os contatos do período, agrupados por indústria, com data, hora, cliente, cidade, operador, tipo e resultado. Exportável para impressão via navegador.

---

### Pipeline

O **Pipeline** é o quadro Kanban de oportunidades de venda — prospecções que ainda não viraram pedido mas têm potencial identificado.

Acesse pelo menu **CRM → Pipeline**.

#### 5 etapas do pipeline

| Etapa | O que significa |
|-------|----------------|
| **Prospecção** | Cliente identificado como potencial comprador |
| **Qualificação** | Necessidade e potencial de compra confirmados |
| **Proposta** | Orçamento ou proposta enviada |
| **Negociação** | Em processo de fechamento |
| **Fechamento** | Venda concluída |

Cada coluna exibe o número de oportunidades e o valor total estimado naquele estágio.

#### Criando uma oportunidade

Clique no **+** em qualquer coluna. Preencha:
- **Cliente** — quem é o potencial comprador
- **Título** — descrição da oportunidade (ex: "Expansão linha de freios — Mar/2026")
- **Etapa** — em qual estágio está
- **Valor Estimado (R$)** — quanto pode render
- **Probabilidade (%)** — sua estimativa de fechar
- **Previsão de Fechamento** — data esperada
- **Descrição** — detalhes adicionais

#### Movendo oportunidades

Arraste o card de uma coluna para outra conforme a oportunidade avança. O sistema atualiza automaticamente. Use o ícone de lápis para editar ou o X para excluir.

#### Indicadores no Dashboard

O **Dashboard CRM** (tela inicial do CRM) consolida os dados do pipeline em 4 cards:
- **Oportunidades** — total no pipeline
- **Valor em Pipeline** — soma dos valores estimados
- **Follow-ups Hoje** — compromissos pendentes para hoje
- **Atrasados** — follow-ups que passaram do prazo

---

### WhatsApp IA

O **WhatsApp IA** conecta a IRIS (assistente de inteligência artificial do RepOne) ao seu WhatsApp Business. Com a integração ativa, a IRIS responde mensagens automaticamente, 24 horas por dia.

Acesse pelo menu **CRM → WhatsApp IA**.

#### Conectando o WhatsApp

1. Clique em **Gerar QR Code**
2. No seu celular, abra o WhatsApp → toque nos três pontos (⋮) → **Aparelhos Conectados**
3. Aponte a câmera para o QR Code exibido na tela
4. Aguarde a confirmação — o painel mostrará **"Sincronizado!"** quando a conexão for estabelecida

> Se você tiver múltiplas instâncias, use o seletor no topo para escolher qual conectar.

#### O que a IRIS faz pelo WhatsApp

Quando ativa, a IRIS:
- Responde perguntas sobre **status de pedidos**
- Consulta o **histórico de compras** de um cliente
- Tira dúvidas sobre **produtos e preços**
- Auxilia na **montagem de pedidos**
- Envia **alertas automáticos** de clientes em risco

A IRIS usa dados reais do sistema (pedidos, clientes, produtos) para responder com precisão. A configuração de como ela deve se comportar — tom de voz, o que pode ou não revelar, instruções do negócio — é feita em **IRIS → Configurações** (somente administradores).

---

### Visitas — Check-in / Check-out

O módulo de **Visitas** exibe o histórico completo de visitas de campo registradas pelo app mobile. É a visão do escritório sobre o que a equipe fez em campo.

Acesse pelo menu **CRM → Visitas**.

#### Filtros de período

Use os campos de data para definir o intervalo desejado. Navegue entre semanas com as setas **‹ ›** ou ajuste as datas manualmente e clique em **Filtrar**.

#### Resumo do período

Três cards no topo mostram rapidamente:

| Card | O que exibe |
|------|------------|
| **Total de Visitas** | Quantidade de visitas no período |
| **Concluídas** | Visitas com check-out registrado |
| **Em Aberto** | Visitas com check-in mas sem check-out |

#### Lista de visitas

As visitas são agrupadas por dia, com a data e o total do dia como cabeçalho. Cada card mostra:

- **Borda colorida:** verde = visita concluída / amarelo = em aberto
- **Cliente:** razão social e nome reduzido
- **Promotor** responsável pela visita
- **Entrada / Saída:** horários de check-in e check-out
- **Duração** (quando concluída): ex. "42 min" ou "1h 15min"
- **Distância:** distância do promotor ao endereço cadastrado do cliente no momento do check-in

> **Administradores** visualizam todas as visitas da equipe. Vendedores visualizam apenas suas próprias visitas.

---

### Campo Digital — O Promotor em Ação

O **Campo Digital** é o coração do CRM no mobile. Transforma o celular do promotor em uma ferramenta de campo completa: check-in com GPS, pedido durante a visita e registro do resultado ao sair.

Acesse pelo app mobile → **Clientes**.

#### 1. Check-in: anunciar chegada

Ao chegar no cliente, localize-o na lista e toque no botão **verde de entrada (→)**. O app captura automaticamente a localização GPS e registra o horário de chegada. O botão muda para **laranja**, indicando visita em andamento.

> O sistema calcula a distância entre o GPS atual e o endereço cadastrado do cliente — essa informação aparece no histórico de visitas.

#### 2. Usar o catálogo e fazer pedido

Durante a visita, você pode navegar pelo catálogo de produtos e criar o pedido diretamente na frente do lojista. O pedido ficará vinculado automaticamente a esta visita.

#### 3. Check-out: registrar o resultado

Ao sair, toque no botão **laranja (✕)**. O app abre a tela de resultado — o campo **mais importante** da visita.

**Selecione o que aconteceu:**

| Resultado | Quando usar |
|-----------|------------|
| ✅ **Positivou** | Saiu com pedido — a visita gerou venda |
| ❌ **Não positivou** | Não saiu com pedido — selecione o motivo |
| 📅 **Reagendou** | Cliente pediu para voltar em outra data |
| 🚪 **Ausente** | Loja fechada ou responsável não estava |

**Quando "Não positivou"**, o sistema exige a seleção de um motivo:
- Sem estoque / estoque cheio
- Preço acima do mercado
- Concorrência
- Sem interesse no momento
- Comprador ausente
- Outro

**Ação de Marketing (opcional):** em qualquer resultado de visita você pode registrar uma ação de marketing realizada durante a passagem:

| Ação | Quando usar |
|------|------------|
| **Dia Foco** | Visita com objetivo de ativar vendas de uma linha específica |
| **Relacionamento** | Visita de fortalecimento de vínculo sem objetivo de pedido imediato |
| **Sell-out** | Ação de apoio ao lojista para girar estoque já comprado |

Quando uma ação de marketing é selecionada, o campo "Como foi a visita?" (resultado) torna-se **opcional** — a ação de marketing por si só já justifica o registro da visita.

Após selecionar, toque em **Confirmar Check-out**. O app registra o GPS de saída e calcula automaticamente a duração da visita.

> **Por que isso importa:** A **taxa de positivação** — percentual de visitas que geram pedido — é o indicador mais importante de uma representação de autopeças. Com o campo digital, o RepOne é o único sistema que calcula esse número com precisão.

---

### Campo Ao Vivo — Painel do Diretor

O **Campo Ao Vivo** é a visão em tempo real da equipe em campo. Atualiza automaticamente a cada 30 segundos, sem precisar recarregar a página.

Acesse pelo menu **CRM → Campo Ao Vivo**.

#### KPIs do dia

Quatro cards no topo exibem o panorama atual:

| Card | O que exibe |
|------|------------|
| **Total de Visitas** | Quantas visitas foram iniciadas hoje |
| **Positivações** | Quantas terminaram com pedido |
| **Não positivaram** | Quantas terminaram sem pedido |
| **Em visita agora** | Quantos promotores estão com check-in aberto neste momento |

#### Cards por promotor

Cada promotor com visita no dia tem um card próprio:

- **Anel âmbar** ao redor do card: promotor está dentro de uma visita agora. O nome do cliente atual e o horário de entrada aparecem abaixo do nome.
- **Estatísticas:** total de visitas, quantas positivaram, quantas não positivaram
- **Barra de positivação:** percentual visual com cor dinâmica — verde (≥ 60%), amarelo (40-59%), vermelho (< 40%)

#### Mapa de cobertura

Quando os clientes visitados têm coordenadas GPS cadastradas, um mapa é exibido com pins coloridos:

| Cor do pin | Significado |
|-----------|------------|
| 🟡 Amarelo | Em visita agora |
| 🟢 Verde | Check-out registrado — positivou |
| 🔴 Vermelho | Check-out registrado — não positivou |
| ⚫ Cinza | Check-out com outro resultado (reagendou, ausente) |

Clique em qualquer pin para ver: nome do cliente, promotor, horário de entrada e saída.

#### Tabela de todas as visitas

Abaixo do mapa, uma tabela lista todas as visitas do dia em ordem cronológica inversa, com cliente, promotor, horário e resultado. Visitas sem check-out aparecem com o badge **Em visita** em âmbar.

> **Dica de gestão:** Use o Campo Ao Vivo pela manhã para verificar se a equipe está em campo, e ao final do dia para acompanhar a taxa de positivação e identificar quem precisa de apoio comercial.

---

## Agenda

A Agenda organiza sua rotina de trabalho — visitas, ligações, tarefas e compromissos em um só lugar.

### Visualizações

A agenda oferece três formas de ver seus compromissos:

- **Lista:** todos os itens em ordem cronológica
- **Hoje:** foco no dia atual
- **Kanban:** organizado por status (pendente, em andamento, concluído)

### Criando uma Tarefa

1. Clique em **Nova Tarefa** (ou no botão +)
2. Escolha o **tipo:**
   - Tarefa
   - Lembrete
   - Visita
   - Ligação
   - Reunião
   - Cobrança
   - Follow-up
   - Aniversário
3. Selecione o **cliente** (opcional)
4. Defina a **data e hora**
5. Escolha a **prioridade:** Alta (A), Média (M) ou Baixa (B)
6. Adicione observações se necessário
7. Salve

### Tarefas Recorrentes

Para atividades que se repetem (ex: visita semanal a um cliente), ative a opção de **Recorrência** e defina a frequência (diária, semanal, mensal).

### Concluindo uma Tarefa

Ao concluir, clique em **Marcar como Concluída** e adicione uma nota de conclusão se necessário. O histórico fica registrado na ficha do cliente.

---

## Financeiro

*Disponível para administradores e gestores com permissão financeira*

O módulo Financeiro centraliza a saúde financeira da representação comercial. Ele é separado do módulo de Vendas: as **receitas** aqui são comissões e outros recebimentos; as **despesas** são os custos operacionais da empresa (aluguel, funcionários, combustível, etc.).

> **Importante:** o Financeiro trabalha com lançamentos manuais. Os pedidos faturados no sistema **não** geram automaticamente contas a receber — o representante registra a comissão quando ela é confirmada pela indústria.

---

### Dashboard Financeiro

A tela inicial do módulo mostra quatro KPIs em destaque:

| KPI | O que representa |
|-----|-----------------|
| **A Receber** | Total de contas a receber em aberto (não vencidas + vencidas) |
| **A Pagar** | Total de contas a pagar em aberto |
| **Saldo Previsto** | A Receber − A Pagar (pode ser negativo se houver mais compromissos do que receitas) |
| **Inadimplência** | Valor das contas a receber com vencimento no passado |

Logo abaixo dos KPIs aparece o **Gráfico de Evolução dos Últimos 6 Meses** comparando receitas e despesas lançadas.

À direita do gráfico ficam dois painéis de alerta:
- **Atenção — A Pagar:** mostra os valores vencidos, que vencem hoje e que vencem nos próximos 7 dias.
- **Atenção — A Receber:** mesma leitura para o lado das receitas.

---

### Contas a Pagar

Registre e controle todas as saídas financeiras da representação — com **conta corrente por parcela**, baixa parcial, estorno e relatório por centro de custo.

#### Lançar uma conta

1. Clique em **Nova Conta**.
2. Preencha **Descrição**, **Valor Total** e **Data de Vencimento**.
3. Vincule **Fornecedor**, **Plano de Contas** e **Centro de Custo** (recomendado — é o que agrupa o relatório).
4. **Gerador de Parcelas:** informe o **N° de Parcelas** e o **Intervalo (dias)** e clique em **Calcular Parcelas**. A prévia é **editável** (ajuste valor e vencimento de cada parcela). O rodapé mostra **Total do Formulário** × **Soma das Parcelas** — devem bater.
   - **Dica (jeito da Lorena):** você também pode lançar **uma única parcela com o valor total** e ir dando **baixas parciais** até quitar.
5. Clique em **Salvar**.

> **Edição:** ao editar uma conta, só os **dados do cabeçalho** mudam (descrição, fornecedor, classificação). As **parcelas e os pagamentos são preservados** — o gerador de parcelas aparece apenas no lançamento. Para mudar valores/parcelas, exclua e recrie a conta.

#### Baixar (registrar pagamento) — conta corrente da parcela

1. Na lista, clique no **check verde** (ou no olho → **Detalhes**). Abrem **todas as parcelas** — clique em **Baixar** na que quiser.
2. No modal você vê o **saldo da parcela** com **barra de progresso** e o **extrato das baixas** já lançadas.
3. Informe **Data**, **Conta de caixa**, **Valor Pago** (já vem com o saldo) e, se houver, **Juros** e **Desconto**.
4. Clique em **Confirmar Pagamento**:
   - Pagou o **total** → a parcela **quita** e o modal fecha.
   - Pagou **parcial** → a baixa entra no **extrato**, o **saldo recalcula na hora** e o modal **continua aberto** já com o novo saldo. Repita até zerar.
5. Toda baixa **lança automaticamente no Livro Caixa** (saída).

#### Estornar uma baixa

Errou um pagamento? Abra os **Detalhes** da conta → no **Conta Corrente · Extrato de Baixas**, clique em **Estornar**. O valor **volta ao saldo** da parcela e é **revertido no Livro Caixa**, mantendo tudo conciliado.

#### Filtros

- **Filtrar por: Vencimento** (padrão — o que **vence** no período) **ou Pagamento** (o que foi **pago** no período, incluindo parciais; os cards passam a mostrar **Pago no Período**).
- **Período** (De / Até), **Status**, **Fornecedor**, **Centro de Custo** e **busca** por descrição.
- Os **cards** do topo refletem **sempre o período e os filtros** — não o histórico todo.

#### Relatório por Centro de Custo

Clique em **Relatório** (topo). Abre um relatório **agrupado por Centro de Custo**, com cada parcela listada e as **pagas destacadas em amarelo**, **subtotal por centro** (Valor / Pago / A Pagar) e **Total Geral**. Respeita os filtros da tela. O botão **Exportar Excel** gera a planilha com o mesmo agrupamento e destaque.

#### Status das contas

| Status | Significado |
|--------|-------------|
| **Aberto** | Há saldo a pagar |
| **Pago** | Totalmente quitada |
| **Vencido** | Venceu sem pagamento |
| **Cancelado** | Cancelada manualmente |

> 💡 O botão **Ajuda (?)** no topo abre um guia rápido com tudo isso dentro da própria tela.

---

### Contas a Receber

Registre as comissões e outros valores a receber.

#### Como lançar uma conta a receber

1. Clique em **Nova Conta**
2. Preencha a **Descrição** (ex.: "Comissão Janeiro/2026 – Indústria Alfa")
3. Informe o **Valor Total** e a **Data de Vencimento**
4. Se desejar, vincule um **Cliente Financeiro** e um **Plano de Contas**
5. Para parcelamento, ajuste **N° Parcelas** e **Intervalo**
6. Clique em **Salvar**

> **Dica:** você pode lançar **uma única parcela** com o valor total e ir recebendo aos poucos — não precisa criar várias parcelas. No **edit** o cabeçalho é atualizado (descrição, cliente, classificação); as parcelas e os recebimentos são **preservados**.

#### Conta corrente da parcela (recebimento integral ou parcial)

Cada parcela funciona como uma **conta corrente**: a obrigação fica registrada e os recebimentos entram como movimentos.

1. Clique no **✓** da linha (ou no 👁 **Detalhes**) e escolha a parcela
2. Na tela de recebimento você vê o **saldo**, a **barra de progresso** e o **histórico** dos recebimentos já feitos
3. Informe a **conta de caixa**, o **valor**, **juros** e **desconto** e clique em **Confirmar Recebimento**
4. Em recebimentos **parciais** a parcela **continua aberta** e a tela já sugere o saldo restante — receba o resto quando quiser
5. Quando o valor **quita** a parcela, a tela avisa e fecha

Todo recebimento **alimenta o caixa** automaticamente e fica no **extrato** da conta (visível nos Detalhes). Errou? Clique em **Estornar** no extrato: o valor volta ao saldo da parcela e é revertido no caixa.

#### Filtro por Vencimento ou Recebimento

No topo da lista, **Filtrar por**:
- **Vencimento** — mostra o que **vence** no período (visão de planejamento)
- **Recebimento** — mostra o que você **efetivamente recebeu** no período (integral + parcial); os cards e a coluna *Recebido no período* passam a refletir o caixa

Filtre também por **Centro de Custo** e **Cliente**.

#### Relatório (Excel)

O botão **Relatório** abre o relatório **por Centro de Custo**, respeitando os filtros, com as parcelas **recebidas destacadas em amarelo** (estilo planilha) e subtotais por centro. Exporte em **Excel** com um clique.

> **Dica:** quando a indústria paga a comissão parcelada, cada parcela pode ser baixada individualmente sem afetar as demais.

---

### Fluxo de Caixa

Relatório de entradas e saídas por período, com três modos de agrupamento:

| Agrupamento | Uso recomendado |
|-------------|-----------------|
| **Diário** | Semanas ou meses curtos (até 30 dias) |
| **Semanal** | Trimestres (visão ampla sem excesso de linhas) |
| **Mensal** | Análise anual ou semestral |

#### Como gerar

1. Selecione **Data Início** e **Data Fim**
2. Escolha o **Agrupamento**
3. Clique em **Gerar**

O relatório mostra:
- **Entradas:** soma das baixas de Contas a Receber no período
- **Saídas:** soma das baixas de Contas a Pagar no período
- **Saldo do Período:** Entradas − Saídas no intervalo
- **Saldo Acumulado:** saldo corrente desde o início do período filtrado

Ao fim da tabela aparece a **linha TOTAL** com os somatórios. Clique em **Exportar CSV** para salvar os dados em planilha.

---

### DRE Gerencial

A Demonstração do Resultado do Exercício mostra a performance financeira de um mês específico classificada pelo **Plano de Contas**.

#### Como gerar

1. Selecione o **Mês** e o **Ano**
2. Clique em **Gerar DRE**

O relatório é dividido em três blocos:
1. **RECEITAS** — todas as baixas de Contas a Receber agrupadas por conta do plano
2. **DESPESAS** — todas as baixas de Contas a Pagar agrupadas por conta do plano
3. **RESULTADO LÍQUIDO** — Receitas − Despesas (verde se positivo, vermelho se negativo)

A coluna **% Receita** mostra quanto cada conta representa em relação ao total de receitas — útil para entender onde estão os maiores custos.

> Para que o DRE seja útil, é essencial que cada lançamento esteja vinculado a uma conta do Plano de Contas.

---

### Plano de Contas

Estrutura hierárquica que classifica todas as receitas e despesas. É a "espinha dorsal" do DRE.

#### Hierarquia

```
1  RECEITAS                          ← Nível 1 (Grupo)
   1.1  Comissões                    ← Nível 2 (Subgrupo)
        1.1.01  Comissão à Vista     ← Nível 3 (Conta)
        1.1.02  Comissão Parcelada
   1.2  Outras Receitas

2  DESPESAS
   2.1  Pessoal
        2.1.01  Salários
        2.1.02  Pró-labore
   2.2  Ocupação
        2.2.01  Aluguel
```

#### Como criar uma conta

1. Clique em **Nova Conta**
2. Informe o **Código** (use o padrão hierárquico acima) e a **Descrição**
3. Selecione o **Tipo**: Receita (R) ou Despesa (D)
4. Informe o **Nível** (1 = Grupo, 2 = Subgrupo, 3 = Conta)
5. Se for nível 2 ou 3, selecione a **Conta Pai**
6. Salve

> As contas de nível 3 são as que aparecem nos lançamentos. Contas de nível 1 e 2 são apenas agrupadores no DRE.

---

### Clientes e Fornecedores Financeiros

São cadastros exclusivos do módulo Financeiro — **diferentes** dos clientes de vendas.

- **Clientes Financeiros:** entidades vinculadas às Contas a Receber (ex.: indústrias que pagam comissão, clientes que pagam serviços extras).
- **Fornecedores Financeiros:** entidades vinculadas às Contas a Pagar (ex.: locador do escritório, operadora de telefonia, fornecedor de combustível).

Ambos os cadastros têm os mesmos campos: razão social, CPF/CNPJ, endereço, telefone e e-mail.

---

### Centro de Custo

*(Em desenvolvimento)* Recurso futuro que permitirá classificar despesas por área (ex.: Comercial, Administrativo, Logística). Isso enriquecerá o DRE com uma visão departamental.

---

### Boas Práticas Financeiras no RepOne

1. **Lance as comissões assim que confirmadas** pela indústria, não quando esperadas — isso mantém o fluxo de caixa realista.
2. **Vincule sempre o Plano de Contas** em cada lançamento para que o DRE seja confiável.
3. **Registre as baixas na data real do pagamento/recebimento** — não altere a data retroativamente para que o Fluxo de Caixa reflita o histórico verdadeiro.
4. **Revise mensalmente:** no início de cada mês, gere o DRE do mês anterior e o Fluxo de Caixa do trimestre para identificar tendências.
5. **Use o Dashboard como ponto de partida:** se os alertas de vencimento estiverem com valores altos, priorize as baixas antes de lançar novas contas.

---

## Relatórios

O RepOne oferece mais de 20 relatórios prontos, organizados em categorias.

### Como gerar um relatório

1. Acesse **Relatórios** no menu lateral
2. Escolha a categoria e o relatório desejado
3. Defina os filtros (período, cliente, indústria, etc.)
4. Clique em **Gerar**
5. O relatório abre em PDF para visualização, impressão ou download

### Relatórios de Cadastro

- **Clientes:** lista completa ou por filtros
- **Indústrias:** fornecedores cadastrados
- **Transportadoras:** empresas de frete
- **Tabelas de Preço:** completa, reduzida ou com descontos
- **Promoções:** produtos em promoção ativa
- **Clientes por Indústria:** quais clientes compram de cada fornecedor
- **Clientes por Área de Atuação:** distribuição geográfica

### Relatórios de Vendas

- **Cotações Pendentes:** pedidos em aberto aguardando confirmação
- **Vendas por Período:** detalhado (item a item) ou sintético (por pedido)
- **Vendas por Cliente:** faturamento consolidado por cliente
- **Vendas por Indústria:** faturamento consolidado por fornecedor
- **Vendas por Cidade/Estado:** distribuição geográfica das vendas
- **Produtos Vendidos por Grupo:** mix de vendas por categoria

### Relatórios de Faturamento

- **Comissão de Vendedores:** cálculo de comissão por período
- **Faturamento no Período:** total faturado com detalhes
- **Pedidos Faturados:** lista de pedidos confirmados pelas indústrias
- **Faturamento Pendente:** pedidos ainda não confirmados
- **Produtos Não Faturados:** itens com divergência no faturamento

---

## Importador de Preços

O **Importador de Preços** permite criar ou atualizar tabelas de preço de forma rápida, sem precisar preencher produto a produto. Acesse pelo menu **Produtos → Importação de Preços**.

A página oferece dois modos de importação:

---

### Modo 1: Importar Tabela (colar colunas)

O modo padrão. Você abre a tabela da indústria no Excel, copia coluna por coluna e cola diretamente nos campos correspondentes. Não precisa baixar nenhum gabarito — basta copiar cada coluna do Excel da indústria.

#### Passo a passo

1. **Selecione a Indústria** — escolha o fornecedor dono desta tabela
2. **Selecione ou crie a Tabela** — escolha uma tabela existente para atualizar, ou clique em **+ NOVA** para criar
3. **Data da Tabela** — data de vigência dos preços
4. **Validade** — opcional. Deixe em branco para tabelas sem prazo de vencimento
5. **Cole as colunas** — nas abas abaixo, copie cada coluna do Excel e cole no campo correspondente

#### Campos disponíveis — 3 abas

**Aba 1 — Dados Principais** (mínimo necessário para importar):
| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Código | Sim | Código do fabricante (referência do produto) |
| Complemento | Não | Complemento do código (sufixo, variação) |
| Marca / Linha | Não | Nome da marca ou sub-linha |
| Nome do Produto | Sim | Descrição comercial do produto |
| Preço Bruto | Sim | Preço tabela (de lista) |
| Preço Promoção | Não | Preço promocional vigente |
| Preço Especial | Não | Preço especial para clientes selecionados |

**Aba 2 — Detalhes do Produto**:
| Campo | Descrição |
|-------|-----------|
| Grupo de Produtos | Categoria/grupo (ex: FREIOS, SUSPENSÃO) |
| Aplicação | Veículos compatíveis |
| Embalagem | Quantidade por embalagem |
| Peso | Peso unitário em kg |
| Preço por Peso/Qtd | Preço calculado por peso ou quantidade |
| Grupo de Desconto | Grupo de desconto vinculado ao item |
| % IPI | Alíquota de IPI do produto |
| % ST | Alíquota de Substituição Tributária |

**Aba 3 — Códigos e Classificações**:
| Campo | Descrição |
|-------|-----------|
| Código Original | Código do fabricante original (cross-reference) |
| Código de Barras | EAN/GTIN |
| Desconto Adicional | % de desconto adicional sobre o preço bruto |
| NCM | Nomenclatura Comum do Mercosul |
| Curva ABC | Classificação A, B ou C na linha da indústria |
| Categoria | Linha do veículo (LEVE, PESADA, AGRÍCOLA, MOTO, OFF-ROAD, UNIVERSAL) |
| Conversão | Informação de equivalência ou kit |
| Ciclo | C = Corrente (produto ativo) / L = Lançamento |

#### Como colar as colunas

1. No Excel da indústria, clique no cabeçalho da coluna (ex: coluna de código) para selecionar toda a coluna
2. Pressione **Ctrl+C**
3. Clique no campo correspondente aqui no sistema (ex: "Código")
4. Pressione **Ctrl+V**
5. O contador no topo do campo mostra quantas linhas foram coladas
6. Repita para os demais campos
7. Todos os campos preenchidos devem ter o **mesmo número de linhas** — o sistema avisa se houver inconsistência
8. Clique em **⚡ Importar**

> **Dica:** Se a coluna de preços tiver "R$" ou pontos de milhar, o sistema interpreta automaticamente — não precisa limpar o formato.

> **Gabarito:** O arquivo `Gabarito_Importacao_ListaPrecos.xlsx` contém uma planilha de referência com as colunas no formato ideal para colagem. Use como base quando a tabela da indústria vier em formato diferente.

#### Tabela existente vs Nova tabela

- **Atualizar tabela existente:** selecione o nome de uma tabela já cadastrada. Os produtos são atualizados com os novos preços. Use quando a indústria envia um reajuste.
- **Criar nova tabela:** clique em **+ NOVA** e dê um nome diferente (ex: TABELA_2026). Os produtos da tabela anterior continuam intactos. Use quando a indústria lança tabela completamente nova.

---

### Modo 2: Magic Import (upload de planilha)

Importação inteligente via upload de arquivo Excel. O sistema lê a planilha, detecta automaticamente as colunas e exibe um mapeamento visual antes de importar.

#### Como usar

1. Na aba **✨ Magic Import**, arraste o arquivo `.xlsx` ou `.xls` para a área indicada (ou clique para selecionar)
2. O sistema lê os cabeçalhos e sugere automaticamente o mapeamento das colunas
3. Confira o mapeamento — você pode corrigir se a detecção automática errar em alguma coluna
4. Selecione a Indústria e a Tabela de destino
5. Veja a prévia das primeiras linhas para confirmar
6. Clique em **Importar**

**Colunas detectadas automaticamente:** Código, Descrição, Marca/Linha, Preço Normal, Preço Promoção, Preço Especial, IPI%, ST%, Embalagem, Peso, Conversão, Aplicação, Grupo de Produto, Código de Barras.

---

### Detecção automática de segmento de linha

A coluna **Linha** (ou Marca/Linha) do gabarito é um campo de texto livre onde você informa para quais segmentos de veículos o produto se aplica — por exemplo: `PESADA UTILITARIOS AGRICOLA FORA DE ESTRADA`.

O sistema lê esse texto e **ativa automaticamente as flags de segmento** do produto no catálogo (as colunas coloridas LEVE, PESAD, AGRIC, UTIL, MOTO, OFF, AMAR). Você não precisa preencher colunas separadas para cada segmento.

#### Palavras reconhecidas por segmento

| Segmento | Ícone | Palavras e derivações aceitas |
|---|---|---|
| **Linha Leve** | LEVE | `LEVE`, `PASSEIO`, `HATCH`, `SEDAN`, `POPULAR`, `AUTOMOVEL`, `VUC` |
| **Linha Pesada** | PESAD | `PESADA`, `CAMINHAO`, `CAMINHOES`, `ONIBUS`, `CARRETA`, `SEMIRREBOQUE`, `REBOQUE`, `TRUCK`, `BUS` |
| **Linha Agrícola** | AGRIC | `AGRICOLA`, `COLHEITADEIRA`, `PLANTADEIRA`, `PULVERIZADOR`, `PULVERIZADORA`, `SEMEADEIRA`, `CEIFEIRA`, `IMPLEMENTOS` |
| **Utilitários** | UTIL | `UTILITARIO`, `UTILITARIOS`, `PICKUP`, `PICKUPS`, `PICK UP`, `SUV`, `CAMIONETE`, `CAMIONETA`, `VAN`, `FURGAO`, `FURGOES` |
| **Motocicletas** | MOTO | `MOTO`, `MOTOCICLETA`, `MOTOCICLETAS`, `SCOOTER`, `CICLOMOTOR`, `TRICICLO` |
| **Off-Road** | OFF | `OFFROAD`, `OFF ROAD`, `FORA DE ESTRADA`, `4X4`, `ATV`, `UTV`, `BUGGY`, `ENDURO`, `TRILHA`, `TODOTERRENO`, `QUADRICICLO` |
| **Linha Amarela** | AMAR | `AMARELA`, `LINHA AMARELA`, `TRATOR`, `TRATORES`, `ESCAVADEIRA`, `RETROESCAVADEIRA`, `MOTONIVELADORA`, `COMPACTADOR`, `EMPILHADEIRA`, `FORKLIFT`, `RETRO`, `PA CARREGADEIRA`, `OBRAS` |

> **Exemplos práticos:**
> - `"PESADA UTILITARIOS AGRICOLA FORA DE ESTRADA"` → ativa PESAD + UTIL + AGRIC + OFF
> - `"PICKUPS"` → ativa UTIL
> - `"TRATORES"` → ativa AMAR (linha amarela)
> - `"COLHEITADEIRA"` → ativa AGRIC
> - `"LEVE PESADA"` → ativa LEVE + PESAD (produto universal)

#### Regras importantes

- Um produto pode pertencer a **múltiplos segmentos** ao mesmo tempo.
- A detecção ignora acentos e maiúsculas/minúsculas — `Agrícola`, `AGRICOLA` e `agricola` funcionam igual.
- Palavras curtas são verificadas como **palavra inteira** para evitar conflitos: `MOTO` não ativa `MOTONIVELADORA` (que é linha amarela).
- Se você preencher as colunas individuais de segmento (MAGIC_FLAGS: `linhaleve`, `linhapesada`, etc.), elas têm **prioridade** sobre o texto da coluna Linha.
- Ao reimportar uma tabela já existente, as flags são **recalculadas e atualizadas** automaticamente para todos os produtos.

---

### Resultado da importação

Após importar, o sistema exibe um resumo com:
- **Total** de linhas processadas
- **Inseridos** — produtos novos criados
- **Atualizados** — produtos já existentes que tiveram preço atualizado
- **Erros** — linhas com problema, com relatório detalhado (código, descrição e motivo do erro)

Você pode copiar a lista de erros para verificar e corrigir na planilha original.

---

## Configurações da Empresa

Em **Utilitários → Configurações** o administrador do escritório define dados cadastrais da empresa e parâmetros operacionais que afetam o sistema todo.

### Dados cadastrais

- Razão social, CNPJ, Inscrição Estadual
- Endereço completo, telefone, e-mail
- **Logotipo** — usado nos PDFs de pedido, e-mails e cabeçalho do sistema (upload de imagem; o sistema converte para Base64 e mostra preview)

> **Dica do CNPJ:** preencha o CNPJ e clique no botão de busca ao lado. O sistema consulta a Receita Federal e preenche razão social, endereço, bairro, cidade, UF e CEP automaticamente.

### Atendimento por vendedor (afeta mapas estatísticos)

Esse parâmetro define **como os mapas estatísticos atribuem cada venda ao vendedor**. Duas opções:

- **1 vendedor por cliente** (padrão) — cada cliente tem um titular único definido no cadastro do cliente (campo Vendedor). Todos os mapas filtram vendedor pela carteira do cliente.

- **Vários vendedores por cliente** — adequado quando o mesmo cliente é atendido por **vendedores diferentes em indústrias diferentes** (ex.: vendedor A vende a indústria X pra esse cliente, vendedor B vende a indústria Y pro mesmo cliente). Nesse modo, os mapas atribuem cada venda ao vendedor cuja **tabela de Vendedor × Indústrias** contém aquela indústria.

> **⚠️ Pré-requisito do modo "Vários vendedores":** você precisa popular a tabela **Vendedor × Indústrias** (ficha de cada Vendedor → aba INDÚSTRIAS). Sem isso, os mapas saem vazios ao filtrar por vendedor. Quem usa o modo padrão (1 vendedor por cliente) não precisa mexer nessa tabela.

### Outras configurações

- E-mail SMTP — servidor de envio de e-mails (usado para enviar pedidos por e-mail)
- IMAP — servidor de leitura de e-mails (usado pela Central de E-mails)
- WhatsApp — chave de API do WhatsApp Business (quando ativo)

> Os módulos premium (BI, WhatsApp IA, CRM, IRIS) são habilitados pela Softham conforme o plano contratado e aparecem automaticamente no menu lateral quando ativos. Para alterar o plano, contate o suporte.

---

## IRIS — Assistente de IA

A IRIS é a inteligência artificial do RepOne. Ela opera em dois contextos:

### IRIS no BI

Em cada aba do BI, a IRIS lê os seus dados e gera uma análise em linguagem natural — como se um analista estivesse explicando os números para você. Exemplo:

> *"Seu faturamento cresceu 12% em relação ao mês anterior, puxado principalmente pelo cliente XYZ. Atenção: 3 clientes da classe A não compraram este mês — risco de churn."*

Essa análise aparece automaticamente quando os dados carregam.

### IRIS no WhatsApp

A IRIS responde mensagens no WhatsApp Business da sua empresa. Os reps e clientes podem perguntar diretamente pelo WhatsApp e receber respostas inteligentes sobre pedidos, produtos e clientes.

**Configuração:** Acesse **IRIS → Configurações** para personalizar como a IRIS se comporta — tom de voz, informações que ela pode ou não revelar, e instruções específicas do negócio. Essa configuração é exclusiva para administradores.

---

## Dúvidas Frequentes

### Não consigo logar no sistema
Verifique se o Caps Lock está ativado. Se esqueceu a senha, clique em **Esqueci minha senha** ou contate o administrador do sistema.

### O pedido sumiu da lista
Pedidos excluídos não aparecem na lista. Se o pedido foi faturado, verifique o filtro de situação — ele pode estar oculto se o filtro estiver mostrando apenas "Em Aberto".

### O produto não aparece na busca do pedido
O produto pode estar inativo ou sem tabela de preço para a indústria selecionada. Verifique com o gestor.

### O preço está diferente do esperado
O sistema aplica o preço da tabela vigente. Se houve reajuste de tabela, os novos preços já estão refletidos. Consulte o relatório de Tabelas de Preço para conferir.

### Como adicionar uma indústria a um cliente?
Abra a ficha do cliente, acesse a aba **INDÚSTRIAS** e clique em adicionar. Informe a indústria, a tabela de preço, o código do cliente na indústria e os descontos D1 a D11 negociados.

### Como funciona a importação de itens no pedido?
No pedido, na tela de itens (F2), clique no botão de importação. Você pode usar: **XLS** (planilha Excel), **TXT** (arquivo de sistemas como PP2, Stahl, Arca ou KV), **XML** (nota fiscal eletrônica) ou **Magic Load** (IA, aceita qualquer formato incluindo foto).

### Como atualizo uma tabela de preços?
Acesse **Importador de Preços** no menu de Produtos. Cole as colunas da planilha da indústria nas abas correspondentes e confirme a importação.

### O BI não está atualizando
O BI carrega dados em tempo real. Se estiver desatualizado, clique no botão de atualizar ou verifique sua conexão com a internet.

### A IRIS não está respondendo no WhatsApp
A IRIS depende de uma instância do WhatsApp conectada. Contate o administrador para verificar se a instância está ativa.

### O que significa "D1, D2... D11" nos descontos do cliente?
São colunas de desconto negociadas individualmente. Cada indústria pode usar essas colunas de forma diferente — D1 pode ser "desconto comercial", D2 "desconto financeiro", D3 "desconto de linha" etc. O significado de cada coluna é definido junto com a indústria no momento da negociação.

### Como lançar metas para os vendedores?
Acesse **Cadastros → Vendedores**, abra a ficha do vendedor e clique na aba **METAS**. Escolha o ano, clique em **Nova Meta**, selecione a indústria e informe os valores mensais.

### Preciso de ajuda que não está aqui
Entre em contato com o suporte Softham:
- **WhatsApp:** (número do suporte)
- **E-mail:** suporte@softham.com.br

---

*Manual do Usuário RepOne V2 — © 2026 Softham Sistemas. Todos os direitos reservados.*
