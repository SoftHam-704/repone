import OpenAI from 'openai';
import axios from 'axios';

// ─── Clientes IA ──────────────────────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const geminiKey = process.env.GEMINI_API_KEY;

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  modelOpenAI?: string;
  modelGemini?: string;
}

// ─── Chamada de Texto (Fallback Automático) ──────────────────────────────────
export async function callAI(messages: AIMessage[], opts?: AIOptions): Promise<string> {
  const maxTokens  = opts?.maxTokens  ?? 1200;
  const temperature = opts?.temperature ?? 0.7;
  const isJson      = opts?.responseFormat === 'json_object';

  // 1. Tentar OpenAI primeiro
  if (openai) {
    try {
      const model = opts?.modelOpenAI || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const r = await openai.chat.completions.create({
        model,
        messages: messages as any,
        temperature,
        max_tokens: maxTokens,
        response_format: isJson ? { type: 'json_object' } : undefined,
      });
      const text = r.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn('[AI-PROVIDER] OpenAI falhou, tentando Gemini:', e?.message);
    }
  }

  // 2. Fallback para Gemini
  if (geminiKey) {
    // Tenta modelos em ordem — do mais recente para o mais estável
    const geminiModels = [
      opts?.modelGemini,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean) as string[];

    const prompt = messages.map(m => `[${m.role}]: ${m.content}`).join('\n\n')
      + (isJson ? '\n\nResponda APENAS com um objeto JSON válido.' : '');

    for (const model of geminiModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const r = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
            responseMimeType: isJson ? 'application/json' : 'text/plain'
          },
        }, { timeout: 90000 });

        const text: string | undefined = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          if (model !== (opts?.modelGemini || 'gemini-2.5-flash')) {
            console.warn(`[AI-PROVIDER] Gemini: usando fallback "${model}" (modelo preferido indisponível)`);
          }
          return text;
        }
      } catch (e: any) {
        console.warn(`[AI-PROVIDER] Gemini "${model}" falhou:`, e?.message);
      }
    }
    console.error('[AI-PROVIDER] Todos os modelos Gemini falharam');
  }

  throw new Error('Nenhum provedor de IA disponível ou configurado corretamente.');
}

// ─── Chamada de Visão / Multimodal ───────────────────────────────────────────
export async function callAIVision(params: {
  prompt: string;
  base64: string;
  mimeType: string;
  opts?: AIOptions;
}): Promise<string> {
  const { prompt, base64, mimeType, opts } = params;
  const isJson = opts?.responseFormat === 'json_object';

  // Preferir Gemini para PDFs (suporte nativo melhor)
  if (mimeType === 'application/pdf' && geminiKey) {
    try {
      const model = opts?.modelGemini || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const r = await axios.post(url, {
        contents: [{
          parts: [
            { text: prompt + (isJson ? '\n\nRetorne APENAS o JSON solicitado.' : '') },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: opts?.temperature ?? 0,
          maxOutputTokens: opts?.maxTokens ?? 8192,
          responseMimeType: isJson ? 'application/json' : 'text/plain'
        },
      }, { timeout: 60000 });

      const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn('[AI-PROVIDER] Gemini Vision falhou:', e?.message);
    }
  }

  // Fallback / Default para OpenAI Vision
  if (openai) {
    try {
      const model = opts?.modelOpenAI || 'gpt-4o'; // gpt-4o é melhor para visão que o mini
      const r = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        temperature: opts?.temperature ?? 0,
        max_tokens: opts?.maxTokens ?? 4096,
        response_format: isJson ? { type: 'json_object' as const } : undefined,
      });

      const text = r.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      console.error('[AI-PROVIDER] OpenAI Vision falhou:', e?.message);
    }
  }

  // Se OpenAI falhou e ainda não tentamos Gemini (ex: imagem no OpenAI que deu erro)
  if (mimeType !== 'application/pdf' && geminiKey) {
    try {
      const model = opts?.modelGemini || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const r = await axios.post(url, {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: opts?.temperature ?? 0,
          maxOutputTokens: opts?.maxTokens ?? 8192,
          responseMimeType: isJson ? 'application/json' : 'text/plain',
        },
      });
      return r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    } catch {}
  }

  throw new Error('Nenhum provedor de visão disponível.');
}
