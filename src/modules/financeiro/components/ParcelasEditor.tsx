import { useState } from 'react'

// ── Design tokens (mirrors G object in Contas pages) ──────────────────────────
const G = {
  bg:     '#E8E1D4',
  card:   '#FFFFFF',
  border: '#D6CDB8',
  text:   '#28374A',
  muted:  '#7A8899',
  navy:   '#1E2D3D',
  red:    '#DC2626',
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ParcelaLinha {
  numero_parcela: number
  data_vencimento: string   // 'YYYY-MM-DD'
  valor: number             // em reais
}

interface Props {
  valorTotal: number             // em reais (já convertido)
  dataVencimentoInicial: string  // 'YYYY-MM-DD' (1º vencimento)
  accent: string                 // G.red (pagar) | G.green (receber)
  value: ParcelaLinha[]          // controlled
  onChange: (parcelas: ParcelaLinha[]) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formata número como BRL sem abreviações. */
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Retorna YYYY-MM-DD de uma Date sem deslocar o fuso. */
function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Modo Intervalo (dias): data = dataBase + i * intervaloDias
 */
function calcIntervalo(dataBase: string, n: number, intervalo: number): string[] {
  const base = new Date(dataBase + 'T12:00:00')
  const datas: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i * intervalo)
    datas.push(toISO(d))
  }
  return datas
}

/**
 * Modo Dia Fixo (espelho de InstallmentManager.tsx / handleCalculate):
 * - 1ª parcela = dataVencimentoInicial (exatamente)
 * - Cada seguinte: avança 1 mês e ajusta o dia para min(diaFixo, ultimoDiaDoMes)
 */
function calcDiaFixo(dataBase: string, n: number, diaFixo: number): string[] {
  const datas: string[] = []
  // Usa T12:00:00 para evitar problemas de DST
  let current = new Date(dataBase + 'T12:00:00')
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      current.setMonth(current.getMonth() + 1)
      const ultimoDia = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
      current.setDate(Math.min(diaFixo, ultimoDia))
    }
    datas.push(toISO(current))
  }
  return datas
}

/**
 * Distribui valorTotal em n parcelas com arredondamento 2 casas.
 * Última parcela recebe a sobra exata (total - soma anteriores).
 */
function distribuirValor(valorTotal: number, n: number): number[] {
  if (n <= 0) return []
  const base = parseFloat((valorTotal / n).toFixed(2))
  const valores: number[] = []
  let soma = 0
  for (let i = 1; i <= n; i++) {
    const v = i === n ? parseFloat((valorTotal - soma).toFixed(2)) : base
    valores.push(v)
    soma += base
  }
  return valores
}

// ── Estilo compartilhado para células editáveis ───────────────────────────────
function cellInputStyle(accent: string, focused: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '5px 8px',
    border: focused ? `1.5px solid ${accent}` : `1px solid ${G.border}`,
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    color: G.text,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: focused ? `${accent}22 0px 0px 0px 3px` : 'none',
    transition: 'all 0.12s ease-in-out',
  }
}

