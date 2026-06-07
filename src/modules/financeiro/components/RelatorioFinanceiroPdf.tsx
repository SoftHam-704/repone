import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'

// ─────────────────────────────────────────────────────────────────────────────
// Relatório impresso (PDF A4) de Contas a Pagar / a Receber.
// Cabeçalho com logotipo + dados da representação, agrupamento por Centro de
// Custo OU Fornecedor/Cliente, subtotais, total geral, paginação e assinatura.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  navy: '#1E2D3D', ink: '#28374A', muted: '#7A8899', border: '#D6CDB8',
  green: '#0F7B53', amber: '#B45309', yellow: '#FEF9C3', soft: '#F4F1EA',
  groupPag: '#E7EFE9', groupRec: '#E7EFF6', line: '#E3DCCB',
}

export interface LinhaRel {
  centro_custo: string
  entidade: string
  conta_descricao: string
  numero_documento?: string | null
  numero_parcela: number
  data_vencimento: string
  valor: number
  pago: number
  saldo: number
  status: string
  paga: boolean
}

export interface Empresa {
  emp_nome?: string; emp_logotipo?: string | null; emp_cnpj?: string; emp_inscricao?: string
  emp_endereco?: string; emp_bairro?: string; emp_cidade?: string; emp_uf?: string
  emp_cep?: string; emp_fones?: string
}

export interface RelConfig {
  titulo: string             // "Relatório de Contas a Pagar"
  entidadeLabel: string      // "Fornecedor" | "Cliente"
  valorPagoLabel: string     // "Pago" | "Recebido"
  statusPagoLabel: string    // "PAGO" | "RECEBIDO"
  accent: 'pagar' | 'receber'
  empresa: Empresa | null
  periodo: string            // "01/06/2026 a 30/06/2026"
  filtros: string[]          // ["Fornecedor: Todos", "Centro de custo: Todos", "Status: Em aberto"]
  agruparPor: 'centro' | 'entidade'
  rows: LinhaRel[]
  emitidoEm: string          // "07/06/2026 14:32"
}

const money = (n: number) =>
  'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function fmtDate(d?: string | null) {
  if (!d) return '—'
  const [y, m, day] = String(d).substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}
function logoSrc(raw?: string | null): string | null {
  if (!raw) return null
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
}

const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 46, paddingHorizontal: 26, fontSize: 8, color: C.ink, fontFamily: 'Helvetica' },

  // Cabeçalho
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: C.navy, paddingBottom: 10, marginBottom: 10 },
  logoBox: { width: 86, height: 56, marginRight: 14, justifyContent: 'center', alignItems: 'center' },
  logo: { maxWidth: 86, maxHeight: 56, objectFit: 'contain' },
  empNome: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 2 },
  empLinha: { fontSize: 8, color: C.muted, marginBottom: 1 },

  // Faixa do título
  tituloBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 4 },
  tituloTxt: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tituloPer: { fontSize: 8, color: 'rgba(255,255,255,0.85)' },
  filtrosTxt: { fontSize: 8, color: C.muted, marginBottom: 8 },

  // Tabela
  thead: { flexDirection: 'row', backgroundColor: C.soft, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.navy, paddingVertical: 5 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.navy, paddingHorizontal: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3.5, minHeight: 15 },
  td: { fontSize: 8, paddingHorizontal: 4 },

  groupBar: { backgroundColor: C.soft, paddingVertical: 4, paddingHorizontal: 6, marginTop: 8, borderLeftWidth: 3 },
  groupTxt: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy },
  subtotal: { flexDirection: 'row', backgroundColor: '#FBF9F4', borderTopWidth: 0.5, borderTopColor: C.border, paddingVertical: 4 },

  totalGeral: { flexDirection: 'row', backgroundColor: C.navy, borderRadius: 4, paddingVertical: 7, marginTop: 12 },
  totalTxt: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#fff', paddingHorizontal: 4 },

  assinatura: { marginTop: 38, flexDirection: 'row', justifyContent: 'space-around' },
  assBox: { width: '40%', alignItems: 'center' },
  assLine: { borderTopWidth: 1, borderTopColor: C.ink, width: '100%', marginBottom: 3 },
  assTxt: { fontSize: 7.5, color: C.muted },

  footer: { position: 'absolute', bottom: 20, left: 26, right: 26, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 5 },
  footerTxt: { fontSize: 7, color: C.muted },
})

