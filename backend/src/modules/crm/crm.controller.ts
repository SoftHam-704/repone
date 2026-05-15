import { Request, Response } from 'express';
import axios from 'axios';
import { env } from '../../config/env';
import { pool } from '../../config/database';

function err(res: Response, e: any, ctx = '') {
  console.error(`❌ [CRM]${ctx ? ' ' + ctx : ''}:`, e?.message ?? e);
  res.status(500).json({ success: false, message: e?.message ?? 'Erro interno' });
}

const PIPELINE_STAGES = [
  { etapa_id: 1, descricao: 'Prospecção',  color: '#60A5FA' },
  { etapa_id: 2, descricao: 'Qualificação', color: '#818CF8' },
  { etapa_id: 3, descricao: 'Proposta',     color: '#FB923C' },
  { etapa_id: 4, descricao: 'Negociação',   color: '#EAB308' },
  { etapa_id: 5, descricao: 'Fechamento',   color: '#10B981' },
];

// ════════════════════════════════════════════════════════════════════
// PIPELINE / OPORTUNIDADES
// ════════════════════════════════════════════════════════════════════

export async function getPipelineHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo } = req.query as Record<string, string>;

    let query = `
      SELECT
        o.oportunidade_id AS id,
        o.cli_codigo,
        o.ven_codigo,
        o.for_codigo,
        o.etapa_id,
        o.titulo,
        o.descricao,
        o.valor_estimado,
        o.probabilidade,
        o.data_prevista_fechamento,
        o.criado_em,
        o.atualizado_em,
        c.cli_nomred AS cliente_nome,
        c.cli_cidade,
        c.cli_uf,
        COALESCE(f.for_nomered, '') AS industria_nome,
        COALESCE(v.ven_nome, '')    AS promotor_nome,
        COALESCE(agg.interacoes_count, 0) AS interacoes_count,
        agg.ultima_interacao
      FROM crm_oportunidades o
      JOIN clientes c ON c.cli_codigo = o.cli_codigo
      LEFT JOIN fornecedores f ON f.for_codigo = o.for_codigo
      LEFT JOIN vendedores   v ON v.ven_codigo = o.ven_codigo
      LEFT JOIN (
        SELECT oportunidade_id,
               COUNT(*)          AS interacoes_count,
               MAX(data_interacao) AS ultima_interacao
        FROM crm_interacao
        GROUP BY oportunidade_id
      ) agg ON agg.oportunidade_id = o.oportunidade_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (ven_codigo && !isNaN(parseInt(ven_codigo))) {
      query += ` AND o.ven_codigo = $${params.length + 1}`;
      params.push(parseInt(ven_codigo));
    }

    query += ` ORDER BY o.etapa_id, o.oportunidade_id`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'pipeline'); }
}

export async function createOportunidadeHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { titulo, cli_codigo, ven_codigo, valor_estimado, etapa_id, for_codigo, telefone_contato } = req.body;

    if (!titulo || !cli_codigo) {
      res.status(400).json({ success: false, message: 'Título e cliente são obrigatórios' });
      return;
    }

    const clean = (v: any) => (v === '' || v === undefined) ? null : v;

    const result = await db.query(`
      INSERT INTO crm_oportunidades (titulo, cli_codigo, ven_codigo, valor_estimado, etapa_id, for_codigo, telefone_contato)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [titulo, parseInt(cli_codigo), parseInt(ven_codigo) || 1, clean(valor_estimado), parseInt(etapa_id) || 1, clean(for_codigo), telefone_contato || null]);

    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'create oportunidade'); }
}

export async function updateOportunidadeHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { titulo, cli_codigo, ven_codigo, valor_estimado, etapa_id, for_codigo, telefone_contato } = req.body;
    const clean = (v: any) => (v === '' || v === undefined) ? null : v;

    const result = await db.query(`
      UPDATE crm_oportunidades
      SET titulo=$1, cli_codigo=$2, ven_codigo=$3, valor_estimado=$4, etapa_id=$5, for_codigo=$6, telefone_contato=$7, atualizado_em=CURRENT_TIMESTAMP
      WHERE oportunidade_id=$8 RETURNING *
    `, [titulo, parseInt(cli_codigo), parseInt(ven_codigo) || 1, clean(valor_estimado), parseInt(etapa_id) || 1, clean(for_codigo), telefone_contato || null, id]);

    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Oportunidade não encontrada' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'update oportunidade'); }
}

export async function moveOportunidadeHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { etapa_id } = req.body;
    await db.query(
      'UPDATE crm_oportunidades SET etapa_id=$1, atualizado_em=CURRENT_TIMESTAMP WHERE oportunidade_id=$2',
      [parseInt(etapa_id), id]
    );
    res.json({ success: true });
  } catch (e) { err(res, e, 'move oportunidade'); }
}

export async function deleteOportunidadeHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('DELETE FROM crm_oportunidades WHERE oportunidade_id=$1', [id]);
    res.json({ success: true, message: 'Oportunidade removida' });
  } catch (e) { err(res, e, 'delete oportunidade'); }
}

// ════════════════════════════════════════════════════════════════════
// INTERAÇÕES (ATENDIMENTOS)
// ════════════════════════════════════════════════════════════════════

export async function listInteracoesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo, cli_codigo, for_codigo, data_inicio, data_fim } = req.query as Record<string, string>;

    let query = `
      SELECT
        i.interacao_id,
        i.data_interacao,
        i.descricao,
        i.ven_codigo,
        c.cli_nomred,
        c.cli_codigo,
        t.descricao AS tipo,
        t.id        AS tipo_interacao_id,
        r.descricao AS resultado,
        r.id        AS resultado_id,
        cn.descricao AS canal,
        cn.id        AS canal_id,
        v.ven_nome,
        (SELECT array_agg(ii.for_codigo)
         FROM crm_interacao_industria ii
         WHERE ii.interacao_id = i.interacao_id) AS industrias
      FROM crm_interacao i
      JOIN clientes c             ON c.cli_codigo = i.cli_codigo
      JOIN crm_tipo_interacao t   ON t.id = i.tipo_interacao_id
      LEFT JOIN crm_resultado r   ON r.id = i.resultado_id
      LEFT JOIN crm_canal cn      ON cn.id = i.canal_id
      LEFT JOIN vendedores v       ON v.ven_codigo = i.ven_codigo
      WHERE 1=1
    `;
    const params: any[] = [];
    let pi = 1;

    if (ven_codigo && !isNaN(parseInt(ven_codigo))) { query += ` AND i.ven_codigo = $${pi++}`; params.push(parseInt(ven_codigo)); }
    if (cli_codigo)  { query += ` AND i.cli_codigo = $${pi++}`;     params.push(cli_codigo); }
    if (for_codigo)  { query += ` AND EXISTS (SELECT 1 FROM crm_interacao_industria ii2 WHERE ii2.interacao_id = i.interacao_id AND ii2.for_codigo = $${pi++})`; params.push(for_codigo); }
    if (data_inicio) { query += ` AND i.data_interacao >= $${pi++}::timestamp`; params.push(`${data_inicio} 00:00:00`); }
    if (data_fim)    { query += ` AND i.data_interacao <= $${pi++}::timestamp`; params.push(`${data_fim} 23:59:59`); }

    query += ` ORDER BY i.data_interacao DESC LIMIT 200`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list interacoes'); }
}

