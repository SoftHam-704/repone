import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Relatório de Contas a Pagar agrupado por Centro de Custo — "planilha amarelona" da Lorena.
// As parcelas PAGAS saem com fundo amarelo (o amarelão). Subtotal por centro + total geral.

const MONEY = '#,##0.00'
const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } } as any // amarelão
const NAVY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D3D' } } as any
const GREENBG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } } as any

const num = (v: any) => Number(v) || 0
function fmtD(d?: string | null) {
  if (!d) return ''
  const [y, m, day] = String(d).substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export async function exportRelatorioContasPagar(rows: any[], periodo?: string) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Contas a Pagar', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', paperSize: 9 } })
  ws.columns = [
    { width: 28 }, { width: 34 }, { width: 7 }, { width: 12 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 },
  ]

  ws.getCell('A1').value = `RELATÓRIO DE CONTAS A PAGAR — POR CENTRO DE CUSTO${periodo ? ` · ${periodo}` : ''}`
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1E2D3D' } }
  ws.mergeCells('A1:H1')

  let r = 3
  const headers = ['Fornecedor', 'Descrição', 'Parc.', 'Vencimento', 'Valor', 'Pago', 'Saldo', 'Status']
  headers.forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h; c.fill = NAVY
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    c.alignment = { horizontal: i >= 4 && i <= 6 ? 'right' : 'left' }
  })
  r++

  // agrupa por centro de custo (rows já vem ordenado pelo backend)
  const grupos: Record<string, any[]> = {}
  for (const row of rows) { (grupos[row.centro_custo] ||= []).push(row) }

  let totV = 0, totP = 0, totS = 0
  for (const [centro, items] of Object.entries(grupos)) {
    const gc = ws.getCell(r, 1)
    gc.value = `CENTRO DE CUSTO: ${centro}`
    gc.font = { bold: true, color: { argb: 'FF155724' }, size: 10 }
    ws.mergeCells(r, 1, r, 8)
    for (let col = 1; col <= 8; col++) ws.getCell(r, col).fill = GREENBG
    r++

    let sv = 0, sp = 0, ss = 0
    for (const it of items) {
      const paid = it.status === 'PAGO'
      const cells = [
        it.fornecedor, it.conta_descricao, String(it.numero_parcela), fmtD(it.data_vencimento),
        num(it.valor), num(it.pago), num(it.saldo), paid ? 'PAGO' : 'Aberto',
      ]
      cells.forEach((v, i) => {
        const c = ws.getCell(r, i + 1)
        c.value = v; c.font = { size: 9 }
        if (i >= 4 && i <= 6) { c.numFmt = MONEY; c.alignment = { horizontal: 'right' } }
        if (paid) c.fill = YELLOW
      })
      sv += num(it.valor); sp += num(it.pago); ss += num(it.saldo); r++
    }

    const sc = ws.getCell(r, 4); sc.value = `Subtotal · ${centro}`; sc.font = { bold: true, size: 9 }; sc.alignment = { horizontal: 'right' }
    ;([[5, sv], [6, sp], [7, ss]] as [number, number][]).forEach(([col, val]) => {
      const c = ws.getCell(r, col); c.value = val; c.numFmt = MONEY; c.font = { bold: true, size: 9 }
      c.alignment = { horizontal: 'right' }; c.border = { top: { style: 'thin' } } as any
    })
    r += 2
    totV += sv; totP += sp; totS += ss
  }

  const tc = ws.getCell(r, 4); tc.value = 'TOTAL GERAL'; tc.font = { bold: true, size: 11 }; tc.alignment = { horizontal: 'right' }
  ;([[5, totV], [6, totP], [7, totS]] as [number, number][]).forEach(([col, val]) => {
    const c = ws.getCell(r, col); c.value = val; c.numFmt = MONEY; c.font = { bold: true, size: 11 }
    c.alignment = { horizontal: 'right' }; c.border = { top: { style: 'double' } } as any
  })

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Contas_a_Pagar_${(periodo || '').replace(/\D/g, '') || 'relatorio'}.xlsx`)
}