// larguras das colunas (proporção); a 1ª coluna é a "outra" dimensão (não agrupada)
const COL = { ent: 1.7, desc: 2.2, parc: 0.5, venc: 0.95, valor: 1.1, pago: 1.1, saldo: 1.1, status: 0.85 }
const flex = (n: number) => ({ flexGrow: n, flexBasis: 0 })

function Th({ children, n, align = 'left' }: { children: any; n: number; align?: any }) {
  return <Text style={[s.th, flex(n), { textAlign: align }]}>{children}</Text>
}
function Td({ children, n, align = 'left', color, bold }: { children: any; n: number; align?: any; color?: string; bold?: boolean }) {
  return <Text style={[s.td, flex(n), { textAlign: align, color: color || C.ink, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }]}>{children}</Text>
}

function RelDoc(cfg: RelConfig) {
  const e = cfg.empresa || {}
  const logo = logoSrc(e.emp_logotipo)
  const accent = cfg.accent === 'pagar' ? C.amber : C.green
  const groupBg = cfg.accent === 'pagar' ? C.groupPag : C.groupRec
  const colEntCabec = cfg.agruparPor === 'centro' ? cfg.entidadeLabel : 'Centro de Custo'

  // agrupa
  const grupos: Record<string, { items: LinhaRel[]; v: number; p: number; sa: number }> = {}
  let totV = 0, totP = 0, totS = 0
  for (const r of cfg.rows) {
    const k = (cfg.agruparPor === 'centro' ? r.centro_custo : r.entidade) || '(Sem)'
    if (!grupos[k]) grupos[k] = { items: [], v: 0, p: 0, sa: 0 }
    grupos[k].items.push(r)
    grupos[k].v += Number(r.valor); grupos[k].p += Number(r.pago); grupos[k].sa += Number(r.saldo)
    totV += Number(r.valor); totP += Number(r.pago); totS += Number(r.saldo)
  }
  const rotuloGrupo = cfg.agruparPor === 'centro' ? 'CENTRO DE CUSTO' : cfg.entidadeLabel.toUpperCase()

  const endereco = [e.emp_endereco, e.emp_bairro].filter(Boolean).join(', ')
  const cidade = [[e.emp_cidade, e.emp_uf].filter(Boolean).join('/'), e.emp_cep && `CEP ${e.emp_cep}`].filter(Boolean).join(' · ')

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho da representação */}
        <View style={s.header} fixed>
          {logo && <View style={s.logoBox}><Image src={logo} style={s.logo} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={s.empNome}>{e.emp_nome || 'Representação'}</Text>
            {(e.emp_cnpj || e.emp_inscricao) && (
              <Text style={s.empLinha}>
                {e.emp_cnpj ? `CNPJ: ${e.emp_cnpj}` : ''}{e.emp_cnpj && e.emp_inscricao ? '   ·   ' : ''}{e.emp_inscricao ? `IE: ${e.emp_inscricao}` : ''}
              </Text>
            )}
            {endereco ? <Text style={s.empLinha}>{endereco}</Text> : null}
            {cidade ? <Text style={s.empLinha}>{cidade}</Text> : null}
            {e.emp_fones ? <Text style={s.empLinha}>Fones: {e.emp_fones}</Text> : null}
          </View>
        </View>

        {/* Título + período */}
        <View style={s.tituloBar}>
          <Text style={s.tituloTxt}>{cfg.titulo}</Text>
          <Text style={s.tituloPer}>Período: {cfg.periodo}</Text>
        </View>
        <Text style={s.filtrosTxt}>
          {cfg.filtros.join('   ·   ')}   ·   Agrupado por: {cfg.agruparPor === 'centro' ? 'Centro de Custo' : cfg.entidadeLabel}
        </Text>

        {/* Cabeçalho da tabela (repete em toda página) */}
        <View style={s.thead} fixed>
          <Th n={COL.ent}>{colEntCabec}</Th>
          <Th n={COL.desc}>Descrição</Th>
          <Th n={COL.parc} align="center">Parc.</Th>
          <Th n={COL.venc} align="center">Vencimento</Th>
          <Th n={COL.valor} align="right">Valor</Th>
          <Th n={COL.pago} align="right">{cfg.valorPagoLabel}</Th>
          <Th n={COL.saldo} align="right">Saldo</Th>
          <Th n={COL.status} align="center">Status</Th>
        </View>

        {/* Grupos */}
        {Object.entries(grupos).map(([nome, g]) => (
          <View key={nome}>
            <View style={[s.groupBar, { borderLeftColor: accent, backgroundColor: groupBg }]} wrap={false}>
              <Text style={s.groupTxt}>{rotuloGrupo}: {nome}</Text>
            </View>
            {g.items.map((it, idx) => {
              const outra = cfg.agruparPor === 'centro' ? it.entidade : it.centro_custo
              return (
                <View key={idx} style={[s.row, it.paga ? { backgroundColor: C.yellow } : {}]} wrap={false}>
                  <Td n={COL.ent} bold>{outra || '—'}</Td>
                  <Td n={COL.desc} color={C.muted}>{it.conta_descricao}</Td>
                  <Td n={COL.parc} align="center">{it.numero_parcela}</Td>
                  <Td n={COL.venc} align="center">{fmtDate(it.data_vencimento)}</Td>
                  <Td n={COL.valor} align="right">{money(it.valor)}</Td>
                  <Td n={COL.pago} align="right" color={C.green}>{Number(it.pago) > 0 ? money(it.pago) : '—'}</Td>
                  <Td n={COL.saldo} align="right" color={Number(it.saldo) > 0 ? C.amber : C.muted}>{Number(it.saldo) > 0 ? money(it.saldo) : '—'}</Td>
                  <Td n={COL.status} align="center" bold color={it.paga ? C.amber : C.muted}>{it.paga ? cfg.statusPagoLabel : 'Aberto'}</Td>
                </View>
              )
            })}
            <View style={s.subtotal}>
              <Td n={COL.ent + COL.desc + COL.parc + COL.venc} align="right" bold>Subtotal · {nome}    </Td>
              <Td n={COL.valor} align="right" bold>{money(g.v)}</Td>
              <Td n={COL.pago} align="right" bold color={C.green}>{money(g.p)}</Td>
              <Td n={COL.saldo} align="right" bold color={C.amber}>{money(g.sa)}</Td>
              <Td n={COL.status} align="center"> </Td>
            </View>
          </View>
        ))}

        {/* Total geral */}
        <View style={s.totalGeral}>
          <Text style={[s.totalTxt, flex(COL.ent + COL.desc + COL.parc + COL.venc), { textAlign: 'right' }]}>TOTAL GERAL    </Text>
          <Text style={[s.totalTxt, flex(COL.valor), { textAlign: 'right' }]}>{money(totV)}</Text>
          <Text style={[s.totalTxt, flex(COL.pago), { textAlign: 'right' }]}>{money(totP)}</Text>
          <Text style={[s.totalTxt, flex(COL.saldo), { textAlign: 'right' }]}>{money(totS)}</Text>
          <Text style={[s.totalTxt, flex(COL.status)]}> </Text>
        </View>

        {/* Assinatura */}
        <View style={s.assinatura} wrap={false}>
          <View style={s.assBox}><View style={s.assLine} /><Text style={s.assTxt}>Responsável Financeiro</Text></View>
          <View style={s.assBox}><View style={s.assLine} /><Text style={s.assTxt}>Diretoria</Text></View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>Emitido em {cfg.emitidoEm} · {cfg.titulo}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// Gera o PDF e abre em nova aba (pronto pra imprimir/salvar).
export async function imprimirRelatorioFinanceiro(cfg: RelConfig) {
  const blob = await pdf(<RelDoc {...cfg} />).toBlob()
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    // popup bloqueado — força download
    const a = document.createElement('a')
    a.href = url; a.download = `${cfg.titulo.replace(/\s+/g, '_')}.pdf`; a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