export async function createInteracaoHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query('BEGIN');
    const { cli_codigo, ven_codigo, tipo_interacao_id, canal_id, resultado_id, descricao, industrias, data_interacao } = req.body;

    if (!cli_codigo || !ven_codigo || !tipo_interacao_id) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'cli_codigo, ven_codigo e tipo_interacao_id são obrigatórios' });
      return;
    }

    const dataFinal = data_interacao || new Date().toISOString().slice(0, 10);

    const { rows } = await client.query(`
      INSERT INTO crm_interacao (cli_codigo, ven_codigo, tipo_interacao_id, canal_id, resultado_id, descricao, data_interacao)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [cli_codigo, ven_codigo, tipo_interacao_id, canal_id || null, resultado_id || null, descricao || null, dataFinal]);

    const interacaoId = rows[0].interacao_id;

    if (Array.isArray(industrias) && industrias.length) {
      for (const forCodigo of industrias) {
        await client.query(
          'INSERT INTO crm_interacao_industria (interacao_id, for_codigo) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [interacaoId, forCodigo]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    err(res, e, 'create interacao');
  } finally { client.release(); }
}

export async function updateInteracaoHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query('BEGIN');
    const { id } = req.params;
    const { tipo_interacao_id, canal_id, resultado_id, descricao, industrias, data_interacao } = req.body;

    await client.query(`
      UPDATE crm_interacao SET tipo_interacao_id=$1, canal_id=$2, resultado_id=$3, descricao=$4,
        data_interacao=COALESCE($5::date, data_interacao)
      WHERE interacao_id=$6
    `, [tipo_interacao_id, canal_id || null, resultado_id || null, descricao || null, data_interacao || null, id]);

    await client.query('DELETE FROM crm_interacao_industria WHERE interacao_id=$1', [id]);

    if (Array.isArray(industrias) && industrias.length) {
      for (const forCodigo of industrias) {
        await client.query('INSERT INTO crm_interacao_industria (interacao_id, for_codigo) VALUES ($1,$2)', [id, forCodigo]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    err(res, e, 'update interacao');
  } finally { client.release(); }
}

export async function deleteInteracaoHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('DELETE FROM crm_interacao_industria WHERE interacao_id=$1', [id]);
    await db.query('DELETE FROM crm_interacao WHERE interacao_id=$1', [id]);
    res.json({ success: true, message: 'Interação removida' });
  } catch (e) { err(res, e, 'delete interacao'); }
}

// ════════════════════════════════════════════════════════════════════
// FOLLOW-UPS
// ════════════════════════════════════════════════════════════════════

export async function listFollowupsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo, status, periodo, cli_codigo } = req.query as Record<string, string>;

    let query = `
      SELECT f.*, c.cli_nomred, c.cli_cidade, c.cli_uf, c.cli_fone1
      FROM crm_followups f
      LEFT JOIN clientes c ON c.cli_codigo = f.cli_codigo
      WHERE 1=1
    `;
    const params: any[] = [];
    let pi = 1;

    if (ven_codigo && !isNaN(parseInt(ven_codigo))) { query += ` AND f.ven_codigo = $${pi++}`; params.push(parseInt(ven_codigo)); }
    if (status && status !== 'todos') { query += ` AND f.status = $${pi++}`; params.push(status); }
    if (cli_codigo)  { query += ` AND f.cli_codigo = $${pi++}`; params.push(cli_codigo); }

    if (periodo === 'atrasados') query += ` AND f.status = 'pendente' AND f.data_prevista < CURRENT_DATE`;
    else if (periodo === 'hoje') query += ` AND f.status = 'pendente' AND f.data_prevista = CURRENT_DATE`;
    else if (periodo === 'semana') query += ` AND f.status = 'pendente' AND f.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`;

    query += ` ORDER BY
      CASE f.status WHEN 'pendente' THEN 0 WHEN 'concluido' THEN 1 ELSE 2 END,
      CASE f.prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
      f.data_prevista ASC LIMIT 300`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'list followups'); }
}

export async function countFollowupsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo } = req.query as Record<string, string>;
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (ven_codigo && !isNaN(parseInt(ven_codigo))) {
      where += ` AND ven_codigo = $1`;
      params.push(parseInt(ven_codigo));
    }

    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pendente' AND data_prevista < CURRENT_DATE) AS atrasados,
        COUNT(*) FILTER (WHERE status='pendente' AND data_prevista = CURRENT_DATE) AS hoje,
        COUNT(*) FILTER (WHERE status='pendente' AND data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS semana,
        COUNT(*) FILTER (WHERE status='pendente') AS total_pendentes,
        COUNT(*) FILTER (WHERE status='concluido' AND data_conclusao >= CURRENT_DATE - 30) AS concluidos_mes
      FROM crm_followups ${where}
    `, params);

    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'count followups'); }
}

