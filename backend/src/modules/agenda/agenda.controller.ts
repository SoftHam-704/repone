import { Request, Response } from 'express';
import OpenAI from 'openai';
import axios from 'axios';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── Fallback AI — tenta OpenAI, depois Gemini ───────────────────────────────
async function callIrisAI(prompt: string): Promise<string> {
  // 1. Tenta OpenAI
  if (openai) {
    try {
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 320,
        temperature: 0.7,
      });
      const text = r.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn('[IRIS] OpenAI falhou, tentando Gemini:', e?.message ?? e);
    }
  }

  // 2. Fallback Gemini via REST
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const r = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 320, temperature: 0.7 },
      }, { timeout: 20000 });
      const text: string | undefined =
        r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn('[IRIS] Gemini também falhou:', e?.message ?? e);
    }
  }

  throw new Error('Nenhum provedor de IA disponível.');
}

// ─── Feriados Nacionais BR ───────────────────────────────────────────────────
function getEasterDate(year: number): Date {
  // Algoritmo de Gauss/Meeus para cálculo da Páscoa
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtKey(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getBrazilianHolidays(year: number): Map<string, string> {
  const easter = getEasterDate(year);
  const holidays = new Map<string, string>();

  // Feriados fixos
  holidays.set('01-01', 'Confraternização Universal');
  holidays.set('04-21', 'Tiradentes');
  holidays.set('05-01', 'Dia do Trabalho');
  holidays.set('09-07', 'Independência do Brasil');
  holidays.set('10-12', 'Nossa Senhora Aparecida');
  holidays.set('11-02', 'Finados');
  holidays.set('11-15', 'Proclamação da República');
  holidays.set('11-20', 'Dia da Consciência Negra');
  holidays.set('12-25', 'Natal');

  // Feriados móveis (baseados na Páscoa)
  const carnavalSeg  = addDays(easter, -48);
  const carnavalTer  = addDays(easter, -47);
  const sextaSanta   = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  holidays.set(fmtKey(carnavalSeg),   'Carnaval (segunda)');
  holidays.set(fmtKey(carnavalTer),   'Carnaval (terça)');
  holidays.set(fmtKey(sextaSanta),    'Sexta-feira Santa');
  holidays.set(fmtKey(easter),        'Páscoa');
  holidays.set(fmtKey(corpusChristi), 'Corpus Christi');

  return holidays;
}

function getHolidayContext(): string {
  const now  = new Date();
  const year = now.getFullYear();
  const holidays = getBrazilianHolidays(year);

  const today     = fmtKey(now);
  const yesterday = fmtKey(addDays(now, -1));
  const tomorrow  = fmtKey(addDays(now, 1));

  const parts: string[] = [];

  if (holidays.has(today)) {
    parts.push(`Hoje é feriado nacional: ${holidays.get(today)}.`);
  }
  if (holidays.has(yesterday)) {
    parts.push(`Ontem foi feriado nacional: ${holidays.get(yesterday)}.`);
  }
  if (holidays.has(tomorrow)) {
    parts.push(`Amanhã será feriado nacional: ${holidays.get(tomorrow)}.`);
  }

  // Verifica se o dia anterior ao ontem também foi feriado (ex: emendas)
  const anteontem = fmtKey(addDays(now, -2));
  if (holidays.has(anteontem) && holidays.has(yesterday)) {
    parts.push(`Sequência de feriados — possível impacto no ritmo de pedidos.`);
  }

  return parts.length > 0 ? parts.join(' ') : '';
}
// ─── LISTAR TAREFAS ───────────────────────────────────────────────────────────
export async function listAgendaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;
    const { data_inicio, data_fim, status, tipo } = req.query as Record<string, string>;

    let query = `
      SELECT *
      FROM agenda
      WHERE usuario_id = $1 AND empresa_id = $2
    `;
    const params: any[] = [userId, empresaId];
    let i = 3;

    if (data_inicio) { query += ` AND data_inicio >= $${i++}`; params.push(data_inicio); }
    if (data_fim)    { query += ` AND data_inicio <= $${i++}`; params.push(data_fim); }
    if (status && status !== 'todos') { query += ` AND status = $${i++}`; params.push(status); }
    if (tipo   && tipo   !== 'todos') { query += ` AND tipo = $${i++}`;   params.push(tipo); }

    query += ` ORDER BY data_inicio ASC, hora_inicio ASC NULLS LAST`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('❌ [AGENDA] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── RESUMO DASHBOARD ─────────────────────────────────────────────────────────
export async function resumoAgendaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    const hoje = await db.query(
      `SELECT COUNT(*) AS total FROM agenda
       WHERE usuario_id = $1 AND empresa_id = $2
         AND status IN ('pendente','em_andamento') AND data_inicio = CURRENT_DATE`,
      [userId, empresaId]
    );

    const atrasadas = await db.query(
      `SELECT COUNT(*) AS total FROM agenda
       WHERE usuario_id = $1 AND empresa_id = $2
         AND status IN ('pendente','em_andamento') AND data_inicio < CURRENT_DATE`,
      [userId, empresaId]
    );

    const proximo = await db.query(
      `SELECT titulo, hora_inicio, tipo FROM agenda
       WHERE usuario_id = $1 AND empresa_id = $2
         AND status IN ('pendente','em_andamento') AND data_inicio = CURRENT_DATE
         AND (hora_inicio IS NULL OR hora_inicio >= CURRENT_TIME)
       ORDER BY hora_inicio ASC NULLS LAST LIMIT 1`,
      [userId, empresaId]
    );

    // Aniversariantes do mês inteiro — apenas clientes ativos
    const anivCliAniv = await db.query(
      `SELECT ca.ani_nome AS con_nome, COALESCE(c.cli_nomred, '') AS empresa,
              (EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' ||
               LPAD(ca.ani_mes::text, 2, '0') || '-' ||
               LPAD(ca.ani_diaaniv::text, 2, '0'))::date AS con_dtnasc,
              'cliente' AS origem,
              ca.ani_diaaniv::int AS dia,
              COALESCE(c.cli_redeloja, '') AS cli_redeloja
       FROM cli_aniv ca
       INNER JOIN clientes c ON c.cli_codigo = ca.ani_cliente AND c.cli_tipopes = 'A'
       WHERE ca.ani_mes::int = EXTRACT(MONTH FROM CURRENT_DATE)::int
         AND ca.ani_diaaniv > 0 AND ca.ani_mes > 0`
    ).catch(() => ({ rows: [] }));
    // Contatos das indústrias (contato_for) aniversariando no mês
    const anivContatoMes = await db.query(
      `SELECT cf.con_nome AS con_nome,
              COALESCE(f.for_nomered, '') AS empresa,
              cf.con_dtnasc,
              'industria' AS origem,
              EXTRACT(DAY FROM cf.con_dtnasc)::int AS dia,
              '' AS cli_redeloja
       FROM contato_for cf
       LEFT JOIN fornecedores f ON f.for_codigo = cf.con_fornec
       WHERE cf.con_dtnasc IS NOT NULL
         AND EXTRACT(MONTH FROM cf.con_dtnasc)::int = EXTRACT(MONTH FROM CURRENT_DATE)::int`
    ).catch(() => ({ rows: [] }));
    const aniversariosMes = {
      rows: [...anivCliAniv.rows, ...anivContatoMes.rows]
        .sort((a: any, b: any) => (a.dia || 0) - (b.dia || 0))
        .slice(0, 100),
    };

    // Aniversários hoje — apenas clientes ativos
    const vendedorFilter = req.schema === 'borcatorep' ? ' AND c.cli_vendedor = ' + (req.user?.userId || 0) : '';
    const hodjeCliAniv = await db.query(
      `WITH datas_alvo AS (
         SELECT EXTRACT(MONTH FROM CURRENT_DATE) AS m, EXTRACT(DAY FROM CURRENT_DATE) AS d
         UNION ALL SELECT EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day'), EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day') WHERE EXTRACT(DOW FROM CURRENT_DATE) = 1
         UNION ALL SELECT EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 days'), EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '2 days') WHERE EXTRACT(DOW FROM CURRENT_DATE) = 1
       )
       SELECT ca.ani_nome AS con_nome, COALESCE(c.cli_nomred, 'Cliente s/ nome') AS empresa,
              (EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' ||
               LPAD(ca.ani_mes::text, 2, '0') || '-' ||
               LPAD(ca.ani_diaaniv::text, 2, '0'))::date AS con_dtnasc,
              'cliente' AS origem,
              COALESCE(c.cli_redeloja, '') AS cli_redeloja
       FROM cli_aniv ca
       INNER JOIN clientes c ON c.cli_codigo = ca.ani_cliente AND c.cli_tipopes = 'A'
       WHERE (ca.ani_mes::int, ca.ani_diaaniv::int) IN (SELECT m::int, d::int FROM datas_alvo)
         AND ca.ani_diaaniv > 0 AND ca.ani_mes > 0${vendedorFilter}`
    ).catch(() => ({ rows: [] }));
    // Contatos das indústrias aniversariando hoje (+ fim de semana se for segunda)
    const hojeContato = await db.query(
      `WITH datas_alvo AS (
         SELECT EXTRACT(MONTH FROM CURRENT_DATE) AS m, EXTRACT(DAY FROM CURRENT_DATE) AS d
         UNION ALL SELECT EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day'), EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day') WHERE EXTRACT(DOW FROM CURRENT_DATE) = 1
         UNION ALL SELECT EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 days'), EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '2 days') WHERE EXTRACT(DOW FROM CURRENT_DATE) = 1
       )
       SELECT cf.con_nome AS con_nome, COALESCE(f.for_nomered, '') AS empresa,
              cf.con_dtnasc, 'industria' AS origem, '' AS cli_redeloja
       FROM contato_for cf
       LEFT JOIN fornecedores f ON f.for_codigo = cf.con_fornec
       WHERE cf.con_dtnasc IS NOT NULL
         AND (EXTRACT(MONTH FROM cf.con_dtnasc)::int, EXTRACT(DAY FROM cf.con_dtnasc)::int) IN (SELECT m::int, d::int FROM datas_alvo)`
    ).catch(() => ({ rows: [] }));
    const aniversarios = {
      rows: [...hodjeCliAniv.rows, ...hojeContato.rows]
        .sort((a: any, b: any) => a.con_nome?.localeCompare(b.con_nome))
        .slice(0, 15),
    };

    res.json({
      success: true,
      data: {
        tarefas_hoje:       parseInt(hoje.rows[0]?.total     || '0'),
        atrasadas:          parseInt(atrasadas.rows[0]?.total || '0'),
        proximo_compromisso: proximo.rows[0] || null,
        aniversarios_hoje:  aniversarios.rows,
        aniversarios_mes:   aniversariosMes.rows,
      },
    });
  } catch (error: any) {
    console.error('❌ [AGENDA] resumo:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── ANIVERSARIANTES POR PERÍODO ──────────────────────────────────────────────
// GET /api/agenda/aniversariantes-periodo?data_inicial=YYYY-MM-DD&data_final=YYYY-MM-DD
// Retorna aniversariantes cujo dia/mês cai dentro do período informado.
// Lida com ranges cruzando ano (ex: 20/12 a 10/02) via CASE no WHERE.
export async function aniversariantesPeriodoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const dataInicial = String(req.query.data_inicial || '').trim();
    const dataFinal   = String(req.query.data_final   || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicial) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFinal)) {
      res.status(400).json({ success: false, message: 'data_inicial e data_final são obrigatórios no formato YYYY-MM-DD.' });
      return;
    }

    const vendedorFilter = req.schema === 'borcatorep' ? ' AND c.cli_vendedor = ' + (req.user?.userId || 0) : '';

    // Query principal — mesma estratégia "tolera schema legado" do resumoAgendaHandler.
    // Se tabela/coluna não existir num tenant antigo, retorna vazio em vez de 500.
    const r = await db.query(
      `WITH params AS (
         SELECT
           EXTRACT(MONTH FROM $1::date)::int * 100 + EXTRACT(DAY FROM $1::date)::int AS start_mmdd,
           EXTRACT(MONTH FROM $2::date)::int * 100 + EXTRACT(DAY FROM $2::date)::int AS end_mmdd
       )
       SELECT
         ca.ani_nome                                                AS con_nome,
         COALESCE(c.cli_nomred, '')                                 AS empresa,
         ca.ani_diaaniv::int                                        AS dia,
         ca.ani_mes::int                                            AS mes,
         COALESCE(c.cli_redeloja, '')                               AS cli_redeloja,
         'cliente'                                                  AS origem,
         (LPAD(ca.ani_diaaniv::text, 2, '0') || '/' || LPAD(ca.ani_mes::text, 2, '0')) AS data_aniv
       FROM cli_aniv ca
       INNER JOIN clientes c ON c.cli_codigo = ca.ani_cliente AND c.cli_tipopes = 'A'
       CROSS JOIN params p
       WHERE ca.ani_diaaniv > 0 AND ca.ani_mes > 0
         AND CASE
           WHEN p.start_mmdd <= p.end_mmdd THEN
             (ca.ani_mes::int * 100 + ca.ani_diaaniv::int) BETWEEN p.start_mmdd AND p.end_mmdd
           ELSE
             (ca.ani_mes::int * 100 + ca.ani_diaaniv::int) >= p.start_mmdd
             OR (ca.ani_mes::int * 100 + ca.ani_diaaniv::int) <= p.end_mmdd
         END
         ${vendedorFilter}
       ORDER BY ca.ani_mes::int, ca.ani_diaaniv::int, ca.ani_nome`,
      [dataInicial, dataFinal]
    ).catch((err: any) => {
      // Loga a causa real para diagnose (tabela/coluna inexistente em tenant antigo, etc.)
      console.warn('[AGENDA] aniversariantes-periodo query falhou:', err?.code, err?.message);
      return { rows: [] as any[] };
    });

    // Contatos das indústrias (contato_for) aniversariando no período
    const rInd = await db.query(
      `WITH params AS (
         SELECT
           EXTRACT(MONTH FROM $1::date)::int * 100 + EXTRACT(DAY FROM $1::date)::int AS start_mmdd,
           EXTRACT(MONTH FROM $2::date)::int * 100 + EXTRACT(DAY FROM $2::date)::int AS end_mmdd
       )
       SELECT
         cf.con_nome                                                AS con_nome,
         COALESCE(f.for_nomered, '')                                AS empresa,
         EXTRACT(DAY   FROM cf.con_dtnasc)::int                     AS dia,
         EXTRACT(MONTH FROM cf.con_dtnasc)::int                     AS mes,
         ''                                                         AS cli_redeloja,
         'industria'                                                AS origem,
         (LPAD(EXTRACT(DAY FROM cf.con_dtnasc)::int::text, 2, '0') || '/' ||
          LPAD(EXTRACT(MONTH FROM cf.con_dtnasc)::int::text, 2, '0')) AS data_aniv
       FROM contato_for cf
       LEFT JOIN fornecedores f ON f.for_codigo = cf.con_fornec
       CROSS JOIN params p
       WHERE cf.con_dtnasc IS NOT NULL
         AND CASE
           WHEN p.start_mmdd <= p.end_mmdd THEN
             (EXTRACT(MONTH FROM cf.con_dtnasc)::int * 100 + EXTRACT(DAY FROM cf.con_dtnasc)::int) BETWEEN p.start_mmdd AND p.end_mmdd
           ELSE
             (EXTRACT(MONTH FROM cf.con_dtnasc)::int * 100 + EXTRACT(DAY FROM cf.con_dtnasc)::int) >= p.start_mmdd
             OR (EXTRACT(MONTH FROM cf.con_dtnasc)::int * 100 + EXTRACT(DAY FROM cf.con_dtnasc)::int) <= p.end_mmdd
         END`,
      [dataInicial, dataFinal]
    ).catch((err: any) => {
      console.warn('[AGENDA] aniversariantes-periodo (indústrias) falhou:', err?.code, err?.message);
      return { rows: [] as any[] };
    });

    // Dedup: clientes pela rede (cli_redeloja); contatos de indústria por empresa+origem
    const seen = new Set<string>();
    const dedup = [...r.rows, ...rInd.rows]
      .sort((a: any, b: any) => (a.mes - b.mes) || (a.dia - b.dia) || String(a.con_nome || '').localeCompare(String(b.con_nome || '')))
      .filter((row: any) => {
        const key = `${row.origem || 'cliente'}|${(row.con_nome || '').trim().toUpperCase()}|${(row.cli_redeloja || row.empresa || '').trim().toUpperCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    res.json({ success: true, data: dedup, total: dedup.length });
  } catch (error: any) {
    console.error('❌ [AGENDA] aniversariantes-periodo:', error.message, error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── BUSCAR POR ID ────────────────────────────────────────────────────────────
export async function getAgendaByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    const result = await db.query(
      `SELECT a.*, c.cli_nomred AS cliente_nome
        FROM agenda a
        LEFT JOIN clientes c ON c.cli_codigo = a.cliente_id
        WHERE a.id = $1 AND a.usuario_id = $2 AND a.empresa_id = $3
        ${req.schema === 'borcatorep' ? 'AND (a.cliente_id IS NULL OR c.cli_vendedor = ' + (req.user?.userId || 0) + ')' : ''}
       `,
      [id, userId, empresaId]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Tarefa não encontrada.' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [AGENDA] get-by-id:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── CRIAR TAREFA ─────────────────────────────────────────────────────────────
export async function createAgendaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;
    const t = req.body;

    if (!t.titulo?.trim() || !t.data_inicio) {
      res.status(400).json({ success: false, message: 'Título e data são obrigatórios.' });
      return;
    }

    const result = await db.query(
      `INSERT INTO agenda (
          usuario_id, empresa_id, titulo, descricao, tipo,
          data_inicio, hora_inicio, data_fim, hora_fim, dia_inteiro,
          status, prioridade,
          cliente_id, contato_id, pedido_codigo,
          recorrente, tipo_recorrencia, intervalo_recorrencia,
          lembrete_ativo, lembrete_antes, cor
       ) VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,
          $13,$14,$15,
          $16,$17,$18,
          $19,$20,$21
       ) RETURNING *`,
      [
        userId, empresaId, t.titulo.trim(), t.descricao || null, t.tipo || 'tarefa',
        t.data_inicio, t.hora_inicio || null, t.data_fim || null, t.hora_fim || null, !!t.dia_inteiro,
        t.status || 'pendente', t.prioridade || 'M',
        t.cliente_id || null, t.contato_id || null, t.pedido_codigo || null,
        !!t.recorrente, t.tipo_recorrencia || null, t.intervalo_recorrencia || 1,
        t.lembrete_ativo !== false, t.lembrete_antes || 15, t.cor || null,
      ]
    );

    res.status(201).json({ success: true, message: 'Tarefa criada.', data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [AGENDA] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── ATUALIZAR TAREFA ─────────────────────────────────────────────────────────
export async function updateAgendaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;
    const t = req.body;

    if (!t.titulo?.trim() || !t.data_inicio) {
      res.status(400).json({ success: false, message: 'Título e data são obrigatórios.' });
      return;
    }

    const result = await db.query(
      `UPDATE agenda SET
          titulo = $1, descricao = $2, tipo = $3,
          data_inicio = $4, hora_inicio = $5, data_fim = $6, hora_fim = $7, dia_inteiro = $8,
          status = $9, prioridade = $10,
          cliente_id = $11, contato_id = $12, pedido_codigo = $13,
          recorrente = $14, tipo_recorrencia = $15,
          lembrete_ativo = $16, lembrete_antes = $17, cor = $18
       WHERE id = $19 AND usuario_id = $20 AND empresa_id = $21
       RETURNING *`,
      [
        t.titulo.trim(), t.descricao || null, t.tipo || 'tarefa',
        t.data_inicio, t.hora_inicio || null, t.data_fim || null, t.hora_fim || null, !!t.dia_inteiro,
        t.status || 'pendente', t.prioridade || 'M',
        t.cliente_id || null, t.contato_id || null, t.pedido_codigo || null,
        !!t.recorrente, t.tipo_recorrencia || null,
        t.lembrete_ativo !== false, t.lembrete_antes || 15, t.cor || null,
        id, userId, empresaId,
      ]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Tarefa não encontrada.' });
      return;
    }
    res.json({ success: true, message: 'Tarefa atualizada.', data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [AGENDA] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── ATUALIZAR STATUS (AÇÃO RÁPIDA) ──────────────────────────────────────────
export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { status, notas_conclusao } = req.body;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    const VALID = ['pendente','em_andamento','concluida','adiada','cancelada'];
    if (!VALID.includes(status)) {
      res.status(400).json({ success: false, message: 'Status inválido.' });
      return;
    }

    const concluido = status === 'concluida' ? ', concluido_em = NOW()' : '';
    const result = await db.query(
      `UPDATE agenda SET status = $1, notas_conclusao = $2${concluido}
       WHERE id = $3 AND usuario_id = $4 AND empresa_id = $5 RETURNING *`,
      [status, notas_conclusao || null, id, userId, empresaId]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Tarefa não encontrada.' });
      return;
    }
    res.json({ success: true, message: 'Status atualizado.', data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [AGENDA] status:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── ADIAR TAREFA ─────────────────────────────────────────────────────────────
export async function adiarAgendaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { nova_data, nova_hora, motivo } = req.body;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    if (!nova_data) {
      res.status(400).json({ success: false, message: 'Nova data é obrigatória.' });
      return;
    }

    const atual = await db.query(
      `SELECT data_inicio, data_original, vezes_adiada FROM agenda
       WHERE id = $1 AND usuario_id = $2 AND empresa_id = $3`,
      [id, userId, empresaId]
    );
    if (!atual.rows.length) {
      res.status(404).json({ success: false, message: 'Tarefa não encontrada.' });
      return;
    }

    const dataOriginal = atual.rows[0].data_original || atual.rows[0].data_inicio;
    const vezesAdiada  = (atual.rows[0].vezes_adiada || 0) + 1;

    const result = await db.query(
      `UPDATE agenda SET
          data_inicio = $1, hora_inicio = $2, data_original = $3, vezes_adiada = $4,
          status = 'adiada', lembrete_enviado = false,
          notas_conclusao = COALESCE(notas_conclusao, '') || E'\\n[Adiada] ' || $5
       WHERE id = $6 AND usuario_id = $7 AND empresa_id = $8 RETURNING *`,
      [nova_data, nova_hora || null, dataOriginal, vezesAdiada, motivo || '', id, userId, empresaId]
    );

    res.json({ success: true, message: `Tarefa adiada para ${nova_data}.`, data: result.rows[0] });
  } catch (error: any) {
    console.error('❌ [AGENDA] adiar:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── EXCLUIR TAREFA ───────────────────────────────────────────────────────────
export async function deleteAgendaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    const result = await db.query(
      `DELETE FROM agenda WHERE id = $1 AND usuario_id = $2 AND empresa_id = $3 RETURNING titulo`,
      [id, userId, empresaId]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Tarefa não encontrada.' });
      return;
    }
    res.json({ success: true, message: `Tarefa "${result.rows[0].titulo}" excluída.` });
  } catch (error: any) {
    console.error('❌ [AGENDA] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── NOTIFICAÇÕES PENDENTES ───────────────────────────────────────────────────
export async function notificationsPendingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    const result = await db.query(
      `SELECT id, titulo, tipo, data_inicio, hora_inicio, lembrete_antes
       FROM agenda
       WHERE usuario_id = $1 AND empresa_id = $2
         AND status IN ('pendente','em_andamento')
         AND lembrete_ativo = true AND lembrete_enviado = false
         AND (data_inicio + COALESCE(hora_inicio, '00:00:00'::time)) - (lembrete_antes * interval '1 minute') <= NOW()
       ORDER BY data_inicio ASC, hora_inicio ASC`,
      [userId, empresaId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [AGENDA] notifications-pending:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── MARCAR NOTIFICAÇÃO COMO ENVIADA ─────────────────────────────────────────
export async function markNotificationSentHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;

    await db.query(
      `UPDATE agenda SET lembrete_enviado = true WHERE id = $1 AND usuario_id = $2 AND empresa_id = $3`,
      [id, userId, empresaId]
    );
    res.json({ success: true, message: 'Notificação marcada como enviada.' });
  } catch (error: any) {
    console.error('❌ [AGENDA] notification-sent:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── ESTATÍSTICAS DE PRODUTIVIDADE ────────────────────────────────────────────
export async function statsProdutividadeHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const userId    = req.user?.userId;
    const empresaId = req.user?.empresaId;
    const { periodo } = req.query as Record<string, string>;

    let intervalo = '30 days';
    if (periodo === 'semana') intervalo = '7 days';
    if (periodo === 'ano')    intervalo = '365 days';

    const stats = await db.query(
      `SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${intervalo}') AS total_criadas,
          COUNT(*) FILTER (WHERE status = 'concluida' AND concluido_em >= NOW() - INTERVAL '${intervalo}') AS total_concluidas,
          COUNT(*) FILTER (WHERE status IN ('pendente','em_andamento') AND data_inicio < CURRENT_DATE) AS total_atrasadas,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'concluida' AND concluido_em >= NOW() - INTERVAL '${intervalo}')::numeric /
            NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${intervalo}'), 0) * 100, 1
          ) AS taxa_conclusao
       FROM agenda WHERE usuario_id = $1 AND empresa_id = $2`,
      [userId, empresaId]
    );

    const porTipo = await db.query(
      `SELECT tipo, COUNT(*) AS total FROM agenda
       WHERE usuario_id = $1 AND empresa_id = $2 AND created_at >= NOW() - INTERVAL '${intervalo}'
       GROUP BY tipo ORDER BY total DESC`,
      [userId, empresaId]
    );

    res.json({ success: true, data: { ...stats.rows[0], por_tipo: porTipo.rows } });
  } catch (error: any) {
    console.error('❌ [AGENDA] stats:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── Helper: buscar aniversariantes (hoje + fim de semana se segunda) ────────
// Apenas clientes ativos — indústrias excluídas
async function fetchAniversariantes(db: any, schema?: string, userId?: number): Promise<any[]> {
  const vendedorFilter = schema === 'borcatorep' ? 'AND c.cli_vendedor = ' + (userId || 0) : '';
  return db.query(
    `WITH datas_alvo AS (
       SELECT EXTRACT(MONTH FROM CURRENT_DATE) AS m, EXTRACT(DAY FROM CURRENT_DATE) AS d
       UNION ALL SELECT EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day'), EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day') WHERE EXTRACT(DOW FROM CURRENT_DATE) = 1
       UNION ALL SELECT EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 days'), EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '2 days') WHERE EXTRACT(DOW FROM CURRENT_DATE) = 1
     )
     SELECT con_nome, empresa, con_dtnasc, origem FROM (
       SELECT cc.con_nome, c.cli_nomred AS empresa, cc.con_dtnasc, 'cliente' AS origem
       FROM contato_cli cc
       JOIN clientes c ON c.cli_codigo = cc.con_codigo AND c.cli_tipopes = 'A'
       WHERE (EXTRACT(MONTH FROM cc.con_dtnasc)::int, EXTRACT(DAY FROM cc.con_dtnasc)::int) IN (SELECT m::int, d::int FROM datas_alvo)
       ${vendedorFilter}
       UNION ALL
       SELECT ca.ani_nome AS con_nome, COALESCE(c.cli_nomred, 'Cliente s/ nome') AS empresa,
              CAST(EXTRACT(YEAR FROM CURRENT_DATE) || '-' || ca.ani_mes || '-' || ca.ani_diaaniv AS DATE) AS con_dtnasc,
              'cliente' AS origem
       FROM cli_aniv ca
       INNER JOIN clientes c ON c.cli_codigo = ca.ani_codcli AND c.cli_tipopes = 'A'
       WHERE (ca.ani_mes::int, ca.ani_diaaniv::int) IN (SELECT m::int, d::int FROM datas_alvo)
       ${vendedorFilter}
     ) sub
     ORDER BY con_nome
     LIMIT 15`
  ).then((r: any) => r.rows).catch(() => []);
}

// ─── IRIS — BRIEFING DO DIA ───────────────────────────────────────────────────
export async function irisBriefingHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const userId      = req.user?.userId;
  const empresaId   = req.user?.empresaId;
  const nomeUsuario = req.user?.name?.split(' ')[0] || req.user?.username || 'Usuário';
  const holidayCtx  = getHolidayContext();

  // Busca tarefas, emails e aniversariantes — sempre, mesmo sem IA disponível
  let hojeRows: any[]          = [];
  let atrasadasRows: any[]     = [];
  let emailLeadsRows: any[]    = [];
  let aniversariantesRows: any[] = [];
  try {
    const [hoje, atrasadas, emailLeads, aniversariantes] = await Promise.all([
      db.query(
        `SELECT titulo, tipo, hora_inicio, prioridade, status, cliente_id
         FROM agenda
         WHERE usuario_id = $1 AND empresa_id = $2
           AND data_inicio = CURRENT_DATE
           AND status NOT IN ('concluida','cancelada')
         ORDER BY hora_inicio ASC NULLS LAST`,
        [userId, empresaId]
      ),
      db.query(
        `SELECT titulo, tipo, data_inicio, prioridade
         FROM agenda
         WHERE usuario_id = $1 AND empresa_id = $2
           AND data_inicio < CURRENT_DATE
           AND status NOT IN ('concluida','cancelada')
         ORDER BY data_inicio ASC LIMIT 5`,
        [userId, empresaId]
      ),
      // Emails novos e relevantes (cotação/pedido prioritários)
      db.query(
        `SELECT assunto, tipo, de_nome, resumo_ia
         FROM email_lead
         WHERE estado = 'novo'
         ORDER BY tipo = 'cotacao' DESC, tipo = 'pedido' DESC, recebido_em DESC
         LIMIT 5`
      ).catch(() => ({ rows: [] })),
      // Aniversariantes (hoje + fim de semana se segunda)
      fetchAniversariantes(db, req.schema, req.user?.userId),
    ]);
    hojeRows          = hoje.rows;
    atrasadasRows     = atrasadas.rows;
    emailLeadsRows    = emailLeads.rows;
    aniversariantesRows = aniversariantes;
  } catch (dbErr: any) {
    console.error('❌ [IRIS] Erro ao buscar dados:', dbErr.message);
  }

  const tipoLabel: Record<string, string> = {
    tarefa: 'Tarefa', lembrete: 'Lembrete', visita: 'Visita',
    ligacao: 'Ligação', reuniao: 'Reunião', cobranca: 'Cobrança',
    followup: 'Follow-up', aniversario: 'Aniversário',
  };
  const priorLabel: Record<string, string> = { A: 'Alta', M: 'Média', B: 'Baixa' };
  const hora = (h: string | null) => h ? h.substring(0, 5) : 'horário livre';

  const hojeTexto = hojeRows.length === 0
    ? 'Nenhuma tarefa agendada para hoje.'
    : hojeRows.map((t: any) =>
        `- [${tipoLabel[t.tipo] || t.tipo}] ${hora(t.hora_inicio)} — ${t.titulo} (Prioridade ${priorLabel[t.prioridade] || t.prioridade})`
      ).join('\n');

  const atrasadasTexto = atrasadasRows.length === 0
    ? ''
    : `\n\nTarefas em atraso (${atrasadasRows.length}):\n` + atrasadasRows.map((t: any) =>
        `- ${t.titulo} [${tipoLabel[t.tipo] || t.tipo}]`
      ).join('\n');

  const emailTexto = emailLeadsRows.length === 0
    ? ''
    : `\n\nEmails novos capturados pela IRIS (${emailLeadsRows.length}):\n` + emailLeadsRows.map((e: any) => {
        const tipoEmail = e.tipo === 'cotacao' ? '🔥 Cotação' : e.tipo === 'pedido' ? '📦 Pedido' : e.tipo;
        return `- [${tipoEmail}] De: ${e.de_nome || '?'} — ${e.assunto}`;
      }).join('\n');

  const aniversarioTexto = aniversariantesRows.length === 0
    ? ''
    : `\n\n🎂 Aniversariantes${new Date().getDay() === 1 ? ' (hoje + fim de semana)' : ' de hoje'} (${aniversariantesRows.length}):\n` + aniversariantesRows.map((a: any) =>
        `- ${a.con_nome} — ${a.empresa} [${a.origem === 'industria' ? 'Indústria' : 'Cliente'}]`
      ).join('\n');

  // ─── Fallback estático — usado quando todos os provedores de IA falham ──────
  const staticBriefing = (): string => {
    const n = hojeRows.length;
    const a = atrasadasRows.length;
    const e = emailLeadsRows.length;
    const b = aniversariantesRows.length;
    const partes: string[] = [];
    if (n === 0 && a === 0 && e === 0 && b === 0) return `Bom dia, ${nomeUsuario}! Sua agenda está livre hoje. Aproveite para prospectar novos clientes ou adiantar pendências.`;
    if (n > 0) partes.push(`Você tem ${n} tarefa${n > 1 ? 's' : ''} para hoje.`);
    if (a > 0) partes.push(`Atenção: há ${a} item${a > 1 ? 'ns' : ''} em atraso.`);
    if (e > 0) {
      const cotacoes = emailLeadsRows.filter((x: any) => x.tipo === 'cotacao').length;
      if (cotacoes > 0) partes.push(`${cotacoes} cotaç${cotacoes > 1 ? 'ões' : 'ão'} nova${cotacoes > 1 ? 's' : ''} no email — priorize!`);
      else partes.push(`${e} email${e > 1 ? 's' : ''} novo${e > 1 ? 's' : ''} aguardando sua atenção.`);
    }
    if (b > 0) partes.push(`🎂 ${b} aniversariante${b > 1 ? 's' : ''} — mande um parabéns!`);
    partes.push('Foque no que gera resultado. Um passo de cada vez.');
    return partes.join(' ');
  };

  // ─── Tenta gerar briefing com IA ─────────────────────────────────────────────
  let briefing: string;
  if (!openai && !process.env.GEMINI_API_KEY) {
    briefing = staticBriefing();
  } else {
    const prompt = `Você é IRIS, a assistente de inteligência do SalesMasters — sistema de gestão de representantes comerciais.
