import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Relatório de Contas a Receber agrupado por Centro de Custo. Parcelas RECEBIDAS em amarelo discreto.

const MONEY = '#,##0.00'
const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } } as any
const NAVY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2D3D' } } as any
const GREENBG = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } } as any

const num = (v: any) => Number(v) || 0
function fmtD(d?: string | null) {
  if (!d) return ''
  const [y, m, day] = String(d).substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export async function exportRelatorioContasReceber(rows: any[], periodo?: string) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Contas a Receber', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', paperSize: 9 } })
  ws.columns = [
    { width: 28 }, { width: 34 }, { width: 7 }, { width: 12 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 },
  ]

  ws.getCell('A1').value = `RELATÓRIO DE CONTAS A RECEBER — POR CENTRO DE CUSTO${periodo ? ` · ${periodo}` : ''}`
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1E2D3D' } }
  ws.mergeCells('A1:H1')

  let r = 3
  const headers = ['Cliente', 'Descrição', 'Parc.', 'Vencimento', 'Valor', 'Recebido', 'Saldo', 'Status']
  headers.forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h; c.fill = NAVY
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    c.alignment = { horizontal: i >= 4 && i <= 6 ? 'right' : 'left' }
  })
  r++

  const grupos: Record<string, any[]> = {}
  for (const row of rows) { (grupos[row.centro_custo] ||= []).push(row) }

  let totV = 0, totR = 0, totS = 0
  for (const [centro, items] of Object.entries(grupos)) {
    const gc = ws.getCell(r, 1)
    gc.value = `CENTRO DE CUSTO: ${centro}`
    gc.font = { bold: true, color: { argb: 'FF155724' }, size: 10 }
    ws.mergeCells(r, 1, r, 8)
    for (let col = 1; col <= 8; col++) ws.getCell(r, col).fill = GREENBG
    r++

    let sv = 0, sr = 0, ss = 0
    for (const it of items) {
      const recebida = it.status === 'RECEBIDO'
      const cells = [
        it.cliente, it.conta_descricao, String(it.numero_parcela), fmtD(it.data_vencimento),
        num(it.valor), num(it.recebido), num(it.saldo), recebida ? 'RECEBIDO' : 'Aberto',
      ]
      cells.forEach((v, i) => {
        const c = ws.getCell(r, i + 1)
        c.value = v; c.font = { size: 9 }
        if (i >= 4 && i <= 6) { c.numFmt = MONEY; c.alignment = { horizontal: 'right' } }
        if (recebida) c.fill = YELLOW
      })
      sv += num(it.valor); sr += num(it.recebido); ss += num(it.saldo); r++
    }

    const sc = ws.getCell(r, 4); sc.value = `Subtotal · ${centro}`; sc.font = { bold: true, size: 9 }; sc.alignment = { horizontal: 'right' }
    ;([[5, sv], [6, sr], [7, ss]] as [number, number][]).forEach(([col, val]) => {
      const c = ws.getCell(r, col); c.value = val; c.numFmt = MONEY; c.font = { bold: true, size: 9 }
      c.alignment = { horizontal: 'right' }; c.border = { top: { style: 'thin' } } as any
    })
    r += 2
    totV += sv; totR += sr; totS += ss
  }

  const tc = ws.getCell(r, 4); tc.value = 'TOTAL GERAL'; tc.font = { bold: true, size: 11 }; tc.alignment = { horizontal: 'right' }
  ;([[5, totV], [6, totR], [7, totS]] as [number, number][]).forEach(([col, val]) => {
    const c = ws.getCell(r, col); c.value = val; c.numFmt = MONEY; c.font = { bold: true, size: 11 }
    c.alignment = { horizontal: 'right' }; c.border = { top: { style: 'double' } } as any
  })

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Contas_a_Receber_${(periodo || '').replace(/\D/g, '') || 'relatorio'}.xlsx`)
}
