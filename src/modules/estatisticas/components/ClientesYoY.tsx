import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Download, Play, Factory, Users, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; }
interface YoYRow {
  cliente_nome: string;
  valor_prev: number; qtd_prev: number;
  valor_curr: number; qtd_curr: number;
  perc_valor: number; perc_qtd: number;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmtR$ = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtN  = (v: number) => v.toLocaleString('pt-BR');

function Pct({ val }: { val: number }) {
  if (val === 0) return <span style={{ color: G.textMuted, fontSize: 11, fontWeight: 700 }}><Minus size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> 0%</span>;
  const up    = val > 0;
  const color = up ? '#16A34A' : '#DC2626';
  const Icon  = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ color, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
      <Icon size={11} />
      {up ? '+' : ''}{val.toFixed(2)}%
    </span>
  );
}

const selStyle: React.CSSProperties = {
  height: 32, padding: '0 8px 0 26px', borderRadius: 7, fontSize: 11, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
  outline: 'none', cursor: 'pointer',
};
const labelSt: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 3,
};
const chkLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  fontSize: 10, fontWeight: 700, color: G.textSec, userSelect: 'none',
};

export default function ClientesYoY() {
  const hoje      = new Date();
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [industria,  setIndustria]  = useState('');
  const [mes,        setMes]        = useState(hoje.getMonth() + 1);
  const [ano,        setAno]        = useState(hoje.getFullYear());
  const [anoTodo,    setAnoTodo]    = useState(false);
  const [redeLoja,   setRedeLoja]   = useState(false);

  const [data,     setData]     = useState<YoYRow[]>([]);
  const [anoPrev,  setAnoPrev]  = useState(hoje.getFullYear() - 1);
  const [anoCurr,  setAnoCurr]  = useState(hoje.getFullYear());
  const [loading,  setLoading]  = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  // Anos disponíveis: atual até 5 anos atrás
  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || []));
  }, []);

  const processar = useCallback(async () => {
    if (!industria) return;
    setLoading(true);
    try {
      const res = await api.get('/estatisticas/clientes-yoy', {
        params: { mes, ano, industria, anoTodo, redeLoja },
      });
      setData(res.data.data || []);
      setAnoPrev(res.data.anoPrev);
      setAnoCurr(res.data.anoCurr);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [mes, ano, industria, anoTodo, redeLoja]);

  const exportExcel = () => {
    if (!data.length) return;
    const rows = data.map(r => ({
      'Cliente': r.cliente_nome,
      [`Valor ${anoPrev}`]: r.valor_prev,
      [`Qtd ${anoPrev}`]:   r.qtd_prev,
      [`Valor ${anoCurr}`]: r.valor_curr,
      [`Qtd ${anoCurr}`]:   r.qtd_curr,
      '% Valor': r.perc_valor,
      '% Qtd':   r.perc_qtd,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes_YoY');
    XLSX.writeFile(wb, `Clientes_YoY_${anoPrev}_${anoCurr}.xlsx`);
  };

  // Totais
  const totValPrev  = data.reduce((s, r) => s + r.valor_prev, 0);
  const totQtdPrev  = data.reduce((s, r) => s + r.qtd_prev,  0);
  const totValCurr  = data.reduce((s, r) => s + r.valor_curr, 0);
  const totQtdCurr  = data.reduce((s, r) => s + r.qtd_curr,  0);
  const totPercVal  = totValPrev > 0 ? ((totValCurr - totValPrev) / totValPrev) * 100 : 0;
  const totPercQtd  = totQtdPrev > 0 ? ((totQtdCurr - totQtdPrev) / totQtdPrev) * 100 : 0;

  const thBase: React.CSSProperties = {
    padding: '7px 14px', fontSize: 9, fontWeight: 800, letterSpacing: 0.7,
    textTransform: 'uppercase', borderRight: `1px solid rgba(255,255,255,0.1)`,
    whiteSpace: 'nowrap',
  };
  const tdBase: React.CSSProperties = {
    padding: '7px 14px', fontSize: 11, borderRight: `1px solid ${G.border}`,
    borderBottom: `1px solid ${G.border}`, color: G.text, whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Filtros ── */}
      <div style={{
        padding: '10px 18px', background: G.card, borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>

        {/* Mês */}
        <div style={{ display: 'flex', flexDirection: 'column', opacity: anoTodo ? 0.4 : 1 }}>
          <div style={labelSt}>Mês de Referência</div>
          <div style={{ position: 'relative' }}>
            <CalendarDays size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={{ ...selStyle, minWidth: 130 }} value={mes} onChange={e => setMes(Number(e.target.value))} disabled={anoTodo}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Ano */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Ano</div>
          <select style={{ ...selStyle, paddingLeft: 10, minWidth: 90 }} value={ano} onChange={e => setAno(Number(e.target.value))}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Indústria */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Indústria *</div>
          <div style={{ position: 'relative' }}>
            <Factory size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={{ ...selStyle, minWidth: 200, borderColor: !industria ? '#DC2626' : G.border }} value={industria} onChange={e => setIndustria(e.target.value)}>
              <option value="">Selecione...</option>
              {industrias.map(i => <option key={i.for_codigo} value={String(i.for_codigo)}>{i.for_nomered}</option>)}
            </select>
          </div>
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 2 }}>
          <label style={chkLabel}>
            <input type="checkbox" checked={anoTodo} onChange={e => setAnoTodo(e.target.checked)}
              style={{ accentColor: G.mustard, width: 13, height: 13, cursor: 'pointer' }} />
            Ano Todo
          </label>
          <label style={chkLabel}>
            <input type="checkbox" checked={redeLoja} onChange={e => setRedeLoja(e.target.checked)}
              style={{ accentColor: G.mustard, width: 13, height: 13, cursor: 'pointer' }} />
            <Users size={11} style={{ color: G.textMuted }} /> Rede de Lojas
          </label>
        </div>

        <div style={{ flex: 1 }} />

        <button
          style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', opacity: data.length ? 1 : 0.4 }}
          onClick={exportExcel} disabled={!data.length}
        >
          <Download size={12} /> Excel
        </button>

        <button
          onClick={processar} disabled={loading || !industria}
          style={{ height: 32, padding: '0 18px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: G.text, color: G.mustard, cursor: (loading || !industria) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', opacity: (loading || !industria) ? 0.5 : 1 }}
        >
          {loading
            ? <><span style={{ width: 11, height: 11, border: `2px solid rgba(255,210,0,0.3)`, borderTopColor: G.mustard, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Processando...</>
            : <><Play size={12} /> Processar</>
          }
        </button>
      </div>

      {/* ── Tabela ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loaded ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <TrendingUp size={40} style={{ color: G.border }} />
            <span style={{ fontSize: 12, color: G.textMuted }}>Selecione a indústria e clique em Processar</span>
          </div>
        ) : data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: G.textMuted }}>Nenhum registro encontrado</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              {/* Cabeçalho de anos */}
              <tr style={{ background: G.text }}>
                <th rowSpan={2} style={{ ...thBase, color: G.mustard, minWidth: 220, textAlign: 'left', position: 'sticky', left: 0, background: G.text, zIndex: 3 }}>
                  CLIENTE
                </th>
                <th colSpan={2} style={{ ...thBase, color: '#94A3B8', textAlign: 'center', minWidth: 200 }}>
                  {anoPrev}
                </th>
                <th colSpan={2} style={{ ...thBase, color: '#E8E1D4', textAlign: 'center', minWidth: 200 }}>
                  {anoCurr}
                </th>
                <th colSpan={2} style={{ ...thBase, color: G.mustard, textAlign: 'center', background: '#162436', borderLeft: `2px solid ${G.mustard}40` }}>
                  VARIAÇÃO
                </th>
              </tr>
              <tr style={{ background: '#1a2633' }}>
                <th style={{ ...thBase, color: '#94A3B8', textAlign: 'right', fontWeight: 600, minWidth: 120 }}>Valor</th>
                <th style={{ ...thBase, color: '#94A3B8', textAlign: 'right', fontWeight: 600, minWidth: 80 }}>Qtd</th>
                <th style={{ ...thBase, color: '#E8E1D4', textAlign: 'right', fontWeight: 600, minWidth: 120 }}>Valor</th>
                <th style={{ ...thBase, color: '#E8E1D4', textAlign: 'right', fontWeight: 600, minWidth: 80 }}>Qtd</th>
                <th style={{ ...thBase, color: G.mustard, textAlign: 'right', fontWeight: 600, minWidth: 90, background: '#162436', borderLeft: `2px solid ${G.mustard}30` }}>% Valor</th>
                <th style={{ ...thBase, color: G.mustard, textAlign: 'right', fontWeight: 600, minWidth: 90, background: '#162436' }}>% Qtd</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${G.border}`, background: i % 2 === 0 ? G.card : G.bg }}>
                  <td style={{ ...tdBase, fontWeight: 700, position: 'sticky', left: 0, background: i % 2 === 0 ? G.card : G.bg, zIndex: 1, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.cliente_nome}>
                    {row.cliente_nome}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right', color: G.textSec }}>{fmtR$(row.valor_prev)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', color: G.textSec }}>{fmtN(row.qtd_prev)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{fmtR$(row.valor_curr)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{fmtN(row.qtd_curr)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', background: '#1E2D3D', borderLeft: `2px solid ${G.mustard}20` }}>
                    <Pct val={row.perc_valor} />
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right', background: '#1E2D3D' }}>
                    <Pct val={row.perc_qtd} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: G.text, position: 'sticky', bottom: 0, zIndex: 2, borderTop: `2px solid ${G.mustard}40` }}>
                <td style={{ ...tdBase, fontWeight: 900, color: G.mustard, position: 'sticky', left: 0, background: G.text, zIndex: 3, borderBottom: 'none' }}>
                  TOTAIS — {data.length} clientes
                </td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 800, color: '#94A3B8', borderBottom: 'none' }}>{fmtR$(totValPrev)}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 800, color: '#94A3B8', borderBottom: 'none' }}>{fmtN(totQtdPrev)}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: '#E8E1D4', borderBottom: 'none' }}>{fmtR$(totValCurr)}</td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, color: '#E8E1D4', borderBottom: 'none' }}>{fmtN(totQtdCurr)}</td>
                <td style={{ ...tdBase, textAlign: 'right', background: '#162436', borderLeft: `2px solid ${G.mustard}40`, borderBottom: 'none' }}>
                  <Pct val={totPercVal} />
                </td>
                <td style={{ ...tdBase, textAlign: 'right', background: '#162436', borderBottom: 'none' }}>
                  <Pct val={totPercQtd} />
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
