import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../../config/database';
import { parseNFe, normCNPJ, normCod } from './nfe.parser';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Allocation {
  pedido:       string;
  ped_numero:   number;
  produto:      string;
  xProd:        string;
  qty_apply:    number;
  valor_apply:  number;   // qty_apply × vUnCom
  vUnCom:       number;
}

export interface OrderPreview {
  pedido:         string;
  ped_numero:     number;
  ped_data:       string;
  ped_totliq:     number;
  total_faturado: number;  // já faturado antes desta NF
  valor_nf:       number;  // quanto entra desta NF
  will_complete:  boolean; // ficará 'F' após esta NF?
  allocations:    Allocation[];
}

export interface ParseResult {
  nf: {
    nNF: string; serie: string; dhEmi: string; vNF: number;
    codPedidoInd: string;
  };
  industry: { for_codigo: number; for_nome: string; for_cgc: string } | null;
  client:   { cli_codigo: number; cli_nome: string; cli_cnpj: string } | null;
  orders:   OrderPreview[];
  unmatched_items: Array<{ cProd: string; xProd: string; qty_unmatched: number; reason: string }>;
  warnings: string[];
}

// ─── Helper: sync situação do pedido ─────────────────────────────────────────
async function syncStatus(client: any, pedido: string) {
  const sum = await client.query(
    `SELECT COALESCE(SUM(fat_valorfat),0) AS fat FROM fatura_ped WHERE TRIM(fat_pedido)=TRIM($1)`,
    [pedido]
  );
  const totalFat = parseFloat(sum.rows[0].fat);
  const ped = await client.query(
    `SELECT ped_totliq, ped_situacao FROM pedidos WHERE TRIM(ped_pedido)=TRIM($1)`,
    [pedido]
  );
  if (!ped.rows.length) return;
  const { ped_totliq, ped_situacao } = ped.rows[0];
  if (totalFat >= parseFloat(ped_totliq) && parseFloat(ped_totliq) > 0 && ped_situacao !== 'F') {
    await client.query(`UPDATE pedidos SET ped_situacao='F' WHERE TRIM(ped_pedido)=TRIM($1)`, [pedido]);
  }
}

