import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Trash2, Pencil, FileSpreadsheet, Percent, FileText } from 'lucide-react'
import { api } from '@/shared/lib/api'
import SearchCombobox from '@/shared/components/ui/SearchCombobox'
import { exportNfseToExcel } from '../utils/exportNfseToExcel'

// ── tokens (Areia+Navy, espelha LivroCaixaPage) ────────────────────────────
const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8', text: '#28374A',
  muted: '#7A8899', navy: '#1E2D3D', mustard: '#FFD200', green: '#059669', red: '#DC2626',
}
const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function fmtDate(d?: string | null) {
  if (!d) return '—'
  const [y, m, day] = String(d).substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}
function maskBRLFromDigits(digits: string): string {
  const cents = (digits || '').replace(/\D/g, '')
  if (!cents) return ''
  return (parseInt(cents, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const digitsToReais = (digits: string): number => {
  const cents = (digits || '').replace(/\D/g, '')
  return cents ? parseInt(cents, 10) / 100 : 0
}
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', border: `1px solid ${G.border}`, borderRadius: 8, fontSize: 13, color: G.text, background: '#fff', marginTop: 4, boxSizing: 'border-box' }
const btnPrimary = (c: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: c, color: c === G.mustard ? G.text : '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.28)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const lbl: React.CSSProperties = { fontSize: 12, color: G.muted, fontWeight: 500, display: 'block' }

// ── tipos ────────────────────────────────────────────────────────────────
interface Aliquotas {
  regime?: string
  irrf_pct: number; pis_pct: number; cofins_pct: number; csll_pct: number
  irpj_pct: number; iss_pct: number; fgts_gps_pct: number
}
interface Nfse {
  id: number; numero: string | null; emissao: string; competencia: string
  for_codigo: number; representada_nome: string | null; representada_label?: string
  vr_bruto: number; irrf: number; pis: number; cofins: number; csll: number
  irpj: number; iss: number; fgts_gps: number; liquido_nf: number; liq_rec: number
  data_pgto: string | null; transf: boolean; obs: string | null
}
interface Totais {
  qtd: number; vr_bruto: number; impostos: number; liquido_nf: number; liq_rec: number
}
interface Repres { for_codigo: number; for_nome: string; for_nomered: string }

const ALIQ_DEFAULT: Aliquotas = { regime: 'PRESUMIDO', irrf_pct: 0, pis_pct: 0, cofins_pct: 0, csll_pct: 0, irpj_pct: 0, iss_pct: 0, fgts_gps_pct: 0 }

// apura no cliente (preview no modal); o servidor é a fonte da verdade ao gravar
function calcPreview(vrBruto: number, a: Aliquotas) {
  const bruto = r2(vrBruto)
  const pct = (p: number) => r2(bruto * (Number(p) || 0) / 100)
  const irrf = pct(a.irrf_pct), pis = pct(a.pis_pct), cofins = pct(a.cofins_pct), csll = pct(a.csll_pct)
  const irpj = pct(a.irpj_pct), iss = pct(a.iss_pct), fgts_gps = pct(a.fgts_gps_pct)
  const liquido_nf = r2(bruto - irrf)
  const liq_rec = r2(liquido_nf - (pis + cofins + csll + irpj + iss + fgts_gps))
  return { irrf, pis, cofins, csll, irpj, iss, fgts_gps, liquido_nf, liq_rec }
}

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const todayISO = () => new Date().toISOString().split('T')[0]

export default function NfseComissoesPage() {
  const [competencia, setCompetencia] = useState(thisMonth())
  const [list, setList] = useState<Nfse[]>([])
  const [totais, setTotais] = useState<Totais>({ qtd: 0, vr_bruto: 0, impostos: 0, liquido_nf: 0, liq_rec: 0 })
  const [aliq, setAliq] = useState<Aliquotas>(ALIQ_DEFAULT)
  const [representadas, setRepresentadas] = useState<Repres[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<Nfse | 'new' | null>(null)
  const [aliqModal, setAliqModal] = useState(false)

  const reps = useMemo(() => representadas.map(r => ({ id: r.for_codigo, nome: (r.for_nomered || r.for_nome || '').trim() })), [representadas])

  const reload = async () => {
    setLoading(true)
    try {
      const r = await api.get('/nfse', { params: { competencia } })
      setList(r.data.data || [])
      setTotais(r.data.totais || { qtd: 0, vr_bruto: 0, impostos: 0, liquido_nf: 0, liq_rec: 0 })
    } catch { setList([]) } finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [competencia])
  useEffect(() => {
    api.get('/nfse/aliquotas').then(r => setAliq({ ...ALIQ_DEFAULT, ...(r.data.data || {}) })).catch(() => {})
    api.get('/nfse/representadas').then(r => setRepresentadas(r.data.data || [])).catch(() => {})
  }, [])

  const del = async (id: number) => {
    if (!confirm('Excluir esta NFS-e?')) return
    await api.delete(`/nfse/${id}`); reload()
  }

  return (
    <div style={{ background: G.bg, minHeight: '100vh', padding: 20 }}>
      {/* HERO */}
      <div style={{ background: G.navy, borderRadius: 14, padding: '18px 22px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <FileText size={20} color={G.mustard} />
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Controle de NFS-e · Comissões</h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#B9C4D0' }}>Notas de serviço emitidas às representadas — apuração de impostos e comissão líquida</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: '#B9C4D0' }}>
            Competência
            <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)}
              style={{ ...inputStyle, width: 160, marginTop: 2, color: G.text }} />
          </label>
          <button style={btnGhost} onClick={() => setAliqModal(true)}><Percent size={15} /> Alíquotas</button>
          <button style={btnGhost} onClick={() => exportNfseToExcel(competencia, list, totais)} disabled={!list.length}>
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button style={btnPrimary(G.mustard)} onClick={() => setModal('new')}><Plus size={16} /> Nova NF</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, margin: '14px 0' }}>
        <KpiCard label="Notas no mês" value={String(totais.qtd)} color={G.text} />
        <KpiCard label="Valor Bruto (comissão)" value={fmtBRL(totais.vr_bruto)} color={G.navy} />
        <KpiCard label="Impostos do escritório" value={fmtBRL(totais.impostos)} color={G.red} />
        <KpiCard label="Comissão Líquida" value={fmtBRL(totais.liq_rec)} color={G.green} accent />
      </div>

      {/* TABELA */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: G.navy, color: '#fff' }}>
                {['NF', 'Emissão', 'Representada', 'VR Bruto', 'PIS', 'IRPJ', 'CSLL', 'COFINS', 'ISS', 'FGTS/GPS', 'Líquido NF', 'Líq Rec', 'Pgto', 'Transf', 'OBS', ''].map((h, i) => (
                  <th key={i} style={{ padding: '9px 8px', textAlign: i >= 3 && i <= 11 ? 'right' : 'left', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} style={{ padding: 24, textAlign: 'center', color: G.muted }}>Carregando…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={16} style={{ padding: 24, textAlign: 'center', color: G.muted }}>Nenhuma NFS-e nesta competência. Clique em “Nova NF”.</td></tr>
              ) : list.map((n, idx) => (
                <tr key={n.id} style={{ borderTop: `1px solid ${G.border}`, background: idx % 2 ? '#FBF9F4' : '#fff' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 700, fontFamily: 'monospace' }}>{n.numero || '—'}</td>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{fmtDate(n.emissao)}</td>
                  <td style={{ padding: '7px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.representada_label || n.representada_nome || n.for_codigo}</td>
                  <td style={cellR(700)}>{fmtNum(n.vr_bruto)}</td>
                  <td style={cellR()}>{fmtNum(n.pis)}</td>
                  <td style={cellR()}>{fmtNum(n.irpj)}</td>
                  <td style={cellR()}>{fmtNum(n.csll)}</td>
                  <td style={cellR()}>{fmtNum(n.cofins)}</td>
                  <td style={cellR()}>{fmtNum(n.iss)}</td>
                  <td style={cellR()}>{fmtNum(n.fgts_gps)}</td>
                  <td style={cellR(600)}>{fmtNum(n.liquido_nf)}</td>
                  <td style={{ ...cellR(700), color: G.green }}>{fmtNum(n.liq_rec)}</td>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{fmtDate(n.data_pgto)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{n.transf ? '✓' : '—'}</td>
                  <td style={{ padding: '7px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: G.muted }}>{n.obs || ''}</td>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                    <button title="Editar" onClick={() => setModal(n)} style={iconBtn}><Pencil size={14} /></button>
                    <button title="Excluir" onClick={() => del(n.id)} style={{ ...iconBtn, color: G.red }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: `2px solid ${G.navy}`, background: '#F1ECE0', fontWeight: 700 }}>
                  <td colSpan={3} style={{ padding: '9px 8px' }}>TOTAL ({totais.qtd})</td>
                  <td style={cellR(700)}>{fmtNum(totais.vr_bruto)}</td>
                  <td colSpan={6} style={{ padding: '9px 8px', textAlign: 'right', color: G.red }}>Impostos: {fmtNum(totais.impostos)}</td>
                  <td style={cellR(700)}>{fmtNum(totais.liquido_nf)}</td>
                  <td style={{ ...cellR(700), color: G.green }}>{fmtNum(totais.liq_rec)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modal && (
        <NfseModal
          data={modal === 'new' ? null : modal}
          competencia={competencia} aliq={aliq} reps={reps}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload() }}
        />
      )}
      {aliqModal && (
        <AliquotasModal aliq={aliq} onClose={() => setAliqModal(false)}
          onSaved={(a) => { setAliq(a); setAliqModal(false); reload() }} />
      )}
    </div>
  )
}

const cellR = (weight: number = 400): React.CSSProperties => ({ padding: '7px 8px', textAlign: 'right', fontWeight: weight, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' })
const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }

function KpiCard({ label, value, color, accent }: { label: string; value: string; color: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? G.navy : G.card, border: `1px solid ${accent ? G.navy : G.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: accent ? '#B9C4D0' : G.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: accent ? G.mustard : color, marginTop: 4 }}>{value}</div>
    </div>
  )
}

// ── Modal de lançamento ────────────────────────────────────────────────────
function NfseModal({ data, competencia, aliq, reps, onClose, onSaved }: {
  data: Nfse | null; competencia: string; aliq: Aliquotas
  reps: { id: number; nome: string }[]; onClose: () => void; onSaved: () => void
}) {
  const [numero, setNumero] = useState(data?.numero || '')
  const [emissao, setEmissao] = useState(data?.emissao?.substring(0, 10) || todayISO())
  const [forCodigo, setForCodigo] = useState(data ? String(data.for_codigo) : '')
  const [brutoDigits, setBrutoDigits] = useState(data ? String(Math.round((data.vr_bruto || 0) * 100)) : '')
  const [dataPgto, setDataPgto] = useState(data?.data_pgto?.substring(0, 10) || '')
  const [transf, setTransf] = useState<boolean>(!!data?.transf)
  const [obs, setObs] = useState(data?.obs || '')
  const [saving, setSaving] = useState(false)

  const vrBruto = digitsToReais(brutoDigits)
  const prev = useMemo(() => calcPreview(vrBruto, aliq), [vrBruto, aliq])

  const save = async () => {
    if (!forCodigo) { alert('Selecione a representada.'); return }
    if (vrBruto <= 0) { alert('Informe o valor bruto (VR Bruto) da comissão.'); return }
    if (!emissao) { alert('Informe a data de emissão.'); return }
    setSaving(true)
    try {
      const body = {
        numero: numero.trim() || null, emissao, competencia,
        for_codigo: Number(forCodigo),
        representada_nome: reps.find(r => String(r.id) === forCodigo)?.nome || null,
        vr_bruto: vrBruto, data_pgto: dataPgto || null, transf, obs: obs.trim() || null,
      }
      if (data) await api.put(`/nfse/${data.id}`, body)
      else await api.post('/nfse', body)
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao salvar.') } finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, color: G.text }}>{data ? 'Editar NFS-e' : 'Nova NFS-e'}</h2>
        <button onClick={onClose} style={iconBtn}><X size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={lbl}>Nº da NF
          <input value={numero} onChange={e => setNumero(e.target.value)} style={inputStyle} placeholder="ex: 111" />
        </label>
        <label style={lbl}>Emissão
          <input type="date" value={emissao} onChange={e => setEmissao(e.target.value)} style={inputStyle} />
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={lbl}>Representada</span>
          <div style={{ marginTop: 4 }}>
            <SearchCombobox options={reps} value={forCodigo} onChange={setForCodigo} placeholder="Selecionar representada…" required />
          </div>
        </div>
        <div>
          <span style={lbl}>VR Bruto (comissão)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input value={maskBRLFromDigits(brutoDigits)} onChange={e => setBrutoDigits(e.target.value.replace(/\D/g, ''))}
              style={{ ...inputStyle, marginTop: 0, textAlign: 'right', fontWeight: 700, flex: 1 }} placeholder="0,00" inputMode="numeric" />
            <button
              type="button"
              disabled
              title="Em breve: calcula o valor a partir do faturamento da representada × % de comissão"
              style={{ flexShrink: 0, padding: '9px 11px', borderRadius: 8, border: `1px solid ${G.border}`, background: '#F1F5F9', color: G.muted, fontWeight: 700, fontSize: 11, cursor: 'not-allowed', whiteSpace: 'nowrap', lineHeight: 1.2 }}
            >
              🔎 Buscar valor a receber <span style={{ fontSize: 10, opacity: 0.75 }}>(em breve)</span>
            </button>
          </div>
        </div>
        <label style={lbl}>Data de Pagamento
          <input type="date" value={dataPgto} onChange={e => setDataPgto(e.target.value)} style={inputStyle} />
        </label>
        <label style={lbl}>Observação
          <input value={obs} onChange={e => setObs(e.target.value)} style={inputStyle} placeholder="OK / pendente…" />
        </label>
        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
          <input type="checkbox" checked={transf} onChange={e => setTransf(e.target.checked)} /> Transferido (B.B.)
        </label>
      </div>

      {/* preview da apuração */}
      <div style={{ marginTop: 14, background: '#FBF9F4', border: `1px solid ${G.border}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Apuração ({aliq.regime || 'PRESUMIDO'})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
          <Prev l="IRRF" v={prev.irrf} /><Prev l="PIS" v={prev.pis} /><Prev l="COFINS" v={prev.cofins} /><Prev l="CSLL" v={prev.csll} />
          <Prev l="IRPJ" v={prev.irpj} /><Prev l="ISS" v={prev.iss} /><Prev l="FGTS/GPS" v={prev.fgts_gps} /><Prev l="Líquido NF" v={prev.liquido_nf} strong />
        </div>
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: G.muted }}>Comissão líquida a receber</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: G.green }}>{fmtBRL(prev.liq_rec)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', marginTop: 0 }}>Cancelar</button>
        <button onClick={save} disabled={saving} style={btnPrimary(G.green)}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Overlay>
  )
}
function Prev({ l, v, strong }: { l: string; v: number; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: G.muted }}>{l}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: G.text, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(v)}</span>
    </div>
  )
}

// ── Modal de alíquotas ──────────────────────────────────────────────────────
function AliquotasModal({ aliq, onClose, onSaved }: { aliq: Aliquotas; onClose: () => void; onSaved: (a: Aliquotas) => void }) {
  const [a, setA] = useState<Aliquotas>(aliq)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Aliquotas, v: string) => setA(p => ({ ...p, [k]: v === '' ? 0 : parseFloat(v.replace(',', '.')) || 0 }))
  const fields: { k: keyof Aliquotas; l: string }[] = [
    { k: 'irrf_pct', l: 'IRRF (retido)' }, { k: 'pis_pct', l: 'PIS' }, { k: 'cofins_pct', l: 'COFINS' }, { k: 'csll_pct', l: 'CSLL' },
    { k: 'irpj_pct', l: 'IRPJ' }, { k: 'iss_pct', l: 'ISS' }, { k: 'fgts_gps_pct', l: 'FGTS/GPS' },
  ]
  const save = async () => {
    setSaving(true)
    try { const r = await api.put('/nfse/aliquotas', a); onSaved({ ...ALIQ_DEFAULT, ...r.data.data }) }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao salvar.') } finally { setSaving(false) }
  }
  return (
    <Overlay onClose={onClose} width={440}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 17, color: G.text }}>Matriz de Alíquotas</h2>
        <button onClick={onClose} style={iconBtn}><X size={18} /></button>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: G.muted }}>% sobre o valor bruto da comissão. Vale para os próximos lançamentos (o histórico já gravado não muda).</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {fields.map(f => (
          <label key={f.k} style={lbl}>{f.l} (%)
            <input value={String(a[f.k] ?? 0)} onChange={e => set(f.k, e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} inputMode="decimal" />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', marginTop: 0 }}>Cancelar</button>
        <button onClick={save} disabled={saving} style={btnPrimary(G.green)}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose, width = 620 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: G.card, borderRadius: 14, padding: 22, width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        {children}
      </div>
    </div>
  )
}