export async function createFollowupHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo, cli_codigo, interacao_id, oportunidade_id, titulo, descricao, data_prevista, prioridade, tipo } = req.body;

    if (!ven_codigo || !titulo || !data_prevista) {
      res.status(400).json({ success: false, message: 'ven_codigo, titulo e data_prevista são obrigatórios' });
      return;
    }

    const result = await db.query(`
      INSERT INTO crm_followups (ven_codigo, cli_codigo, interacao_id, oportunidade_id, titulo, descricao, data_prevista, prioridade, tipo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [ven_codigo, cli_codigo || null, interacao_id || null, oportunidade_id || null, titulo, descricao || null, data_prevista, prioridade || 'media', tipo || 'outro']);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'create followup'); }
}

export async function updateFollowupHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { status, titulo, descricao, data_prevista, prioridade, tipo } = req.body;

    const sets: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (status      !== undefined) { sets.push(`status=$${pi++}`);        params.push(status); if (status === 'concluido') { sets.push('data_conclusao=NOW()'); } }
    if (titulo      !== undefined) { sets.push(`titulo=$${pi++}`);        params.push(titulo); }
    if (descricao   !== undefined) { sets.push(`descricao=$${pi++}`);     params.push(descricao); }
    if (data_prevista !== undefined) { sets.push(`data_prevista=$${pi++}`); params.push(data_prevista); }
    if (prioridade  !== undefined) { sets.push(`prioridade=$${pi++}`);    params.push(prioridade); }
    if (tipo        !== undefined) { sets.push(`tipo=$${pi++}`);          params.push(tipo); }

    if (!sets.length) { res.status(400).json({ success: false, message: 'Nenhum campo' }); return; }
    params.push(id);

    const result = await db.query(`UPDATE crm_followups SET ${sets.join(',')} WHERE id=$${pi} RETURNING *`, params);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Follow-up não encontrado' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'update followup'); }
}

export async function deleteFollowupHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const result = await db.query('DELETE FROM crm_followups WHERE id=$1 RETURNING id', [id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Follow-up não encontrado' }); return; }
    res.json({ success: true });
  } catch (e) { err(res, e, 'delete followup'); }
}

// ════════════════════════════════════════════════════════════════════
// LOOKUPS (tipos, canais, resultados)
// ════════════════════════════════════════════════════════════════════

export async function listTiposHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query('SELECT * FROM crm_tipo_interacao WHERE ativo=true ORDER BY descricao');
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'list tipos'); }
}

export async function listCanaisHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query('SELECT * FROM crm_canal WHERE ativo=true ORDER BY descricao');
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'list canais'); }
}

export async function listResultadosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const r = await db.query('SELECT * FROM crm_resultado WHERE ativo=true ORDER BY ordem, descricao');
    res.json({ success: true, data: r.rows });
  } catch (e) { err(res, e, 'list resultados'); }
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ════════════════════════════════════════════════════════════════════

export async function crmDashboardHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo } = req.query as Record<string, string>;

    const whereOpp = ven_codigo && !isNaN(parseInt(ven_codigo))
      ? `WHERE ven_codigo = ${parseInt(ven_codigo)}`
      : '';
    const whereFollow = ven_codigo && !isNaN(parseInt(ven_codigo))
      ? `WHERE ven_codigo = ${parseInt(ven_codigo)}`
      : '';

    const [pipeline, followups, interacoes] = await Promise.all([
      db.query(`
        SELECT
          etapa_id,
          COUNT(*)             AS total,
          COALESCE(SUM(valor_estimado), 0) AS valor_total
        FROM crm_oportunidades ${whereOpp}
        GROUP BY etapa_id ORDER BY etapa_id
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='pendente' AND data_prevista < CURRENT_DATE) AS atrasados,
          COUNT(*) FILTER (WHERE status='pendente' AND data_prevista = CURRENT_DATE) AS hoje,
          COUNT(*) FILTER (WHERE status='pendente' AND data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS semana,
          COUNT(*) FILTER (WHERE status='pendente') AS total_pendentes
        FROM crm_followups ${whereFollow}
      `),
      db.query(`
        SELECT COUNT(*) AS total_mes
        FROM crm_interacao
        WHERE data_interacao >= date_trunc('month', CURRENT_DATE)
        ${ven_codigo && !isNaN(parseInt(ven_codigo)) ? `AND ven_codigo = ${parseInt(ven_codigo)}` : ''}
      `),
    ]);

    const stagesMap = Object.fromEntries(PIPELINE_STAGES.map(s => [s.etapa_id, s]));
    const pipelineData = PIPELINE_STAGES.map(stage => {
      const row = pipeline.rows.find((r: any) => r.etapa_id === stage.etapa_id);
      return { ...stage, total: parseInt(row?.total ?? 0), valor_total: parseFloat(row?.valor_total ?? 0) };
    });

    res.json({
      success: true,
      data: {
        pipeline:   pipelineData,
        followups:  followups.rows[0],
        interacoes: interacoes.rows[0],
      }
    });
  } catch (e) { err(res, e, 'dashboard'); }
}

// ════════════════════════════════════════════════════════════════════
// CARTEIRA VIVA
// ════════════════════════════════════════════════════════════════════

// Helper: início do trimestre atual e anterior
function trimestre(offset = 0) {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + offset;
  const year = now.getFullYear() + Math.floor(q / 4);
  const qNorm = ((q % 4) + 4) % 4;
  const start = new Date(year, qNorm * 3, 1);
  const end   = new Date(year, qNorm * 3 + 3, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// GET /crm/carteira/radar
export async function carteiraRadarHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo } = req.query as Record<string, string>;
    const venId = ven_codigo && !isNaN(parseInt(ven_codigo)) ? parseInt(ven_codigo) : null;

    const tAtual  = trimestre(0);
    const tAnter  = trimestre(-1);
    const venWhere = venId ? `AND p.ped_vendedor = ${venId}` : '';
    const venWhereV = venId ? `AND v.ven_codigo = ${venId}` : '';

    const [alertas, metaRows, visitaRows] = await Promise.all([

      // Clientes que compraram no trimestre anterior mas NÃO no atual
      db.query(`
        SELECT
          c.cli_codigo,
          c.cli_nomred,
          c.cli_cidade,
          c.cli_uf,
          c.cli_fone1,
          MAX(p_ant.ped_data) AS ultima_compra,
          COUNT(DISTINCT p_ant.ped_pedido) AS pedidos_trimestre_anterior,
          COALESCE(SUM(p_ant.ped_totliq), 0) AS valor_trimestre_anterior
        FROM clientes c
        JOIN pedidos p_ant ON p_ant.ped_cliente = c.cli_codigo
          AND p_ant.ped_data BETWEEN $1 AND $2
          AND p_ant.ped_situacao IN ('P','F')
          ${venWhere.replace('p.', 'p_ant.')}
        WHERE NOT EXISTS (
          SELECT 1 FROM pedidos p_atual
          WHERE p_atual.ped_cliente = c.cli_codigo
            AND p_atual.ped_data BETWEEN $3 AND $4
            AND p_atual.ped_situacao IN ('P','F')
            ${venWhere.replace('p.', 'p_atual.')}
        )
        GROUP BY c.cli_codigo, c.cli_nomred, c.cli_cidade, c.cli_uf, c.cli_fone1
        ORDER BY valor_trimestre_anterior DESC
        LIMIT 50
      `, [tAnter.start, tAnter.end, tAtual.start, tAtual.end]),

      // Meta do trimestre atual por indústria
      db.query(`
        SELECT
          f.for_codigo,
          f.for_nomered,
          COALESCE(
            CASE EXTRACT(MONTH FROM CURRENT_DATE)::int
              WHEN 1 THEN m.met_jan WHEN 2 THEN m.met_fev WHEN 3 THEN m.met_mar
              WHEN 4 THEN m.met_abr WHEN 5 THEN m.met_mai WHEN 6 THEN m.met_jun
              WHEN 7 THEN m.met_jul WHEN 8 THEN m.met_ago WHEN 9 THEN m.met_set
              WHEN 10 THEN m.met_out WHEN 11 THEN m.met_nov WHEN 12 THEN m.met_dez
            END, 0
          ) * 3 AS meta_trimestre,
          COALESCE(SUM(p.ped_totliq), 0) AS realizado
        FROM fornecedores f
        LEFT JOIN ind_metas m ON m.met_industria = f.for_codigo
          AND m.met_ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
        LEFT JOIN pedidos p ON p.ped_industria = f.for_codigo
          AND p.ped_data BETWEEN $1 AND $2
          AND p.ped_situacao IN ('P','F')
          ${venWhere.replace('p.', 'p.')}
        GROUP BY f.for_codigo, f.for_nomered, m.met_jan, m.met_fev, m.met_mar,
          m.met_abr, m.met_mai, m.met_jun, m.met_jul, m.met_ago, m.met_set,
          m.met_out, m.met_nov, m.met_dez
        HAVING COALESCE(
          CASE EXTRACT(MONTH FROM CURRENT_DATE)::int
            WHEN 1 THEN m.met_jan WHEN 2 THEN m.met_fev WHEN 3 THEN m.met_mar
            WHEN 4 THEN m.met_abr WHEN 5 THEN m.met_mai WHEN 6 THEN m.met_jun
            WHEN 7 THEN m.met_jul WHEN 8 THEN m.met_ago WHEN 9 THEN m.met_set
            WHEN 10 THEN m.met_out WHEN 11 THEN m.met_nov WHEN 12 THEN m.met_dez
          END, 0
        ) > 0
        ORDER BY meta_trimestre DESC
      `, [tAtual.start, tAtual.end]),

      // Visitas desta semana
      db.query(`
        SELECT
          COUNT(*) AS total_semana,
          COUNT(*) FILTER (WHERE resultado = 'positivou') AS com_pedido,
          COUNT(*) FILTER (WHERE data = CURRENT_DATE) AS hoje
        FROM repcrm_visita
        WHERE data >= date_trunc('week', CURRENT_DATE)
        ${venWhereV}
      `, []),
    ]);

    res.json({
      success: true,
      data: {
        trimestre_atual: tAtual,
        trimestre_anterior: tAnter,
        em_risco: alertas.rows,
        metas: metaRows.rows,
        visitas: visitaRows.rows[0],
      }
    });
  } catch (e) { err(res, e, 'radar'); }
}

// GET /crm/carteira/clientes
export async function carteiraClientesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo, status, industria, search } = req.query as Record<string, string>;
    const venId = ven_codigo && !isNaN(parseInt(ven_codigo)) ? parseInt(ven_codigo) : null;

    const tAtual  = trimestre(0);
    const tAnter  = trimestre(-1);
    const t2Anter = trimestre(-2);
    const t3Anter = trimestre(-3);

    const params: any[] = [tAtual.start, tAtual.end, tAnter.start, tAnter.end, t2Anter.start, t2Anter.end, t3Anter.start];
    let pi = 9;
    let extraWhere = '';

    if (venId) { params.push(venId); extraWhere += ` AND p_all.ped_vendedor = $${params.length}`; }
    if (industria && !isNaN(parseInt(industria))) { params.push(parseInt(industria)); extraWhere += ` AND p_all.ped_industria = $${params.length}`; }
    if (search) { params.push(`%${search}%`); extraWhere += ` AND (c.cli_nomred ILIKE $${params.length} OR c.cli_nome ILIKE $${params.length})`; }

    const result = await db.query(`
      WITH compras AS (
        SELECT
          p_all.ped_cliente,
          MAX(p_all.ped_data)                                                  AS ultima_compra,
          COUNT(DISTINCT p_all.ped_pedido)                                     AS total_pedidos,
          COALESCE(SUM(p_all.ped_totliq), 0)                                   AS ltv,
          COUNT(DISTINCT p_all.ped_pedido) FILTER (
            WHERE p_all.ped_data BETWEEN $1 AND $2)                           AS ped_t0,
          COUNT(DISTINCT p_all.ped_pedido) FILTER (
            WHERE p_all.ped_data BETWEEN $3 AND $4)                           AS ped_t1,
          COUNT(DISTINCT p_all.ped_pedido) FILTER (
            WHERE p_all.ped_data BETWEEN $5 AND $6)                           AS ped_t2,
          COALESCE(SUM(p_all.ped_totliq) FILTER (
            WHERE p_all.ped_data BETWEEN $1 AND $2), 0)                       AS valor_t0,
          COALESCE(SUM(p_all.ped_totliq) FILTER (
            WHERE p_all.ped_data BETWEEN $3 AND $4), 0)                       AS valor_t1
        FROM pedidos p_all
        WHERE p_all.ped_situacao IN ('P','F')
          AND p_all.ped_data >= $7
          ${extraWhere}
        GROUP BY p_all.ped_cliente
      ),
      ultima_visita AS (
        SELECT cli_codigo, MAX(data) AS data_visita, MAX(resultado::text) AS ultimo_resultado
        FROM repcrm_visita
        WHERE cli_codigo IS NOT NULL
        ${venId ? `AND ven_codigo = ${venId}` : ''}
        GROUP BY cli_codigo
      )
      SELECT
        c.cli_codigo,
        c.cli_nomred,
        c.cli_nome,
        c.cli_cidade,
        c.cli_uf,
        c.cli_fone1,
        cp.ultima_compra,
        cp.total_pedidos,
        cp.ltv,
        cp.ped_t0,
        cp.ped_t1,
        cp.ped_t2,
        cp.valor_t0,
        cp.valor_t1,
        uv.data_visita AS ultima_visita,
        uv.ultimo_resultado,
        CASE
          WHEN cp.ped_t0 > 0                          THEN 'ativo'
          WHEN cp.ped_t1 > 0 AND cp.ped_t0 = 0       THEN 'risco'
          WHEN cp.ped_t2 > 0 AND cp.ped_t1 = 0       THEN 'inativo'
          WHEN cp.ped_t0 IS NULL AND cp.ped_t1 IS NULL THEN 'perdido'
          ELSE 'perdido'
        END AS status_carteira
      FROM clientes c
      JOIN compras cp ON cp.ped_cliente = c.cli_codigo
      LEFT JOIN ultima_visita uv ON uv.cli_codigo = c.cli_codigo
      ${status && status !== 'todos' ? `WHERE CASE
        WHEN cp.ped_t0 > 0 THEN 'ativo'
        WHEN cp.ped_t1 > 0 AND cp.ped_t0 = 0 THEN 'risco'
        WHEN cp.ped_t2 > 0 AND cp.ped_t1 = 0 THEN 'inativo'
        ELSE 'perdido'
      END = '${status}'` : ''}
      ORDER BY
        CASE CASE WHEN cp.ped_t0 > 0 THEN 'ativo' WHEN cp.ped_t1 > 0 AND cp.ped_t0 = 0 THEN 'risco' WHEN cp.ped_t2 > 0 AND cp.ped_t1 = 0 THEN 'inativo' ELSE 'perdido' END
          WHEN 'risco' THEN 0 WHEN 'inativo' THEN 1 WHEN 'perdido' THEN 2 WHEN 'ativo' THEN 3
        END,
        cp.valor_t1 DESC
    `, params.slice(0, 7));

    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'carteira clientes'); }
}

// GET /crm/carteira/clientes/:id/ficha
export async function carteiraFichaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { ven_codigo } = req.query as Record<string, string>;
    const tAtual = trimestre(0);
    const tAnter = trimestre(-1);

    const [cliente, pedidos, visitas, produtosFavs, areas] = await Promise.all([
      db.query(`
        SELECT c.cli_codigo, c.cli_nome, c.cli_nomred,
               c.cli_cidade, c.cli_uf, c.cli_fone1,
               c.cli_atuacaoprincipal
        FROM clientes c
        WHERE c.cli_codigo = $1
      `, [id]),

      db.query(`
        SELECT p.ped_pedido, p.ped_data, p.ped_totliq, p.ped_situacao,
               f.for_nomered AS industria
        FROM pedidos p
        LEFT JOIN fornecedores f ON f.for_codigo = p.ped_industria
        WHERE p.ped_cliente = $1 AND p.ped_situacao <> 'E'
        ORDER BY p.ped_data DESC LIMIT 10
      `, [id]),

      db.query(`
        SELECT v.id, v.cli_codigo, v.data AS data_visita, v.resultado::text AS resultado,
               v.notas, v.duracao_minutos, v.created_at
        FROM repcrm_visita v
        WHERE v.cli_codigo = $1
        ORDER BY v.data DESC, v.created_at DESC LIMIT 10
      `, [id]),

      db.query(`
        SELECT i.ite_produto, i.ite_nomeprod,
               COUNT(*) AS vezes, SUM(i.ite_quant) AS qtd_total
        FROM itens_ped i
        JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_cliente = $1 AND p.ped_situacao IN ('P','F')
          AND p.ped_data >= $2
        GROUP BY i.ite_produto, i.ite_nomeprod
        ORDER BY vezes DESC, qtd_total DESC LIMIT 10
      `, [id, tAnter.start]),

      db.query(`
        SELECT a.atu_descricao
        FROM area_atu a
        JOIN atua_cli ac ON ac.atu_atuaid = a.atu_id AND ac.atu_idcli = $1
        ORDER BY a.atu_descricao
      `, [parseInt(String(id))]),
    ]);

    if (!cliente.rows[0]) { res.status(404).json({ success: false, message: 'Cliente não encontrado' }); return; }

    res.json({
      success: true,
      data: {
        cliente:       cliente.rows[0],
        pedidos:       pedidos.rows,
        visitas:       visitas.rows,
        produtos_favs: produtosFavs.rows,
        areas:         areas.rows.map((r: any) => r.atu_descricao),
      }
    });
  } catch (e) { err(res, e, 'ficha cliente'); }
}

// POST /crm/carteira/visitas
export async function criarVisitaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo, cli_codigo, data_visita, resultado, notas, duracao_minutos } = req.body;

    if (!cli_codigo) { res.status(400).json({ success: false, message: 'cli_codigo é obrigatório' }); return; }

    // Map resultado V2 → enum V1
    const resultadoMap: Record<string, string> = {
      pedido_gerado: 'positivou', sem_pedido: 'nao_positivou',
      reagendou: 'reagendou', nao_encontrado: 'ausente',
    };
    const resultadoEnum = resultadoMap[resultado] ?? 'nao_positivou';

    const result = await db.query(`
      INSERT INTO repcrm_visita (cli_codigo, ven_codigo, data, resultado, notas, duracao_minutos, created_at, updated_at)
      VALUES ($1,$2,$3,$4::repcrm_visita_resultado_enum,$5,$6,NOW(),NOW()) RETURNING *
    `, [
      cli_codigo,
      ven_codigo || null,
      data_visita || new Date().toISOString().slice(0, 10),
      resultadoEnum,
      notas || null,
      duracao_minutos || null,
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (e) { err(res, e, 'criar visita'); }
}

// GET /crm/carteira/visitas
export async function listarVisitasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { ven_codigo, cli_codigo, limit = '50' } = req.query as Record<string, string>;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (ven_codigo && !isNaN(parseInt(ven_codigo))) { params.push(parseInt(ven_codigo)); where += ` AND v.ven_codigo = $${params.length}`; }
    if (cli_codigo && !isNaN(parseInt(cli_codigo))) { params.push(parseInt(cli_codigo)); where += ` AND v.cli_codigo = $${params.length}`; }

    const result = await db.query(`
      SELECT v.id, v.cli_codigo, v.ven_codigo, v.data AS data_visita,
             v.resultado, v.notas, v.duracao_minutos, v.created_at,
             c.cli_nomred
      FROM repcrm_visita v
      LEFT JOIN clientes c ON c.cli_codigo = v.cli_codigo
      ${where}
      ORDER BY v.data DESC, v.created_at DESC
      LIMIT ${parseInt(limit) || 50}
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'listar visitas'); }
}