Seu tom é direto, profissional e levemente motivador. Use frases curtas. Máximo 4 parágrafos.
Não use bullet points no briefing — escreva em texto corrido.
Responda em português do Brasil.

Gere um briefing de produtividade para ${nomeUsuario} com base nas informações de hoje:
${holidayCtx ? `\nCONTEXTO DE FERIADO:\n${holidayCtx}\n` : ''}
AGENDA:
${hojeTexto}${atrasadasTexto}${emailTexto}${aniversarioTexto}

O briefing deve:
1. Identificar o compromisso mais urgente ou de maior impacto do dia (agenda ou email de cotação/pedido)
2. Mencionar se há emails importantes que precisam de resposta rápida, destacando cotações
3. Mencionar brevemente se há tarefas atrasadas
4. Se houver aniversariantes, citar os nomes e sugerir que mande parabéns — isso fortalece o relacionamento
5. Se houver contexto de feriado (ontem foi feriado, hoje é feriado, amanhã será feriado), adaptar o tom: sugerir recuperar o ritmo, aproveitar pra organizar, ou se preparar para o retorno
6. Fechar com uma frase motivadora curta e genuína (sem exageros)`;

    try {
      briefing = await callIrisAI(prompt);
    } catch (aiErr: any) {
      console.warn('[IRIS] Todos os provedores falharam, usando briefing estático:', aiErr.message);
      briefing = staticBriefing();
    }
  }

  // ─── Sempre retorna 200 ────────────────────────────────────────────────────
  res.json({
    success: true,
    data: {
      briefing,
      tarefas_hoje:     hojeRows.length,
      atrasadas:        atrasadasRows.length,
      aniversariantes:  aniversariantesRows,
    },
  });
}
