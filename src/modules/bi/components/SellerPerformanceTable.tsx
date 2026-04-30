import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Award, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useBIStore, buildBIParams } from '../store/useBIStore';
import { BI, fmtBRL } from './biTokens';
import { SkeletonCard } from './SkeletonCard';

type SortKey = 'total_value_current' | 'mom_value_percent' | 'clients_previous' | 'new_clients' | 'reactivated_clients' | 'new_skus_count';
type SortDir = 'asc' | 'desc';

const fmtPctSigned = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const fmtN = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');

const SortIcon = ({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) => {
  if (col !== sortKey) return <ChevronsUpDown size={10} style={{ color: BI.textMuted }} />;
  return sortDir === 'asc'
    ? <ChevronUp size={10} style={{ color: BI.teal }} />
    : <ChevronDown size={10} style={{ color: BI.teal }} />;
};

export const SellerPerformanceTable = () => {
  const { filters } = useBIStore();
  const p = buildBIParams(filters);

  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('total_value_current');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    api.get(`/bi/sellers-performance?${p}`)
      .then(r => r.data.success && setData(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [p]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    if (!data.length) return [];
    return [...data].sort((a, b) => {
      const av = parseFloat(a[sortKey]) || 0;
      const bv = parseFloat(b[sortKey]) || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  // Totais
  const totals = useMemo(() => ({
    current:    data.reduce((s, r) => s + (parseFloat(r.total_value_current) || 0), 0),
    previous:   data.reduce((s, r) => s + (parseFloat(r.total_value_previous) || 0), 0),
    clientes:   data.reduce((s, r) => s + (parseInt(r.clients_previous) || 0), 0),
    novos:      data.reduce((s, r) => s + (parseInt(r.new_clients) || 0), 0),
    reat:       data.reduce((s, r) => s + (parseInt(r.reactivated_clients) || 0), 0),
    skus:       data.reduce((s, r) => s + (parseInt(r.new_skus_count) || 0), 0),
  }), [data]);

  const totalMom    = totals.current - totals.previous;
  const totalMomPct = totals.previous ? (totalMom / totals.previous * 100) : 0;

  const narrativa = useMemo((): string[] => {
    if (!data.length) return [];
    const lider = sorted[0];
    if (!lider) return [];
    const liderTotal = parseFloat(lider.total_value_current) || 0;
    const linhas: string[] = [
      `${lider.ven_nome} lidera o time com ${fmtBRL(liderTotal)}.`,
    ];
    const totalNovos = totals.novos + totals.reat;
    if (totalNovos > 0) {
      linhas.push(`${totals.novos} cliente(s) novo(s) e ${totals.reat} reativado(s) no período.`);
    }
    if (totals.previous > 0 && Math.abs(totalMomPct) <= 999) {
      linhas.push(
        `Time ${totalMomPct >= 0 ? 'cresceu' : 'recuou'} ${Math.abs(totalMomPct).toFixed(1)}% vs período anterior.`
      );
    }
    return linhas;
  }, [data, sorted, totals, totalMomPct]);

  const thStyle: React.CSSProperties = {
    padding: '10px 8px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: BI.textMuted, whiteSpace: 'nowrap', cursor: 'pointer',
    userSelect: 'none', overflow: 'hidden',
  };
  const tdStyle: React.CSSProperties = { padding: '10px 8px', fontSize: 13, borderTop: `1px solid ${BI.border}` };

  const MoMBadge = ({ value }: { value: number }) => (
    <div className="flex items-center gap-1 justify-center"
      style={{
        display: 'inline-flex', padding: '2px 5px', borderRadius: 6, fontSize: 10, fontWeight: 700,
        background: value >= 0 ? `${BI.success}15` : `${BI.danger}15`,
        color: value >= 0 ? BI.success : BI.danger,
        border: `1px solid ${value >= 0 ? BI.success : BI.danger}28`,
      }}>
      {value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {fmtBRL(Math.abs(value))}
    </div>
  );

  if (loading) return <SkeletonCard lines={6} />;
  if (!data.length) return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <Award size={28} style={{ color: BI.textMuted }} />
      <p className="text-xs font-bold" style={{ color: BI.textMuted }}>Nenhum vendedor encontrado</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award size={14} style={{ color: BI.warning }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: BI.textMuted }}>
            Ranking de Performance
          </span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
          style={{ background: `${BI.teal}15`, color: BI.teal, border: `1px solid ${BI.teal}30` }}>
          {data.length} vendedores
        </span>
      </div>

      {/* Narrativa + Critérios — card único */}
      {narrativa.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-4"
          style={{ background: `${BI.teal}09`, border: `1px solid ${BI.teal}22` }}>

          {/* Narrativa */}
          <div className="flex items-start gap-3 mb-3">
            <span style={{ color: BI.teal, fontSize: 12, flexShrink: 0, marginTop: 2, opacity: 0.8 }}>✦</span>
            <div>
              {narrativa.map((line, i) => (
                <p key={i} className="text-xs leading-relaxed"
                  style={{ color: i === 0 ? BI.textSec : BI.textMuted, fontWeight: i === 0 ? 600 : 400, marginTop: i > 0 ? 2 : 0 }}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Divisor */}
          <div style={{ height: 1, background: `${BI.teal}18`, marginBottom: 10 }} />

          {/* Critérios — 2 por linha */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              { label: 'Novos',      color: BI.teal,    desc: 'clientes sem compra registrada antes do período' },
              { label: 'Reativados', color: BI.blue,    desc: 'inativos 60+ dias que voltaram a comprar' },
              { label: 'Cli. M-1',   color: BI.textSec, desc: 'clientes com pedido no mês anterior' },
              { label: 'Novos SKUs', color: BI.textSec, desc: 'produtos inéditos para aquele cliente' },
            ].map(({ label, color, desc }) => (
              <div key={label} className="flex items-start gap-1.5">
                <span style={{ color, fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{label}:</span>
                <span style={{ color: BI.textMuted, fontSize: 11, lineHeight: 1.4 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: `1px solid ${BI.border}`, overflowX: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: BI.panelGrad, tableLayout: 'fixed', minWidth: 0 }}>
          <colgroup>
            <col style={{ width: '18%' }} />{/* Valores */}
            <col style={{ width: '22%' }} />{/* MoM R$ */}
            <col style={{ width: '12%' }} />{/* MoM % */}
            <col style={{ width: '11%' }} />{/* Cli M-1 */}
            <col style={{ width: '10%' }} />{/* Novos */}
            <col style={{ width: '10%' }} />{/* Reat. */}
            <col style={{ width: '17%' }} />{/* SKUs */}
          </colgroup>
          <thead>
            <tr style={{ background: BI.panelHiGrad }}>
              <th style={{ ...thStyle, textAlign: 'right' }}
                title="Faturamento total no período selecionado"
                onClick={() => handleSort('total_value_current')}>
                <div className="flex items-center justify-end gap-1">
                  Valores <SortIcon col="total_value_current" sortKey={sortKey} sortDir={sortDir} />
                </div>
              </th>
              <th style={{ ...thStyle, textAlign: 'center' }}
                title="Month over Month — variação em R$ comparado ao período anterior">MoM (R$)</th>
              <th style={{ ...thStyle, textAlign: 'center' }}
                title="Month over Month — variação percentual comparado ao período anterior"
                onClick={() => handleSort('mom_value_percent')}>
                <div className="flex items-center justify-center gap-1">
                  MoM (%) <SortIcon col="mom_value_percent" sortKey={sortKey} sortDir={sortDir} />
                </div>
              </th>
              <th style={{ ...thStyle, textAlign: 'center' }}
                title="Clientes com compra no mês anterior (M-1) — base de positivação recente"
                onClick={() => handleSort('clients_previous')}>
                <div className="flex items-center justify-center gap-1">
                  Cli. M-1 <SortIcon col="clients_previous" sortKey={sortKey} sortDir={sortDir} />
                </div>
              </th>
              <th style={{ ...thStyle, textAlign: 'center' }}
                title="Clientes novos conquistados no período — sem histórico anterior"
                onClick={() => handleSort('new_clients')}>
                <div className="flex items-center justify-center gap-1">
                  Novos <SortIcon col="new_clients" sortKey={sortKey} sortDir={sortDir} />
                </div>
              </th>
              <th style={{ ...thStyle, textAlign: 'center' }}
                title="Clientes reativados — compraram no período após ficarem inativos por 60+ dias"
                onClick={() => handleSort('reactivated_clients')}>
                <div className="flex items-center justify-center gap-1">
                  Reat. <SortIcon col="reactivated_clients" sortKey={sortKey} sortDir={sortDir} />
                </div>
              </th>
              <th style={{ ...thStyle, textAlign: 'center' }}
                title="Novos SKUs vendidos — produtos que o vendedor nunca havia vendido para o cliente"
                onClick={() => handleSort('new_skus_count')}>
                <div className="flex items-center justify-center gap-1">
                  SKUs <SortIcon col="new_skus_count" sortKey={sortKey} sortDir={sortDir} />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((s: any, i: number) => {
              const mom    = parseFloat(s.total_value_current) - parseFloat(s.total_value_previous);
              const momPct = parseFloat(s.mom_value_percent) || 0;
              const isTop  = i === 0;
              return (
                <>
                  {/* ── Seller header row ── */}
                  <tr key={`${s.ven_codigo}-hdr`}>
                    <td colSpan={7} style={{
                      padding: '6px 14px',
                      background: '#1E2D3D',
                      borderTop: `1px solid ${BI.border}`,
                      overflow: 'hidden',
                      maxWidth: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                        {isTop && <Award size={12} style={{ color: BI.warning, flexShrink: 0 }} />}
                        <span style={{
                          fontSize: 11, fontWeight: 900, color: '#E8E1D4',
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          minWidth: 0,
                        }}>
                          {s.ven_nome}
                        </span>
                        <span style={{ fontSize: 10, color: '#A8B8C4', fontWeight: 600, flexShrink: 0 }}>
                          #{i + 1}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* ── Data row ── */}
                  <tr key={s.ven_codigo}
                    onMouseEnter={e => (e.currentTarget.style.background = BI.panelHi)}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: BI.teal, fontFamily: 'monospace' }}>
                    {fmtBRL(parseFloat(s.total_value_current) || 0)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <MoMBadge value={mom} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700,
                    color: momPct >= 0 ? BI.success : BI.danger }}>
                    {fmtPctSigned(momPct)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: BI.textSec }}>
                    {fmtN(parseInt(s.clients_previous) || 0)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {(parseInt(s.new_clients) || 0) > 0 ? (
                      <span className="font-bold" style={{
                        color: BI.teal, background: `${BI.teal}15`,
                        padding: '2px 9px', borderRadius: 6, fontSize: 12,
                      }}>
                        +{s.new_clients}
                      </span>
                    ) : (
                      <span style={{ color: BI.textMuted, fontSize: 12 }}>0</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {(parseInt(s.reactivated_clients) || 0) > 0 ? (
                      <span className="font-bold" style={{
                        color: BI.blue, background: `${BI.blue}15`,
                        padding: '2px 9px', borderRadius: 6, fontSize: 12,
                      }}>
                        {s.reactivated_clients}
                      </span>
                    ) : (
                      <span style={{ color: BI.textMuted, fontSize: 12 }}>0</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: 12 }}>
                      <p className="font-bold" style={{ color: BI.textSec }}>{s.new_skus_count || 0} SKUs</p>
                      {parseFloat(s.new_skus_value) > 0 && (
                        <p style={{ color: BI.textMuted, fontSize: 11 }}>{fmtBRL(parseFloat(s.new_skus_value))}</p>
                      )}
                    </div>
                  </td>
                </tr>
                </>
              );
            })}
          </tbody>

          {/* Totais */}
          <tfoot>
            <tr style={{ background: BI.panelHiGrad, borderTop: `2px solid ${BI.border}` }}>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: BI.teal, fontFamily: 'monospace' }}>
                <span style={{ color: BI.textMuted, fontWeight: 600, marginRight: 8, fontSize: 11 }}>Totais</span>
                {fmtBRL(totals.current)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <MoMBadge value={totalMom} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700,
                color: totalMomPct >= 0 ? BI.success : BI.danger }}>
                {fmtPctSigned(totalMomPct)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', color: BI.textSec, fontWeight: 700 }}>{fmtN(totals.clientes)}</td>
              <td style={{ ...tdStyle, textAlign: 'center', color: BI.teal, fontWeight: 700 }}>{totals.novos}</td>
              <td style={{ ...tdStyle, textAlign: 'center', color: BI.blue, fontWeight: 700 }}>{totals.reat}</td>
              <td style={{ ...tdStyle, textAlign: 'center', color: BI.textSec, fontWeight: 700 }}>{totals.skus} SKUs</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
