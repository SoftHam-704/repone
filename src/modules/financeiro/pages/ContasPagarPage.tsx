import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, Eye, Check, Trash2, ArrowUpCircle, X, Pencil, ChevronDown, ChevronUp, FileText, Layers } from 'lucide-react'
import { api } from '@/shared/lib/api'
import ParcelasEditor, { type ParcelaLinha } from '../components/ParcelasEditor'
import LancamentoLoteModal from '../components/LancamentoLoteModal'
import { analiticasPorTipo } from '../utils/planoContas'

const G = {
  bg:      '#E8E1D4',
  card:    '#FFFFFF',
  border:  '#D6CDB8',
  text:    '#28374A',
  muted:   '#7A8899',
  mustard: '#FFD200',
  green:   '#059669',
  red:     '#DC2626',
  amber:   '#D97706',
  navy:    '#1E2D3D',
}

const GRID_BG = `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 0v40M40 0v40M0 0h40M0 40h40' stroke='%23ffffff' stroke-width='0.4' stroke-opacity='0.07'/%3E%3C/svg%3E")`

function fmtBRL(v: any) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}
// Máscara de moeda BRL para inputs controlados: estado interno em dígitos
// (centavos como string), display formatado. Usuário digita da direita p/ esquerda.
function maskBRLFromDigits(digits: string): string {
  const cents = (digits || '').replace(/\D/g, '');
  if (!cents) return '';
  const num = parseInt(cents, 10) / 100;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function digitsToReais(digits: string): number {
  const cents = (digits || '').replace(/\D/g, '');
  return cents ? parseInt(cents, 10) / 100 : 0;
}
function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.substring(0, 10).split('-')
  return `${day}/${m}/${y}`
}
function todayISO() { return new Date().toISOString().split('T')[0] }
function firstOfMonth() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

type Status = 'ABERTO' | 'PAGO' | 'VENCIDO' | 'CANCELADO'

interface Parcela {
  id: number
  numero_parcela: number
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  valor_pago: number | null
  juros: number
  desconto: number
  status: Status
}

interface Conta {
  id: number
  descricao: string
  numero_documento: string
  valor_total: number
  valor_pago: number
  saldo: number
  data_emissao: string
  data_vencimento: string
  status: Status
  fornecedor_nome: string
  plano_contas_descricao: string
  pago_periodo?: number
  parcelas?: Parcela[]
}

interface FinFornecedor { id: number; nome_razao: string }
interface PlanoContas { id: number; codigo: string; descricao: string; tipo: string }

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; bg: string; color: string }> = {
    ABERTO:    { label: 'Aberto',    bg: '#E0F2FE', color: '#0369A1' },
    PAGO:      { label: 'Pago',      bg: '#D1FAE5', color: '#065F46' },
    VENCIDO:   { label: 'Vencido',   bg: '#FEE2E2', color: '#991B1B' },
    CANCELADO: { label: 'Cancelado', bg: '#F3F4F6', color: '#6B7280' },
  }
  const s = map[status] ?? map.ABERTO
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// Form UI Subcomponents with focus/hover states
function FormInput({
  label,
  required = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ fontSize: 12, color: G.muted, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <span style={{ color: G.text }}>{label} {required && <span style={{ color: G.red }}>*</span>}</span>
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 14px',
          border: focused ? `1.5px solid ${G.navy}` : `1px solid ${G.border}`,
          borderRadius: 8,
          fontSize: 13,
          background: '#fff',
          color: G.text,
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: focused ? `${G.navy}1a 0px 0px 0px 3px` : 'none',
          transition: 'all 0.15s ease-in-out',
        }}
        {...props}
      />
    </label>
  )
}

function FormTextarea({
  label,
  required = false,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; required?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ fontSize: 12, color: G.muted, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <span style={{ color: G.text }}>{label} {required && <span style={{ color: G.red }}>*</span>}</span>
      <textarea
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 14px',
          border: focused ? `1.5px solid ${G.navy}` : `1px solid ${G.border}`,
          borderRadius: 8,
          fontSize: 13,
          background: '#fff',
          color: G.text,
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: focused ? `${G.navy}1a 0px 0px 0px 3px` : 'none',
          transition: 'all 0.15s ease-in-out',
          height: 68,
          resize: 'vertical',
        }}
        {...props}
      />
    </label>
  )
}

interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
}

function CustomCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = '— Selecionar —',
  required = false
}: {
  label: string
  options: ComboboxOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(o => String(o.value) === String(value))

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <label style={{ fontSize: 12, color: G.muted, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: G.text }}>{label} {required && <span style={{ color: G.red }}>*</span>}</span>
        <div
          onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          tabIndex={0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '10px 14px',
            border: isOpen || isFocused ? `1.5px solid ${G.navy}` : `1px solid ${G.border}`,
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
            color: selectedOption ? G.text : G.muted,
            cursor: 'pointer',
            boxSizing: 'border-box',
            outline: 'none',
            boxShadow: isOpen || isFocused ? `${G.navy}1a 0px 0px 0px 3px` : 'none',
            transition: 'all 0.15s ease-in-out',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? (
              selectedOption.sublabel ? `${selectedOption.sublabel} — ${selectedOption.label}` : selectedOption.label
            ) : (
              placeholder
            )}
          </span>
          {isOpen ? <ChevronUp size={16} color={G.muted} /> : <ChevronDown size={16} color={G.muted} />}
        </div>
      </label>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: '#ffffff',
            border: `1px solid ${G.border}`,
            borderRadius: 8,
            boxShadow: '0 8px 30px rgba(40,55,74,0.15)',
            zIndex: 1010,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 8, borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 6, background: '#FAF8F5' }}>
            <Search size={14} color={G.muted} />
            <input
              autoFocus
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: G.text,
              }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: G.muted, textAlign: 'center' }}>
                Nenhum resultado encontrado
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value)
                const isHovered = hoveredIdx === idx
                return (
                  <div
                    key={opt.value}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => {
                      onChange(String(opt.value))
                      setIsOpen(false)
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: 13,
                      color: isSelected ? '#fff' : G.text,
                      background: isSelected ? G.navy : isHovered ? '#F5F2EC' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? 600 : 500 }}>{opt.label}</span>
                    {opt.sublabel && (
                      <span style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.7)' : G.muted }}>
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13,
  background: '#fff', color: G.text, outline: 'none', boxSizing: 'border-box',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', border: `1px solid ${G.border}`, background: 'transparent',
  borderRadius: 7, fontSize: 13, color: G.text, cursor: 'pointer',
}
const btnPrimary = (bg: string): React.CSSProperties => ({
  padding: '8px 18px', border: 'none', background: bg,
  borderRadius: 7, fontSize: 13, color: '#fff', cursor: 'pointer', fontWeight: 600,
})