// DELETE /crm/carteira/visitas/:id
export async function deletarVisitaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    await db.query('DELETE FROM repcrm_visita WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) { err(res, e, 'deletar visita'); }
}

// ════════════════════════════════════════════════════════════════════
// WHATSAPP — Evolution API
// ════════════════════════════════════════════════════════════════════

function evolutionClient() {
  const baseURL = env.EVOLUTION_API_URL;
  const apiKey  = env.EVOLUTION_API_KEY;
  if (!baseURL || !apiKey) throw new Error('Evolution API não configurada no .env');
  return axios.create({
    baseURL,
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

// ════════════════════════════════════════════════════════════════════
// RELATÓRIO DE RELACIONAMENTOS
// ════════════════════════════════════════════════════════════════════

export async function relatorioRelacionamentosHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { dataInicio, dataFim, for_codigo } = req.query as Record<string, string>;

    if (!dataInicio || !dataFim) {
      res.status(400).json({ success: false, message: 'dataInicio e dataFim são obrigatórios' });
      return;
    }

    let query = `
      SELECT
        i.interacao_id,
        i.data_interacao,
        i.descricao,
        c.cli_nomred AS cliente_nome,
        c.cli_cidade,
        c.cli_uf,
        COALESCE(v.ven_nome, '') AS operador,
        t.descricao AS tipo,
        COALESCE(r.descricao, '') AS resultado,
        f.for_nomered AS industria,
        f.for_codigo
      FROM crm_interacao i
      JOIN clientes c             ON c.cli_codigo = i.cli_codigo
      LEFT JOIN vendedores v      ON v.ven_codigo = i.ven_codigo
      JOIN crm_tipo_interacao t   ON t.id = i.tipo_interacao_id
      LEFT JOIN crm_resultado r   ON r.id = i.resultado_id
      JOIN crm_interacao_industria ii ON ii.interacao_id = i.interacao_id
      JOIN fornecedores f         ON f.for_codigo = ii.for_codigo
      WHERE i.data_interacao >= $1::timestamp
        AND i.data_interacao <= $2::timestamp
    `;
    const params: any[] = [`${dataInicio} 00:00:00`, `${dataFim} 23:59:59`];

    if (for_codigo && !isNaN(parseInt(for_codigo))) {
      query += ` AND ii.for_codigo = $${params.length + 1}`;
      params.push(parseInt(for_codigo));
    }

    query += ` ORDER BY f.for_nomered, i.data_interacao`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'relatorio relacionamentos'); }
}

