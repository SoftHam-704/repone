import { useState, useEffect, useRef } from 'react'
import { X, FileText, Calculator, Layers } from 'lucide-react'
import { api } from '@/shared/lib/api'
import ParcelasEditor, {
  type ParcelaLinha,
  calcDiaFixo,
  calcIntervalo,
  distribuirValor,
} from './ParcelasEditor'
import SearchCombobox from '@/shared/components/ui/SearchCombobox'
import { analiticasPorTipo } from '../utils/planoContas'

// ── Design tokens (consistent with Areia+Navy system) ────────────────────────
const G = {
  bg:      '#E8E1D4',
  card:    '#FFFFFF',
  border:  '#D6CDB8',
  text:    '#28374A',
  muted:   '#7A8899',
  mustard: '#FFD200',
  green:   '#059669',
  red:     '#DC2626',
  navy:    '#1E2D3D',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  rotinaPadrao: 'RECEITAS' | 'DESPESAS'
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskBRLFromDigits(digits: string): string {
  const cents = (digits || '').replace(/\D/g, '')
  if (!cents) return ''
  const num = parseInt(cents, 10) / 100
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function digitsToReais(digits: string): number {
  const cents = (digits || '').replace(/\D/g, '')
  return cents ? parseInt(cents, 10) / 100 : 0
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function LancamentoLoteModal({ isOpen, onClose, onSaved, rotinaPadrao }: Props) {
  const [rotina, setRotina] = useState<'RECEITAS' | 'DESPESAS'>(rotinaPadrao)

  // Form fields
  const [favorecidoId, setFavorecidoId] = useState('')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [planoContasId, setPlanoContasId] = useState('')
  const [nParcelas, setNParcelas] = useState('1')
  const [dataVencimentoInicial, setDataVencimentoInicial] = useState(todayISO())
  const [valorParcela, setValorParcela] = useState('')
  const [diaFixo, setDiaFixo] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Grid state
  const [parcelasGrid, setParcelasGrid] = useState<ParcelaLinha[]>([])

  // Options states
  const [clientes, setClientes] = useState<{ id: number; nome_razao: string }[]>([])
  const [fornecedores, setFornecedores] = useState<{ id: number; nome_razao: string }[]>([])
  const [centrosCusto, setCentrosCusto] = useState<{ id: number; codigo?: string; descricao: string; ativo?: boolean }[]>([])
  const [planoContas, setPlanoContas] = useState<{ id: number; codigo: string; descricao: string; tipo: 'R' | 'D' }[]>([])

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  // Fetch combo options
  useEffect(() => {
    api.get('/financeiro/fin-clientes').then(r => r.data.success && setClientes(r.data.data)).catch(() => {})
    api.get('/financeiro/fin-fornecedores').then(r => r.data.success && setFornecedores(r.data.data)).catch(() => {})
    api.get('/financeiro/centro-custo').then(r => r.data.success && setCentrosCusto(r.data.data)).catch(() => {})
    api.get('/financeiro/plano-contas').then(r => r.data.success && setPlanoContas(r.data.data)).catch(() => {})
  }, [])

  // Clear selections when switching routine
  const handleRotinaChange = (val: 'RECEITAS' | 'DESPESAS') => {
    setRotina(val)
    setFavorecidoId('')
    setPlanoContasId('')
    setParcelasGrid([])
    setError('')
    setValidationErrors([])
  }

  // Auto-fill Dia Fixo when dataVencimentoInicial changes
  useEffect(() => {
    if (dataVencimentoInicial) {
      const day = dataVencimentoInicial.split('-')[2]
      if (day) {
        setDiaFixo(String(parseInt(day, 10)))
      }
    }
  }, [dataVencimentoInicial])

  // Form validation
  const validateForm = () => {
    const errs: string[] = []
    if (!favorecidoId) errs.push('favorecido')
    if (!dataVencimentoInicial) errs.push('data_vencimento')
    
    const n = parseInt(nParcelas, 10) || 0
    if (n < 1 || n > 120) errs.push('parcelas')

    const val = digitsToReais(valorParcela)
    if (val <= 0) errs.push('valor')

    setValidationErrors(errs)
    return errs.length === 0
  }

  const handleCalcular = () => {
    setError('')
    if (!validateForm()) {
      setError('Por favor, preencha corretamente todos os campos obrigatórios marcados em vermelho.')
      return
    }

    const n = Math.max(1, Math.min(120, parseInt(nParcelas, 10) || 1))
    const vReais = digitsToReais(valorParcela)
    const total = n * vReais

    const datas = diaFixo.trim()
      ? calcDiaFixo(dataVencimentoInicial, n, Math.max(1, Math.min(31, parseInt(diaFixo, 10) || 1)))
      : calcIntervalo(dataVencimentoInicial, n, 30)

    const valores = distribuirValor(total, n)

    const grid = datas.map((dt, idx) => ({
      numero_parcela: idx + 1,
      data_vencimento: dt,
      valor: valores[idx],
    }))

    setParcelasGrid(grid)
  }

  const handleProcessar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      setError('Por favor, preencha corretamente todos os campos obrigatórios marcados em vermelho.')
      return
    }

    if (parcelasGrid.length === 0) {
      setError('Por favor, calcule as parcelas na grade antes de processar.')
      return
    }

    const totalSum = parcelasGrid.reduce((acc, p) => acc + p.valor, 0)
    const centsSum = parcelasGrid.reduce((acc, p) => acc + Math.round(p.valor * 100), 0)
    const formattedTotal = fmtBRL(totalSum)

    const favorecidoNome = (rotina === 'RECEITAS'
      ? clientes.find(c => String(c.id) === favorecidoId)?.nome_razao
      : fornecedores.find(f => String(f.id) === favorecidoId)?.nome_razao) || 'Favorecido'

    const confirmMsg = `Gerar ${parcelasGrid.length} parcelas de ${maskBRLFromDigits(valorParcela)} para ${favorecidoNome} — total ${formattedTotal}. Confirmar?`
    if (!window.confirm(confirmMsg)) return

    setSaving(true)
    try {
      const payload = {
        descricao: observacoes.trim() ? observacoes.trim() : favorecidoNome,
        id_fornecedor: rotina === 'DESPESAS' ? (Number(favorecidoId) || null) : null,
        id_cliente: rotina === 'RECEITAS' ? (Number(favorecidoId) || null) : null,
        id_plano_contas: planoContasId ? Number(planoContasId) : null,
        id_centro_custo: centroCustoId ? Number(centroCustoId) : null,
        numero_documento: numeroDocumento || '',
        valor_total: totalSum,
        data_emissao: todayISO(),
        data_vencimento: dataVencimentoInicial,
        observacoes: observacoes || '',
        numero_parcelas: parcelasGrid.length,
        parcelas: parcelasGrid,
      }

      const endpoint = rotina === 'RECEITAS' ? '/financeiro/contas-receber' : '/financeiro/contas-pagar'
      await api.post(endpoint, payload)

      alert(`${parcelasGrid.length} parcelas geradas com sucesso!`)
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao processar os lançamentos em lote.')
    } finally {
      setSaving(false)
    }
  }

  // Options maps
  const favorecidoOptions = (rotina === 'RECEITAS' ? clientes : fornecedores).map(x => ({
    id: x.id,
    nome: x.nome_razao,
  }))

  const planoOptions = analiticasPorTipo(planoContas, rotina === 'RECEITAS' ? 'R' : 'D')
    .map(p => ({
      id: p.id,
      nome: `${p.codigo} - ${p.descricao}`,
    }))

  const centroOptions = centrosCusto
    .filter(c => c.ativo !== false)
    .map(c => ({
      id: c.id,
      nome: c.codigo ? `${c.codigo} - ${c.descricao}` : c.descricao,
    }))

  const accentColor = rotina === 'RECEITAS' ? G.green : G.red

  // Input styles
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    border: hasError ? `1.5px solid ${G.red}` : `1px solid ${G.border}`,
    borderRadius: 8,
    fontSize: 13,
    background: '#fff',
    color: G.text,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease-in-out',
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: G.text,
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(40, 55, 74, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(40,55,74,0.18)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${G.border}` }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${G.navy}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} color={G.navy} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>Lançamento em Lote</h3>
            <p style={{ margin: 0, fontSize: 11, color: G.muted }}>Gere múltiplas parcelas recorrentes de uma vez para receitas ou despesas</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.muted, padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleProcessar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: '#FEE2E2', color: G.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, borderLeft: `4px solid ${G.red}` }}>
              {error}
            </div>
          )}

          {/* Toggle Rotina */}
          <div style={{ display: 'flex', gap: 8, background: G.bg, padding: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
            <button
              type="button"
              onClick={() => handleRotinaChange('RECEITAS')}
              style={{
                padding: '6px 16px',
                border: 'none',
                background: rotina === 'RECEITAS' ? G.green : 'transparent',
                color: rotina === 'RECEITAS' ? '#fff' : G.text,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              RECEITAS
            </button>
            <button
              type="button"
              onClick={() => handleRotinaChange('DESPESAS')}
              style={{
                padding: '6px 16px',
                border: 'none',
                background: rotina === 'DESPESAS' ? G.red : 'transparent',
                color: rotina === 'DESPESAS' ? '#fff' : G.text,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              DESPESAS
            </button>
          </div>

          {/* Favorecido SearchCombobox */}
          <div>
            <span style={{ fontSize: 12, color: G.text, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Favorecido (deve ser selecionado) <span style={{ color: G.red }}>*</span>
            </span>
            <SearchCombobox
              options={favorecidoOptions}
              value={favorecidoId}
              onChange={setFavorecidoId}
              placeholder={rotina === 'RECEITAS' ? 'Selecionar Cliente...' : 'Selecionar Fornecedor...'}
              required
            />
          </div>

          {/* Centro de Custo & Plano de Contas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <span style={{ fontSize: 12, color: G.text, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Centro de Custo (Opcional)
              </span>
              <SearchCombobox
                options={centroOptions}
                value={centroCustoId}
                onChange={setCentroCustoId}
                placeholder="Selecionar Centro de Custo..."
              />
            </div>
            <div>
              <span style={{ fontSize: 12, color: G.text, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Plano de Contas (Opcional)
              </span>
              <SearchCombobox
                options={planoOptions}
                value={planoContasId}
                onChange={setPlanoContasId}
                placeholder="Selecionar Plano de Contas..."
              />
            </div>
          </div>

          {/* Parâmetros numéricos e de vencimento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <label style={labelStyle}>
              <span>Nº de Parcelas (1 a 120) <span style={{ color: G.red }}>*</span></span>
              <input
                type="number"
                min={1}
                max={120}
                value={nParcelas}
                onChange={e => setNParcelas(e.target.value)}
                style={inputStyle(validationErrors.includes('parcelas'))}
                required
              />
            </label>
            <label style={labelStyle}>
              <span>Valor da Parcela <span style={{ color: G.red }}>*</span></span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={maskBRLFromDigits(valorParcela)}
                onChange={e => setValorParcela(e.target.value.replace(/\D/g, ''))}
                style={inputStyle(validationErrors.includes('valor'))}
                required
              />
            </label>
            <label style={labelStyle}>
              <span>1º Vencimento <span style={{ color: G.red }}>*</span></span>
              <input
                type="date"
                value={dataVencimentoInicial}
                onChange={e => setDataVencimentoInicial(e.target.value)}
                style={inputStyle(validationErrors.includes('data_vencimento'))}
                required
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelStyle}>
              <span>Dia Fixo (1 a 31) (Opcional)</span>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 10"
                value={diaFixo}
                onChange={e => setDiaFixo(e.target.value)}
                style={inputStyle(false)}
              />
            </label>
            <label style={labelStyle}>
              <span>Nº Documento (Opcional)</span>
              <input
                type="text"
                placeholder="Ex: NF-2026"
                value={numeroDocumento}
                onChange={e => setNumeroDocumento(e.target.value)}
                style={inputStyle(false)}
              />
            </label>
          </div>

          {/* Histórico/Observações */}
          <label style={labelStyle}>
            <span>Observações / Histórico (Opcional)</span>
            <textarea
              placeholder="Histórico padrão das parcelas..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                border: `1px solid ${G.border}`,
                borderRadius: 8,
                fontSize: 13,
                background: '#fff',
                color: G.text,
                outline: 'none',
                boxSizing: 'border-box',
                height: 60,
                resize: 'none',
              }}
            />
          </label>

          {/* Botão Calcular Parcelas */}
          <button
            type="button"
            onClick={handleCalcular}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: G.navy,
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.12s',
            }}
          >
            <Calculator size={16} />
            Calcular Parcelas
          </button>

          {/* Parcelas Grid */}
          {parcelasGrid.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 12, color: G.text, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Prévia e Ajuste Fino das Parcelas
              </span>
              <ParcelasEditor
                valorTotal={Number(nParcelas) * digitsToReais(valorParcela)}
                dataVencimentoInicial={dataVencimentoInicial}
                accent={accentColor}
                value={parcelasGrid}
                onChange={setParcelasGrid}
                hideGenerator={true}
              />
            </div>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${G.border}` }}>
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
              onMouseEnter={() => setHoveredBtn('process')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: '10px 24px',
                border: 'none',
                background: saving ? G.muted : accentColor,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: hoveredBtn === 'process' && !saving ? `0 4px 12px ${accentColor}33` : 'none',
                transform: hoveredBtn === 'process' && !saving ? 'translateY(-1px)' : 'none',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              {saving ? 'Processando...' : 'Processar Lançamentos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