function NovaContaModal({ onClose, onSaved, fornecedores, planoContas, centrosCusto, editingId }: {
  onClose: () => void; onSaved: () => void
  fornecedores: FinFornecedor[]; planoContas: PlanoContas[]; centrosCusto: any[]
  editingId?: number | null
}) {
  const isEdit = editingId != null
  const [form, setForm] = useState({
    descricao: '', id_fornecedor: '', numero_documento: '',
    valor_total: '', data_emissao: todayISO(), data_vencimento: todayISO(),
    observacoes: '', id_plano_contas: '', id_centro_custo: '',
  })
  const [parcelasGrid, setParcelasGrid] = useState<ParcelaLinha[]>([])
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(isEdit)
  const [hasPago, setHasPago]   = useState(false)
  const [error, setError]       = useState('')
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isEdit) return
    api.get(`/financeiro/contas-pagar/${editingId}`).then(r => {
      if (!r.data.success) return
      const c = r.data.data
      const parcelas: any[] = c.parcelas ?? []
      // valor_total no estado = string de centavos (dígitos)
      const cents = Math.round(Number(c.valor_total) * 100).toString()
      setForm({
        descricao: c.descricao ?? '',
        id_fornecedor: c.id_fornecedor ? String(c.id_fornecedor) : '',
        numero_documento: c.numero_documento ?? '',
        valor_total: cents,
        data_emissao: (c.data_emissao ?? todayISO()).substring(0, 10),
        data_vencimento: (c.data_vencimento ?? todayISO()).substring(0, 10),
        observacoes: c.observacoes ?? '',
        id_plano_contas: c.id_plano_contas ? String(c.id_plano_contas) : '',
        id_centro_custo: c.id_centro_custo ? String(c.id_centro_custo) : '',
      })
      // Inicializa a grade a partir das parcelas existentes
      if (parcelas.length > 0) {
        setParcelasGrid(parcelas.map(p => ({
          numero_parcela: p.numero_parcela,
          data_vencimento: (p.data_vencimento ?? '').substring(0, 10),
          valor: Number(p.valor),
        })))
      }
      setHasPago(Number(c.valor_pago) > 0)
    }).catch(() => setError('Falha ao carregar conta.')).finally(() => setLoading(false))
  }, [editingId, isEdit])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const valorReais = digitsToReais(form.valor_total)
    if (!form.descricao || valorReais <= 0 || !form.data_vencimento) { setError('Preencha os campos obrigatórios.'); return }
    if (parcelasGrid.length === 0) { setError('Calcule as parcelas antes de salvar.'); return }
    if (isEdit && hasPago && !confirm('Esta conta já tem pagamentos registrados. Editar irá APAGAR todas as parcelas (inclusive as pagas) e regenerar. Continuar?')) return
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        valor_total: valorReais,
        numero_parcelas: parcelasGrid.length,
        parcelas: parcelasGrid,
        id_fornecedor:  form.id_fornecedor || null,
        id_plano_contas: form.id_plano_contas || null,
        id_centro_custo: form.id_centro_custo || null,
      }
      if (isEdit) await api.put(`/financeiro/contas-pagar/${editingId}`, payload)
      else        await api.post('/financeiro/contas-pagar', payload)
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  // Prepara opções dos comboboxes
  const fornecedorOpts = fornecedores.map(f => ({ value: String(f.id), label: f.nome_razao }))
  const planoOpts = analiticasPorTipo(planoContas, 'D').map(p => ({ value: String(p.id), label: p.descricao, sublabel: p.codigo }))
  const centroOpts = centrosCusto.filter(c => c.ativo !== false).map(c => ({ value: String(c.id), label: c.descricao, sublabel: c.codigo || undefined }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(40, 55, 74, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(40,55,74,0.18)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${G.border}` }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${G.navy}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} color={G.navy} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>{isEdit ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h3>
            <p style={{ margin: 0, fontSize: 11, color: G.muted }}>{isEdit ? 'Atualize as informações do lançamento financeiro' : 'Cadastre um novo compromisso financeiro'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando...</div> : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, borderLeft: `4px solid ${G.red}` }}>{error}</div>}
          {isEdit && hasPago && (
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', padding: '10px 14px', borderRadius: 8, fontSize: 12, borderLeft: '4px solid #F59E0B' }}>
              ⚠ Esta conta tem pagamentos registrados. Salvar irá <strong>apagar todas as parcelas (inclusive as pagas)</strong> e regenerar a partir dos novos valores.
            </div>
          )}

          {/* Descrição */}
          <FormInput
            label="Descrição"
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Ex: Aluguel do escritório"
            required
          />

          {/* Valor Total & N° Documento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormInput
              label="Valor Total"
              value={maskBRLFromDigits(form.valor_total)}
              onChange={e => set('valor_total', e.target.value.replace(/\D/g, ''))}
              placeholder="R$ 0,00"
              inputMode="numeric"
              required
            />
            <FormInput
              label="N° Documento"
              value={form.numero_documento}
              onChange={e => set('numero_documento', e.target.value)}
              placeholder="000.000"
            />
          </div>

          {/* Emissão & Vencimento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormInput
              type="date"
              label="Emissão"
              value={form.data_emissao}
              onChange={e => set('data_emissao', e.target.value)}
            />
            <FormInput
              type="date"
              label="Vencimento"
              value={form.data_vencimento}
              onChange={e => set('data_vencimento', e.target.value)}
              required
            />
          </div>

          {/* Fornecedor Combobox */}
          <CustomCombobox
            label="Fornecedor"
            options={fornecedorOpts}
            value={form.id_fornecedor}
            onChange={val => set('id_fornecedor', val)}
            placeholder="— Selecionar Fornecedor —"
          />

          {/* Plano de Contas Combobox */}
          <CustomCombobox
            label="Plano de Contas (Despesa)"
            options={planoOpts}
            value={form.id_plano_contas}
            onChange={val => set('id_plano_contas', val)}
            placeholder="— Selecionar Plano de Contas —"
          />

          {/* Centro de Custo Combobox */}
          <CustomCombobox
            label="Centro de Custo"
            options={centroOpts}
            value={form.id_centro_custo}
            onChange={val => set('id_centro_custo', val)}
            placeholder="— Selecionar Centro de Custo —"
          />

          {/* Parcelas — gerador com prévia editável */}
          <ParcelasEditor
            valorTotal={digitsToReais(form.valor_total)}
            dataVencimentoInicial={form.data_vencimento}
            accent={G.red}
            value={parcelasGrid}
            onChange={setParcelasGrid}
          />

          {/* Observações */}
          <FormTextarea
            label="Observações"
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Informações adicionais..."
          />

          {/* Footer Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12, paddingTop: 16, borderTop: `1px solid ${G.border}` }}>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setHoveredBtn('cancel')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: '10px 20px',
                border: `1.5px solid ${G.border}`,
                background: hoveredBtn === 'cancel' ? '#F5F2EC' : 'transparent',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: G.text,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              onMouseEnter={() => setHoveredBtn('save')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: '10px 24px',
                border: 'none',
                background: saving ? G.muted : G.red,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: hoveredBtn === 'save' && !saving ? `0 4px 12px ${G.red}33` : 'none',
                transform: hoveredBtn === 'save' && !saving ? 'translateY(-1px)' : 'none',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

function BaixaModal({ conta, parcela, onClose, onSaved }: {
  conta: Conta; parcela: Parcela; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    data_pagamento: todayISO(), valor_pago: String(Math.round(Number(parcela.valor) * 100)),
    juros: '', desconto: '', observacoes: '', gerar_residuo: true,
    id_conta_caixa: '', valor_sem_imposto: String(Math.round(Number(parcela.valor) * 100)), valor_com_imposto: '',
  })
  const [contasCaixa, setContasCaixa] = useState<{ id: number; conta_nome: string }[]>([])
  const [teto, setTeto] = useState(0)
  const [accMes, setAccMes] = useState(0)
  useEffect(() => {
    api.get('/livro-caixa/contas').then(r => setContasCaixa(r.data.data)).catch(() => {})
    api.get('/livro-caixa/config').then(r => { setTeto(Number(r.data.data.teto_com_imposto_mensal) || 0); setAccMes(Number(r.data.data.acumulado_mes) || 0) }).catch(() => {})
  }, [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const vPago = digitsToReais(form.valor_pago)
  const residual = parcela.valor - vPago - digitsToReais(form.desconto)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    if (!form.id_conta_caixa) { setError('Selecione a conta de caixa do pagamento.'); setSaving(false); return }
    try {
      const resp = await api.post(`/financeiro/contas-pagar/${conta.id}/baixa`, {
        id_parcela: parcela.id,
        data_pagamento: form.data_pagamento,
        valor_pago: vPago,
        juros: digitsToReais(form.juros),
        desconto: digitsToReais(form.desconto),
        observacoes: form.observacoes,
        gerar_residuo: form.gerar_residuo,
        id_conta_caixa: Number(form.id_conta_caixa),
        valor_sem_imposto: digitsToReais(form.valor_sem_imposto),
        valor_com_imposto: digitsToReais(form.valor_com_imposto),
      })
      const aviso = resp?.data?.aviso_teto_imposto
      if (aviso) {
        alert(`⚠️ Teto mensal de pagamento COM IMPOSTO ultrapassado.\nAcumulado no mês: ${fmtBRL(aviso.acumulado)}\nTeto: ${fmtBRL(aviso.teto)}`)
      }
      onSaved()
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Erro') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Registrar Pagamento</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginBottom: 14, padding: '8px 12px', background: G.bg, borderRadius: 6 }}>
          Parcela {parcela.numero_parcela} · {fmtBRL(parcela.valor)} · venc. {fmtDate(parcela.data_vencimento)}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: '#FEE2E2', color: G.red, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Data Pagamento
            <input type="date" value={form.data_pagamento} onChange={e => set('data_pagamento', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Conta de caixa
            <select value={form.id_conta_caixa} onChange={e => set('id_conta_caixa', e.target.value)} style={inputStyle}>
              <option value="">Selecione…</option>
              {contasCaixa.map(c => <option key={c.id} value={c.id}>{c.conta_nome}</option>)}
            </select>
          </label>
          {teto > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#FEF9C3', border: '1px solid #FCD34D', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                Split fiscal (reforma) — Com imposto no mês: {fmtBRL(accMes)} de {fmtBRL(teto)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Sem imposto
                  <input value={maskBRLFromDigits(form.valor_sem_imposto)} onChange={e => set('valor_sem_imposto', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" />
                </label>
                <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Com imposto
                  <input value={maskBRLFromDigits(form.valor_com_imposto)} onChange={e => set('valor_com_imposto', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" />
                </label>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Valor Pago
              <input value={maskBRLFromDigits(form.valor_pago)} onChange={e => set('valor_pago', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Juros
              <input value={maskBRLFromDigits(form.juros)} onChange={e => set('juros', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" />
            </label>
            <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Desconto
              <input value={maskBRLFromDigits(form.desconto)} onChange={e => set('desconto', e.target.value.replace(/\D/g, ''))} style={inputStyle} inputMode="numeric" placeholder="R$ 0,00" />
            </label>
          </div>
          {residual > 0.01 && (
            <div style={{ background: '#FEF9C3', border: '1px solid #FCD34D', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
              Saldo residual: {fmtBRL(residual)}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <input type="checkbox" checked={form.gerar_residuo} onChange={e => set('gerar_residuo', e.target.checked)} />
                Gerar parcela para o saldo residual
              </label>
            </div>
          )}
          <label style={{ fontSize: 12, color: G.muted, fontWeight: 500 }}>Observações
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} style={{ ...inputStyle, height: 60, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={saving} style={btnPrimary(G.red)}>{saving ? 'Salvando...' : 'Confirmar Pagamento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetalhesModal({ contaId, onClose, onBaixa, onChanged }: {
  contaId: number; onClose: () => void; onBaixa: (conta: Conta, parcela: Parcela) => void; onChanged?: () => void
}) {
  const [conta, setConta] = useState<Conta | null>(null)
  const [extrato, setExtrato] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [estornando, setEstornando] = useState<number | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/financeiro/contas-pagar/${contaId}`).then(r => r.data.success && setConta(r.data.data)).catch(() => {}),
      api.get(`/financeiro/contas-pagar/${contaId}/extrato`).then(r => r.data.success && setExtrato(r.data.data || [])).catch(() => setExtrato([])),
    ]).finally(() => setLoading(false))
  }, [contaId])

  useEffect(() => { reload() }, [reload])

  const estornar = async (idBaixa: number) => {
    if (!confirm('Estornar este pagamento?\n\nO valor volta ao saldo da parcela e é revertido no caixa.')) return
    setEstornando(idBaixa)
    try {
      await api.post(`/financeiro/contas-pagar/baixa/${idBaixa}/estornar`, {})
      reload(); onChanged?.()
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao estornar.') }
    finally { setEstornando(null) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 28, width: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: G.text }}>Detalhes da Conta a Pagar</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={18} /></button>
        </div>
        {loading ? <div style={{ textAlign: 'center', color: G.muted, padding: 40 }}>Carregando...</div>
        : conta ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: G.text, marginBottom: 20, background: G.bg, padding: 14, borderRadius: 8 }}>
              <div><span style={{ color: G.muted }}>Descrição: </span>{conta.descricao}</div>
              <div><span style={{ color: G.muted }}>Fornecedor: </span>{conta.fornecedor_nome || '—'}</div>
              <div><span style={{ color: G.muted }}>Valor Total: </span><strong>{fmtBRL(conta.valor_total)}</strong></div>
              <div><span style={{ color: G.muted }}>Valor Pago: </span>{fmtBRL(conta.valor_pago)}</div>
              <div><span style={{ color: G.muted }}>Vencimento: </span>{fmtDate(conta.data_vencimento)}</div>
              <div><span style={{ color: G.muted }}>Status: </span><StatusBadge status={conta.status} /></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginBottom: 10 }}>Parcelas</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: G.bg }}>
                  {['#', 'Vencimento', 'Valor', 'Pago', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: G.muted, fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conta.parcelas?.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                    <td style={{ padding: '8px 10px', color: G.muted }}>{p.numero_parcela}</td>
                    <td style={{ padding: '8px 10px', color: G.text }}>{fmtDate(p.data_vencimento)}</td>
                    <td style={{ padding: '8px 10px' }}>{fmtBRL(p.valor)}</td>
                    <td style={{ padding: '8px 10px' }}>{p.valor_pago != null ? fmtBRL(p.valor_pago) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '8px 10px' }}>
                      {(p.status === 'ABERTO' || p.status === 'VENCIDO') && (
                        <button onClick={() => { onClose(); onBaixa(conta, p) }} style={{ ...btnPrimary(G.red), padding: '4px 10px', fontSize: 11 }}>
                          Baixar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Conta corrente — extrato de baixas/estornos */}
            {extrato.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.text, margin: '22px 0 10px' }}>Conta Corrente · Extrato de Baixas</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: G.bg }}>
                      {['Data', 'Parc.', 'Tipo', 'Valor', 'Caixa', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: G.muted, fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extrato.map((m: any) => {
                      const isEstorno = m.tipo === 'ESTORNO'
                      const cor = isEstorno ? G.amber : G.green
                      return (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${G.border}`, opacity: m.estornada ? 0.5 : 1 }}>
                          <td style={{ padding: '8px 10px', color: G.text }}>{fmtDate(m.data)}</td>
                          <td style={{ padding: '8px 10px', color: G.muted }}>{m.numero_parcela}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: cor, background: cor + '1a' }}>{isEstorno ? 'ESTORNO' : 'BAIXA'}</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: isEstorno ? G.amber : G.text, fontWeight: 600 }}>{isEstorno ? '− ' : ''}{fmtBRL(m.valor_pago)}</td>
                          <td style={{ padding: '8px 10px', color: G.muted }}>{m.caixa_nome || '—'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {!isEstorno && !m.estornada && (
                              <button onClick={() => estornar(m.id)} disabled={estornando === m.id}
                                style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11, color: G.red, borderColor: `${G.red}55` }}>
                                {estornando === m.id ? '...' : 'Estornar'}
                              </button>
                            )}
                            {m.estornada && <span style={{ fontSize: 11, color: G.muted }}>estornada</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        ) : <div style={{ color: G.red, textAlign: 'center' }}>Conta não encontrada.</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnSecondary}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function ContasPagarPage() {
  const [contas, setContas]               = useState<Conta[]>([])
  const [loading, setLoading]             = useState(true)
  const [fornecedores, setFornecedores]   = useState<FinFornecedor[]>([])
  const [planoContas, setPlanoContas]     = useState<PlanoContas[]>([])
  const [centrosCusto, setCentrosCusto]   = useState<any[]>([])
  const [filters, setFilters] = useState({
    dataInicio: firstOfMonth(), dataFim: todayISO(), status: '', idFornecedor: '', idCentroCusto: '', filtrarPor: 'vencimento',
  })
  const [search, setSearch]         = useState('')
  const [showNova, setShowNova]     = useState(false)
  const [showLote, setShowLote]     = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [detalhesId, setDetalhesId] = useState<number | null>(null)
  const [baixaData, setBaixaData]   = useState<{ conta: Conta; parcela: Parcela } | null>(null)

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.dataInicio)   params.set('dataInicio',   filters.dataInicio)
    if (filters.dataFim)      params.set('dataFim',      filters.dataFim)
    if (filters.status)       params.set('status',       filters.status)
    if (filters.idFornecedor)  params.set('idFornecedor',  filters.idFornecedor)
    if (filters.idCentroCusto) params.set('idCentroCusto', filters.idCentroCusto)
    params.set('filtrarPor', filters.filtrarPor)
    api.get(`/financeiro/contas-pagar?${params}`)
      .then(r => r.data.success && setContas(r.data.data))
      .catch(() => {}).finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/financeiro/fin-fornecedores').then(r => r.data.success && setFornecedores(r.data.data)).catch(() => {})
    api.get('/financeiro/plano-contas').then(r => r.data.success && setPlanoContas(r.data.data)).catch(() => {})
    api.get('/financeiro/centro-custo').then(r => r.data.success && setCentrosCusto(r.data.data)).catch(() => {})
  }, [])

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta conta e todas as parcelas?')) return
    await api.delete(`/financeiro/contas-pagar/${id}`)
    load()
  }

  const filtered = contas.filter(c =>
    !search || c.descricao?.toLowerCase().includes(search.toLowerCase()) || c.fornecedor_nome?.toLowerCase().includes(search.toLowerCase())
  )

  const totais = filtered.reduce((acc, c) => ({
    total: acc.total + Number(c.valor_total),
    pago:  acc.pago  + Number(c.valor_pago),
    saldo: acc.saldo + Number(c.saldo),
    pagoPeriodo: acc.pagoPeriodo + Number(c.pago_periodo || 0),
  }), { total: 0, pago: 0, saldo: 0, pagoPeriodo: 0 })
  const porPagamento = filters.filtrarPor === 'pagamento'

  const vencidas = filtered.filter(c => c.status === 'ABERTO' && new Date(c.data_vencimento) < new Date(todayISO())).length
  const isVencida = (c: Conta) => c.status === 'ABERTO' && new Date(c.data_vencimento) < new Date(todayISO())

  return (
    <div style={{ background: G.bg, minHeight: '100%' }}>

      {/* Hero */}
      <div style={{
        background: G.navy, backgroundImage: GRID_BG,
        padding: '28px 28px 52px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', background: `radial-gradient(circle, ${G.red}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowUpCircle size={22} color={G.red} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>Contas a Pagar</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Controle de despesas e compromissos financeiros</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowLote(true)} style={{ ...btnPrimary(G.navy), border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={15} /> Lançamento em Lote
            </button>
            <button onClick={() => setShowNova(true)} style={{ ...btnPrimary(G.red), display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nova Conta
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ padding: '0 28px', marginTop: -28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {(porPagamento ? [
            { label: 'Pago no Período',  value: fmtBRL(totais.pagoPeriodo), color: G.green },
            { label: 'Total das Contas', value: fmtBRL(totais.total),       color: G.navy },
            { label: 'Saldo Pendente',   value: fmtBRL(totais.saldo),       color: totais.saldo > 0 ? G.amber : G.muted },
            { label: 'Contas',           value: String(filtered.length),    color: G.muted },
          ] : [
            { label: 'Total a Pagar',   value: fmtBRL(totais.total), color: G.navy },
            { label: 'Já Pago',         value: fmtBRL(totais.pago),  color: G.green },
            { label: 'Saldo Pendente',  value: fmtBRL(totais.saldo), color: totais.saldo > 0 ? G.amber : G.muted },
            { label: 'Vencidas',        value: String(vencidas),     color: vencidas > 0 ? G.red : G.muted },
          ]).map(({ label, value, color }) => (
            <div key={label} style={{
              background: G.card, borderRadius: 10, padding: '14px 18px',
              borderLeft: `4px solid ${color}`, boxShadow: '0 2px 8px rgba(0,0,0,.08)',
            }}>
              <div style={{ fontSize: 12, color: G.muted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 28px 28px' }}>

        <p style={{ margin: '0 0 12px', fontSize: 12, color: G.muted }}>
          {porPagamento
            ? <>Mostrando o que foi <strong>pago no período</strong> (pela data do pagamento) — inclui baixas integrais e parciais.</>
            : <>Os totais refletem o <strong>vencimento</strong> no período e os filtros selecionados — não o histórico todo.</>}
        </p>

        {/* Filters */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <label style={{ fontSize: 12, color: G.muted }}>Filtrar por
            <select value={filters.filtrarPor} onChange={e => setFilter('filtrarPor', e.target.value)} style={{ ...inputStyle, width: 130 }}>
              <option value="vencimento">Vencimento</option>
              <option value="pagamento">Pagamento</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: G.muted }}>De
            <input type="date" value={filters.dataInicio} onChange={e => setFilter('dataInicio', e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </label>
          <label style={{ fontSize: 12, color: G.muted }}>Até
            <input type="date" value={filters.dataFim} onChange={e => setFilter('dataFim', e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </label>
          <label style={{ fontSize: 12, color: G.muted }}>Status
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ ...inputStyle, width: 130 }}>
              <option value="">Todos</option>
              <option value="ABERTO">Aberto</option>
              <option value="PAGO">Pago</option>
              <option value="VENCIDO">Vencido</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: G.muted }}>Fornecedor
            <select value={filters.idFornecedor} onChange={e => setFilter('idFornecedor', e.target.value)} style={{ ...inputStyle, width: 180 }}>
              <option value="">Todos</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_razao}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: G.muted }}>Centro de Custo
            <select value={filters.idCentroCusto} onChange={e => setFilter('idCentroCusto', e.target.value)} style={{ ...inputStyle, width: 180 }}>
              <option value="">Todos</option>
              {centrosCusto.filter((c: any) => c.ativo !== false).map((c: any) => (
                <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} · ` : ''}{c.descricao}</option>
              ))}
            </select>
          </label>
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft: 30, width: 180, marginTop: 0 }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Carregando...</div>
          : filtered.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: G.muted }}>Nenhuma conta encontrada.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.bg, borderBottom: `1px solid ${G.border}` }}>
                  {['Descrição', 'Fornecedor', 'Vencimento', 'Valor Total', 'Pago', ...(porPagamento ? ['Pago no período'] : []), 'Saldo', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: G.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${G.border}`, background: isVencida(c) ? '#FFF8F8' : 'transparent' }}
                    onMouseEnter={e => { if (!isVencida(c)) e.currentTarget.style.background = '#F9F7F4' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isVencida(c) ? '#FFF8F8' : 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', color: G.text, fontWeight: 500 }}>{c.descricao}</td>
                    <td style={{ padding: '10px 12px', color: G.muted }}>{c.fornecedor_nome || '—'}</td>
                    <td style={{ padding: '10px 12px', color: isVencida(c) ? G.red : G.text, fontWeight: isVencida(c) ? 600 : 400 }}>{fmtDate(c.data_vencimento)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmtBRL(c.valor_total)}</td>
                    <td style={{ padding: '10px 12px', color: G.green }}>{fmtBRL(c.valor_pago)}</td>
                    {porPagamento && <td style={{ padding: '10px 12px', color: G.green, fontWeight: 700 }}>{fmtBRL(c.pago_periodo || 0)}</td>}
                    <td style={{ padding: '10px 12px', color: Number(c.saldo) > 0 ? G.amber : G.muted, fontWeight: 600 }}>{fmtBRL(c.saldo)}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button title="Ver detalhes" onClick={() => setDetalhesId(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4 }}>
                          <Eye size={15} />
                        </button>
                        <button title="Editar" onClick={() => setEditingId(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.text, padding: 4 }}>
                          <Pencil size={14} />
                        </button>
                        {(c.status === 'ABERTO' || isVencida(c)) && (
                          <button title="Registrar pagamento" onClick={async () => {
                            const r = await api.get(`/financeiro/contas-pagar/${c.id}`)
                            if (r.data.success) {
                              const parcela = r.data.data.parcelas?.find((p: Parcela) => p.status === 'ABERTO' || p.status === 'VENCIDO')
                              if (parcela) setBaixaData({ conta: r.data.data, parcela })
                            }
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.green, padding: 4 }}>
                            <Check size={15} />
                          </button>
                        )}
                        <button title="Excluir" onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.red, padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNova && (
        <NovaContaModal onClose={() => setShowNova(false)} onSaved={() => { setShowNova(false); load() }}
          fornecedores={fornecedores} planoContas={planoContas} centrosCusto={centrosCusto} />
      )}
      {showLote && (
        <LancamentoLoteModal isOpen={showLote} onClose={() => setShowLote(false)} onSaved={() => { setShowLote(false); load() }}
          rotinaPadrao="DESPESAS" />
      )}
      {editingId !== null && (
        <NovaContaModal editingId={editingId}
          onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); load() }}
          fornecedores={fornecedores} planoContas={planoContas} centrosCusto={centrosCusto} />
      )}
      {detalhesId !== null && (
        <DetalhesModal contaId={detalhesId} onClose={() => setDetalhesId(null)}
          onBaixa={(conta, parcela) => setBaixaData({ conta, parcela })} onChanged={load} />
      )}
      {baixaData && (
        <BaixaModal conta={baixaData.conta} parcela={baixaData.parcela}
          onClose={() => setBaixaData(null)} onSaved={() => { setBaixaData(null); load() }} />
      )}
    </div>
  )
}
