import { callAI, AIMessage } from '../../shared/utils/ai_providers';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface DadosQualificacao {
  nome?:           string;
  empresa?:        string;
  tipo_cliente?:   string; // lojista | oficina | distribuidora | outro
  produtos?:       string;
  quantidade?:     string;
  urgencia?:       string;
  cidade?:         string;
  uf?:             string;
  email?:          string;
  observacoes?:    string;
  score?:          number;
  classificacao?:  'cold' | 'warm' | 'hot';
  qualificado?:    boolean;
}

export interface RespostaIA {
  texto:          string;
  dadosExtraidos: Partial<DadosQualificacao>;
  qualificado:    boolean;
  intencao:       string;
  tokensPrompt:   number;
  tokensResposta: number;
}

export interface TenantConfig {
  representante_nome: string;
  empresa_nome:       string;
  industrias?:        string; // ex: "Bosch, Nakata, Monroe"
}

// ─── Qualificação — sistema de pontuação ─────────────────────────────────────
const THRESHOLD     = parseInt(process.env.QUALIFICATION_THRESHOLD      || '65');
const HOT_THRESHOLD = parseInt(process.env.QUALIFICATION_HOT_THRESHOLD  || '85');

export function avaliarQualificacao(dados: Partial<DadosQualificacao>) {
  let score = 0;
  const campos: string[] = [];
  const faltando: string[] = [];

  const checks: Array<[keyof DadosQualificacao, number, boolean]> = [
    ['produtos',     35, true ],  // o que quer comprar — mais importante
    ['empresa',      20, true ],  // nome da loja/oficina
    ['quantidade',   15, true ],  // volume
    ['urgencia',     10, false],
    ['tipo_cliente', 10, false],
    ['nome',          5, false],
    ['cidade',        5, false],
  ];

  for (const [campo, pts, obrigatorio] of checks) {
    if (dados[campo]) { score += pts; campos.push(campo); }
    else if (obrigatorio) faltando.push(campo);
  }

  const qualificado   = score >= THRESHOLD;
  const classificacao: 'cold'|'warm'|'hot' =
    score >= HOT_THRESHOLD ? 'hot' :
    score >= THRESHOLD     ? 'warm' : 'cold';

  return { score, qualificado, classificacao, campos, faltando };
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(tenant: TenantConfig): string {
  return `Você é o assistente virtual de ${tenant.representante_nome}, representante comercial${
    tenant.industrias ? ` das marcas ${tenant.industrias}` : ''
  } na empresa ${tenant.empresa_nome}.

Você atende pelo WhatsApp clientes como lojistas, oficinas e distribuidoras de autopeças.

## SEU PAPEL
- Recepcionar e qualificar leads/clientes que entram em contato
- Entender a necessidade de compra de forma natural e simpática
- Coletar as informações necessárias para o representante fazer o atendimento
- Quando o cliente estiver qualificado, informar que o representante entrará em contato

## INFORMAÇÕES PARA COLETAR (ordem natural, não robotizada)
1. **Nome** do contato (se não vier pelo WhatsApp)
2. **Empresa** — nome da loja, oficina ou empresa
3. **Tipo** — lojista, oficina mecânica, distribuidora ou outro
4. **Produtos** — quais peças ou categorias tem interesse
5. **Quantidade** — volume aproximado
6. **Urgência** — para quando precisa
7. **Cidade/Estado** (se relevante para logística)

## REGRAS
- NUNCA invente preços, prazos de entrega ou disponibilidade de estoque
- Se perguntarem preço, diga que o representante verificará as melhores condições
- Tom informal mas profissional. Use emojis com moderação (máximo 1-2 por mensagem)
- Respostas curtas (WhatsApp não é e-mail). Máximo 3-4 linhas
- Faça UMA pergunta por vez
- Se o cliente já for cadastrado e der informações suficientes, não insista em perguntas óbvias

## QUALIFICAÇÃO
Considere QUALIFICADO quando tiver: empresa + produtos + quantidade.
Então diga que o representante entrará em contato em breve.

## FORMATO DE RESPOSTA — SEMPRE retorne JSON válido:
{
  "texto": "Sua mensagem para o cliente aqui",
  "dados_extraidos": {
    "campo": "valor"
  },
  "qualificado": false,
  "intencao": "interesse_inicial"
}

Campos possíveis em dados_extraidos:
nome, empresa, tipo_cliente, produtos, quantidade, urgencia, cidade, uf, email, observacoes

Valores de intencao:
interesse_inicial, pedindo_info, respondendo_pergunta, desinteresse, off_topic, saudacao, agradecimento, reclamacao`.trim();
}

function buildQualificationContext(dados: Partial<DadosQualificacao>): string {
  const preenchidos: string[] = [];
  const faltando: string[] = [];

  const mapa: Record<string, string> = {
    nome: 'Nome', empresa: 'Empresa', tipo_cliente: 'Tipo de cliente',
    produtos: 'Produtos de interesse', quantidade: 'Quantidade/volume',
    urgencia: 'Urgência', cidade: 'Cidade', uf: 'Estado', email: 'Email',
  };

  const obrigatorios = new Set(['empresa', 'produtos', 'quantidade']);

  for (const [campo, label] of Object.entries(mapa)) {
    const val = dados[campo as keyof DadosQualificacao];
    if (val) { preenchidos.push(`- ${label}: ${val}`); }
    else if (obrigatorios.has(campo)) { faltando.push(`- ${label}`); }
  }

  let ctx = `DADOS JÁ COLETADOS:\n${preenchidos.join('\n') || '  Nenhum ainda.'}`;
  if (faltando.length > 0) {
    ctx += `\n\nDADOS QUE FALTAM (priorize perguntar):\n${faltando.join('\n')}`;
  }
  ctx += `\n\nNão pergunte o que já sabe. Se já tem empresa + produtos + quantidade → qualificado.`;
  return ctx;
}

// ─── Chamada à IA ────────────────────────────────────────────────────────────
async function executeAI(
  messages: AIMessage[],
  opts?: { maxTokens?: number; temperature?: number; responseFormat?: 'json_object' | 'text' }
): Promise<string> {
  return callAI(messages, {
    maxTokens: opts?.maxTokens,
    temperature: opts?.temperature,
    responseFormat: opts?.responseFormat ?? 'json_object',
  });
}

// ─── Filtro de Relevância — IRIS ──────────────────────────────────────────────
// Chamada leve (temperatura 0, poucos tokens) que decide se a mensagem
// tem alguma relação com contexto comercial de representação.
// Retorna true (relevante) por padrão em caso de erro (fail-open).
export async function avaliarRelevancia(
  content: string,
  tenantConfig: TenantConfig
): Promise<boolean> {
  // Descarte imediato por conteúdo claramente não-textual ou vazio
  const lower = content.toLowerCase().trim();
  if (!lower || lower === '[mensagem vazia]' || lower === '[sticker]') return false;

  const contexto = tenantConfig.industrias
    ? `representante das marcas ${tenantConfig.industrias}`
    : 'representante comercial de autopeças';

  const systemPrompt =
    `Você é um filtro de triagem para ${tenantConfig.representante_nome}, ${contexto}.
Recebemos uma mensagem via WhatsApp de um contato NOVO (primeiro contato ou sem conversa ativa).

Sua tarefa: decidir se a mensagem pode ter origem em um cliente ou lead com interesse comercial.

RELEVANTE (true): saudações simples ("oi", "bom dia"), perguntas sobre produtos/preços/marcas, pedidos de cotação, qualquer texto que possa evoluir para negócio.
IRRELEVANTE (false): spam, correntes, piadas, mensagens claramente encaminhadas sem contexto comercial, conteúdo pessoal/religioso/político, número errado evidente, mídia sem legenda.

Responda APENAS: {"relevante": true} ou {"relevante": false}`;

  try {
    const raw = await executeAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Mensagem recebida: "${content.substring(0, 300)}"` },
      ],
      { maxTokens: 20, temperature: 0 }
    );
    // Extrai JSON mesmo que venha com markdown
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return result.relevante !== false; // default true se campo ausente
  } catch {
    return true; // fail-open: em caso de erro deixa passar
  }
}

// ─── Processamento principal ──────────────────────────────────────────────────
export async function processarMensagem(params: {
  mensagemAtual:    string;
  historico:        Array<{ remetente: string; conteudo: string }>;
  dadosQualificacao: Partial<DadosQualificacao>;
  tenantConfig:     TenantConfig;
}): Promise<RespostaIA> {
  const { mensagemAtual, historico, dadosQualificacao, tenantConfig } = params;

  const messages: { role: string; content: string }[] = [];

  // System prompt
  messages.push({ role: 'system', content: buildSystemPrompt(tenantConfig) });

  // Contexto de qualificação (o que já sabe)
  if (Object.keys(dadosQualificacao).length > 0) {
    messages.push({ role: 'system', content: buildQualificationContext(dadosQualificacao) });
  }

  // Histórico
  for (const msg of historico) {
    let content = msg.conteudo;
    // Se conteúdo é JSON bruto da IA, extrai só o texto
    try { const p = JSON.parse(content); content = p.texto || content; } catch { /* ok */ }
    messages.push({
      role: msg.remetente === 'lead' ? 'user' : 'assistant',
      content,
    });
  }

  messages.push({ role: 'user', content: mensagemAtual });

  try {
    const raw = await executeAI(messages as AIMessage[]);
    let result: any = {};
    try { result = JSON.parse(raw); } catch { result = { texto: raw }; }

    return {
      texto:          result.texto || 'Desculpe, pode repetir?',
      dadosExtraidos: result.dados_extraidos || {},
      qualificado:    result.qualificado || false,
      intencao:       result.intencao || 'respondendo_pergunta',
      tokensPrompt:   0,
      tokensResposta: 0,
    };
  } catch {
    return {
      texto: 'Desculpe, tive um probleminha aqui. Pode repetir sua mensagem? 😅',
      dadosExtraidos: {},
      qualificado:    false,
      intencao:       'erro',
      tokensPrompt:   0,
      tokensResposta: 0,
    };
  }
}

// ─── Resumo da conversa ───────────────────────────────────────────────────────
export async function gerarResumo(
  historico: Array<{ remetente: string; conteudo: string }>
): Promise<string> {
  const texto = historico
    .map(m => `[${m.remetente}]: ${m.conteudo}`)
    .join('\n');

  const prompt = `Resuma esta conversa de WhatsApp entre um cliente e o assistente de um representante de autopeças.
Destaque: nome, empresa, tipo de cliente, produtos de interesse, quantidade, urgência, cidade.
Máximo 3 frases diretas. Sem introdução. Ex: "José da Silva, Loja ABC (oficina), precisa de 50 filtros Bosch em Campinas/SP com urgência."`;

  try {
    const raw = await executeAI([
      { role: 'system', content: prompt } as AIMessage,
      { role: 'user',   content: texto.slice(0, 6000) } as AIMessage,
    ], { responseFormat: 'text' });
    // Resumo é texto puro, não JSON
    try { return JSON.parse(raw).texto || raw; } catch { return raw; }
  } catch {
    return 'Resumo indisponível.';
  }
}
