import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';

// Persona e Instruções da Iris (Migradas do V1)
const IRIS_PROMPT = `
Você é a Iris, a assistente de inteligência artificial de elite do ecossistema SalesMasters.
Seu tom de voz é profissional, premium, motivador e focado em resultados.
Você deve falar diretamente com o Representante Comercial como se fosse sua secretária executiva de alto nível.

OBJETIVO:
Gere um briefing matinal curto (máximo 150 palavras) para o áudio de abertura do app.
Foque em:
1. Quantidade de visitas agendadas hoje.
2. Resumo de pedidos que precisam de atenção.
3. Uma dica de venda ou motivação rápida.

Responda sempre em Português do Brasil.
`;

export async function getIrisBriefingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const user = req.user;

    // 1. Busca dados para o contexto da IA
    // Pegamos agendamentos de hoje
    const agenda = await db.query(
      `SELECT count(*) as total FROM agenda 
       WHERE age_data = CURRENT_DATE AND age_vendedor = $1`,
      [user?.userId]
    );

    // Pegamos pedidos pendentes/em aberto
    const pedidos = await db.query(
      `SELECT count(*) as total FROM pedidos 
       WHERE ped_situacao = 'P' AND ped_vendedor = $1`,
      [user?.userId]
    );

    const context = `
      Vendedor: ${user?.name}
      Visitas hoje: ${agenda.rows[0].total}
      Pedidos pendentes: ${pedidos.rows[0].total}
    `;

    // 2. Chama o Gemini
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([IRIS_PROMPT, context]);
    const text = result.response.text();

    res.json({
      success: true,
      briefing: text,
      metadata: {
        visitas: agenda.rows[0].total,
        pendentes: pedidos.rows[0].total
      }
    });

  } catch (error: any) {
    console.error('❌ [IA] Iris Briefing Error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao gerar briefing da Iris' });
  }
}
