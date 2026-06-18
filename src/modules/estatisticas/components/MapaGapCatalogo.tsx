import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Download, Play, Factory, User, Target, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; }
interface Cliente   { cli_codigo: number; cli_nomred:  string; }
interface GapRow {
  codigo: string;
  descricao: string;
  familia: string;
  valor_mercado: number;
  qtd_mercado: number;
  pontos_venda: number;
  pct_acumulado: number;
  curva_abc: 'A' | 'B' | 'C';
}
interface Kpis {
  total: number;
  curvaA: number;
  curvaB: number;
  curvaC: number;
  valorMercado: number;
}

const fmtR$ = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (v: number) => v.toLocaleString('pt-BR');
const fmtDateISO = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function PeriodoInputs({ dataInicio, dataFim, onDataInicio, onDataFim }: {
  dataInicio: string; dataFim: string;
  onDataInicio?: (v: string) => void; onDataFim?: (v: string) => void;
}) {
  const inputSt: React.CSSProperties = {
    height: 32, padding: '0 8px', borderRadius: 7, fontSize: 11, fontWeight: 600,
    border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
    outline: 'none', cursor: 'pointer',
  };
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>De</div>
        <input type="date" value={dataInicio} onChange={e => onDataInicio?.(e.target.value)} style={inputSt} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>Até</div>
        <input type="date" value={dataFim} onChange={e => onDataFim?.(e.target.value)} style={inputSt} />
      </div>
    </>
  );
}

const selStyle: React.CSSProperties = {
  height: 32, padding: '0 8px 0 26px', borderRadius: 7, fontSize: 11, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
  outline: 'none', cursor: 'pointer', minWidth: 200, maxWidth: 280,
};
const labelSt: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 3,
};

const ABC_COLORS: Record<'A' | 'B' | 'C', { bg: string; fg: string; bar: string }> = {
  A: { bg: '#DCFCE7', fg: '#166534', bar: '#16A34A' },
  B: { bg: '#FEF3C7', fg: '#92400E', bar: '#D97706' },
  C: { bg: '#FEE2E2', fg: '#7F1D1D', bar: '#DC2626' },
};

