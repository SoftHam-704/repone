import { Request, Response } from 'express';
import { getLinkedSellerId } from '../../shared/permissions';

// ─── GET /api/itinerarios ─────────────────────────────────────────────────────
export async function listItinerariosHandler(req: Request, res: Response): Promise<void> {
  try {
    const { search, vendedor } = req.query;
    const db = req.db!;
    const params: any[] = [];
    let query = `
      SELECT i.iti_codigo, i.iti_descricao, i.iti_frequencia, i.iti_observacao,
             i.iti_vendedor_id, i.iti_regiao_id,
             v.ven_nome AS vendedor_nome,
             r.reg_descricao AS regiao_nome,
             COUNT(p.itp_codigo) AS total_paradas
      FROM itinerarios i
      LEFT JOIN vendedores v ON v.ven_codigo = i.iti_vendedor_id
      LEFT JOIN regioes r ON r.reg_codigo = i.iti_regiao_id
      LEFT JOIN itinerario_paradas p ON p.itp_itinerario = i.iti_codigo
      WHERE 1=1`;

    // Auto-escopo: operador só vê as próprias rotas. Master/Gerência (sellerId null) veem todas.
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) {
      params.push(sellerId);
      query += ` AND i.iti_vendedor_id = $${params.length}`;
    } else if (vendedor) {
      // Master/Gerência podem filtrar explicitamente (uso do web).
      params.push(vendedor);
      query += ` AND i.iti_vendedor_id = $${params.length}`;
    }

    if (search) { params.push(`%${search}%`); query += ` AND i.iti_descricao ILIKE $${params.length}`; }
    query += ` GROUP BY i.iti_codigo, v.ven_nome, r.reg_descricao ORDER BY i.iti_descricao`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [ITINERARIOS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/itinerarios/:id ─────────────────────────────────────────────────
export async function getItinerarioHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) {
      const own = await db.query(
        'SELECT 1 FROM itinerarios WHERE iti_codigo = $1 AND iti_vendedor_id = $2',
        [parseInt(String(req.params.id)), sellerId]
      );
      if (!own.rows.length) { res.status(403).json({ success: false, message: 'Acesso negado a esta rota.' }); return; }
    }
    const result = await db.query(
      `SELECT i.iti_codigo, i.iti_descricao, i.iti_frequencia, i.iti_observacao,
              i.iti_vendedor_id, i.iti_regiao_id,
              v.ven_nome AS vendedor_nome, r.reg_descricao AS regiao_nome
       FROM itinerarios i
       LEFT JOIN vendedores v ON v.ven_codigo = i.iti_vendedor_id
       LEFT JOIN regioes r ON r.reg_codigo = i.iti_regiao_id
       WHERE i.iti_codigo = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Itinerário não encontrado.' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/itinerarios ────────────────────────────────────────────────────
export async function createItinerarioHandler(req: Request, res: Response): Promise<void> {
  try {
    const { iti_descricao, iti_frequencia, iti_observacao, iti_vendedor_id, iti_regiao_id } = req.body;
    const db = req.db!;
    if (!iti_descricao?.trim()) { res.status(400).json({ success: false, message: 'Nome do itinerário é obrigatório.' }); return; }
    const result = await db.query(
      `INSERT INTO itinerarios (iti_descricao, iti_frequencia, iti_observacao, iti_vendedor_id, iti_regiao_id) VALUES ($1, $2, $3, $4, $5) RETURNING iti_codigo`,
      [iti_descricao.trim(), iti_frequencia || null, iti_observacao?.trim() || null, iti_vendedor_id || null, iti_regiao_id || null]
    );
    res.json({ success: true, message: 'Itinerário criado com sucesso!', id: result.rows[0].iti_codigo });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/itinerarios/:id ─────────────────────────────────────────────────
export async function updateItinerarioHandler(req: Request, res: Response): Promise<void> {
  try {
    const { iti_descricao, iti_frequencia, iti_observacao, iti_vendedor_id, iti_regiao_id } = req.body;
    const db = req.db!;
    if (!iti_descricao?.trim()) { res.status(400).json({ success: false, message: 'Nome do itinerário é obrigatório.' }); return; }
    await db.query(
      `UPDATE itinerarios SET iti_descricao=$1, iti_frequencia=$2, iti_observacao=$3, iti_vendedor_id=$4, iti_regiao_id=$5 WHERE iti_codigo=$6`,
      [iti_descricao.trim(), iti_frequencia || null, iti_observacao?.trim() || null, iti_vendedor_id || null, iti_regiao_id || null, parseInt(String(req.params.id))]
    );
    res.json({ success: true, message: 'Itinerário atualizado com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/itinerarios/:id ──────────────────────────────────────────────
export async function deleteItinerarioHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const result = await db.query(
      `DELETE FROM itinerarios WHERE iti_codigo=$1 RETURNING iti_codigo`,
      [parseInt(String(req.params.id))]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Itinerário não encontrado.' }); return; }
    res.json({ success: true, message: 'Itinerário excluído com sucesso!' });
  } catch (error: any) {
    if (error.code === '23503') { res.status(400).json({ success: false, message: 'Itinerário em uso.' }); return; }
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/itinerarios/:id/paradas ─────────────────────────────────────────
export async function listParadasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const itinId = parseInt(String(req.params.id));
    // Operador só acessa paradas das próprias rotas (master/gerência: sellerId null = acesso total)
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) {
      const own = await db.query(
        'SELECT 1 FROM itinerarios WHERE iti_codigo = $1 AND iti_vendedor_id = $2',
        [itinId, sellerId]
      );
      if (!own.rows.length) { res.status(403).json({ success: false, message: 'Acesso negado a esta rota.' }); return; }
    }
    const result = await db.query(
      `SELECT p.itp_codigo, p.itp_ordem, p.itp_obs,
              c.cli_codigo, c.cli_nomred AS cli_nome, c.cli_fantasia,
              c.cli_endereco, c.cli_endnum, c.cli_bairro, c.cli_cidade, c.cli_uf, c.cli_cep,
              COALESCE(c.cli_latitude,  cid.cid_latitude)  AS cli_latitude,
              COALESCE(c.cli_longitude, cid.cid_longitude) AS cli_longitude,
              (c.cli_latitude IS NOT NULL) AS gps_real,
              c.cli_fone1
       FROM itinerario_paradas p
       INNER JOIN clientes c ON c.cli_codigo = p.itp_cliente
       LEFT  JOIN public.cidades cid ON cid.cid_codigo = c.cli_idcidade
       WHERE p.itp_itinerario = $1
       ORDER BY p.itp_ordem, p.itp_codigo`,
      [itinId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/itinerarios/:id/paradas ────────────────────────────────────────
export async function addParadaHandler(req: Request, res: Response): Promise<void> {
  try {
    const { cli_codigo, itp_obs } = req.body;
    const db = req.db!;
    if (!cli_codigo) { res.status(400).json({ success: false, message: 'cli_codigo é obrigatório.' }); return; }
    // Get next order
    const orderRes = await db.query(
      `SELECT COALESCE(MAX(itp_ordem), 0) + 1 AS next_order FROM itinerario_paradas WHERE itp_itinerario = $1`,
      [parseInt(String(req.params.id))]
    );
    const nextOrder = orderRes.rows[0].next_order;
    await db.query(
      `INSERT INTO itinerario_paradas (itp_itinerario, itp_cliente, itp_ordem, itp_obs) VALUES ($1,$2,$3,$4)
       ON CONFLICT (itp_itinerario, itp_cliente) DO NOTHING`,
      [parseInt(String(req.params.id)), cli_codigo, nextOrder, itp_obs || null]
    );
    res.json({ success: true, message: 'Parada adicionada.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PUT /api/itinerarios/:id/paradas/reorder ─────────────────────────────────
// Body: { ordem: [cli_codigo, cli_codigo, ...] }
export async function reorderParadasHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ordem } = req.body; // array of cli_codigo in new order
    const db = req.db!;
    for (let i = 0; i < ordem.length; i++) {
      await db.query(
        `UPDATE itinerario_paradas SET itp_ordem=$1 WHERE itp_itinerario=$2 AND itp_cliente=$3`,
        [i + 1, parseInt(String(req.params.id)), ordem[i]]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/itinerarios/:id/paradas/:cliId ───────────────────────────────
export async function removeParadaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    await db.query(
      `DELETE FROM itinerario_paradas WHERE itp_itinerario=$1 AND itp_cliente=$2`,
      [parseInt(String(req.params.id)), parseInt(String(req.params.cliId))]
    );
    res.json({ success: true, message: 'Parada removida.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/itinerarios/clientes-rota ───────────────────────────────────────
// Busca clientes com coordenadas para montar rota
// Query: regiao, setor (bairro), cidade, search, vendedor
export async function clientesRotaHandler(req: Request, res: Response): Promise<void> {
  try {
    const { regiao, cidade, bairro, setor, search, vendedor } = req.query;
    const db = req.db!;
    const params: any[] = [];
    let query = `
      SELECT c.cli_codigo, c.cli_nomred AS cli_nome, c.cli_fantasia,
             c.cli_endereco, c.cli_endnum, c.cli_bairro, c.cli_cidade, c.cli_uf, c.cli_cep,
             COALESCE(c.cli_latitude,  cid.cid_latitude)  AS cli_latitude,
             COALESCE(c.cli_longitude, cid.cid_longitude) AS cli_longitude,
             (c.cli_latitude IS NOT NULL) AS gps_real,
             c.cli_fone1,
             c.cli_regiao2, c.cli_setor_id,
             r.reg_descricao AS regiao_nome,
             s.set_nome AS setor_nome
      FROM clientes c
      LEFT JOIN regioes r ON r.reg_codigo = c.cli_regiao2
      LEFT JOIN setores s ON s.set_codigo = c.cli_setor_id
      LEFT JOIN public.cidades cid ON cid.cid_codigo = c.cli_idcidade
      WHERE c.cli_tipopes = 'A'`;
    if (regiao) {
      params.push(regiao);
      const rIdx = params.length;
      // Inclui clientes com região atribuída OU cuja cidade pertence à região
      query += ` AND (c.cli_regiao2 = $${rIdx} OR c.cli_idcidade IN (SELECT cid_id FROM cidades_regioes WHERE reg_id = $${rIdx}))`;
    }
    if (setor)    { params.push(setor);          query += ` AND c.cli_setor_id = $${params.length}`; }
    if (cidade)   { params.push(`%${cidade}%`);  query += ` AND c.cli_cidade ILIKE $${params.length}`; }
    if (bairro)   { params.push(`%${bairro}%`);  query += ` AND c.cli_bairro ILIKE $${params.length}`; }
    if (vendedor) { params.push(vendedor);        query += ` AND c.cli_vendedor = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      const sIdx = params.length;
      query += ` AND (c.cli_nomred ILIKE $${sIdx} OR c.cli_fantasia ILIKE $${sIdx})`;
    }
    query += ` ORDER BY c.cli_cidade, s.set_nome NULLS LAST, c.cli_bairro, c.cli_nomred LIMIT 500`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
