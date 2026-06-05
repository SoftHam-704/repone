import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Espelha a planilha de controle de NFS-e da contadora (uma nota por representada/mês).

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
function competenciaLabel(comp: string) {
  const [y, m] = (comp || '').split('-')
  const mi = parseInt(m, 10) - 1
  return mi >= 0 && mi < 12 ? `${MESES[mi]} ${y}` : comp
}
function fmtD(d?: string | null) {
  if (!d) return ''
  const [y, m, day] = String(d).substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}

const HEADER_BG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D3D' } } // navy
const HEADER_FONT = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }
const FONT = { name: 'Arial', size: 8, color: { argb: 'FF000000' } }
const FONT_B = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF000000' } }
const MONEY = '#,##0.00'

const COLS = [
  { h: 'NF', w: 8 }, { h: 'EMISSÃO', w: 11 }, { h: 'REPRESENTADA', w: 26 }, { h: 'VR. BRUTO', w: 12 },
  { h: 'PIS', w: 9 }, { h: 'IRPJ', w: 9 }, { h: 'CSLL', w: 9 }, { h: 'COFINS', w: 9 }, { h: 'ISS', w: 9 },
  { h: 'FGTS/GPS', w: 10 }, { h: 'LIQUIDO NF', w: 12 }, { h: 'LIQ REC', w: 12 },
  { h: 'DATA PGTO', w: 11 }, { h: 'OBS', w: 12 }, { h: 'TRANSF.', w: 9 },
]

export async function exportNfseToExcel(competencia: string, rows: any[], totais: any) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('NFS-e', { pageSetup: { paperSize: 9, orientation: 'landscape' }, views: [{ showGridLines: true }] })
  ws.columns = COLS.map((c, i) => ({ key: String.fromCharCode(65 + i), width: c.w }))

  // Título
  const t = ws.getCell('A1')
  t.value = `NOTAS FISCAIS DE SERVIÇO - ${competenciaLabel(competencia)}`
  t.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E2D3D' } }
  ws.mergeCells('A1:O1')

  // Cabeçalho (linha 2)
  COLS.forEach((c, i) => {
    const cell = ws.getCell(2, i + 1)
    cell.value = c.h
    cell.fill = HEADER_BG as any
    cell.font = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Linhas
  let r = 3
  const setC = (col: number, value: any, font: any = FONT, align: any = 'left', numFmt?: string) => {
    const cell = ws.getCell(r, col)
    cell.value = value
    cell.font = font
    cell.alignment = { horizontal: align, vertical: 'middle' }
    if (numFmt) cell.numFmt = numFmt
  }
  for (const n of rows) {
    setC(1, n.numero || '', FONT_B, 'left')
    setC(2, fmtD(n.emissao), FONT, 'center')
    setC(3, n.representada_label || n.representada_nome || '', FONT, 'left')
    setC(4, Number(n.vr_bruto) || 0, FONT_B, 'right', MONEY)
    setC(5, Number(n.pis) || 0, FONT, 'right', MONEY)
    setC(6, Number(n.irpj) || 0, FONT, 'right', MONEY)
    setC(7, Number(n.csll) || 0, FONT, 'right', MONEY)
    setC(8, Number(n.cofins) || 0, FONT, 'right', MONEY)
    setC(9, Number(n.iss) || 0, FONT, 'right', MONEY)
    setC(10, Number(n.fgts_gps) || 0, FONT, 'right', MONEY)
    setC(11, Number(n.liquido_nf) || 0, FONT, 'right', MONEY)
    setC(12, Number(n.liq_rec) || 0, FONT_B, 'right', MONEY)
    setC(13, fmtD(n.data_pgto), FONT, 'center')
    setC(14, n.obs || '', FONT, 'left')
    setC(15, n.transf ? 'SIM' : '', FONT, 'center')
    r++
  }

  // Totais (linha em branco + total)
  r++
  const tot = (col: number, value: number, fmt = MONEY) => {
    const cell = ws.getCell(r, col)
    cell.value = value
    cell.font = FONT_B
    cell.alignment = { horizontal: 'right' }
    cell.numFmt = fmt
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } } as any
  }
  ws.getCell(r, 3).value = 'TOTAL:'
  ws.getCell(r, 3).font = FONT_B
  ws.getCell(r, 3).alignment = { horizontal: 'right' }
  tot(4, Number(totais?.vr_bruto) || 0)
  tot(11, Number(totais?.liquido_nf) || 0)
  tot(12, Number(totais?.liq_rec) || 0)

  // Resumo (impostos + comissão líquida) abaixo
  r += 2
  ws.getCell(r, 3).value = 'IMPOSTOS DO ESCRITÓRIO:'; ws.getCell(r, 3).font = FONT_B; ws.getCell(r, 3).alignment = { horizontal: 'right' }
  ws.getCell(r, 4).value = Number(totais?.impostos) || 0; ws.getCell(r, 4).font = FONT_B; ws.getCell(r, 4).numFmt = MONEY; ws.getCell(r, 4).alignment = { horizontal: 'right' }
  r++
  ws.getCell(r, 3).value = 'COMISSÃO LÍQUIDA:'; ws.getCell(r, 3).font = FONT_B; ws.getCell(r, 3).alignment = { horizontal: 'right' }
  ws.getCell(r, 4).value = Number(totais?.liq_rec) || 0; ws.getCell(r, 4).font = FONT_B; ws.getCell(r, 4).numFmt = MONEY; ws.getCell(r, 4).alignment = { horizontal: 'right' }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `NFSe_Comissoes_${competencia}.xlsx`)
}
