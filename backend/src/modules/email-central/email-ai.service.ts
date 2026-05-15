import OpenAI from 'openai';
import axios from 'axios';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface ClassificacaoEmail {
  relevante:        boolean;
  tipo:             'cotacao' | 'pedido' | 'lead' | 'suporte' | 'reclamacao' | 'outro';
  resumo:           string;
  dadosExtraidos:   {
    empresa?:     string;
    contato?:     string;
    produtos?:    string;
    quantidade?:  string;
    urgencia?:    string;
  };
  tokensConsumidos: number;
}

const SYSTEM_PROMPT = `Você é a IRIS, assistente de triagem de emails para um representante comercial de autopeças.

Analise o email recebido e retorne JSON com exatamente esta estrutura:
{
  "relevante": true,
  "tipo": "cotacao",
  "resumo": "Cliente solicita cotação de 50 filtros Bosch com entrega urgente.",
  "dados_extraidos": {
    "empresa": "Distribuidora Sul Ltda",
    "contato": "Carlos Souza",
    "produtos": "Filtros Bosch linha leve",
    "quantidade": "50 unidades",
    "urgencia": "para esta semana"
  }
}

Valores possíveis para "tipo":
- cotacao    → pedido de cotação ou orçamento de produtos
- pedido     → confirmação ou solicitação de pedido de compra
- lead       → interesse comercial sem cotação específica
- suporte    → dúvida, reclamação pós-venda, assistência técnica
- reclamacao → insatisfação, problema com entrega/produto
- outro      → qualquer outro assunto comercial relevante

IRRELEVANTE (relevante: false): spam, newsletter, notificação automática de sistema,
bounce, out-of-office, promoção genérica, phishing, sem relação com compra de autopeças.

Para emails irrelevantes retorne apenas: {"relevante": false, "tipo": "outro", "resumo": "", "dados_extraidos": {}}`;

// ─── Chamada IA com fallback OpenAI → Gemini ──────────────────────────────────
async function callAI(assunto: string, corpo: string): Promise<string> {
  const userMsg = `Assunto: ${assunto}\n\nCorpo do email:\n${corpo.substring(0, 2000)}`;

  // 1. OpenAI
  if (openai) {
    try {
      const r = await openai.chat.completions.create({
        model:           process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages:        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMsg },
        ],
        temperature:     0,
        max_tokens:      300,
        response_format: { type: 'json_object' },
      });
      const text = r.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn('[EMAIL-AI] OpenAI falhou, tentando Gemini:', e?.message);
    }
  }

  // 2. Gemini via REST
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt = `${SYSTEM_PROMPT}\n\n[user]: ${userMsg}\n\nResponda APENAS com o JSON pedido.`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const r = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0 },
      }, { timeout: 20000 });
      const text: string | undefined =
        r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn('[EMAIL-AI] Gemini falhou:', e?.message);
    }
  }

  throw new Error('Nenhum provedor de IA disponível');
}

// ─── Fallback por keywords — roda sem IA quando ambos provedores falham ──────
function keywordClassify(assunto: string, corpo: string): ClassificacaoEmail {
  const text = `${assunto} ${corpo}`.toLowerCase();

  if (/cota[çc][aã]o|orçamento|or[çc]amento|lista\s*de\s*pre[çc]o|tabela\s*de\s*pre[çc]o|pre[çc]o\s*de/.test(text)) {
    return {
      relevante: true, tipo: 'cotacao',
      resumo: `[keyword] Solicitação de cotação: ${assunto}`,
      dadosExtraidos: {}, tokensConsumidos: 0,
    };
  }
  if (/\bpedido\b|solicito\s*compra|ordem\s*de\s*compra|purchase\s*order/.test(text)) {
    return {
      relevante: true, tipo: 'pedido',
      resumo: `[keyword] Pedido de compra: ${assunto}`,
      dadosExtraidos: {}, tokensConsumidos: 0,
    };
  }
  if (/reclamac[aã]o|reclamo|produto\s*com\s*defeito|entrega\s*errada|troca|devolu[çc][aã]o/.test(text)) {
    return {
      relevante: true, tipo: 'reclamacao',
      resumo: `[keyword] Reclamação: ${assunto}`,
      dadosExtraidos: {}, tokensConsumidos: 0,
    };
  }
  if (/suporte|assist[eê]ncia|d[úu]vida|como\s*(usar|funciona|acessar)/.test(text)) {
    return {
      relevante: true, tipo: 'suporte',
      resumo: `[keyword] Suporte: ${assunto}`,
      dadosExtraidos: {}, tokensConsumidos: 0,
    };
  }
  if (/interesse|quero\s*conhecer|representante|distribui[çc][aã]o|parceria|fornec/.test(text)) {
    return {
      relevante: true, tipo: 'lead',
      resumo: `[keyword] Interesse comercial: ${assunto}`,
      dadosExtraidos: {}, tokensConsumidos: 0,
    };
  }
  // Sem keyword comercial reconhecível — não captura como lead
  return { relevante: false, tipo: 'outro', resumo: '', dadosExtraidos: {}, tokensConsumidos: 0 };
}

// ─── Classificação principal ──────────────────────────────────────────────────
export async function classificarEmail(params: {
  assunto:  string;
  corpo:    string;
  de:       string;
  deNome:   string;
}): Promise<ClassificacaoEmail> {
  const { assunto, corpo, de, deNome } = params;

  // Heurísticas rápidas — descarte sem chamar IA
  const spamPatterns = [
    /unsubscribe|cancelar inscri/i,
    /noreply|no-reply|mailer-daemon/i,
    /você ganhou|parabéns.*prêmio|clique aqui para resgatar/i,
  ];
  if (spamPatterns.some(p => p.test(de) || p.test(assunto))) {
    return {
      relevante: false, tipo: 'outro', resumo: '',
      dadosExtraidos: {}, tokensConsumidos: 0,
    };
  }

  try {
    const raw = await callAI(assunto, corpo);
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    if (!result.relevante) {
      // Antes de descartar: se keywords comerciais batem forte, captura mesmo assim
      const kw = keywordClassify(assunto, corpo);
      if (kw.relevante && kw.tipo !== 'outro') {
        console.log(`[EMAIL-AI] IA→irrelevante mas keyword override (${kw.tipo}): "${assunto.substring(0, 40)}"`);
        return kw;
      }
      return { relevante: false, tipo: 'outro', resumo: '', dadosExtraidos: {}, tokensConsumidos: 0 };
    }

    return {
      relevante:        true,
      tipo:             result.tipo             || 'outro',
      resumo:           result.resumo           || '',
      dadosExtraidos:   result.dados_extraidos  || {},
      tokensConsumidos: 0,
    };
  } catch (aiErr: any) {
    // IA indisponível — usa fallback por keywords
    console.warn('[EMAIL-AI] Falha na IA, usando fallback por keywords:', aiErr?.message);
    return keywordClassify(assunto, corpo);
  }
}