// GET /whatsapp/status — retorna estado da instância e QR se desconectado
export async function whatsappStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const evo = evolutionClient();
    const { instance } = req.query as { instance?: string };
    const instanceName = instance || 'salesmasters';

    const [stateRes, instancesRes] = await Promise.allSettled([
      evo.get(`/instance/connectionState/${instanceName}`),
      evo.get('/instance/fetchInstances'),
    ]);

    const state     = stateRes.status === 'fulfilled'     ? stateRes.value.data : null;
    const instances = instancesRes.status === 'fulfilled' ? instancesRes.value.data : [];

    res.json({ success: true, data: { state, instances, instanceName } });
  } catch (e: any) { err(res, e, 'whatsapp status'); }
}

// POST /whatsapp/send — envia mensagem de texto
export async function whatsappSendHandler(req: Request, res: Response): Promise<void> {
  try {
    const evo = evolutionClient();
    const { instance = 'salesmasters', number, message } = req.body;

    if (!number || !message) {
      res.status(400).json({ success: false, message: 'number e message são obrigatórios' });
      return;
    }

    // Evolution API v2 format
    const result = await evo.post(`/message/sendText/${instance}`, {
      number:  number.replace(/\D/g, ''), // apenas dígitos
      text:    message,
      delay:   1000,
    });

    res.json({ success: true, data: result.data });
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? 'Erro ao enviar';
    res.status(500).json({ success: false, message: msg });
  }
}

