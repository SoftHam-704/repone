import { Request, Response } from 'express';
import { pool } from '../../config/database';

// ─── GET /api/sellout ─────────────────────────────────────────────────────────
export async function listSellOutHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { periodo, cliente_id, industria_id, search } = req.query as any;

    let query = `
      SELECT
        s.id, s.cli_codigo, s.for_codigo, s.periodo,
        s.valor, s.quantidade, s.criado_em,
        c.cli_nome, c.cli_fantasia, c.cli_nomred,
        f.for_nome AS industria_nome, f.for_nomered AS industria_nomered
      FROM crm_sellout s
      LEFT JOIN clientes c ON s.cli_codigo = c.cli_codigo
      LEFT JOIN fornecedores f ON s.for_codigo = f.for_codigo
      WHERE 1=1
    `;
    const params: any[] = [];
    let p = 1;

    if (periodo) { params.push(periodo); query += ` AND s.periodo = $${p++}`; }
    if (cliente_id) { params.push(cliente_id); query += ` AND s.cli_codigo = $${p++}`; }
    if (industria_id) { params.push(industria_id); query += ` AND s.for_codigo = $${p++}`; }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.cli_nomred ILIKE $${p} OR c.cli_fantasia ILIKE $${p} OR f.for_nomered ILIKE $${p} OR f.for_nome ILIKE $${p})`;
      p++;
    }

    query += ` ORDER BY s.periodo DESC, c.cli_nomred`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLOUT] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellout/summary ─────────────────────────────────────────────────
// Returns 7-month trend (3 before current + current + 3 after)
export async function sellOutSummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { industria_id } = req.query as any;

    let industriaFilter = '';
    const params: any[] = [];
    if (industria_id) {
      params.push(industria_id);
      industriaFilter = `AND s.for_codigo = $1`;
    }

    const result = await db.query(`
      SELECT
        TO_CHAR(gs.month, 'YYYY-MM') AS periodo,
        COALESCE(SUM(s.valor), 0)      AS total_valor,
        COALESCE(SUM(s.quantidade), 0) AS total_quantidade,
        COUNT(DISTINCT s.cli_codigo)   AS total_clientes,
        COUNT(DISTINCT s.for_codigo)   AS total_industrias
      FROM generate_series(
        DATE_TRUNC('month', NOW()) - INTERVAL '3 months',
        DATE_TRUNC('month', NOW()) + INTERVAL '3 months',
        INTERVAL '1 month'
      ) AS gs(month)
      LEFT JOIN crm_sellout s
        ON TO_CHAR(s.periodo::date, 'YYYY-MM') = TO_CHAR(gs.month, 'YYYY-MM')
        ${industriaFilter}
      GROUP BY gs.month
      ORDER BY gs.month
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLOUT] summary:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellout/pendencies ─────────────────────────────────────────────
// Clients who reported in previous period but NOT in current
export async function sellOutPendenciesHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { industria_id } = req.query as any;

    const currentPeriod  = new Date();
    const previousPeriod = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() - 1, 1);
    const currentStr  = `${currentPeriod.getFullYear()}-${String(currentPeriod.getMonth() + 1).padStart(2, '0')}-01`;
    const previousStr = `${previousPeriod.getFullYear()}-${String(previousPeriod.getMonth() + 1).padStart(2, '0')}-01`;

    const params: any[] = [previousStr, currentStr];
    let industriaFilter = '';
    if (industria_id) {
      params.push(industria_id);
      industriaFilter = `AND prev.for_codigo = $${params.length}`;
    }

    const result = await db.query(`
      SELECT
        prev.cli_codigo, prev.for_codigo,
        c.cli_nome, c.cli_fantasia, c.cli_nomred,
        f.for_nome AS industria_nome, f.for_nomered AS industria_nomered,
        prev.valor AS valor_anterior, prev.quantidade AS quantidade_anterior
      FROM crm_sellout prev
      LEFT JOIN clientes c ON prev.cli_codigo = c.cli_codigo
      LEFT JOIN fornecedores f ON prev.for_codigo = f.for_codigo
      WHERE prev.periodo = $1
        ${industriaFilter}
        AND NOT EXISTS (
          SELECT 1 FROM crm_sellout curr
          WHERE curr.cli_codigo = prev.cli_codigo
            AND curr.for_codigo = prev.for_codigo
            AND curr.periodo = $2
        )
      ORDER BY c.cli_nomred, f.for_nomered
    `, params);

    res.json({ success: true, data: result.rows, currentPeriod: currentStr, previousPeriod: previousStr });
  } catch (error: any) {
    console.error('❌ [SELLOUT] pendencies:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellout/stats ───────────────────────────────────────────────────
export async function sellOutStatsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;

    const currentPeriod  = new Date();
    const previousPeriod = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() - 1, 1);
    const currentStr  = `${currentPeriod.getFullYear()}-${String(currentPeriod.getMonth() + 1).padStart(2, '0')}-01`;
    const previousStr = `${previousPeriod.getFullYear()}-${String(previousPeriod.getMonth() + 1).padStart(2, '0')}-01`;

    const [currRes, prevRes, pendRes] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(valor), 0) AS total_valor,
          COUNT(DISTINCT cli_codigo) AS total_clientes,
          COUNT(DISTINCT for_codigo) AS total_industrias
        FROM crm_sellout WHERE periodo = $1
      `, [currentStr]),
      db.query(`
        SELECT COALESCE(SUM(valor), 0) AS total_valor FROM crm_sellout WHERE periodo = $1
      `, [previousStr]),
      db.query(`
        SELECT COUNT(*) AS total
        FROM crm_sellout prev
        WHERE prev.periodo = $1
          AND NOT EXISTS (
            SELECT 1 FROM crm_sellout curr
            WHERE curr.cli_codigo = prev.cli_codigo
              AND curr.for_codigo = prev.for_codigo
              AND curr.periodo = $2
          )
      `, [previousStr, currentStr]),
    ]);

    const curr     = currRes.rows[0];
    const prevVal  = parseFloat(prevRes.rows[0].total_valor);
    const currVal  = parseFloat(curr.total_valor);
    const growth   = prevVal > 0 ? ((currVal - prevVal) / prevVal) * 100 : null;

    res.json({
      success: true,
      data: {
        total_valor:       currVal,
        total_clientes:    parseInt(curr.total_clientes),
        total_industrias:  parseInt(curr.total_industrias),
        pendencias:        parseInt(pendRes.rows[0].total),
        crescimento:       growth,
      },
    });
  } catch (error: any) {
    console.error('❌ [SELLOUT] stats:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/sellout/ranking ─────────────────────────────────────────────────
export async function sellOutRankingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { periodo, by } = req.query as any; // by: 'client' | 'industry'

    const currentStr = periodo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    let query: string;
    if (by === 'industry') {
      query = `
        SELECT
          s.for_codigo AS id,
          COALESCE(f.for_nomered, f.for_nome) AS nome,
          SUM(s.valor) AS total_valor,
          SUM(s.quantidade) AS total_quantidade,
          COUNT(DISTINCT s.cli_codigo) AS total_clientes
        FROM crm_sellout s
        LEFT JOIN fornecedores f ON s.for_codigo = f.for_codigo
        WHERE s.periodo = $1
        GROUP BY s.for_codigo, f.for_nomered, f.for_nome
        ORDER BY total_valor DESC
        LIMIT 10
      `;
    } else {
      query = `
        SELECT
          s.cli_codigo AS id,
          COALESCE(c.cli_nomred, c.cli_fantasia, c.cli_nome) AS nome,
          SUM(s.valor) AS total_valor,
          SUM(s.quantidade) AS total_quantidade,
          COUNT(DISTINCT s.for_codigo) AS total_industrias
        FROM crm_sellout s
        LEFT JOIN clientes c ON s.cli_codigo = c.cli_codigo
        WHERE s.periodo = $1
        GROUP BY s.cli_codigo, c.cli_nomred, c.cli_fantasia, c.cli_nome
        ORDER BY total_valor DESC
        LIMIT 10
      `;
    }

    const result = await db.query(query, [currentStr]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [SELLOUT] ranking:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/sellout ────────────────────────────────────────────────────────
export async function createSellOutHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { cli_codigo, for_codigo, periodo, valor, quantidade } = req.body;

    if (!cli_codigo || !for_codigo || !periodo) {
      res.status(400).json({ success: false, message: 'Cliente, indústria e período são obrigatórios.' });
      return;
    }

    // Normalize periodo to YYYY-MM-01
    let periodoDate = periodo;
    if (/^\d{4}-\d{2}$/.test(periodo)) periodoDate = `${periodo}-01`;

    const result = await db.query(`
      INSERT INTO crm_sellout (cli_codigo, for_codigo, periodo, valor, quantidade)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cli_codigo, for_codigo, periodo)
      DO UPDATE SET
        valor      = crm_sellout.valor      + $4,
        quantidade = crm_sellout.quantidade + $5,
        criado_em  = NOW()
      RETURNING *, (xmax <> 0) AS acumulado
    `, [cli_codigo, for_codigo, periodoDate, valor || 0, quantidade || 0]);

    res.json({ success: true, data: result.rows[0], acumulado: result.rows[0].acumulado });
  } catch (error: any) {
    console.error('❌ [SELLOUT] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/sellout/:id ─────────────────────────────────────────────────────
export async function updateSellOutHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { valor, quantidade } = req.body;

    await db.query(`
      UPDATE crm_sellout SET valor = $1, quantidade = $2 WHERE id = $3
    `, [valor || 0, quantidade || 0, id]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [SELLOUT] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/sellout/:id ──────────────────────────────────────────────────
export async function deleteSellOutHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    await db.query(`DELETE FROM crm_sellout WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [SELLOUT] delete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/sellout/import ─────────────────────────────────────────────────
// Batch upsert from Excel import
export async function importSellOutHandler(req: Request, res: Response): Promise<void> {
  const schema = (req as any).schema as string;
  if (!schema) { res.status(400).json({ success: false, message: 'Schema não identificado.' }); return; }

  const client = await pool.connect();
  try {
    const { rows } = req.body as { rows: Array<{ cli_codigo: number; for_codigo: number; periodo: string; valor: number; quantidade?: number }> };

    if (!rows || !rows.length) {
      res.status(400).json({ success: false, message: 'Nenhum registro para importar.' });
      return;
    }

    await client.query(`SET search_path TO "${schema}", public`);
    await client.query('BEGIN');

    let imported = 0;
    let errors = 0;
    const errorList: string[] = [];

    for (const row of rows) {
      try {
        if (!row.cli_codigo || !row.for_codigo || !row.periodo) {
          errors++;
          errorList.push(`Linha inválida: cli=${row.cli_codigo}, ind=${row.for_codigo}, per=${row.periodo}`);
          continue;
        }

        // Normalize periodo
        let periodoDate = row.periodo;
        if (/^\d{4}-\d{2}$/.test(periodoDate)) periodoDate = `${periodoDate}-01`;
        else if (/^\d{2}\/\d{4}$/.test(periodoDate)) {
          const [mm, yyyy] = periodoDate.split('/');
          periodoDate = `${yyyy}-${mm}-01`;
        }

        await client.query(`
          INSERT INTO crm_sellout (cli_codigo, for_codigo, periodo, valor, quantidade)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (cli_codigo, for_codigo, periodo)
          DO UPDATE SET
            valor      = crm_sellout.valor      + $4,
            quantidade = crm_sellout.quantidade + $5,
            criado_em  = NOW()
        `, [row.cli_codigo, row.for_codigo, periodoDate, row.valor || 0, row.quantidade || 0]);
        imported++;
      } catch (e: any) {
        errors++;
        errorList.push(e.message);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, imported, errors, errorList });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [SELLOUT] import:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await client.query(`RESET search_path`);
    client.release();
  }
}
