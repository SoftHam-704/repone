import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- HELPERS ---

const formatDate = (dateString: any, time = false) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
        return dateString;
    }
};

const getOrderDiscountText = (order: any) => {
    const discs = [];
    for (let i = 1; i <= 10; i++) {
        const val = parseFloat(order[`ped_desc${i}`]);
        if (val > 0) discs.push(`${val.toFixed(2)}%`);
    }
    return discs.length > 0 ? discs.join('+') : '0.00%';
};

// --- STYLING CONSTANTS (Based on the "Classic" Image) ---

const FONT_NORMAL = { name: 'Arial', size: 8, color: { argb: 'FF000000' } };
const FONT_BOLD = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF000000' } };

// Green header background (#008000 roughly)
const HEADER_BG_COLOR = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008000' } };
// Header text: Yellow/Gold for readability on Green, looking at typical old-school Excel exports
const HEADER_FONT = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFF00' } };

const BORDER_THIN = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, // Very light grey borders like gridlines
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
};

// --- MAIN BUILDER ---

// incluirCodigoInterno: quando true, a coluna ITEM COMPLEMENTO mostra o código
// interno/SAP (ite_embuch) — usado pra importar no portal da fábrica. Quando false,
// omite o código interno (o lojista não precisa vê-lo). Pedido do REP da Remap.
async function buildWorkbook(order: any, items: any[], separateGroups: 'S' | 'N' = 'N', incluirCodigoInterno = true) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pedido', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }, // A4 Landscape usually
        views: [{ showGridLines: true }] // Gridlines on
    });

    // --- COLUMNS SETUP (Matches Image Layout) ---
    // A: Código
    // B: Descrição (Wide)
    // C: Complemento (Wide)
    // D: (Spacer/Aux) - Using for now as part of layout flexibility or Ped.Cliente
    // E: QTD
    // F: Preço Bruto
    // G: Preço Líquido
    // H: Total Líquido
    // I: IPI %
    // J: Unit Com IPI
    // K: Total Com IPI
    // L: ST %
    // M: Unit Com IPI/ST
    // N: Total final? Image cuts off. Let's assume standard fiscal columns.

    worksheet.columns = [
        { key: 'A', width: 12 }, // Código
        { key: 'B', width: 40 }, // Descrição
        { key: 'C', width: 20 }, // Item Complemento
        { key: 'D', width: 12 }, // (Ped.Cliente headers usually land here)
        { key: 'E', width: 8 },  // QTD
        { key: 'F', width: 12 }, // Preço Bruto
        { key: 'G', width: 12 }, // Preço Liquido
        { key: 'H', width: 12 }, // Total Liquido
        { key: 'I', width: 6 },  // IPI %
        { key: 'J', width: 12 }, // Unit com IPI
        { key: 'K', width: 12 }, // Total com IPI
        { key: 'L', width: 6 },  // ST %
        { key: 'M', width: 12 }, // Unit com ST
        { key: 'N', width: 12 }  // Extra
    ];

    // --- HELPER TO ADD ROW DATA ---
    const setCell = (row: any, col: any, value: any, font: any = FONT_NORMAL, align = 'left') => {
        const cell = worksheet.getCell(`${col}${row}`);
        cell.value = value;
        cell.font = font;
        cell.alignment = { horizontal: align, vertical: 'middle' } as any;
        return cell;
    };

    // --- HEADER (Rows 1-7) ---
    // Replicating the exact "spreadsheet form" look

    // Line 1
    setCell(1, 'A', 'Pedido Nº:', FONT_BOLD);
    setCell(1, 'B', order.ped_pedido, FONT_BOLD, 'left').alignment = { horizontal: 'left' };

    setCell(1, 'D', 'OC do Cliente:', FONT_NORMAL, 'right');
    // Sem OC do cliente → usa o nº do pedido interno como OC (só exibição). Pedido REP Remap.
    setCell(1, 'E', order.ped_oc || order.ped_pedido || '', FONT_BOLD, 'right');

    setCell(1, 'G', 'Data:', FONT_NORMAL, 'right');
    setCell(1, 'H', formatDate(order.ped_data), FONT_BOLD, 'left');

    // Line 2
    setCell(2, 'A', 'Cliente:', FONT_BOLD);
    setCell(2, 'B', `${order.cli_nome || ''}`);

    // Line 3
    setCell(3, 'A', 'Endereço:', FONT_BOLD);
    setCell(3, 'B', `${order.cli_endereco || ''}, ${order.cli_bairro || ''}`);

    setCell(3, 'D', 'Cidade/UF:', FONT_NORMAL, 'right');
    setCell(3, 'E', `${order.cli_cidade}/${order.cli_uf}`);

    setCell(3, 'G', 'CEP:', FONT_NORMAL, 'right');
    setCell(3, 'H', order.cli_cep || '');

    // Line 4
    setCell(4, 'A', 'CNPJ:', FONT_BOLD);
    setCell(4, 'B', order.client_cnpj || order.cli_cnpj || order.cli_cgc || '');

    setCell(4, 'D', 'INSCRIÇÃO:', FONT_NORMAL, 'right');
    setCell(4, 'E', order.cli_inscricao || '');

    setCell(4, 'G', 'Telefone:', FONT_NORMAL, 'right');
    setCell(4, 'H', order.cli_fone1 || '');

    // Line 5
    setCell(5, 'A', 'Descontos:', FONT_BOLD);
    setCell(5, 'B', getOrderDiscountText(order));

    // Line 6
    setCell(6, 'A', 'Condições:', FONT_BOLD);
    setCell(6, 'B', order.ped_condpag || '');
    setCell(6, 'D', order.ped_condicaopgto || ''); // Sometimes code is in separate col

    // Line 7
    setCell(7, 'A', 'Transportadora:', FONT_BOLD);
    setCell(7, 'B', `${order.tra_nome || ''}   Telefone: ${order.tra_fone || ''}`);

    setCell(7, 'D', 'FRETE:', FONT_NORMAL, 'right');
    setCell(7, 'E', order.ped_tipofrete === 'F' ? 'FOB' : 'CIF');

    // --- TABLE HEADER (Row 8) ---
    const headerRowIdx = 8;
    const headers = [
        { col: 'A', text: 'CODIGO' },
        { col: 'B', text: 'DESCRICAO' },
        { col: 'C', text: 'ITEM COMPLEMENTO' },
        { col: 'D', text: '' }, // Spacer?
        { col: 'E', text: 'QTD' },
        { col: 'F', text: 'PREÇO BRUTO' },
        { col: 'G', text: 'PREÇO LIQUIDO' },
        { col: 'H', text: 'TOTAL LIQUIDO' },
        { col: 'I', text: 'IPI %' },
        { col: 'J', text: 'UNIT. COM IPI' },
        { col: 'K', text: 'TOTAL COM IPI' },
        { col: 'L', text: 'ST %' },
        { col: 'M', text: 'UNIT COM IPI/ST' }
    ];

    headers.forEach(h => {
        const cell = worksheet.getCell(`${h.col}${headerRowIdx}`);
        cell.value = h.text;
        cell.fill = HEADER_BG_COLOR as any;
        cell.font = HEADER_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        // cell.border = BORDER_THIN;
    });

    // --- ITEMS ---
    let currentRowIdx = 9;

    // Group items logic: Hierarchical by Discount + Product Group
    // Calcula o discKey a partir dos campos ite_des1..ite_des10 (igual ao PDF)
    const getItemDiscountKey = (item: any): string => {
        const discs: string[] = [];
        for (let i = 1; i <= 10; i++) {
            const val = parseFloat(item[`ite_des${i}`]);
            if (val > 0) discs.push(`${val.toFixed(2)}%`);
        }
        return discs.length > 0 ? discs.join(' + ') : 'Preço de Tabela';
    };

    const groups: Record<string, any[]> = {};
    (items || []).forEach(item => {
        const discKey = getItemDiscountKey(item);
        const groupName = separateGroups === 'S' ? (item.gru_nome || 'GERAL') : 'GERAL';
        const key = `${discKey}|GRP|${groupName}`;

        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    Object.entries(groups).forEach(([key, groupItems]) => {
        const [discountLabel, groupName] = key.split('|GRP|');
        
        // Group Header Line
        const groupRowCell = worksheet.getCell(`A${currentRowIdx}`);
        let headerText = discountLabel === 'Preço de Tabela'
            ? 'Preço de Tabela'
            : `DESCONTOS: ${discountLabel}`;
        if (groupName !== 'GERAL') {
            headerText += `  |  GRUPO: ${groupName.toUpperCase()}`;
        }
        
        groupRowCell.value = headerText;
        groupRowCell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF155724' } }; // Verde escuro igual ao PDF
        groupRowCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } } as any; // Verde claro igual ao PDF
        groupRowCell.alignment = { horizontal: 'left', vertical: 'middle' };

        worksheet.mergeCells(`A${currentRowIdx}:M${currentRowIdx}`);
        // Add border to the group header row
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach(col => {
            const cell = worksheet.getCell(`${col}${currentRowIdx}`);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        });
        
        currentRowIdx++;

        groupItems.forEach(item => {
            const liq = parseFloat(item.ite_totliquido) || 0;
            const quant = parseFloat(item.ite_quant) || 1;
            const ipiPercent = parseFloat(item.ite_ipi) || 0;
            const stPercent = parseFloat(item.ite_st) || 0;

            // Calculate Values if missing but percent exists
            let ipiVal = parseFloat(item.ite_valipi) || 0;
            if (ipiVal === 0 && ipiPercent > 0) {
                ipiVal = liq * (ipiPercent / 100);
            }

            let stVal = parseFloat(item.ite_valst) || 0;
            if (stVal === 0 && stPercent > 0) {
                stVal = (liq + ipiVal) * (stPercent / 100);
            }

            const totalComIpi = liq + ipiVal;
            const unitComIpi = totalComIpi / quant;
            const totalComImp = liq + ipiVal + stVal;
            const unitComImp = totalComImp / quant;

            // Mapping to columns
            setCell(currentRowIdx, 'A', item.ite_produto || '', FONT_NORMAL, 'left');
            setCell(currentRowIdx, 'B', item.ite_nomeprod || '', FONT_NORMAL, 'left');
            const codOrig = (item.pro_codigooriginal && String(item.pro_codigooriginal).trim() !== String(item.ite_produto).trim()) ? item.pro_codigooriginal : '';
            // Código interno/SAP (ite_embuch) só quando selecionado; senão cai no complemento normal.
            const complementoVal = incluirCodigoInterno
                ? (item.ite_embuch || codOrig || item.ite_complemento || '')
                : (codOrig || item.ite_complemento || '');
            setCell(currentRowIdx, 'C', complementoVal, FONT_NORMAL, 'left');
            // D skipped
            setCell(currentRowIdx, 'E', quant, FONT_NORMAL, 'right').numFmt = '0';
            setCell(currentRowIdx, 'F', parseFloat(item.ite_puni) || 0, FONT_NORMAL, 'right').numFmt = '#,##0.00';
            setCell(currentRowIdx, 'G', parseFloat(item.ite_puniliq) || 0, FONT_NORMAL, 'right').numFmt = '#,##0.00';
            setCell(currentRowIdx, 'H', liq, FONT_NORMAL, 'right').numFmt = '#,##0.00';
            setCell(currentRowIdx, 'I', ipiPercent, FONT_NORMAL, 'right').numFmt = '0.00';
            setCell(currentRowIdx, 'J', unitComIpi, FONT_NORMAL, 'right').numFmt = '#,##0.00';
            setCell(currentRowIdx, 'K', totalComIpi, FONT_NORMAL, 'right').numFmt = '#,##0.00';
            setCell(currentRowIdx, 'L', stPercent, FONT_NORMAL, 'right').numFmt = '0.00';
            setCell(currentRowIdx, 'M', unitComImp, FONT_NORMAL, 'right').numFmt = '#,##0.00';

            currentRowIdx++;
        });
    });

    // --- TOTALS ---
    currentRowIdx++;
    // Totais usually at bottom right
    const sumLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
    const sumTotal = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0) + (parseFloat(it.ite_valipi) || 0) + (parseFloat(it.ite_valst) || 0), 0);
    const sumQtd = items.reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);

    // Total Qtd
    setCell(currentRowIdx, 'E', sumQtd, FONT_BOLD, 'right').numFmt = '0';

    // Label
    setCell(currentRowIdx, 'G', 'Total liquido', FONT_NORMAL, 'center').border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    // Total Liquido Value
    setCell(currentRowIdx, 'H', sumLiq, FONT_NORMAL, 'right').numFmt = '#,##0.00'; // Image has no bold on value, simple grid

    // Total Final
    setCell(currentRowIdx, 'I', sumTotal, FONT_NORMAL, 'right').numFmt = '#,##0.00';

    // --- OBSERVATIONS ---
    currentRowIdx += 2;
    setCell(currentRowIdx, 'A', 'Observações:', FONT_BOLD);
    setCell(currentRowIdx, 'B', order.ped_obs || '-');

    return workbook;
}

// --- EXPORTS ---

export async function exportOrderToExcel(order: any, items: any[], separateGroups: 'S' | 'N' = 'N', incluirCodigoInterno = true) {
    try {
        const workbook = await buildWorkbook(order, items, separateGroups, incluirCodigoInterno);
        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const cleanName = (order.cli_nomred || 'Cliente').replace(/[^a-z0-9]/gi, '_');
        const filename = `Pedido_${order.ped_pedido || 'NOVO'}_${cleanName}.xlsx`;

        saveAs(blob, filename);
        return filename;
    } catch (error) {
        console.error('Error exporting Excel:', error);
        throw error;
    }
}

export async function generateOrderExcelData(order: any, items: any[], separateGroups: 'S' | 'N' = 'N') {
    try {
        const workbook = await buildWorkbook(order, items, separateGroups);
        const buffer = await workbook.xlsx.writeBuffer();
        return new Uint8Array(buffer);
    } catch (error) {
        console.error('Error generating Excel buffer:', error);
        throw error;
    }
}

export default exportOrderToExcel;
