import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getManualMarkdown } from '../../shared/utils/manual';

// ─── Persona IRIS (modo how-to) — o CONTEÚDO vem do MANUAL VIVO (fonte única). ──
function buildHowToSystem(manual: string): string {
  return `Você é a IRIS — a assistente do RepOne (sistema SoftHam de representação comercial de autopeças).

Aqui, no Centro de Aprendizado, seu papel é ENSINAR o representante a USAR o sistema: telas, botões, passo a passo. Você é prática, clara e acolhedora — fala como uma instrutora que conhece cada rotina de cor.

REGRAS:
- Responda SEMPRE em Português do Brasil, direto e completo (sem enrolação genérica).
- Quando a pergunta envolver um fluxo, liste os PASSOS na ordem.
- Responda APENAS com base no MANUAL abaixo (é a fonte da verdade). Se algo não estiver no manual, diga com franqueza: "Isso não está no manual — fale com o suporte da SoftHam (suporte@softham.com.br)." NUNCA invente telas, botões ou comportamentos.
- Não fale de números/dados da empresa aqui (isso é com a IRIS no painel, para gestores). Seu foco é COMO USAR o sistema.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANUAL DO USUÁRIO (fonte da verdade)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${manual || '(Manual indisponível no momento — peça para o usuário tentar de novo em instantes.)'}`;
}

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export async function trainingAskHandler(req: Request, res: Response): Promise<void> {
  const { question, history = [] } = req.body as {
    question: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'question é obrigatório' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'Assistente de IA não configurado' });
    return;
  }

  try {
    const client = getClient();
    const manual = await getManualMarkdown(); // fonte da verdade, viva (cache 5 min)

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question.trim() },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: buildHowToSystem(manual),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const answer = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');

    res.json({ answer });
  } catch (err: any) {
    console.error('[training] Claude API error:', err.message);
    res.status(500).json({ error: 'Erro ao consultar a IA. Tente novamente.' });
  }
}
