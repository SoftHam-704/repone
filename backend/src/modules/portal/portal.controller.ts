/**
 * portal.controller.ts
 * Exportações para portais industriais e importação Paraflu.
 * Copiado fielmente do V1 (portal_integration_endpoints.js + paraflu_import_endpoints.js)
 * Adaptação: pool → req.db!, CommonJS → TypeScript, getCurrentPool → authMiddleware/tenantMiddleware
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import multer from 'multer';
import { pool } from '../../config/database';

// ─── Multer para upload da planilha Paraflu ───────────────────────────────────
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'uploads', 'paraflu');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
export const uploadParaflu = multer({ storage });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (value: any) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDate = (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR') + '  ' + d.toLocaleTimeString('pt-BR');
};

const handleFileDownload = (res: Response, content: string, filename: string, contentType = 'text/plain', encoding: BufferEncoding = 'latin1') => {
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', `${contentType}; charset=${encoding === 'latin1' ? 'ISO-8859-1' : 'UTF-8'}`);
    console.log(`✅ [PORTAL] Arquivo gerado: ${filename}`);
    const buffer = Buffer.from(content, encoding);
    res.send(buffer);
};

// ─── 1. STAHL (.txt) ──────────────────────────────────────────────────────────
export async function exportStahlHandler(req: Request, res: Response): Promise<void> {
    const pedPedido = String(req.params.id);
    const db = req.db!;
    try {
        const orderResult = await db.query(`
            SELECT p.*, c.cli_nome, c.cli_nomred, c.cli_cnpj, c.cli_endereco, c.cli_bairro, c.cli_cep, c.cli_cidade, c.cli_uf AS cli_estado,
                   t.tra_nome
            FROM pedidos p
            LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
            LEFT JOIN transportadora t ON p.ped_transp = t.tra_codigo
            WHERE TRIM(p.ped_pedido) = TRIM($1)
        `, [pedPedido]);

        if (!orderResult.rows.length) { res.status(404).json({ success: false, message: 'Pedido não encontrado.' }); return; }
        const order = orderResult.rows[0];

        const items = (await db.query(`SELECT * FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq`, [pedPedido])).rows;

        let content = `Catálogo STAHL  -  Carrinho\r\n`;
        content += `${formatDate(new Date())}\r\n\r\n\r\n`;
        content += `### Cliente:\r\n------------\r\n`;
        content += `Cod.Cliente: 67563 (59833934000157 )\r\n`;
        content += `Empresa:   SOMA REPRESENTAÇOES\r\n`;
        content += `Nome:      CARLOS\r\n`;
        content += `Telefone:  65 992598800\r\n`;
        content += `E-Mail:    somarepresentacoes021@gmail.com\r\n\r\n\r\n\r\n`;
        content += `### Dados para Faturamento:\r\n---------------------------\r\n\r\n`;
        content += `Transportadora: ${order.tra_nome || ''}\r\n`;
        content += `Prazo:          ${order.ped_condpag || ''}\r\n`;
        content += `Razão Social:   ${order.cli_nome || ''}\r\n`;
        content += `CNPJ:           ${order.cli_cnpj || ''}\r\n`;
        content += `Endereço:       ${order.cli_endereco || ''}\r\n`;
        content += `Bairro:         ${order.cli_bairro || ''}\r\n`;
        content += `CEP:            ${order.cli_cep || ''}\r\n`;
        content += `Cidade:         ${order.cli_cidade || ''}\r\n`;
        content += `Estado:         ${order.cli_estado || ''}\r\n\r\n\r\n\r\n`;
        content += `### Mensagem:\r\n-------------\r\n\r\n\r\n\r\n`;
        content += `### Produtos:\r\n-------------\r\n`;

        items.forEach((item: any) => {
            content += `CÓDIGO:     ${item.ite_produto || ''}\r\n`;
            content += `DESCRICÃO:  ${item.ite_nomeprod || ''}\r\n`;
            content += `QUANTIDADE: ${item.ite_quant}     PREÇO UNITÁRIO: ${formatCurrency(item.ite_puni)}        TOTAL: ${formatCurrency(item.ite_totbruto)}\r\n`;
            content += `----------------------------------------------------------------------------\r\n`;
        });
        content += `### TOTAL DO CARRINHO: ${formatCurrency(order.ped_totliq || order.ped_totbruto)}\r\n`;
        content = content.replace(/\r?\n/g, '\r\n');

        handleFileDownload(res, content, `${pedPedido}.txt`);
    } catch (error: any) {
        console.error('❌ [PORTAL] Erro STAHL:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─── 2. IGUAÇU (.xml) ────────────────────────────────────────────────────────
export async function exportIguacuHandler(req: Request, res: Response): Promise<void> {
    const pedPedido = String(req.params.id);
    const db = req.db!;
    try {
        const orderResult = await db.query(`
            SELECT p.ped_pedido, p.ped_cliind, p.ped_condpag, p.ped_obs,
                   c.cli_cnpj, t.tra_cgc
            FROM pedidos p
            LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
            LEFT JOIN transportadora t ON p.ped_transp = t.tra_codigo
            WHERE TRIM(p.ped_pedido) = TRIM($1)
        `, [pedPedido]);

        if (!orderResult.rows.length) { res.status(404).json({ success: false, message: 'Pedido não encontrado.' }); return; }
        const order = orderResult.rows[0];

        const items = (await db.query(`SELECT * FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq`, [pedPedido])).rows;

        const onlyNumbers = (str: any) => String(str || '').replace(/\D/g, '');
        const limit = (str: any, max: number) => String(str || '').substring(0, max);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<PED_ONLINE>\n`;
        xml += `  <PEDIDO>\n`;
        xml += `    <CNPJ_CLI>${onlyNumbers(order.cli_cnpj)}</CNPJ_CLI>\n`;
        xml += `    <CNPJ_TRANSP>${onlyNumbers(order.tra_cgc)}</CNPJ_TRANSP>\n`;
        xml += `    <PED_CLI>${limit(order.ped_cliind, 20)}</PED_CLI>\n`;
        xml += `    <PED_REPRS>${limit(order.ped_pedido, 10)}</PED_REPRS>\n`;
        xml += `    <PRAZOS>${limit(order.ped_condpag, 40)}</PRAZOS>\n`;
        xml += `    <T_ENTREGA>1</T_ENTREGA>\n`;
        xml += `    <OBS>${limit(order.ped_obs, 500)}</OBS>\n`;
        xml += `  </PEDIDO>\n`;
        xml += `  <PRODUTOS>\n`;
        xml += `    <ITENS_PEDIDO>\n`;

        items.forEach((item: any, index: number) => {
            xml += `      <ITENS nItem="${index + 1}">\n`;
            xml += `        <COD_PRODUTO>${limit(item.ite_produto, 20)}</COD_PRODUTO>\n`;
            xml += `        <QDE>${Math.trunc(item.ite_quant || 0)}</QDE>\n`;
            xml += `      </ITENS>\n`;
        });

        xml += `    </ITENS_PEDIDO>\n`;
        xml += `  </PRODUTOS>\n`;
        xml += `</PED_ONLINE>`;

        // Salvamento automático opcional (IGUACU_EXPORT_PATH)
        const exportPath = process.env.IGUACU_EXPORT_PATH;
        if (exportPath) {
            try {
                if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });
                fs.writeFileSync(path.join(exportPath, `${pedPedido}.xml`), xml, 'utf8');
            } catch (fsErr: any) {
                console.error(`❌ [PORTAL] Erro ao salvar XML localmente: ${fsErr.message}`);
            }
        }

        handleFileDownload(res, xml, `${pedPedido}.xml`, 'application/xml', 'utf8');
    } catch (error: any) {
        console.error('❌ [PORTAL] Erro IGUAÇU:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─── 3. VIEMAR (.xlsx) ───────────────────────────────────────────────────────
export async function exportViemarHandler(req: Request, res: Response): Promise<void> {
    const pedPedido = String(req.params.id);
    const db = req.db!;
    try {
        const items = (await db.query(`SELECT * FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq`, [pedPedido])).rows;
        if (!items.length) { res.status(404).json({ success: false, message: 'Pedido sem itens.' }); return; }

        const data = items.map((item: any) => [
            item.ite_produto || '',
            item.ite_quant || 0,
            Number(item.ite_puni || 0)
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=${pedPedido}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        console.log(`✅ [PORTAL] VIEMAR Excel: ${pedPedido}.xlsx`);
        res.send(buffer);
    } catch (error: any) {
        console.error('❌ [PORTAL] Erro VIEMAR:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─── 4. SAMPEL (.xlsx) ───────────────────────────────────────────────────────
export async function exportSampelHandler(req: Request, res: Response): Promise<void> {
    const pedPedido = String(req.params.id);
    const db = req.db!;
    try {
        const orderResult = await db.query(`
            SELECT p.ped_pedido, p.ped_tabela, c.cli_cnpj
            FROM pedidos p
            LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
            WHERE TRIM(p.ped_pedido) = TRIM($1)
        `, [pedPedido]);
        if (!orderResult.rows.length) { res.status(404).json({ success: false, message: 'Pedido não encontrado.' }); return; }
        const order = orderResult.rows[0];

        const items = (await db.query(`SELECT ite_produto, ite_quant FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq`, [pedPedido])).rows;
        if (!items.length) { res.status(404).json({ success: false, message: 'Pedido sem itens.' }); return; }

        const header = [["CNPJ", "PEDIDO REPRES", "TABELA PRECO", "ITEM", "QUANTIDADE"]];
        const dataRows = items.map((item: any) => [
            (order.cli_cnpj || '').replace(/\D/g, ''),
            order.ped_pedido || '',
            order.ped_tabela || '',
            item.ite_produto || '',
            item.ite_quant || 0
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows]);
        ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=SAMPEL_${pedPedido}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        console.log(`✅ [PORTAL] SAMPEL Excel: SAMPEL_${pedPedido}.xlsx`);
        res.send(buffer);
    } catch (error: any) {
        console.error('❌ [PORTAL] Erro SAMPEL:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─── 5. POLO (.csv) ───────────────────────────────────────────────────────────
export async function exportPoloHandler(req: Request, res: Response): Promise<void> {
    const pedPedido = String(req.params.id);
    const db = req.db!;
    try {
        const items = (await db.query(`
            SELECT ite_produto, ite_quant, ite_puniliq
            FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_lancto
        `, [pedPedido])).rows;
        if (!items.length) { res.status(404).json({ success: false, message: 'Pedido sem itens.' }); return; }

        let content = 'codigo;qtde;valor\r\n';
        items.forEach((item: any) => {
            const codigo = item.ite_produto || '';
            const qtde = Math.trunc(item.ite_quant || 0);
            const valorFormatado = parseFloat(item.ite_puniliq || 0).toFixed(2).replace('.', ',');
            content += `${codigo};${qtde};${valorFormatado}\r\n`;
        });

        handleFileDownload(res, content, `${pedPedido}.csv`, 'text/csv', 'utf8');
    } catch (error: any) {
        console.error('❌ [PORTAL] Erro POLO:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─── 6. PARAFLU — Preview ────────────────────────────────────────────────────
export async function parafluPreviewHandler(req: Request, res: Response): Promise<void> {
    let filePath: string | null = null;
    try {
        if (!req.file) { res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' }); return; }
        filePath = req.file.path;

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        const nfeMap: Record<string, any> = {};
        for (const row of rows) {
            const doc = String(row['Documento'] || row['DOCUMENTO'] || '').trim();
            if (!doc) continue;
            if (!nfeMap[doc]) {
                nfeMap[doc] = {
                    documento: doc,
                    cnpj: String(row['CNPJ'] || '').trim(),
                    pedidoCompra: String(row['Pedido de compra'] || '').trim(),
                    periodo: String(row['Período'] || '').trim(),
                    totalFat: 0,
                    qtdItens: 0
                };
            }
            nfeMap[doc].totalFat += parseFloat(row['R$ Fat'] || 0);
            nfeMap[doc].qtdItens++;
        }

        try { fs.unlinkSync(filePath); } catch (_) { }

        res.json({
            success: true,
            data: Object.values(nfeMap),
            totalRows: rows.length,
            totalNFes: Object.keys(nfeMap).length
        });
    } catch (error: any) {
        if (filePath) try { fs.unlinkSync(filePath); } catch (_) { }
        res.status(500).json({ success: false, message: error.message });
    }
}

// ─── 7. PARAFLU — Import ─────────────────────────────────────────────────────
export async function parafluImportHandler(req: Request, res: Response): Promise<void> {
    let filePath: string | null = null;
    try {
        if (!req.file) { res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' }); return; }
        filePath = req.file.path;
        const db = req.db!;

        console.log(`📦 [PARAFLU] Processando: ${req.file.originalname}`);

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) { res.status(400).json({ success: false, message: 'Planilha vazia.' }); return; }

        const getCol = (row: any, ...keys: string[]) => {
            for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return row[k];
            }
            return null;
        };

        const nfeGroups: Record<string, any> = {};
        let skipped = 0;

        for (const row of rows) {
            const documento = String(getCol(row, 'Documento', 'DOCUMENTO', 'documento', 'Doc', 'NFe') || '').trim();
            if (!documento) { skipped++; continue; }

            const cnpj = String(getCol(row, 'CNPJ', 'cnpj', 'Cnpj') || '').trim();
            const codProduto = String(getCol(row, 'Cód. Produto', 'COD. PRODUTO', 'Cod. Produto', 'Código', 'CODIGO', 'codigo') || '').trim();
            const descProduto = String(getCol(row, 'Descrição produto', 'DESCRIÇÃO PRODUTO', 'Descricao produto', 'Descrição', 'DESCRICAO') || '').trim();
            const pedidoCompra = String(getCol(row, 'Pedido de compra', 'PEDIDO DE COMPRA', 'Pedido de Compra', 'PedidoCompra') || '').trim();
            const rFat = parseFloat(getCol(row, 'R$ Fat', 'R$ FAT', 'Valor Fat', 'ValorFat') || 0);
            const qtdeFat = parseFloat(getCol(row, 'Qtde Fat', 'QTDE FAT', 'Quantidade Fat', 'QtdeFat') || 0);
            const rPend = parseFloat(getCol(row, 'R$ Pend', 'R$ PEND', 'Valor Pend') || 0);
            const qtdePend = parseFloat(getCol(row, 'Qtde Pend', 'QTDE PEND', 'Quantidade Pend') || 0);
            const periodo = String(getCol(row, 'Período', 'PERÍODO', 'Periodo', 'PERIODO') || '').trim();

            if (!nfeGroups[documento]) {
                nfeGroups[documento] = { documento, cnpj, pedidoCompra, periodo, items: [], totalFat: 0, totalPend: 0 };
            }

            if (codProduto && qtdeFat > 0) {
                // Consolidar itens duplicados na mesma NFe (join de planilha)
                const existingIdx = nfeGroups[documento].items.findIndex((i: any) => i.codigo === codProduto);
                if (existingIdx >= 0) {
                    const ex = nfeGroups[documento].items[existingIdx];
                    ex.quantidade += qtdeFat;
                    ex.valor      += rFat;
                    ex.qtdePend   += qtdePend;
                    ex.rPend      += rPend;
                    ex.precoUnitario = ex.quantidade > 0 ? ex.valor / ex.quantidade : 0;
                } else {
                    nfeGroups[documento].items.push({
                        codigo: codProduto, descricao: descProduto, quantidade: qtdeFat,
                        valor: rFat, precoUnitario: qtdeFat > 0 ? rFat / qtdeFat : 0,
                        qtdePend, rPend,
                    });
                }
                // Recalculate totals from consolidated items to avoid double-counting duplicates
                nfeGroups[documento].totalFat  = nfeGroups[documento].items.reduce((s: number, i: any) => s + i.valor, 0);
                nfeGroups[documento].totalPend = nfeGroups[documento].items.reduce((s: number, i: any) => s + i.rPend, 0);
            }

            if (cnpj && !nfeGroups[documento].cnpj) nfeGroups[documento].cnpj = cnpj;
            if (pedidoCompra && !nfeGroups[documento].pedidoCompra) nfeGroups[documento].pedidoCompra = pedidoCompra;
        }

        const nfeList = Object.values(nfeGroups);
        console.log(`📊 [PARAFLU] ${nfeList.length} NFes encontradas, ${skipped} linhas ignoradas`);

        // Buscar for_codigo da PARAFLU
        let parafluId: any = null;
        const indRes = await db.query(
            "SELECT for_codigo FROM fornecedores WHERE for_nome ILIKE '%PARAFLU%' OR for_nomered ILIKE '%PARAFLU%' LIMIT 1"
        );
        if (indRes.rows.length > 0) parafluId = indRes.rows[0].for_codigo;

        if (!parafluId) {
            res.status(400).json({ success: false, message: 'Indústria PARAFLU não encontrada no portfólio. Verifique o cadastro de fornecedores.' });
            return;
        }
        console.log(`🏭 [PARAFLU] Indústria ID: ${parafluId}`);
        
        // Buscar uma tabela padrão para a PARAFLU (evita erro de constraint NOT NULL)
        let defaultTable = 'PADRAO';
        const tabRes = await db.query(
            "SELECT itab_tabela FROM cad_tabelaspre WHERE itab_idindustria = $1 LIMIT 1",
            [parafluId]
        );
        if (tabRes.rows.length > 0) defaultTable = tabRes.rows[0].itab_tabela;

        const client = await (req.db as any).connect();
        let inserted = 0, updated = 0;
        const errors: any[] = [];

        try {
            await client.query('BEGIN');

            for (const nfe of nfeList) {
                const savepointName = `nfe_${nfe.documento.replace(/\D/g, '') || Date.now()}`;
                await client.query(`SAVEPOINT ${savepointName}`);
                try {
                    let cliCodigo = 0;
                    let cliVendedor: number | null = null;
                    if (nfe.cnpj) {
                        const cliRes = await client.query(
                            "SELECT cli_codigo, cli_vendedor FROM clientes WHERE REPLACE(REPLACE(REPLACE(cli_cnpj, '.', ''), '/', ''), '-', '') = $1 LIMIT 1",
                            [nfe.cnpj.replace(/\D/g, '').padStart(14, '0')]
                        );
                        if (cliRes.rows.length > 0) {
                            cliCodigo = cliRes.rows[0].cli_codigo;
                            cliVendedor = cliRes.rows[0].cli_vendedor;
                        }
                    }

                    let pedData = new Date();
                    if (nfe.periodo) {
                        const parts = nfe.periodo.split('-');
                        if (parts.length === 2) {
                            pedData = new Date(2000 + parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                        }
                    }

                    const pedPedidoStr = nfe.documento.replace(/\s+/g, '').substring(0, 10);
                    const existsRes = await client.query(
                        "SELECT ped_pedido, ped_numero FROM pedidos WHERE (TRIM(ped_pedindustria) = TRIM($1) OR TRIM(ped_pedido) = TRIM($3)) AND ped_industria = $2 LIMIT 1",
                        [nfe.documento, parafluId, pedPedidoStr]
                    );

                    if (existsRes.rows.length > 0) {
                        const pedPedido = existsRes.rows[0].ped_pedido;
                        await client.query(
                            `UPDATE pedidos SET ped_totbruto=$1, ped_totliq=$2, ped_situacao='F',
                             ped_cliente = CASE WHEN $3 > 0 THEN $3 ELSE ped_cliente END,
                             ped_numpedcli = CASE WHEN $4 != '' THEN $4 ELSE ped_numpedcli END,
                             ped_tabela = CASE WHEN COALESCE(ped_tabela,'') = '' THEN $5 ELSE ped_tabela END,
                             ped_vendedor = CASE WHEN $6 > 0 THEN $6 ELSE ped_vendedor END
                             WHERE TRIM(ped_pedido) = TRIM($7)`,
                            [nfe.totalFat, nfe.totalFat, cliCodigo, nfe.pedidoCompra || '', defaultTable, cliVendedor || 0, pedPedido]
                        );
                        await client.query("DELETE FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1)", [pedPedido]);
                        for (let i = 0; i < nfe.items.length; i++) {
                            const item = nfe.items[i];
                            const prodRes = await client.query(
                                "SELECT pro_id FROM cad_prod WHERE (pro_codprod = $1 OR pro_codigonormalizado = $1 OR pro_codigooriginal = $1) AND pro_industria = $2 LIMIT 1",
                                [item.codigo, parafluId]
                            );
                            if (prodRes.rows.length === 0) throw new Error(`Produto ${item.codigo} não encontrado no cadastro para a indústria Paraflu.`);
                            const proId = prodRes.rows[0].pro_id;
                            await client.query(
                                `INSERT INTO itens_ped (ite_pedido,ite_seq,ite_industria,ite_produto,ite_nomeprod,ite_quant,ite_puni,ite_totbruto,ite_puniliq,ite_totliquido,ite_idproduto)
                                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                                [pedPedido, i + 1, parafluId, item.codigo, item.descricao, item.quantidade, item.precoUnitario, item.valor, item.precoUnitario, item.valor, proId]
                            );
                        }
                        updated++;
                        console.log(`🔄 [PARAFLU] UPDATE: ${nfe.documento} → ${pedPedido} (${nfe.items.length} itens)`);
                    } else {
                        let seqResult: any;
                        try { seqResult = await client.query("SELECT nextval('gen_pedidos_id') as next_num"); }
                        catch (_) {
                            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                            await client.query(`SAVEPOINT ${savepointName}`);
                            try { seqResult = await client.query("SELECT nextval('pedidos_ped_numero_seq') as next_num"); }
                            catch (_2) {
                                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                                await client.query(`SAVEPOINT ${savepointName}`);
                                seqResult = await client.query("SELECT COALESCE(MAX(ped_numero), 0) + 1 as next_num FROM pedidos");
                            }
                        }
                        const pedNumero = seqResult.rows[0].next_num;
                        const pedPedido = nfe.documento.replace(/\s+/g, '').substring(0, 10);

                        await client.query(
                            `INSERT INTO pedidos (ped_data,ped_situacao,ped_numero,ped_pedido,ped_cliente,ped_industria,ped_totbruto,ped_totliq,ped_pedindustria,ped_numpedcli,ped_obs,ped_tabela,ped_transp,ped_vendedor)
                             VALUES ($1,'F',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                            [pedData, pedNumero, pedPedido, cliCodigo, parafluId, nfe.totalFat, nfe.totalFat, nfe.documento, nfe.pedidoCompra || '', 'Importado via Portal Paraflu', defaultTable, 0, cliVendedor || 0]
                        );
                        for (let i = 0; i < nfe.items.length; i++) {
                            const item = nfe.items[i];
                            const prodRes = await client.query(
                                "SELECT pro_id FROM cad_prod WHERE (pro_codprod = $1 OR pro_codigonormalizado = $1 OR pro_codigooriginal = $1) AND pro_industria = $2 LIMIT 1",
                                [item.codigo, parafluId]
                            );
                            if (prodRes.rows.length === 0) throw new Error(`Produto ${item.codigo} não encontrado no cadastro para a indústria Paraflu.`);
                            const proId = prodRes.rows[0].pro_id;
                            await client.query(
                                `INSERT INTO itens_ped (ite_pedido,ite_seq,ite_industria,ite_produto,ite_nomeprod,ite_quant,ite_puni,ite_totbruto,ite_puniliq,ite_totliquido,ite_idproduto)
                                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                                [pedPedido, i + 1, parafluId, item.codigo, item.descricao, item.quantidade, item.precoUnitario, item.valor, item.precoUnitario, item.valor, proId]
                            );
                        }
                        inserted++;
                        console.log(`✅ [PARAFLU] INSERT: ${nfe.documento} → ${pedPedido} (${nfe.items.length} itens, cliente ${cliCodigo})`);
                    }

                    await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                } catch (nfeErr: any) {
                    console.error(`❌ [PARAFLU] Erro no NFe ${nfe.documento}:`, nfeErr.message);
                    errors.push({ nfe: nfe.documento, error: nfeErr.message });
                    try { await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`); } catch (_) {}
                }
            }

            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        try { fs.unlinkSync(filePath); } catch (_) { }

        const summary = {
            success: true,
            message: `Importação concluída! ${inserted} novos pedidos, ${updated} atualizados.`,
            inserted, updated, totalNFes: nfeList.length,
            errors: errors.length > 0 ? errors : undefined
        };
        console.log(`📊 [PARAFLU] ${JSON.stringify(summary)}`);
        res.json(summary);

    } catch (error: any) {
        if (filePath) try { fs.unlinkSync(filePath); } catch (_) { }
        console.error('❌ [PARAFLU] Erro geral:', error);
        res.status(500).json({ success: false, message: `Erro na importação: ${error.message}` });
    }
}

// ─── 8. OSPINA — Export TXT Fixed-Width 728 chars ────────────────────────────
export async function exportOspinaHandler(req: Request, res: Response): Promise<void> {
    const pedPedido = String(req.params.id);
    const db = req.db!;
    try {
        const orderResult = await db.query(`
            SELECT p.ped_pedido, p.ped_cliente, p.ped_vendedor, p.ped_condpag, p.ped_transp,
                   c.cli_cnpj, c.cli_nome,
                   v.ven_codigo,
                   t.tra_cgc,
                   f.for_codrep
            FROM pedidos p
            LEFT JOIN clientes c ON p.ped_cliente = c.cli_codigo
            LEFT JOIN vendedores v ON p.ped_vendedor = v.ven_codigo
            LEFT JOIN transportadora t ON p.ped_transp = t.tra_codigo
            LEFT JOIN fornecedores f ON p.ped_industria = f.for_codigo
            WHERE TRIM(p.ped_pedido) = TRIM($1)
        `, [pedPedido]);

        if (!orderResult.rows.length) {
            res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
            return;
        }
        const order = orderResult.rows[0];
        const items = (await db.query(
            `SELECT * FROM itens_ped WHERE TRIM(ite_pedido) = TRIM($1) ORDER BY ite_seq`,
            [pedPedido]
        )).rows;

        const LINE_SIZE = 727;
        const fill = (text: any, size: number, char = ' ', align = 'left') => {
            let s = String(text || '').substring(0, size);
            return align === 'left' ? s.padEnd(size, char) : s.padStart(size, char);
        };
        const buildLine = (content: string) => fill(content, LINE_SIZE) + '1\r\n';

        let txt = buildLine('9');

        let line0 = '00000';
        line0 += fill(order.for_codrep || order.ped_vendedor || order.ven_codigo || '', 6, '0', 'right');
        txt += fill(line0, LINE_SIZE, '0') + '1\r\n';

        let line1 = '1';
        line1 += fill('', 2);
        line1 += fill(String(order.cli_cnpj || '').replace(/\D/g, ''), 14, '0', 'right');
        line1 += fill('', 4);
        line1 += fill(order.cli_nome, 706);
        txt += line1 + '1\r\n';

        let line2 = '2';
        line2 += fill('', 2);
        line2 += fill(order.ped_pedido, 6, '0', 'right');
        line2 += fill('', 2);
        line2 += fill(order.ped_condpag, 3, '0', 'right');
        line2 += fill('', 2);
        line2 += fill(String(order.tra_cgc || '').replace(/\D/g, ''), 14, '0', 'right');
        txt += buildLine(line2);

        items.forEach((item: any) => {
            let line3 = '3';
            line3 += fill('', 2);
            line3 += fill(order.ped_pedido, 6, '0', 'right');
            line3 += fill('', 2);
            line3 += fill(item.ite_produto, 6, '0', 'right');
            line3 += fill('', 14);
            line3 += fill(Math.trunc(item.ite_quant || 0), 6, '0', 'right');
            txt += buildLine(line3);
        });

        handleFileDownload(res, txt, `OSPINA_${pedPedido}.txt`, 'text/plain', 'latin1');
    } catch (error: any) {
        console.error('❌ [PORTAL] Erro Ospina:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}
