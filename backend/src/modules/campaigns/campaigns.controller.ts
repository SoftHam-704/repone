import { Request, Response } from 'express';

// ─── Helper: dias úteis (seg-sab) ────────────────────────────────────────────
function getBusinessDays(start: string, end: string): number {
  const s = new Date(start), e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
export async function listCampaignsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { search } = req.query as any;

    let query = `
      SELECT
        c.*,
        cli.cli_nome, cli.cli_fantasia, cli.cli_nomred,
        f.for_nome AS industria_nome, f.for_nomered AS industria_nomered
      FROM campanhas_promocionais c
      LEFT JOIN clientes cli ON c.cmp_cliente_id = cli.cli_codigo
      LEFT JOIN fornecedores f ON c.cmp_industria_id = f.for_codigo
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE (c.cmp_descricao ILIKE $1 OR cli.cli_nomred ILIKE $1 OR cli.cli_fantasia ILIKE $1 OR f.for_nomered ILIKE $1 OR f.for_nome ILIKE $1)`;
    }

    query += ` ORDER BY c.cmp_codigo DESC`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [CAMPAIGNS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/campaigns/simulate ────────────────────────────────────────────
export async function simulateCampaignHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { client_id, industry_id, base_start, base_end, campaign_start, campaign_end, growth_percent } = req.body;

    if (!client_id || !industry_id || !base_start || !base_end) {
      res.status(400).json({ success: false, message: 'Dados insuficientes para simulação.' });
      return;
    }

    const cliId = parseInt(String(client_id));
    const indId = parseInt(String(industry_id));
    if (isNaN(cliId) || isNaN(indId)) {
      res.status(400).json({ success: false, message: 'client_id e industry_id devem ser numéricos.' });
      return;
    }

    const histRes = await db.query(`
      SELECT
        COALESCE(ROUND(SUM(i.ite_totliquido::NUMERIC), 2), 0) AS total_value,
        COALESCE(SUM(i.ite_quant), 0)                         AS total_qty
      FROM itens_ped i
      JOIN pedidos p ON i.ite_pedido = p.ped_pedido
      WHERE p.ped_cliente   = $1
        AND i.ite_industria = $2
        AND p.ped_data BETWEEN $3::DATE AND $4::DATE
        AND p.ped_situacao IN ('P', 'F')
    `, [cliId, indId, base_start, base_end]);

    const row = histRes.rows[0] || { total_value: 0, total_qty: 0 };
    const baseValue = parseFloat(String(row.total_value)) || 0;
    const baseQty   = parseFloat(String(row.total_qty))   || 0;

    const baseDays = getBusinessDays(base_start, base_end);
    const campDays = campaign_start && campaign_end ? getBusinessDays(campaign_start, campaign_end) : baseDays;

    const dailyAvgVal  = baseDays > 0 ? baseValue / baseDays : 0;
    const dailyAvgQty  = baseDays > 0 ? baseQty  / baseDays : 0;
    const growthFactor = 1 + (parseFloat(String(growth_percent || 0)) / 100);

    res.json({
      success: true,
      data: {
        base: {
          days: baseDays, total_value: baseValue, total_qty: baseQty,
          daily_avg_value: dailyAvgVal, daily_avg_qty: dailyAvgQty,
        },
        projection: {
          days: campDays,
          growth_percent:    parseFloat(String(growth_percent || 0)),
          target_daily_value: dailyAvgVal * growthFactor,
          target_daily_qty:   dailyAvgQty * growthFactor,
          target_total_value: dailyAvgVal * growthFactor * campDays,
          target_total_qty:   dailyAvgQty * growthFactor * campDays,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [CAMPAIGNS] simulate:', error.message, error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/campaigns/sellout-coverage?cliente=&industria= ─────────────────
// Cobertura de sell-out do par (cliente×indústria) p/ a tela decidir a base de
// apuração padrão (D5) e avisar quando não há reporte (D6).
export async function selloutCoverageHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { cliente, industria } = req.query as any;
    const cli = parseInt(String(cliente));
    const ind = parseInt(String(industria));
    if (isNaN(cli) || isNaN(ind)) {
      res.status(400).json({ success: false, message: 'cliente e industria são obrigatórios.' });
      return;
    }

    const r = await db.query(`
      SELECT
        COUNT(*)                                                                          AS total,
        COUNT(*) FILTER (
          WHERE periodo >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months')
        )                                                                                  AS recentes,
        MAX(periodo)                                                                       AS ultimo_periodo
      FROM crm_sellout
      WHERE cli_codigo = $1 AND for_codigo = $2
    `, [cli, ind]);

    const row      = r.rows[0] || {};
    const recentes = parseInt(row.recentes) || 0;
    res.json({ success: true, data: {
      total:          parseInt(row.total) || 0,
      recentes,
      ultimo_periodo: row.ultimo_periodo || null,
      tem_cobertura:  recentes > 0,
      sugestao_base:  recentes > 0 ? 'SELL_OUT' : 'SELL_IN',
    }});
  } catch (error: any) {
    console.error('❌ [CAMPAIGNS] sellout-coverage:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
export async function createCampaignHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const {
      cmp_descricao, cmp_cliente_id, cmp_industria_id, cmp_promotor_id,
      cmp_periodo_base_ini, cmp_periodo_base_fim, cmp_campanha_ini, cmp_campanha_fim,
      cmp_perc_crescimento, simulation_data, cmp_observacao,
      cmp_setor, cmp_regiao, cmp_equipe_vendas, cmp_verba_solicitada,
      cmp_tema, cmp_tipo_periodo, cmp_tipo, cmp_base_apuracao,
      cmp_meta_qtd_total: cmp_meta_qtd_direct,
    } = req.body;

    const base       = simulation_data?.base       || {};
    const projection = simulation_data?.projection || {};
    // Critério de apuração gravado NA campanha (D4). MIX só existe em sell-in (D3).
    const baseApuracao =
      cmp_tipo === 'MIX'             ? 'SELL_IN'
      : cmp_base_apuracao === 'SELL_OUT' ? 'SELL_OUT'
      : 'SELL_IN';

    const result = await db.query(`
      INSERT INTO campanhas_promocionais (
        cmp_descricao, cmp_cliente_id, cmp_industria_id, cmp_promotor_id,
        cmp_periodo_base_ini, cmp_periodo_base_fim, cmp_campanha_ini, cmp_campanha_fim,
        cmp_base_dias_kpi, cmp_base_valor_total, cmp_base_qtd_total,
        cmp_base_media_diaria_val, cmp_base_media_diaria_qtd,
        cmp_perc_crescimento,
        cmp_meta_valor_total, cmp_meta_qtd_total, cmp_meta_diaria_val, cmp_meta_diaria_qtd,
        cmp_observacao, cmp_setor, cmp_regiao, cmp_equipe_vendas,
        cmp_verba_solicitada, cmp_tema, cmp_tipo_periodo, cmp_tipo, cmp_base_apuracao
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      ) RETURNING cmp_codigo
    `, [
      cmp_descricao, cmp_cliente_id, cmp_industria_id, cmp_promotor_id || null,
      cmp_periodo_base_ini || null, cmp_periodo_base_fim || null,
      cmp_campanha_ini || null, cmp_campanha_fim || null,
      base.days || 0, base.total_value || 0, base.total_qty || 0,
      base.daily_avg_value || 0, base.daily_avg_qty || 0,
      cmp_perc_crescimento || 0,
      projection.target_total_value || 0,
      projection.target_total_qty || cmp_meta_qtd_direct || 0,
      projection.target_daily_value || 0, projection.target_daily_qty || 0,
      cmp_observacao || '', cmp_setor || '', cmp_regiao || '', cmp_equipe_vendas || 0,
      cmp_verba_solicitada || 0, cmp_tema || '', cmp_tipo_periodo || 'TRIMESTRAL',
      cmp_tipo || 'CRESCIMENTO', baseApuracao,
    ]);

    res.json({ success: true, message: 'Campanha criada com sucesso!', id: result.rows[0].cmp_codigo });
  } catch (error: any) {
    console.error('❌ [CAMPAIGNS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/campaigns/:id ───────────────────────────────────────────────────
export async function updateCampaignHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const {
      cmp_descricao, cmp_cliente_id, cmp_industria_id, cmp_promotor_id,
      cmp_periodo_base_ini, cmp_periodo_base_fim, cmp_campanha_ini, cmp_campanha_fim,
      cmp_perc_crescimento, cmp_observacao, cmp_status,
      cmp_setor, cmp_regiao, cmp_equipe_vendas, cmp_verba_solicitada,
      cmp_tema, cmp_tipo_periodo, cmp_justificativa, cmp_premiacoes,
      cmp_real_valor_total, cmp_real_qtd_total, cmp_tipo,
      cmp_meta_qtd_total, cmp_base_apuracao,
    } = req.body;

    const baseApuracaoIn =
      cmp_base_apuracao === 'SELL_OUT' || cmp_base_apuracao === 'SELL_IN' ? cmp_base_apuracao : null;

    await db.query(`
      UPDATE campanhas_promocionais SET
        cmp_descricao          = COALESCE($1,  cmp_descricao),
        cmp_cliente_id         = COALESCE($2,  cmp_cliente_id),
        cmp_industria_id       = COALESCE($3,  cmp_industria_id),
        cmp_promotor_id        = $4,
        cmp_periodo_base_ini   = COALESCE($5,  cmp_periodo_base_ini),
        cmp_periodo_base_fim   = COALESCE($6,  cmp_periodo_base_fim),
        cmp_campanha_ini       = COALESCE($7,  cmp_campanha_ini),
        cmp_campanha_fim       = COALESCE($8,  cmp_campanha_fim),
        cmp_perc_crescimento   = COALESCE($9,  cmp_perc_crescimento),
        cmp_observacao         = $10,
        cmp_status             = COALESCE($11, cmp_status),
        cmp_setor              = COALESCE($12, cmp_setor),
        cmp_regiao             = COALESCE($13, cmp_regiao),
        cmp_equipe_vendas      = COALESCE($14, cmp_equipe_vendas),
        cmp_verba_solicitada   = COALESCE($15, cmp_verba_solicitada),
        cmp_tema               = COALESCE($16, cmp_tema),
        cmp_tipo_periodo       = COALESCE($17, cmp_tipo_periodo),
        cmp_justificativa      = $18,
        cmp_premiacoes         = $19,
        cmp_real_valor_total   = COALESCE($20, cmp_real_valor_total),
        cmp_real_qtd_total     = COALESCE($21, cmp_real_qtd_total),
        cmp_tipo               = COALESCE($22, cmp_tipo),
        cmp_meta_qtd_total     = COALESCE($23, cmp_meta_qtd_total),
        -- só pode mudar o critério enquanto SIMULACAO e nunca em MIX (D3/D7)
        cmp_base_apuracao      = CASE
                                   WHEN cmp_status = 'SIMULACAO' AND COALESCE($22, cmp_tipo) <> 'MIX'
                                     THEN COALESCE($24, cmp_base_apuracao)
                                   ELSE cmp_base_apuracao
                                 END,
        cmp_data_atualizacao   = NOW()
      WHERE cmp_codigo = $25
    `, [
      cmp_descricao, cmp_cliente_id, cmp_industria_id, cmp_promotor_id || null,
      cmp_periodo_base_ini, cmp_periodo_base_fim, cmp_campanha_ini, cmp_campanha_fim,
      cmp_perc_crescimento, cmp_observacao, cmp_status,
      cmp_setor, cmp_regiao, cmp_equipe_vendas, cmp_verba_solicitada,
      cmp_tema, cmp_tipo_periodo, cmp_justificativa, cmp_premiacoes,
      cmp_real_valor_total, cmp_real_qtd_total,
      cmp_tipo || null, cmp_meta_qtd_total || null, baseApuracaoIn,
      id,
    ]);

    res.json({ success: true, message: 'Campanha atualizada com sucesso!' });
  } catch (error: any) {
    console.error('❌ [CAMPAIGNS] update:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/campaigns/:id/auto-progress ────────────────────────────────────
export async function autoProgressHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;

    const campRes = await db.query(`
      SELECT cmp_tipo, cmp_base_apuracao, cmp_cliente_id, cmp_industria_id,
             cmp_campanha_ini, cmp_campanha_fim,
             cmp_meta_valor_total, cmp_meta_qtd_total
      FROM campanhas_promocionais WHERE cmp_codigo = $1
    `, [id]);

    if (!campRes.rows.length) {
      res.status(404).json({ success: false, message: 'Campanha não encontrada.' });
      return;
    }

    const camp = campRes.rows[0];
    const tipo: string = camp.cmp_tipo || 'CRESCIMENTO';
    // MIX sempre cai em sell-in: o sell-out atual é agregado, não tem família (decisão D3).
    const base: 'SELL_OUT' | 'SELL_IN' =
      tipo === 'MIX' ? 'SELL_IN' : (camp.cmp_base_apuracao === 'SELL_OUT' ? 'SELL_OUT' : 'SELL_IN');
    const useSellOut = base === 'SELL_OUT';

    if (!camp.cmp_campanha_ini || !camp.cmp_campanha_fim) {
      res.json({ success: true, data: {
        realizado: 0, meta: 0, progress_pct: 0, elapsed_pct: 0, behind: false,
        tipo, base_apuracao: base, label: '',
        sell_in: 0, sell_out: 0, sell_through: null, sem_reporte: false,
      } });
      return;
    }

    const cli = camp.cmp_cliente_id;
    const ind = camp.cmp_industria_id;
    const ini = camp.cmp_campanha_ini;
    const fim = camp.cmp_campanha_fim;

    // ── Dual-view (sempre): comprou (sell-in R$) · vendeu (sell-out R$) · giro ──
    const sellInValRes = await db.query(`
      SELECT COALESCE(ROUND(SUM(i.ite_totliquido::NUMERIC), 2), 0) AS v
      FROM itens_ped i
      JOIN pedidos p ON i.ite_pedido = p.ped_pedido
      WHERE p.ped_cliente = $1 AND i.ite_industria = $2
        AND p.ped_data BETWEEN $3::DATE AND $4::DATE
        AND p.ped_situacao IN ('P', 'F')
    `, [cli, ind, ini, fim]);
    const sellOutValRes = await db.query(`
      SELECT COALESCE(ROUND(SUM(s.valor)::NUMERIC, 2), 0) AS v, COUNT(*) AS meses
      FROM crm_sellout s
      WHERE s.cli_codigo = $1 AND s.for_codigo = $2
        AND s.periodo >= DATE_TRUNC('month', $3::DATE)
        AND s.periodo <= DATE_TRUNC('month', $4::DATE)
    `, [cli, ind, ini, fim]);

    const sell_in       = parseFloat(sellInValRes.rows[0].v) || 0;
    const sell_out      = parseFloat(sellOutValRes.rows[0].v) || 0;
    const selloutMeses  = parseInt(sellOutValRes.rows[0].meses) || 0;
    const sell_through  = sell_in > 0 ? Math.round((sell_out / sell_in) * 1000) / 10 : null;

    let realizado = 0;
    let meta = 0;
    let label = '';

    if (tipo === 'CRESCIMENTO') {
      realizado = useSellOut ? sell_out : sell_in;
      meta = parseFloat(String(camp.cmp_meta_valor_total)) || 0;
      label = useSellOut ? 'R$ vendido na ponta (sell-out)' : 'R$ comprado (sell-in)';
    } else if (tipo === 'VOLUME') {
      if (useSellOut) {
        const r = await db.query(`
          SELECT COALESCE(SUM(s.quantidade), 0) AS realizado
          FROM crm_sellout s
          WHERE s.cli_codigo = $1 AND s.for_codigo = $2
            AND s.periodo >= DATE_TRUNC('month', $3::DATE)
            AND s.periodo <= DATE_TRUNC('month', $4::DATE)
        `, [cli, ind, ini, fim]);
        realizado = parseFloat(r.rows[0].realizado) || 0;
      } else {
        const r = await db.query(`
          SELECT COALESCE(SUM(i.ite_quant), 0) AS realizado
          FROM itens_ped i
          JOIN pedidos p ON i.ite_pedido = p.ped_pedido
          WHERE p.ped_cliente = $1 AND i.ite_industria = $2
            AND p.ped_data BETWEEN $3::DATE AND $4::DATE
            AND p.ped_situacao IN ('P', 'F')
        `, [cli, ind, ini, fim]);
        realizado = parseFloat(r.rows[0].realizado) || 0;
      }
      meta = parseFloat(String(camp.cmp_meta_qtd_total)) || 0;
      label = useSellOut ? 'unidades vendidas (sell-out)' : 'unidades compradas (sell-in)';
    } else if (tipo === 'POSITIVACAO') {
      if (useSellOut) {
        const r = await db.query(`
          SELECT COUNT(*) AS realizado
          FROM crm_sellout s
          WHERE s.cli_codigo = $1 AND s.for_codigo = $2
            AND s.periodo >= DATE_TRUNC('month', $3::DATE)
            AND s.periodo <= DATE_TRUNC('month', $4::DATE)
            AND s.valor > 0
        `, [cli, ind, ini, fim]);
        realizado = parseFloat(r.rows[0].realizado) || 0;
      } else {
        const r = await db.query(`
          SELECT COUNT(DISTINCT DATE_TRUNC('month', p.ped_data)) AS realizado
          FROM pedidos p
          JOIN itens_ped i ON i.ite_pedido = p.ped_pedido
          WHERE p.ped_cliente = $1 AND i.ite_industria = $2
            AND p.ped_data BETWEEN $3::DATE AND $4::DATE
            AND p.ped_situacao IN ('P', 'F')
        `, [cli, ind, ini, fim]);
        realizado = parseFloat(r.rows[0].realizado) || 0;
      }
      meta = parseFloat(String(camp.cmp_meta_qtd_total)) || 0;
      label = useSellOut ? 'meses com venda (sell-out)' : 'meses com pedido (sell-in)';
    } else if (tipo === 'MIX') {
      const r = await db.query(`
        SELECT COUNT(DISTINCT pr.pro_grupo) AS realizado
        FROM itens_ped i
        JOIN pedidos p  ON i.ite_pedido  = p.ped_pedido
        JOIN produtos pr ON pr.pro_codigo = i.ite_produto
        WHERE p.ped_cliente = $1 AND i.ite_industria = $2
          AND p.ped_data BETWEEN $3::DATE AND $4::DATE
          AND p.ped_situacao IN ('P', 'F')
          AND pr.pro_grupo IS NOT NULL AND pr.pro_grupo <> ''
      `, [cli, ind, ini, fim]);
      realizado = parseFloat(r.rows[0].realizado) || 0;
      meta = parseFloat(String(camp.cmp_meta_qtd_total)) || 0;
      label = 'famílias compradas (sell-in)';
    }

    // Campanha por sell-out, mas o par não reportou nada na janela → aguardando reporte
    // (não é "0%" — é falta de dado; ver decisão D6 / cobertura).
    const sem_reporte = useSellOut && selloutMeses === 0;

    const progress_pct = meta > 0 ? Math.min(100, (realizado / meta) * 100) : 0;

    const now      = new Date();
    const startDt  = new Date(camp.cmp_campanha_ini);
    const endDt    = new Date(camp.cmp_campanha_fim);
    const totalMs  = endDt.getTime() - startDt.getTime();
    const elapsedMs = Math.max(0, now.getTime() - startDt.getTime());
    const elapsed_pct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;

    // Sem reporte não dispara alerta de atraso — não dá pra julgar ritmo sem dado.
    const behind = !sem_reporte && elapsed_pct > 15 && progress_pct < elapsed_pct * 0.75;

    res.json({ success: true, data: {
      realizado, meta, progress_pct, elapsed_pct, behind, tipo,
      base_apuracao: base, label,
      sell_in, sell_out, sell_through, sem_reporte,
    } });
  } catch (error: any) {
    console.error('❌ [CAMPAIGNS] auto-progress:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/campaigns/:id/tracking ─────────────────────────────────────────
export async function getTrackingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT * FROM campanhas_tracking WHERE tra_campanha_id = $1 ORDER BY tra_data DESC, tra_id DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/campaigns/:id/tracking ────────────────────────────────────────
export async function addTrackingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { id } = req.params;
    const { tra_data, tra_vlr_acumulado, tra_qtd_acumulada, tra_observacao } = req.body;

    const result = await db.query(`
      INSERT INTO campanhas_tracking (tra_campanha_id, tra_data, tra_vlr_acumulado, tra_qtd_acumulada, tra_observacao)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [id, tra_data || new Date().toISOString().split('T')[0], tra_vlr_acumulado || 0, tra_qtd_acumulada || 0, tra_observacao || '']);

    await db.query(`
      UPDATE campanhas_promocionais
      SET cmp_real_valor_total = $1, cmp_real_qtd_total = $2, cmp_data_atualizacao = NOW()
      WHERE cmp_codigo = $3
    `, [tra_vlr_acumulado || 0, tra_qtd_acumulada || 0, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/campaigns/tracking/:tid ─────────────────────────────────────
export async function deleteTrackingHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { tid } = req.params;

    const trackRes = await db.query(`SELECT tra_campanha_id FROM campanhas_tracking WHERE tra_id = $1`, [tid]);
    if (!trackRes.rows.length) { res.status(404).json({ success: false, message: 'Log não encontrado.' }); return; }

    const campId = trackRes.rows[0].tra_campanha_id;
    await db.query(`DELETE FROM campanhas_tracking WHERE tra_id = $1`, [tid]);

    const latest = await db.query(`
      SELECT tra_vlr_acumulado, tra_qtd_acumulada FROM campanhas_tracking
      WHERE tra_campanha_id = $1 ORDER BY tra_data DESC, tra_id DESC LIMIT 1
    `, [campId]);

    const latestVal = latest.rows[0]?.tra_vlr_acumulado || 0;
    const latestQtd = latest.rows[0]?.tra_qtd_acumulada || 0;

    await db.query(`
      UPDATE campanhas_promocionais
      SET cmp_real_valor_total = $1, cmp_real_qtd_total = $2, cmp_data_atualizacao = NOW()
      WHERE cmp_codigo = $3
    `, [latestVal, latestQtd, campId]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
