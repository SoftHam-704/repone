import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { getLinkedSellerId } from '../../shared/permissions';

// ─── Upload do comprovante (disco, por schema) ───────────────────────────────
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
});
export const uploadComprovante = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// ─── GET /api/despesas ───────────────────────────────────────────────────────
export async function listDespesasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { vendedor, categoria, de, ate } = req.query;
    const params: any[] = [];
    let q = `
      SELECT d.desp_id, d.desp_vendedor, d.desp_data, d.desp_categoria, d.desp_valor,
             d.desp_descricao, d.desp_km, d.desp_comprovante, d.desp_criado_em,
             v.ven_nome AS vendedor_nome
      FROM despesas d
      LEFT JOIN vendedores v ON v.ven_codigo = d.desp_vendedor
      WHERE 1=1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); q += ` AND d.desp_vendedor = $${params.length}`; }
    else if (vendedor)    { params.push(vendedor); q += ` AND d.desp_vendedor = $${params.length}`; }
    if (categoria) { params.push(categoria); q += ` AND d.desp_categoria = $${params.length}`; }
    if (de)        { params.push(de);        q += ` AND d.desp_data >= $${params.length}`; }
    if (ate)       { params.push(ate);       q += ` AND d.desp_data <= $${params.length}`; }
    q += ` ORDER BY d.desp_data DESC, d.desp_id DESC`;
    const result = await db.query(q, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [DESPESAS] list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/despesas (multipart: comprovante opcional) ─────────────────────
export async function createDespesaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { desp_data, desp_categoria, desp_valor, desp_descricao, desp_km, desp_vendedor } = req.body;
    if (!desp_data || !desp_categoria || !desp_valor) {
      res.status(400).json({ success: false, message: 'Data, categoria e valor são obrigatórios.' });
      return;
    }
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    const venId = sellerId !== null ? sellerId : (desp_vendedor ? parseInt(String(desp_vendedor)) : null);
    if (venId === null) {
      res.status(400).json({ success: false, message: 'Vendedor não identificado para a despesa.' });
      return;
    }
    const comprovante = req.file ? req.file.filename : null;
    const result = await db.query(
      `INSERT INTO despesas
         (desp_vendedor, desp_data, desp_categoria, desp_valor, desp_descricao, desp_km, desp_comprovante)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING desp_id`,
      [venId, desp_data, desp_categoria, parseFloat(String(desp_valor).replace(',', '.')),
       desp_descricao || null, desp_km ? parseInt(String(desp_km)) : null, comprovante]
    );
    res.json({ success: true, message: 'Despesa lançada.', id: result.rows[0].desp_id });
  } catch (error: any) {
    console.error('❌ [DESPESAS] create:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── DELETE /api/despesas/:id ────────────────────────────────────────────────
export async function deleteDespesaHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const id = parseInt(String(req.params.id));
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    const params: any[] = [id];
    let q = `DELETE FROM despesas WHERE desp_id = $1`;
    if (sellerId !== null) { params.push(sellerId); q += ` AND desp_vendedor = $${params.length}`; }
    q += ` RETURNING desp_comprovante`;
    const result = await db.query(q, params);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Despesa não encontrada.' }); return; }
    const arq = result.rows[0].desp_comprovante;
    if (arq) {
      const fp = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public', arq);
      fs.promises.unlink(fp).catch(() => {});
    }
    res.json({ success: true, message: 'Despesa removida.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/despesas/relatorio ─────────────────────────────────────────────
export async function relatorioDespesasHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const { vendedor, de, ate } = req.query;
    const params: any[] = [];
    let where = ` WHERE 1=1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); where += ` AND desp_vendedor = $${params.length}`; }
    else if (vendedor)    { params.push(vendedor); where += ` AND desp_vendedor = $${params.length}`; }
    if (de)  { params.push(de);  where += ` AND desp_data >= $${params.length}`; }
    if (ate) { params.push(ate); where += ` AND desp_data <= $${params.length}`; }
    const porCat = await db.query(
      `SELECT desp_categoria, COUNT(*) AS qtd, COALESCE(SUM(desp_valor),0) AS total
       FROM despesas ${where} GROUP BY desp_categoria ORDER BY total DESC`, params);
    const totalRow = await db.query(
      `SELECT COALESCE(SUM(desp_valor),0) AS total, COUNT(*) AS qtd FROM despesas ${where}`, params);
    res.json({ success: true, data: { por_categoria: porCat.rows, total: totalRow.rows[0] } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/despesas/comprovante/:arquivo (servido autenticado) ─────────────
export async function comprovanteHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    const arquivo = path.basename(String(req.params.arquivo));
    const params: any[] = [arquivo];
    let q = `SELECT 1 FROM despesas WHERE desp_comprovante = $1`;
    const sellerId = await getLinkedSellerId(db, req.user?.userId);
    if (sellerId !== null) { params.push(sellerId); q += ` AND desp_vendedor = $${params.length}`; }
    q += ` LIMIT 1`;
    const ok = await db.query(q, params);
    if (!ok.rows.length) { res.status(404).json({ success: false, message: 'Comprovante não encontrado.' }); return; }
    const fp = path.join(process.cwd(), 'uploads', 'despesas', req.schema || 'public', arquivo);
    if (!fs.existsSync(fp)) { res.status(404).json({ success: false, message: 'Arquivo ausente.' }); return; }
    res.sendFile(fp);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