// GET /whatsapp/instances — lista instâncias ativas
export async function whatsappInstancesHandler(req: Request, res: Response): Promise<void> {
  try {
    // Tenta identificar o identificador único do cliente (CNPJ ou Schema)
    // Na Evolution, as instâncias são nomeadas pelo CNPJ.
    const tenantIdentifier = req.user?.cnpj || req.schema;
    
    const evo = evolutionClient();
    const result = await evo.get('/instance/fetchInstances');
    
    // Filtro Rigoroso: Apenas instâncias que pertencem a este CNPJ/Schema
    const filtered = (result.data || []).filter((inst: any) => {
      const name = inst.name || inst.instanceName;
      // Aceita se o nome for igual ao CNPJ ou igual ao Schema
      return name === tenantIdentifier || name === req.schema || (req.user?.cnpj && name === req.user.cnpj);
    });

    // Normaliza para o frontend
    const list = filtered.map((inst: any) => ({
      instance: {
        instanceName: inst.name || inst.instanceName,
        status: inst.connectionStatus || inst.status || 'disconnected'
      }
    }));

    console.log(`🔍 [CRM] WhatsApp Instances found for tenant identifier ${tenantIdentifier}: ${list.length}`);
    res.json({ success: true, data: list });
  } catch (e: any) { 
    console.error('❌ [CRM] whatsapp instances error:', e?.message);
    err(res, e, 'whatsapp instances'); 
  }
}

// GET /whatsapp/connect-auto — usa schema/cnpj do tenant como nome da instância
export async function whatsappConnectAutoHandler(req: Request, res: Response): Promise<void> {
  const instance = req.user?.cnpj?.replace(/\D/g, '') || req.schema;
  if (!instance) {
    res.status(400).json({ success: false, message: 'Tenant não identificado. Faça login novamente.' });
    return;
  }
  // Redireciona para o handler padrão reusando a lógica
  req.params = { ...req.params, instance };
  return whatsappConnectHandler(req, res);
}

// GET /whatsapp/connect/:instance — gera QR code para pareamento
export async function whatsappConnectHandler(req: Request, res: Response): Promise<void> {
  const { instance } = req.params;
  const tenantIdentifier = req.user?.cnpj || req.schema;
  const evo = evolutionClient();

  // SEGURANÇA: Bloqueia se tentar acessar instância de outro tenant
  // Compara tanto o CNPJ formatado quanto só os dígitos (connect-auto usa replace(/\D/g,''))
  const cnpjDigits = req.user?.cnpj?.replace(/\D/g, '') ?? '';
  const isAuthorized = instance === req.user?.cnpj || instance === cnpjDigits || instance === req.schema;
  if (!isAuthorized) {
    console.warn(`🛡️ [SECURITY] Tenant ${tenantIdentifier} tentou acessar instância não autorizada: ${instance}`);
    res.status(403).json({ success: false, message: 'Acesso não autorizado a esta instância.' });
    return;
  }

  console.log(`🔌 [CRM] WhatsApp connect para: ${instance}`);

  try {
    // 1. Checa estado atual
    let state: string | null = null;
    try {
      const stateRes = await evo.get(`/instance/connectionState/${instance}`);
      state = stateRes.data?.instance?.state ?? stateRes.data?.state ?? null;
      console.log(`ℹ️ [CRM] Estado atual de ${instance}: ${state}`);
    } catch {
      state = null;
    }

    // 2. Se já conectado, retorna sem gerar QR
    if (state === 'open' || state === 'connected') {
      res.json({ success: true, status: 'CONNECTED' });
      return;
    }

    // 3. Deleta e recria do zero — padrão V1 que funciona
    // Mesmo se falhar (instância em uso, rate limit), continua e tenta o QR assim mesmo
    try {
      console.log(`🗑️ [CRM] Resetando instância ${instance}...`);
      await evo.delete(`/instance/delete/${instance}`).catch(() => {});

      console.log(`✨ [CRM] Criando nova instância ${instance}...`);
      await evo.post('/instance/create', {
        instanceName: instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });

      console.log(`⏳ [CRM] Aguardando 5s para estabilização...`);
      await new Promise(r => setTimeout(r, 5000));
    } catch {
      // Criação falhou (instância já existe ou erro da API) — tenta usar a instância existente
      console.warn(`⚠️ [CRM] Falha no ciclo delete+create para ${instance}, tentando instância existente`);
      await new Promise(r => setTimeout(r, 2000));
    }

    // 4. Solicita QR code
    console.log(`📸 [CRM] Solicitando QR para ${instance}...`);
    const qrRes = await evo.get(`/instance/connect/${instance}`);
    const d = qrRes.data;

    // d?.code pode ser string base64 direta (não propriedade aninhada .base64)
    const candidatos = [
      d?.base64,
      d?.code,
      d?.qrcode?.base64,
      d?.instance?.base64,
      d?.data?.base64,
      d?.data?.qrcode?.base64,
    ];
    const base64 = candidatos.find(v => typeof v === 'string' && v.startsWith('data:')) ?? null;

    if (base64) {
      console.log(`✅ [CRM] QR Code gerado para ${instance}`);
      res.json({ success: true, status: 'QR_CODE', qrcode: base64 });
    } else {
      console.warn(`⚠️ [CRM] QR não retornado para ${instance}. Payload:`, JSON.stringify(d).substring(0, 300));
      res.json({ success: false, status: 'BUSY', message: 'Instância criada. Aguarde alguns segundos e tente novamente.' });
    }
  } catch (e: any) {
    console.error(`❌ [CRM] Connect error para ${instance}:`, e?.response?.data || e?.message);
    err(res, e, 'whatsapp connect');
  }
}

