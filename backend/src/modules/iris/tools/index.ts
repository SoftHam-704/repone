import { consultarVendasPeriodo } from './consultar-vendas-periodo';
import { consultarItensPeriodo } from './consultar-itens-periodo';
import { clientesSemCompra } from './clientes-sem-compra';
import { metaAtual } from './meta-atual';
import { curvaAbc } from './curva-abc';
import { rankingClientes } from './ranking-clientes';
import { compararAnos } from './comparar-anos';
import { ultimoPrecoCliente } from './ultimo-preco-cliente';
import { registrarLacuna } from './registrar-lacuna';
import { cadastrarItensTabela } from './cadastrar-itens-tabela';

export type ToolHandler = (db: any, input: any, user: any) => Promise<any>;

// Registry: name → handler. O loop só executa o que está aqui (tool inexistente = erro tratável).
export const TOOLS_REGISTRY: Record<string, ToolHandler> = {
  consultar_vendas_periodo: consultarVendasPeriodo,
  consultar_itens_periodo:  consultarItensPeriodo,
  clientes_sem_compra:      clientesSemCompra,
  meta_atual:               metaAtual,
  curva_abc:                curvaAbc,
  ranking_clientes:         rankingClientes,
  comparar_anos:            compararAnos,
  ultimo_preco_cliente:     ultimoPrecoCliente,
  registrar_lacuna:         registrarLacuna,
  cadastrar_itens_tabela:   cadastrarItensTabela,
};