// ─── POST /api/nfe/parse ──────────────────────────────────────────────────────
export async function parseNFeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { xml } = req.body as { xml: string };
    if (!xml) { res.status(400).json({ success: false, message: 'XML não enviado.' }); return; }

    const db = req.db!;
    const nfe = parseNFe(xml);
    const warnings: string[] = [];

    // ── 1. Encontrar indústria pelo CNPJ emitente ─────────────────────────
    const forRes = await db.query(
      `SELECT for_codigo, for_nome, for_nomered, for_cgc FROM fornecedores
       WHERE REPLACE(REPLACE(REPLACE(for_cgc,'.',''),'/',''),'-','') = $1 LIMIT 1`,
      [nfe.emitCNPJ]
    );
    if (!forRes.rows.length) {
      res.json({ success: false, message: `Indústria com CNPJ ${nfe.emitCNPJ} não encontrada no cadastro.` });
      return;
    }
    const industry = {
      for_codigo: forRes.rows[0].for_codigo,
      for_nome:   forRes.rows[0].for_nomered || forRes.rows[0].for_nome,
      for_cgc:    forRes.rows[0].for_cgc,
    };

    // ── 2. Encontrar cliente pelo CNPJ destinatário ───────────────────────
    const cliRes = await db.query(
      `SELECT cli_codigo, cli_nome, cli_nomred, cli_fantasia, cli_cnpj FROM clientes
       WHERE REPLACE(REPLACE(REPLACE(cli_cnpj,'.',''),'/',''),'-','') = $1 LIMIT 1`,
      [nfe.destCNPJ]
    );
    if (!cliRes.rows.length) {
      res.json({ success: false, message: `Cliente com CNPJ ${nfe.destCNPJ} não encontrado no cadastro.` });
      return;
    }
    const client = {
      cli_codigo: cliRes.rows[0].cli_codigo,
      cli_nome:   cliRes.rows[0].cli_nomred || cliRes.rows[0].cli_fantasia || cliRes.rows[0].cli_nome,
      cli_cnpj:   cliRes.rows[0].cli_cnpj,
    };

    // ── 3. Buscar pedidos abertos deste cliente+indústria ─────────────────
    // Estratégia de match:
    //   a) ped_pedcli ou ped_oc = xPed (OC do cliente no item)
    //   b) ped_pedindustria = codPedidoInd (número da NF na indústria)
    //   c) fallback: todos os pedidos 'P' do cliente+indústria

    // Agrupa xPed únicos presentes nos itens
    const xPedSet = new Set(nfe.items.map(i => i.xPed).filter(Boolean));

    // Busca pedidos candidatos
    let orderRows: any[] = [];

    if (xPedSet.size > 0) {
      const xPedList = Array.from(xPedSet);
      const ocRes = await db.query(`
        SELECT p.ped_pedido, p.ped_numero, p.ped_data, p.ped_totliq,
               p.ped_situacao, p.ped_pedcli, p.ped_oc, p.ped_pedindustria,
               COALESCE(SUM(f.fat_valorfat),0) AS total_faturado
        FROM pedidos p
        LEFT JOIN fatura_ped f ON TRIM(f.fat_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_cliente   = $2
          AND p.ped_situacao  IN ('P','F')
          AND (
            TRIM(p.ped_pedcli) = ANY($3)
            OR TRIM(p.ped_oc)  = ANY($3)
          )
        GROUP BY p.ped_pedido, p.ped_numero, p.ped_data, p.ped_totliq,
                 p.ped_situacao, p.ped_pedcli, p.ped_oc, p.ped_pedindustria
        ORDER BY p.ped_data ASC
      `, [industry.for_codigo, client.cli_codigo, xPedList]);

      orderRows = ocRes.rows;
    }

    // Fallback: busca por ped_pedindustria = codPedidoInd
    if (!orderRows.length && nfe.codPedidoInd) {
      const indRes = await db.query(`
        SELECT p.ped_pedido, p.ped_numero, p.ped_data, p.ped_totliq,
               p.ped_situacao, p.ped_pedcli, p.ped_oc, p.ped_pedindustria,
               COALESCE(SUM(f.fat_valorfat),0) AS total_faturado
        FROM pedidos p
        LEFT JOIN fatura_ped f ON TRIM(f.fat_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria     = $1
          AND p.ped_cliente       = $2
          AND p.ped_situacao      IN ('P','F')
          AND TRIM(p.ped_pedindustria) = $3
        GROUP BY p.ped_pedido, p.ped_numero, p.ped_data, p.ped_totliq,
                 p.ped_situacao, p.ped_pedcli, p.ped_oc, p.ped_pedindustria
        ORDER BY p.ped_data ASC
      `, [industry.for_codigo, client.cli_codigo, nfe.codPedidoInd]);

      orderRows = indRes.rows;
      if (orderRows.length) warnings.push(`Match por Cód. Pedido Indústria (${nfe.codPedidoInd}) — sem OC nos itens.`);
    }

    // Fallback final: todos os pedidos abertos do cliente+indústria
    if (!orderRows.length) {
      warnings.push('OC não encontrada nos pedidos. Exibindo todos os pedidos abertos para associação manual.');
      const allRes = await db.query(`
        SELECT p.ped_pedido, p.ped_numero, p.ped_data, p.ped_totliq,
               p.ped_situacao, p.ped_pedcli, p.ped_oc, p.ped_pedindustria,
               COALESCE(SUM(f.fat_valorfat),0) AS total_faturado
        FROM pedidos p
        LEFT JOIN fatura_ped f ON TRIM(f.fat_pedido) = TRIM(p.ped_pedido)
        WHERE p.ped_industria = $1
          AND p.ped_cliente   = $2
          AND p.ped_situacao  = 'P'
        GROUP BY p.ped_pedido, p.ped_numero, p.ped_data, p.ped_totliq,
                 p.ped_situacao, p.ped_pedcli, p.ped_oc, p.ped_pedindustria
        ORDER BY p.ped_data ASC
        LIMIT 20
      `, [industry.for_codigo, client.cli_codigo]);
      orderRows = allRes.rows;
    }

    if (!orderRows.length) {
      res.json({ success: false, message: 'Nenhum pedido aberto encontrado para este cliente e indústria.' });
      return;
    }

    // ── 4. Buscar itens de cada pedido candidato ──────────────────────────
    const pedidoIds = orderRows.map(r => r.ped_pedido);
    const itemsRes = await db.query(`
      SELECT
        TRIM(ite_pedido)  AS ite_pedido,
        TRIM(ite_produto) AS ite_produto,
        ite_nomeprod,
        ite_quant,
        ite_puniliq,
        COALESCE(ite_qtdfat, 0) AS ite_qtdfat
      FROM itens_ped
      WHERE TRIM(ite_pedido) = ANY($1)
      ORDER BY ite_pedido, ite_seq
    `, [pedidoIds]);

    // Agrupa itens por pedido com saldo disponível
    const orderItemsMap = new Map<string, any[]>();
    for (const row of itemsRes.rows) {
      const saldo = Math.max(0, (row.ite_quant || 0) - (row.ite_qtdfat || 0));
      if (saldo <= 0) continue; // item já completamente faturado
      const key = row.ite_pedido.trim();
      if (!orderItemsMap.has(key)) orderItemsMap.set(key, []);
      orderItemsMap.get(key)!.push({
        produto:  normCod(row.ite_produto),
        nome:     row.ite_nomeprod,
        saldo,
        puniliq:  parseFloat(row.ite_puniliq) || 0,
      });
    }

    // ── 5. Algoritmo de matching ──────────────────────────────────────────
    // Para cada item da NF, distribuir qtd pelos pedidos (mais antigos primeiro)

    // Trabalha com cópia mutável dos saldos
    const saldoMap = new Map<string, Map<string, number>>();
    for (const [ped, itens] of orderItemsMap) {
      const m = new Map<string, number>();
      for (const i of itens) m.set(i.produto, i.saldo);
      saldoMap.set(ped, m);
    }

    const orderAllocMap = new Map<string, Allocation[]>(); // pedido → alocações
    const unmatched_items: ParseResult['unmatched_items'] = [];

    for (const nfItem of nfe.items) {
      let remaining = nfItem.qCom;

      for (const orderRow of orderRows) {
        if (remaining <= 0) break;
        const ped = orderRow.ped_pedido.trim();
        const pedSaldo = saldoMap.get(ped);
        if (!pedSaldo) continue;

        const saldo = pedSaldo.get(nfItem.cProd) ?? 0;
        if (saldo <= 0) continue;

        const apply = Math.min(remaining, saldo);
        const valor = parseFloat((apply * nfItem.vUnCom).toFixed(2));

        if (!orderAllocMap.has(ped)) orderAllocMap.set(ped, []);
        orderAllocMap.get(ped)!.push({
          pedido:      ped,
          ped_numero:  orderRow.ped_numero,
          produto:     nfItem.cProd,
          xProd:       nfItem.xProd,
          qty_apply:   apply,
          valor_apply: valor,
          vUnCom:      nfItem.vUnCom,
        });

        pedSaldo.set(nfItem.cProd, saldo - apply);
        remaining = parseFloat((remaining - apply).toFixed(4));
      }

      if (remaining > 0.001) {
        const reason = orderRows.length === 0
          ? 'Nenhum pedido encontrado'
          : `Produto ${nfItem.cProd} não encontrado nos pedidos ou saldo insuficiente`;
        unmatched_items.push({ cProd: nfItem.cProd, xProd: nfItem.xProd, qty_unmatched: remaining, reason });
      }
    }

    // ── 6. Monta preview por pedido ───────────────────────────────────────
    const orders: OrderPreview[] = [];
    for (const orderRow of orderRows) {
      const ped = orderRow.ped_pedido.trim();
      const allocs = orderAllocMap.get(ped) || [];
      if (!allocs.length) continue; // pedido sem nenhum item alocado

      const valor_nf       = allocs.reduce((s, a) => s + a.valor_apply, 0);
      const total_faturado = parseFloat(orderRow.total_faturado) || 0;
      const ped_totliq     = parseFloat(orderRow.ped_totliq)     || 0;
      const will_complete  = (total_faturado + valor_nf) >= ped_totliq && ped_totliq > 0;

      orders.push({
        pedido:         ped,
        ped_numero:     orderRow.ped_numero,
        ped_data:       orderRow.ped_data,
        ped_totliq,
        total_faturado,
        valor_nf:       parseFloat(valor_nf.toFixed(2)),
        will_complete,
        allocations:    allocs,
      });
    }

    if (unmatched_items.length) {
      warnings.push(`${unmatched_items.length} item(ns) da NF não foram associados a pedidos.`);
    }

    const result: ParseResult = {
      nf: { nNF: nfe.nNF, serie: nfe.serie, dhEmi: nfe.dhEmi, vNF: nfe.vNF, codPedidoInd: nfe.codPedidoInd },
      industry,
      client,
      orders,
      unmatched_items,
      warnings,
    };

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [NFE/parse]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POST /api/nfe/apply ──────────────────────────────────────────────────────
// Recebe o resultado confirmado do parse e grava no banco (em transação)
export async function applyNFeHandler(req: Request, res: Response): Promise<void> {
  const schema = (req as any).schema as string;
  if (!schema) { res.status(400).json({ success: false, message: 'Schema não identificado.' }); return; }

  const dbClient = await pool.connect();
  try {
    const { nf, orders, industry } = req.body as {
      nf: ParseResult['nf'];
      orders: OrderPreview[];
      industry: ParseResult['industry'];
    };

    if (!orders?.length || !nf?.nNF) {
      res.status(400).json({ success: false, message: 'Dados inválidos para aplicar a NF.' });
      return;
    }

    await dbClient.query(`SET search_path TO "${schema}", public`);
    await dbClient.query('BEGIN');

    // Consulta parâmetro do usuário: fechar pedido automaticamente quando saldo zerar?
    const userId = (req as any).user?.userId;
    const parRes = await dbClient.query(
      `SELECT par_baixa_xml_fecha FROM parametros WHERE par_usuario = $1 LIMIT 1`,
      [userId]
    );
    const fechaAuto = parRes.rows[0]?.par_baixa_xml_fecha === 'S';

    const dataFat = nf.dhEmi ? nf.dhEmi.substring(0, 10) : new Date().toISOString().substring(0, 10);
    const applied: string[] = [];

    for (const order of orders) {
      if (!order.allocations?.length) continue;

      const valorNf = order.allocations.reduce((s, a) => s + a.valor_apply, 0);
      const gid     = randomUUID();

      // 1. Insere em fatura_ped
      await dbClient.query(`
        INSERT INTO fatura_ped
          (fat_pedido, fat_industria, fat_datafat, fat_valorfat, fat_nf, fat_obs, fat_percent, fat_comissao, fat_percomissind, gid, fat_items_json)
        VALUES ($1,$2,$3,$4,$5,$6,0,0,'E',$7,$8)
      `, [
        order.pedido,
        industry!.for_codigo,
        dataFat,
        parseFloat(valorNf.toFixed(2)),
        nf.nNF,
        `NF ${nf.nNF} série ${nf.serie}`,
        gid,
        JSON.stringify(order.allocations.map(a => ({
          produto:     a.produto,
          descricao:   a.xProd,
          quantidade:  a.qty_apply,
          valor_unit:  a.vUnCom,
          valor_total: a.valor_apply,
        }))),
      ]);

      // 2. Atualiza ite_qtdfat e ite_faturado para cada produto alocado
      for (const alloc of order.allocations) {
        await dbClient.query(`
          UPDATE itens_ped
          SET
            ite_qtdfat   = GREATEST(0, COALESCE(ite_qtdfat,0) + $1),
            ite_faturado = CASE
              WHEN GREATEST(0, COALESCE(ite_qtdfat,0) + $1) >= ite_quant THEN 'S'
              ELSE 'N'
            END
          WHERE TRIM(ite_pedido)  = TRIM($2)
            AND TRIM(ite_produto) = TRIM($3)
        `, [Math.round(alloc.qty_apply), order.pedido, alloc.produto]);
        // Math.round: ite_qtdfat é INTEGER no banco — quantidades sempre inteiras para autopeças
      }

      // 3. Grava ped_numnf e ped_datafat
      // Só fecha o pedido (ped_situacao='F') se:
      //   a) o parâmetro par_baixa_xml_fecha = 'S'  E
      //   b) o saldo de valor zerar após esta NF
      const sumRes = await dbClient.query(
        `SELECT COALESCE(SUM(fat_valorfat),0) AS fat FROM fatura_ped WHERE TRIM(fat_pedido)=TRIM($1)`,
        [order.pedido]
      );
      const totalFatNovo = parseFloat(sumRes.rows[0].fat);
      const saldoZerou   = totalFatNovo >= order.ped_totliq && order.ped_totliq > 0;
      const deveFechar   = fechaAuto && saldoZerou;

      await dbClient.query(`
        UPDATE pedidos
        SET ped_numnf   = $1,
            ped_datafat = $2
            ${deveFechar ? ", ped_situacao = 'F'" : ''}
        WHERE TRIM(ped_pedido) = TRIM($3)
      `, [nf.nNF, dataFat, order.pedido]);

      applied.push(order.pedido);
    }

    await dbClient.query('COMMIT');
    res.json({ success: true, applied, message: `NF ${nf.nNF} aplicada em ${applied.length} pedido(s).` });
  } catch (error: any) {
    await dbClient.query('ROLLBACK');
    console.error('❌ [NFE/apply]', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await dbClient.query('RESET search_path');
    dbClient.release();
  }
}