// ─── Check-in / Check-out ─────────────────────────────────────────────────────

// GET /crm/visitas/hoje — check-ins abertos hoje para este promotor
export async function visitasHojeHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { ven_codigo } = req.query as Record<string, string>;
  if (!ven_codigo) { res.json({ success: true, data: [] }); return; }
  try {
    // Retorna cli_codigo dos clientes cujo ÚLTIMO registro hoje é CHECKIN (= visita aberta)
    const result = await db.query(`
      SELECT DISTINCT ON (vis_cliente_id) vis_cliente_id, vis_tipo, vis_codigo
      FROM registro_visitas
      WHERE vis_promotor_id = $1
        AND vis_datahora::date = CURRENT_DATE
      ORDER BY vis_cliente_id, vis_datahora DESC
    `, [parseInt(ven_codigo)]);
    const abertos = result.rows
      .filter(r => r.vis_tipo === 'CHECKIN')
      .map(r => ({ cli_codigo: r.vis_cliente_id, vis_codigo: r.vis_codigo }));
    res.json({ success: true, data: abertos });
  } catch (e) { err(res, e, 'visitas hoje'); }
}

// POST /crm/visitas/checkin
export async function checkinHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { ven_codigo, cli_codigo, latitude, longitude } = req.body;
  if (!ven_codigo || !cli_codigo) {
    res.status(400).json({ success: false, message: 'ven_codigo e cli_codigo são obrigatórios.' });
    return;
  }
  try {
    // ── Resolver ven_codigo real: o app envia user_nomes.codigo, precisamos do ven_codigo ──
    const userId = parseInt(ven_codigo);
    const venRes = await db.query(
      'SELECT ven_codigo FROM vendedores WHERE ven_codusu = $1',
      [userId]
    );
    const realVenCodigo = venRes.rows[0]?.ven_codigo ?? userId;

    // ── Calcular distância Haversine se cliente tem coordenadas ──────────────
    let distancia: number | null = null;
    if (latitude && longitude) {
      const cliRes = await db.query(
        'SELECT cli_latitude, cli_longitude FROM clientes WHERE cli_codigo = $1',
        [parseInt(cli_codigo)]
      );
      const cli = cliRes.rows[0];
      if (cli?.cli_latitude && cli?.cli_longitude) {
        const R = 6371000;
        const dLat = (Number(cli.cli_latitude)  - latitude)  * Math.PI / 180;
        const dLon = (Number(cli.cli_longitude) - longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
          Math.cos(latitude * Math.PI/180) * Math.cos(Number(cli.cli_latitude) * Math.PI/180) *
          Math.sin(dLon/2)**2;
        distancia = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      }
    }

    // ── registro_visitas (legado) — é o check-in real, nunca pode falhar ────
    const legacyRes = await db.query(`
      INSERT INTO registro_visitas
        (vis_promotor_id, vis_cliente_id, vis_latitude_checkin, vis_longitude_checkin, vis_distancia_metros, vis_tipo)
      VALUES ($1, $2, $3, $4, $5, 'CHECKIN')
      RETURNING vis_codigo, vis_datahora
    `, [userId, parseInt(cli_codigo), latitude ?? 0, longitude ?? 0, distancia]);
    const legacy = legacyRes.rows[0];

    // ── visitas_campo (painel do diretor) — não-bloqueante ───────────────────
    let campo_id: number | null = null;
    if (realVenCodigo) {
      try {
        const campoRes = await db.query(`
          INSERT INTO visitas_campo
            (cli_codigo, ven_codigo, data, checkin_at, checkin_lat, checkin_lng)
          VALUES ($1, $2, CURRENT_DATE, NOW(), $3, $4)
          RETURNING id
        `, [parseInt(cli_codigo), realVenCodigo, latitude ?? null, longitude ?? null]);
        campo_id = campoRes.rows[0].id;
      } catch (e: any) {
        console.warn(`⚠️ [CHECKIN] visitas_campo falhou (não-bloqueante): ${e.message}`);
      }
    }

    console.log(`📍 [CHECKIN] user=${userId} ven=${realVenCodigo} cli=${cli_codigo} dist=${distancia}m campo_id=${campo_id}`);
    res.json({
      success: true,
      vis_codigo: legacy.vis_codigo,
      campo_id,
      datahora: legacy.vis_datahora,
      distancia_metros: distancia,
    });
  } catch (e) { err(res, e, 'checkin'); }
}

