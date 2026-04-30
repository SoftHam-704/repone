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

// ─── Classificação principal ──────────────────────────────────────────────────
export async function classificarEmail(params: {
  assunto:  string;
  corpo:    string;
  de:       string;
  deNome:   string;
}): Promise<ClassificacaoEmail> {
  const { assunto, corpo, de, deNome } = params;

  // Heurísticas rápidas — descarte sem chamar IA
  const lower = `${assunto} ${corpo}`.toLowerCase();
  const spamPatterns = [
    /unsubscribe|cancelar inscri/i,
    /noreply|no-reply|mailer-daemon/i,
    /você ganhou|parabéns.*prêmio|clique aqui para resgatar/i,
    /^\s*$/,
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
      return { relevante: false, tipo: 'outro', resumo: '', dadosExtraidos: {}, tokensConsumidos: 0 };
    }

    return {
      relevante:        true,
      tipo:             result.tipo             || 'outro',
      resumo:           result.resumo           || '',
      dadosExtraidos:   result.dados_extraidos  || {},
      tokensConsumidos: 0, // sem contagem por enquanto (Gemini não retorna)
    };
  } catch {
    // Fail-open: em caso de erro classifica como lead genérico
    return {
      relevante:        true,
      tipo:             'outro',
      resumo:           `Email de ${deNome || de}: ${assunto}`,
      dadosExtraidos:   {},
      tokensConsumidos: 0,
    };
  }
}