// ── Célula de valor editável (máscara BRL → dígitos internos) ─────────────────
function ValorCell({
  valor,
  accent,
  onChange,
}: {
  valor: number
  accent: string
  onChange: (v: number) => void
}) {
  const [focused, setFocused] = useState(false)
  // Estado interno: string de dígitos (centavos) enquanto editando;
  // ao sair do foco, converte para number e chama onChange.
  const [rawDigits, setRawDigits] = useState('')

  function handleFocus() {
    // Inicializa com os centavos do valor atual
    const cents = Math.round(valor * 100).toString()
    setRawDigits(cents)
    setFocused(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setRawDigits(digits)
  }

  function handleBlur() {
    setFocused(false)
    const cents = parseInt(rawDigits || '0', 10)
    onChange(parseFloat((cents / 100).toFixed(2)))
  }

  // Exibição: se focado, mostra máscara BRL dos dígitos; senão, formata o valor
  function display() {
    if (focused) {
      if (!rawDigits) return ''
      const num = parseInt(rawDigits, 10) / 100
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    return fmtBRL(valor)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display()}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      style={cellInputStyle(accent, focused)}
    />
  )
}

// ── Célula de data editável ───────────────────────────────────────────────────
function DataCell({
  data,
  accent,
  onChange,
}: {
  data: string
  accent: string
  onChange: (d: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="date"
      value={data}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...cellInputStyle(accent, focused), minWidth: 130 }}
    />
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ParcelasEditor({
  valorTotal,
  dataVencimentoInicial,
  accent,
  value,
  onChange,
}: Props) {
  const [nParcelas, setNParcelas] = useState(1)
  const [modo, setModo] = useState<'intervalo' | 'dia-fixo'>('intervalo')
  const [intervalo, setIntervalo] = useState(30)
  // diaFixo inicializa com o dia do 1º vencimento
  const diaFixoDefault = dataVencimentoInicial
    ? parseInt(dataVencimentoInicial.split('-')[2] || '1', 10)
    : 1
  const [diaFixo, setDiaFixo] = useState(diaFixoDefault)

  // Sempre que dataVencimentoInicial mudar (usuário troca a data no form),
  // atualizar diaFixo para o novo dia apenas se o usuário nunca mexeu manualmente.
  // Decisão: não auto-atualizar aqui — diaFixo fica sob controle do usuário.

  function handleCalcular() {
    if (!dataVencimentoInicial || valorTotal <= 0 || nParcelas < 1) return
    const n = Math.max(1, Math.min(60, nParcelas))
    const datas =
      modo === 'dia-fixo'
        ? calcDiaFixo(dataVencimentoInicial, n, diaFixo)
        : calcIntervalo(dataVencimentoInicial, n, intervalo)
    const valores = distribuirValor(valorTotal, n)
    const linhas: ParcelaLinha[] = datas.map((dt, i) => ({
      numero_parcela: i + 1,
      data_vencimento: dt,
      valor: valores[i],
    }))
    onChange(linhas)
  }

  function updateLinha(idx: number, patch: Partial<ParcelaLinha>) {
    const nova = value.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    onChange(nova)
  }

  const soma = value.reduce((acc, l) => acc + l.valor, 0)
  const somaOk = Math.abs(soma - valorTotal) < 0.02  // tolerância de 2 centavos

  // ── Estilo label ──────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: G.muted,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }
  const smallInput: React.CSSProperties = {
    padding: '8px 10px',
    border: `1px solid ${G.border}`,
    borderRadius: 7,
    fontSize: 13,
    background: '#fff',
    color: G.text,
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    transition: 'border 0.12s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Painel de parâmetros ───────────────────────────────────────── */}
      <div style={{
        background: G.bg,
        border: `1px solid ${G.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: G.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Gerador de Parcelas
        </span>

        {/* Linha 1: N° Parcelas + Modo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={labelStyle}>
            <span style={{ color: G.text }}>N° Parcelas</span>
            <input
              type="number"
              min={1}
              max={60}
              value={nParcelas}
              onChange={e => setNParcelas(Math.max(1, parseInt(e.target.value) || 1))}
              style={smallInput}
            />
          </label>
          <label style={labelStyle}>
            <span style={{ color: G.text }}>Modo</span>
            <select
              value={modo}
              onChange={e => setModo(e.target.value as 'intervalo' | 'dia-fixo')}
              style={smallInput}
            >
              <option value="intervalo">Intervalo (dias)</option>
              <option value="dia-fixo">Dia Fixo</option>
            </select>
          </label>
        </div>

        {/* Linha 2: parâmetro condicional */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {modo === 'intervalo' ? (
            <label style={labelStyle}>
              <span style={{ color: G.text }}>Intervalo (dias)</span>
              <input
                type="number"
                min={1}
                value={intervalo}
                onChange={e => setIntervalo(Math.max(1, parseInt(e.target.value) || 1))}
                style={smallInput}
              />
            </label>
          ) : (
            <label style={labelStyle}>
              <span style={{ color: G.text }}>Dia Fixo (1–31)</span>
              <input
                type="number"
                min={1}
                max={31}
                value={diaFixo}
                onChange={e => setDiaFixo(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                style={smallInput}
              />
            </label>
          )}
          {/* Botão calcular */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCalcular}
              disabled={!dataVencimentoInicial || valorTotal <= 0}
              style={{
                width: '100%',
                padding: '9px 14px',
                background: accent,
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: (!dataVencimentoInicial || valorTotal <= 0) ? 'not-allowed' : 'pointer',
                opacity: (!dataVencimentoInicial || valorTotal <= 0) ? 0.5 : 1,
                transition: 'opacity 0.12s',
              }}
            >
              Calcular Parcelas
            </button>
          </div>
        </div>
      </div>

      {/* ── Grade editável ─────────────────────────────────────────────── */}
      {value.length > 0 && (
        <div style={{
          border: `1px solid ${G.border}`,
          borderRadius: 10,
          overflow: 'hidden',
          background: '#fff',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {['Parcela', 'Vencimento', 'Valor (R$)'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: G.muted,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: `1px solid ${G.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((linha, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: idx < value.length - 1 ? `1px solid ${G.border}` : 'none',
                    background: idx % 2 === 0 ? '#fff' : '#FAFAF8',
                  }}
                >
                  {/* Parcela # — read-only */}
                  <td style={{ padding: '6px 10px', color: G.muted, fontWeight: 700, width: 64 }}>
                    {linha.numero_parcela}
                  </td>
                  {/* Vencimento */}
                  <td style={{ padding: '6px 10px', width: 160 }}>
                    <DataCell
                      data={linha.data_vencimento}
                      accent={accent}
                      onChange={d => updateLinha(idx, { data_vencimento: d })}
                    />
                  </td>
                  {/* Valor */}
                  <td style={{ padding: '6px 10px' }}>
                    <ValorCell
                      valor={linha.valor}
                      accent={accent}
                      onChange={v => updateLinha(idx, { valor: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Rodapé: soma vs total */}
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${G.border}`,
            background: G.bg,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 20,
            fontSize: 12,
          }}>
            <span style={{ color: G.muted }}>
              Total do Formulário: <strong style={{ color: G.text }}>{fmtBRL(valorTotal)}</strong>
            </span>
            <span style={{ color: somaOk ? G.text : G.red, fontWeight: somaOk ? 400 : 700 }}>
              Soma das Parcelas: <strong>{fmtBRL(soma)}</strong>
              {!somaOk && <span style={{ marginLeft: 6, fontSize: 11 }}>⚠ diferença de {fmtBRL(Math.abs(soma - valorTotal))}</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