// POST /crm/visitas/checkout
export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { ven_codigo, cli_codigo, latitude, longitude, resultado, motivo_nao_positivo, marketing_acao, campo_id } = req.body;
  if (!ven_codigo || !cli_codigo) {
    res.status(400).json({ success: false, message: 'ven_codigo e cli_codigo são obrigatórios.' });
    return;
  }
  if (!resultado) {
    res.status(400).json({ success: false, message: 'resultado é obrigatório no checkout.' });
    return;
  }
  const resultadosValidos = ['positivou', 'nao_positivou', 'reagendou', 'ausente', 'fechado'];
  if (!resultadosValidos.includes(resultado)) {
    res.status(400).json({ success: false, message: `resultado deve ser: ${resultadosValidos.join(', ')}` });
    return;
  }
  try {
    // ── Resolver ven_codigo real (app envia user_nomes.codigo) ───────────────
    const userId = parseInt(ven_codigo);
    const venRes = await db.query(
      'SELECT ven_codigo FROM vendedores WHERE ven_codusu = $1',
      [userId]
    );
    const realVenCodigo = venRes.rows[0]?.ven_codigo ?? userId;

    // ── Atomic: apenas registro_visitas (nunca pode falhar) ──────────────────
    await db.query('BEGIN');
    let legacy: any;
    try {
      const legacyRes = await db.query(`
        INSERT INTO registro_visitas
          (vis_promotor_id, vis_cliente_id, vis_latitude_checkin, vis_longitude_checkin, vis_tipo)
        VALUES ($1, $2, $3, $4, 'CHECKOUT')
        RETURNING vis_codigo, vis_datahora
      `, [userId, parseInt(cli_codigo), latitude ?? 0, longitude ?? 0]);
      legacy = legacyRes.rows[0];
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      err(res, e, 'checkout');
      return;
    }

    // ── visitas_campo update — não-bloqueante (pode falhar em schemas antigos) ─
    let campo: { id: number; duracao_minutos: number } | null = null;
    try {
      const updateRes = await db.query(`
        UPDATE visitas_campo
        SET checkout_at         = NOW(),
            checkout_lat        = $4,
            checkout_lng        = $5,
            resultado           = $6,
            motivo_nao_positivo = $7,
            marketing_acao      = $8,
            duracao_minutos     = ROUND(EXTRACT(EPOCH FROM (NOW() - checkin_at)) / 60)
        WHERE id = COALESCE(
          $9::int,
          (SELECT id FROM visitas_campo
           WHERE ven_codigo IN ($1, $2) AND cli_codigo = $3
             AND data = CURRENT_DATE AND checkout_at IS NULL
           ORDER BY checkin_at DESC LIMIT 1)
        )
        RETURNING id, duracao_minutos
      `, [
        realVenCodigo, userId, parseInt(cli_codigo),
        latitude ?? null, longitude ?? null,
        resultado, motivo_nao_positivo ?? null,
        marketing_acao ?? null,
        campo_id ? parseInt(campo_id) : null,
      ]);
      campo = updateRes.rows[0] ?? null;
      if (!campo) {
        console.warn(`[CHECKOUT] No open visitas_campo row found: ven=${ven_codigo} cli=${cli_codigo}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [CHECKOUT] visitas_campo falhou (não-bloqueante): ${e.message}`);
    }

    console.log(`🏁 [CHECKOUT] ven=${ven_codigo} cli=${cli_codigo} resultado=${resultado} dur=${campo?.duracao_minutos}min`);
    res.json({
      success: true,
      vis_codigo: legacy.vis_codigo,
      campo_id: campo?.id ?? null,
      resultado,
      duracao_minutos: campo?.duracao_minutos ?? null,
    });
  } catch (e) { err(res, e, 'checkout'); }
}

// GET /crm/visitas/historico — histórico de visitas paginado
export async function visitasHistoricoHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { data_inicio, data_fim, ven_codigo } = req.query as Record<string, string>;

  const inicio = data_inicio || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const fim    = data_fim    || new Date().toISOString().slice(0, 10);

  const params: any[] = [inicio, fim];
  let venFilter = '';
  if (ven_codigo) {
    params.push(parseInt(ven_codigo));
    venFilter = `AND ci.vis_promotor_id = $${params.length}`;
  }

  try {
    const result = await db.query(`
      SELECT
        ci.vis_codigo,
        ci.vis_promotor_id,
        ci.vis_cliente_id,
        ci.vis_datahora          AS checkin_at,
        ci.vis_distancia_metros,
        co.vis_datahora          AS checkout_at,
        c.cli_nome               AS cliente_razao,
        c.cli_nomred             AS cliente_nome,
        TRIM(u.nome || ' ' || COALESCE(u.sobrenome, '')) AS promotor_nome
      FROM registro_visitas ci
      LEFT JOIN LATERAL (
        SELECT vis_datahora
        FROM registro_visitas
        WHERE vis_promotor_id = ci.vis_promotor_id
          AND vis_cliente_id  = ci.vis_cliente_id
          AND vis_tipo        = 'CHECKOUT'
          AND vis_datahora    > ci.vis_datahora
          AND vis_datahora::date = ci.vis_datahora::date
        ORDER BY vis_datahora ASC
        LIMIT 1
      ) co ON true
      LEFT JOIN clientes   c ON c.cli_codigo = ci.vis_cliente_id
      LEFT JOIN user_nomes u ON u.codigo     = ci.vis_promotor_id
      WHERE ci.vis_tipo = 'CHECKIN'
        AND ci.vis_datahora::date BETWEEN $1 AND $2
        ${venFilter}
      ORDER BY ci.vis_datahora DESC
      LIMIT 500
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (e) { err(res, e, 'visitas historico'); }
}

// GET /crm/campo/ao-vivo — estado atual dos promotores + todas as visitas do dia
export async function campoAoVivoHandler(req: Request, res: Response): Promise<void> {
  const db = req.db!;
  const { data } = req.query as Record<string, string>;
  const dia = data || new Date().toISOString().slice(0, 10);

  try {
    const visitasRes = await db.query(`
      SELECT
        vc.id,
        vc.cli_codigo,
        vc.ven_codigo,
        vc.checkin_at,
        vc.checkout_at,
        vc.resultado,
        vc.motivo_nao_positivo,
        vc.duracao_minutos,
        vc.checkin_lat,
        vc.checkin_lng,
        c.cli_nomred  AS cliente_nome,
        c.cli_nome    AS cliente_razao,
        v.ven_nome    AS promotor_nome
      FROM visitas_campo vc
      JOIN clientes   c ON c.cli_codigo  = vc.cli_codigo
      JOIN vendedores v ON v.ven_codigo  = vc.ven_codigo
      WHERE vc.data = $1
      ORDER BY vc.checkin_at DESC
    `, [dia]);

    const visitas = visitasRes.rows;

    const promMap = new Map<number, {
      ven_codigo: number;
      promotor_nome: string;
      total_visitas: number;
      positivadas: number;
      nao_positivadas: number;
      em_visita: boolean;
      cliente_atual: string | null;
      checkin_atual: string | null;
    }>();

    for (const v of visitas) {
      if (!promMap.has(v.ven_codigo)) {
        promMap.set(v.ven_codigo, {
          ven_codigo:      v.ven_codigo,
          promotor_nome:   v.promotor_nome,
          total_visitas:   0,
          positivadas:     0,
          nao_positivadas: 0,
          em_visita:       false,
          cliente_atual:   null,
          checkin_atual:   null,
        });
      }
      const p = promMap.get(v.ven_codigo)!;
      p.total_visitas++;
      if (v.resultado === 'positivou')     p.positivadas++;
      if (v.resultado === 'nao_positivou') p.nao_positivadas++;
      if (!v.checkout_at && !p.em_visita) {
        p.em_visita     = true;
        p.cliente_atual = v.cliente_nome;
        p.checkin_atual = v.checkin_at;
      }
    }

    const kpis = {
      total_visitas:   visitas.length,
      positivadas:     visitas.filter(v => v.resultado === 'positivou').length,
      nao_positivadas: visitas.filter(v => v.resultado === 'nao_positivou').length,
      em_visita:       visitas.filter(v => !v.checkout_at).length,
    };

    res.json({
      success: true,
      data: { kpis, promotores: [...promMap.values()], visitas },
    });
  } catch (e) { err(res, e, 'campo ao vivo'); }
}