// Definições JSON Schema enviadas ao modelo (Anthropic SDK tools).
// vendedor_id NÃO é exposto pra REP (resolvido pela sessão); fica como hint pra admin.
export const TOOLS = [
  {
    name: 'consultar_vendas_periodo',
    description:
      'Consulta o valor de vendas (faturado/em aberto) num período de datas, opcionalmente agrupado por indústria, cliente, vendedor ou mês. Use para perguntas tipo "quanto vendi em abril", "vendas por indústria no trimestre". Considera apenas pedidos válidos (não excluídos). Retorna valores numéricos crus.',
    input_schema: {
      type: 'object',
      properties: {
        data_inicio:  { type: 'string', description: 'Data inicial no formato YYYY-MM-DD' },
        data_fim:     { type: 'string', description: 'Data final no formato YYYY-MM-DD' },
        agrupar_por:  { type: 'string', enum: ['industria', 'cliente', 'vendedor', 'mes', 'uf', 'nenhum'], description: 'Como agrupar o resultado. Use "uf" quando o REP pedir mapa ou distribuição por estado. "nenhum" retorna só o total.' },
        industria_id: { type: 'integer', description: 'Opcional: filtra por uma indústria específica (código).' },
      },
      required: ['data_inicio', 'data_fim', 'agrupar_por'],
    },
  },
  {
    name: 'consultar_itens_periodo',
    description:
      'Consulta a QUANTIDADE de peças vendidas (e o valor) num período, agrupada por mês, produto, cliente ou indústria. Use para "quantas peças vendi", "evolução de itens mês a mês", "o que mais vendeu da indústria X", "itens/peças comprados pelo cliente Y". Considera só pedidos válidos (P/F). Retorna números crus.',
    input_schema: {
      type: 'object',
      properties: {
        data_inicio: { type: 'string', description: 'Data inicial no formato YYYY-MM-DD' },
        data_fim:    { type: 'string', description: 'Data final no formato YYYY-MM-DD' },
        agrupar_por: { type: 'string', enum: ['mes', 'produto', 'cliente', 'industria', 'nenhum'], description: 'Como agrupar. "mes" para evolução; "produto" para ranking de SKU; "nenhum" só o total.' },
        cliente:     { type: 'string', description: 'Opcional: nome (ou parte) do cliente para filtrar. Ex: "WS Automotive".' },
        industria:   { type: 'string', description: 'Opcional: nome (ou parte) da indústria para filtrar.' },
      },
      required: ['data_inicio', 'data_fim', 'agrupar_por'],
    },
  },
  {
    name: 'clientes_sem_compra',
    description:
      'Lista clientes da carteira que estão sem comprar há pelo menos N dias (alerta de churn). Use para "quais clientes sumiram", "carteira parada há mais de 60 dias". Exclui filiais de rede automaticamente. Ordenado do mais inativo pro menos.',
    input_schema: {
      type: 'object',
      properties: {
        dias_minimo: { type: 'integer', description: 'Mínimo de dias sem comprar (ex: 60, 90, 120).' },
        limite:      { type: 'integer', description: 'Máximo de clientes a retornar (default 20, máx 200).' },
      },
      required: ['dias_minimo'],
    },
  },
  {
    name: 'meta_atual',
    description:
      'Retorna o status da meta de vendas de um mês: valor da meta, quanto já foi faturado, percentual atingido, quanto falta e quantos dias úteis restam. Use para "como está minha meta", "quanto falta pra bater a meta de maio". Se não houver meta cadastrada, avisa.',
    input_schema: {
      type: 'object',
      properties: {
        mes_ano: { type: 'string', description: 'Mês de referência no formato YYYY-MM. Default: mês atual.' },
      },
    },
  },
  {
    name: 'curva_abc',
    description:
      'Classificação de Pareto (A/B/C) por faturamento num período, de CLIENTES (default) ou PRODUTOS. A = até 80% do faturamento acumulado, B = 80–95%, C = o resto. Use para "curva ABC dos meus clientes", "quais clientes/produtos concentram minha venda". Considera só pedidos válidos (P/F). Números crus.',
    input_schema: {
      type: 'object',
      properties: {
        data_inicio:  { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        data_fim:     { type: 'string', description: 'Data final YYYY-MM-DD' },
        dimensao:     { type: 'string', enum: ['cliente', 'produto'], description: 'O que classificar: "cliente" (default) ou "produto".' },
        industria_id: { type: 'integer', description: 'Opcional: filtra por uma indústria (código).' },
      },
      required: ['data_inicio', 'data_fim'],
    },
  },
  {
    name: 'ranking_clientes',
    description:
      'Ranking dos maiores clientes num período, por valor faturado (default) ou por quantidade de peças, com nº de pedidos e última compra. Use para "meus top 10 clientes", "quem mais comprou no trimestre". Só pedidos válidos (P/F). Números crus.',
    input_schema: {
      type: 'object',
      properties: {
        data_inicio:  { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        data_fim:     { type: 'string', description: 'Data final YYYY-MM-DD' },
        por:          { type: 'string', enum: ['valor', 'quantidade'], description: 'Ordenar por "valor" (default) ou "quantidade".' },
        limite:       { type: 'integer', description: 'Quantos clientes retornar (default 20, máx 100).' },
        industria_id: { type: 'integer', description: 'Opcional: filtra por uma indústria (código).' },
      },
      required: ['data_inicio', 'data_fim'],
    },
  },
  {
    name: 'comparar_anos',
    description:
      'Compara dois anos (YoY) em faturamento e quantidade, mês a mês (default), por indústria, ou só os totais, com a variação percentual. Use para "comparar 2025 com 2026", "como está esse ano vs ano passado", "evolução ano a ano". Só pedidos válidos (P/F). Números crus.',
    input_schema: {
      type: 'object',
      properties: {
        ano_a:        { type: 'integer', description: 'Ano base (ex: 2025).' },
        ano_b:        { type: 'integer', description: 'Ano de comparação (ex: 2026).' },
        agrupar_por:  { type: 'string', enum: ['mes', 'industria', 'nenhum'], description: '"mes" (default) para evolução mensal; "industria"; "nenhum" só os totais.' },
        industria_id: { type: 'integer', description: 'Opcional: filtra por uma indústria (código).' },
      },
      required: ['ano_a', 'ano_b'],
    },
  },
  {
    name: 'ultimo_preco_cliente',
    description:
      'Retorna o último preço que um cliente pagou num produto (código) e o histórico das últimas 10 compras (bruto e líquido, data, quantidade, indústria). Use para "quanto a loja X pagou no item Y", "qual o último preço do retentor pra esse cliente". Só pedidos válidos (P/F).',
    input_schema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome (ou parte) do cliente. Ex: "Domiciano".' },
        produto: { type: 'string', description: 'Código do produto. Ex: "01-00126".' },
      },
      required: ['cliente', 'produto'],
    },
  },
  {
    name: 'registrar_lacuna',
    description:
      'Registra uma LACUNA quando você NÃO conseguiu atender o REP: (a) ele pediu um número/recorte que nenhuma tool entrega, ou (b) pediu uma rotina/recurso que NÃO existe no sistema (confira no mapa-sistema-completo). Chame SEMPRE que bater numa dessas paredes, junto de avisar o REP que ainda não tem. Não invente — só registre o que faltou. O recado vai pra equipe SoftHam priorizar o que construir.',
    input_schema: {
      type: 'object',
      properties: {
        pergunta: { type: 'string', description: 'O pedido do REP que você não conseguiu atender, com as palavras dele.' },
        motivo:   { type: 'string', enum: ['falta_tool', 'rotina_inexistente', 'ambiguo', 'outro'], description: 'falta_tool = número sem ferramenta; rotina_inexistente = recurso que não existe no sistema; ambiguo = não deu pra entender o pedido; outro.' },
        detalhe:  { type: 'string', description: 'Opcional: o que exatamente faltaria (ex: "tool de giro de estoque", "tela de comparar 3 indústrias no mesmo gráfico").' },
      },
      required: ['pergunta', 'motivo'],
    },
  },
  {
    name: 'cadastrar_itens_tabela',
    description:
      'ESCRITA — Cadastra uma relação de itens que o REP passar na(s) tabela(s) de preço de UMA indústria (cria/atualiza produto + preço). SEMPRE em 2 passos: 1) chame com confirmar=false pra ver a PRÉVIA (não grava) e MOSTRE ao REP, peça "confirma?"; 2) só depois do REP confirmar, chame com confirmar=true pra gravar. A indústria é OBRIGATÓRIA — se o REP não informou, NÃO chame a tool: pergunte qual indústria antes. Mínimo por item: código + preço. Cadastra em TODAS as tabelas da indústria automaticamente. Use o nome reduzido da indústria.',
    input_schema: {
      type: 'object',
      properties: {
        industria: { type: 'string', description: 'Nome reduzido (ou nome) da indústria. OBRIGATÓRIO — se o REP não disse, pergunte antes de chamar.' },
        itens: {
          type: 'array',
          description: 'Lista de itens a cadastrar. Mínimo por item: código e preço.',
          items: {
            type: 'object',
            properties: {
              codigo:    { type: 'string', description: 'Código do produto (obrigatório).' },
              preco:     { type: 'number', description: 'Preço bruto (obrigatório). Aceita 45,90 ou 45.90.' },
              descricao: { type: 'string', description: 'Opcional: nome/descrição do produto.' },
              ipi:       { type: 'number', description: 'Opcional: IPI %.' },
              st:        { type: 'number', description: 'Opcional: ST %.' },
            },
            required: ['codigo', 'preco'],
          },
        },
        confirmar: { type: 'boolean', description: 'false (default) = prévia sem gravar; true = grava (só após o REP confirmar a prévia).' },
      },
      required: ['industria', 'itens'],
    },
  },
];