export default function MapaGapCatalogo({ dataInicio, dataFim, onDataInicio, onDataFim }: {
  dataInicio: string; dataFim: string;
  onDataInicio?: (v: string) => void; onDataFim?: (v: string) => void;
}) {
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [industria, setIndustria]   = useState('');
  const [cliente, setCliente]       = useState('');
  const [curvaFiltro, setCurvaFiltro] = useState<'TODAS' | 'A' | 'B' | 'C'>('TODAS');

  const [data, setData]   = useState<GapRow[]>([]);
  const [kpis, setKpis]   = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  // Ordenação escolhida pelo usuário (clique no cabeçalho). Abre por Qtd Mercado ↓.
  const [sortBy, setSortBy]   = useState<keyof GapRow>('qtd_mercado');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || []));
    api.get('/clients?limit=2000').then(r => setClientes(r.data.data || []));
  }, []);

  const processar = useCallback(async () => {
    if (!industria || !cliente) return;
    setLoading(true);
    try {
      const res = await api.get('/estatisticas/gap-catalogo', {
        params: { dataInicial: dataInicio, dataFinal: dataFim, industria, cliente },
      });
      setData(res.data.data || []);
      setKpis(res.data.kpis || null);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente]);

  const filtered = useMemo(() =>
    curvaFiltro === 'TODAS' ? data : data.filter(d => d.curva_abc === curvaFiltro),
  [data, curvaFiltro]);

  // Ordena pela coluna escolhida. Número compara numérico; texto, alfabético pt-BR.
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR') * dir;
    });
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (field: keyof GapRow) => {
    if (sortBy === field) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortBy(field);
    // texto começa A→Z; números começam do maior (mais relevante no topo)
    setSortDir(['codigo', 'descricao', 'familia', 'curva_abc'].includes(field as string) ? 'asc' : 'desc');
  };

  const exportExcel = () => {
    if (!filtered.length) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Código', 'Descrição', 'Família', 'Curva ABC', 'Valor Mercado', 'Qtd Mercado', 'Pontos de Venda', '% Acumulado'],
      ...sorted.map(d => [d.codigo, d.descricao, d.familia, d.curva_abc, d.valor_mercado, d.qtd_mercado, d.pontos_venda, d.pct_acumulado]),
    ]);
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Gap Catálogo');
    XLSX.writeFile(wb, `Gap_Catalogo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const thBase: React.CSSProperties = {
    padding: '6px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
    textTransform: 'uppercase', borderRight: `1px solid rgba(255,255,255,0.08)`,
    whiteSpace: 'nowrap', textAlign: 'left',
  };
  const tdBase: React.CSSProperties = {
    padding: '5px 10px', fontSize: 11, borderRight: `1px solid ${G.border}`,
    borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap',
  };

  // Cabeçalho clicável: ordena pela coluna; seta indica direção ativa.
  const thSort = (field: keyof GapRow, label: string, opts?: { align?: 'right'; color?: string }) => (
    <th
      onClick={() => toggleSort(field)}
      title="Clique para ordenar"
      style={{
        ...thBase, color: opts?.color ?? '#E8E1D4', textAlign: opts?.align ?? 'left',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      {label}{sortBy === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Filtros ── */}
      <div style={{
        padding: '10px 18px', background: G.card, borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Indústria *</div>
          <div style={{ position: 'relative' }}>
            <Factory size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={industria} onChange={e => setIndustria(e.target.value)}>
              <option value="">— Selecione —</option>
              {industrias.map(i => <option key={i.for_codigo} value={String(i.for_codigo)}>{i.for_nomered}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Cliente *</div>
          <div style={{ position: 'relative' }}>
            <User size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="">— Selecione —</option>
              {clientes.map(c => <option key={c.cli_codigo} value={String(c.cli_codigo)}>{c.cli_nomred}</option>)}
            </select>
          </div>
        </div>

        {/* Toggle curva ABC */}
        <div style={{
          display: 'flex', background: G.bg, borderRadius: 7, padding: 3,
          border: `1px solid ${G.border}`, alignSelf: 'flex-end', gap: 1,
        }}>
          {(['TODAS', 'A', 'B', 'C'] as const).map(c => (
            <button key={c} onClick={() => setCurvaFiltro(c)} style={{
              padding: '4px 12px', borderRadius: 5, fontSize: 9, fontWeight: 800,
              letterSpacing: 0.5, textTransform: 'uppercase', border: 'none', cursor: 'pointer',
              background: curvaFiltro === c ? G.text : 'transparent',
              color: curvaFiltro === c ? G.mustard : G.textMuted,
              transition: 'all 0.12s',
            }}>
              {c}
            </button>
          ))}
        </div>

        <PeriodoInputs dataInicio={dataInicio} dataFim={dataFim} onDataInicio={onDataInicio} onDataFim={onDataFim} />

        <div style={{ flex: 1 }} />

        <button
          style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', opacity: filtered.length ? 1 : 0.4 }}
          onClick={exportExcel} disabled={!filtered.length}
        >
          <Download size={12} /> Excel
        </button>
        <button
          onClick={processar} disabled={loading || !industria || !cliente}
          style={{ height: 32, padding: '0 18px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: G.text, color: G.mustard, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', opacity: (loading || !industria || !cliente) ? 0.6 : 1 }}
        >
          {loading
            ? <><span style={{ width: 11, height: 11, border: '2px solid rgba(255,210,0,0.3)', borderTopColor: G.mustard, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Processando...</>
            : <><Play size={12} /> Processar</>}
        </button>
      </div>

      {/* ── Banner explicativo ── */}
      <div style={{
        padding: '10px 18px', background: '#FAF5FF', borderBottom: `1px solid #E9D5FF`,
        display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
      }}>
        <Target size={16} style={{ color: '#7C3AED', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, color: '#581C87', lineHeight: 1.5 }}>
          <strong>O que faz este mapa:</strong> escolha uma indústria e um cliente. O sistema lista todos os itens da indústria <em>vendidos no mercado dentro do período</em>, classifica em curva ABC (A=80% do faturamento, B=15%, C=5%) e mostra <strong>apenas os itens que esse cliente NUNCA comprou</strong> em qualquer época. <strong>Útil para:</strong> argumentar visita com lista pronta de oportunidades — começar pelos da curva A (maior potencial de receita) e usar "Pontos de Venda" pra mostrar quantos concorrentes já compram aquele item.
        </div>
      </div>

      {/* ── KPIs ── */}
      {kpis && (
        <div style={{
          padding: '10px 18px', background: G.cardHi, borderBottom: `1px solid ${G.border}`,
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, flexShrink: 0,
        }}>
          {[
            { label: 'Gap Total', value: kpis.total,             icon: Target, color: G.text },
            { label: 'Curva A',   value: kpis.curvaA,            icon: PieChart, color: ABC_COLORS.A.bar },
            { label: 'Curva B',   value: kpis.curvaB,            icon: PieChart, color: ABC_COLORS.B.bar },
            { label: 'Curva C',   value: kpis.curvaC,            icon: PieChart, color: ABC_COLORS.C.bar },
            { label: 'Mercado R$', value: `R$ ${fmtR$(kpis.valorMercado)}`, icon: PieChart, color: G.mustard },
          ].map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={18} style={{ color: k.color }} />
                <div>
                  <div style={{ fontSize: 9, color: G.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{k.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: G.text, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tabela ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {!loaded ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
            <Target size={40} style={{ color: G.border }} />
            <div style={{ textAlign: 'center', maxWidth: 360 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 4 }}>Gap de Catálogo (Cross-sell ABC)</div>
              <div style={{ fontSize: 11, color: G.textMuted, lineHeight: 1.5 }}>
                Selecione indústria + cliente. O sistema lista itens da indústria já vendidos no mercado, classifica curva ABC e mostra apenas o que esse cliente <strong>nunca comprou</strong>.
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
            <span style={{ fontSize: 11, color: G.textMuted, textAlign: 'center' }}>
              {data.length === 0
                ? 'Esse cliente já comprou todo o portfólio vendido pela indústria no período — nenhum gap encontrado.'
                : `Nenhum item na curva ${curvaFiltro}`}
            </span>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: G.text }}>
                {thSort('curva_abc', 'ABC', { color: G.mustard })}
                {thSort('codigo', 'Código', { color: G.mustard })}
                {thSort('descricao', 'Descrição')}
                {thSort('familia', 'Família')}
                {thSort('valor_mercado', 'Valor Mercado', { align: 'right' })}
                {thSort('qtd_mercado', 'Qtd Mercado', { align: 'right' })}
                {thSort('pontos_venda', 'Pontos Venda', { align: 'right' })}
                {thSort('pct_acumulado', '% Acum.', { align: 'right' })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const c = ABC_COLORS[r.curva_abc];
                return (
                  <tr key={r.codigo} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', minWidth: 22, padding: '2px 8px', borderRadius: 6,
                        background: c.bg, color: c.fg, fontWeight: 900, fontSize: 11,
                      }}>
                        {r.curva_abc}
                      </span>
                    </td>
                    <td style={{ ...tdBase, fontFamily: 'monospace', fontWeight: 800, color: G.text }}>{r.codigo}</td>
                    <td style={{ ...tdBase, color: G.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.descricao}>{r.descricao}</td>
                    <td style={{ ...tdBase, color: G.textMuted, fontSize: 10, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.familia}>{r.familia}</td>
                    <td style={{ ...tdBase, textAlign: 'right', color: G.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtR$(r.valor_mercado)}</td>
                    <td style={{ ...tdBase, textAlign: 'right', color: G.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(r.qtd_mercado)}</td>
                    <td style={{ ...tdBase, textAlign: 'right', color: G.text, fontVariantNumeric: 'tabular-nums' }}>{r.pontos_venda}</td>
                    <td style={{ ...tdBase, textAlign: 'right', color: G.textMuted, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{r.pct_acumulado.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
