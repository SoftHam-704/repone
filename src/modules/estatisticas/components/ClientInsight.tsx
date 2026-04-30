import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, TrendingUp, MapPin, Calendar, Package,
  Search, UserCheck, UserMinus, Clock, Download,
  ArrowUpRight, Briefcase, Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface ClientRow {
  cliente_id: number;
  razao_social: string;
  nome_fantasia: string;
  cidade: string;
  uf: string;
  vendedor_nome: string;
  status_cliente: string;
  total_faturado: number;
  data_ultima_compra: string | null;
  total_skus: number;
  dias_inatividade: number | null;
}

const fmtR$ = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, accent }: {
  title: string; value: string | number; sub: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 14,
      padding: '18px 20px', flex: 1, minWidth: 160,
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: G.text, lineHeight: 1, letterSpacing: -0.5 }}>
            {value}
          </div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 5 }}>{sub}</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: `${accent}15`,
          border: `1px solid ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

// ─── ClientInsight ────────────────────────────────────────────────────────────
export default function ClientInsight() {
  const [data,    setData]    = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [tab,     setTab]     = useState<'all' | 'A' | 'I'>('all');

  useEffect(() => {
    api.get('/estatisticas/client-insight')
      .then(r => setData(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => ({
    total:     data.length,
    ativos:    data.filter(c => c.status_cliente === 'A').length,
    inativos:  data.filter(c => c.status_cliente !== 'A').length,
    faturamento: data.reduce((s, c) => s + Number(c.total_faturado), 0),
  }), [data]);

  const filtered = useMemo(() =>
    data.filter(c => {
      const matchSearch = !search ||
        (c.nome_fantasia || c.razao_social).toLowerCase().includes(search.toLowerCase()) ||
        (c.cidade || '').toLowerCase().includes(search.toLowerCase());
      const matchTab = tab === 'all' || c.status_cliente === tab;
      return matchSearch && matchTab;
    }),
  [data, search, tab]);

  const exportExcel = () => {
    if (!filtered.length) return;
    const rows = filtered.map(c => ({
      'Nome': c.nome_fantasia || c.razao_social,
      'Cidade': `${c.cidade} - ${c.uf}`,
      'Vendedor': c.vendedor_nome,
      'Status': c.status_cliente === 'A' ? 'Ativo' : 'Inativo',
      'Faturamento': Number(c.total_faturado),
      'Mix SKUs': Number(c.total_skus),
      'Última Compra': fmtDate(c.data_ultima_compra),
      'Inatividade (dias)': c.dias_inatividade ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Client_Insight');
    XLSX.writeFile(wb, `Client_Insight_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabBtn = (key: typeof tab, label: string, activeColor: string) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: '6px 16px', borderRadius: 8, fontSize: 10, fontWeight: 800,
        letterSpacing: 0.5, textTransform: 'uppercase', border: 'none', cursor: 'pointer',
        background: tab === key ? activeColor : 'transparent',
        color: tab === key ? '#fff' : G.textMuted,
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${G.border}`, borderTopColor: G.mustard, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 12, color: G.textMuted }}>Carregando carteira...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{
        padding: '12px 20px', background: G.card, borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} style={{ color: G.mustard }} />
          <span style={{ fontSize: 13, fontWeight: 900, color: G.text }}>Client Insight</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.textMuted, border: `1px solid ${G.border}`, borderRadius: 4, padding: '1px 6px', letterSpacing: 0.5 }}>v2.0</span>
        </div>
        <button
          onClick={exportExcel} disabled={!filtered.length}
          style={{ height: 30, padding: '0 14px', borderRadius: 7, fontSize: 10, fontWeight: 800, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Download size={11} /> Exportar Excel
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ padding: '14px 20px', display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <KpiCard title="Total de Clientes" value={metrics.total} sub="Base cadastrada" icon={Users} accent="#3B82F6" />
        <KpiCard title="Clientes Ativos" value={metrics.ativos} sub={`${metrics.total ? ((metrics.ativos / metrics.total) * 100).toFixed(1) : 0}% de penetração`} icon={UserCheck} accent="#16A34A" />
        <KpiCard title="Clientes Inativos" value={metrics.inativos} sub="Atenção: Risco de Churn" icon={UserMinus} accent="#DC2626" />
        <KpiCard title="Faturamento Total" value={fmtR$(metrics.faturamento)} sub="Acumulado histórico" icon={TrendingUp} accent={G.mustard} />
      </div>

      {/* ── Search + Tabs ── */}
      <div style={{
        padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou cidade..."
            style={{
              width: '100%', height: 34, paddingLeft: 30, paddingRight: 12,
              borderRadius: 8, border: `1px solid ${G.border}`,
              background: G.cardHi, color: G.text, fontSize: 12, outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', background: G.bg, border: `1px solid ${G.border}`, borderRadius: 9, padding: 3, gap: 2 }}>
          {tabBtn('all', 'Todos', G.text)}
          {tabBtn('A', 'Ativos', '#16A34A')}
          {tabBtn('I', 'Inativos', '#6B7280')}
        </div>
        <span style={{ fontSize: 11, color: G.textMuted, marginLeft: 'auto' }}>
          {filtered.length} clientes
        </span>
      </div>

      {/* ── Tabela ── */}
      <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${G.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: G.card }}>
            <tr style={{ borderBottom: `1px solid ${G.border}` }}>
              {['CLIENTE / LOCALIZAÇÃO', 'VENDEDOR', 'STATUS', 'FATURAMENTO', 'MIX (SKUs)', 'ÚLTIMA COMPRA', 'INATIVIDADE', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '8px 16px', fontSize: 9, fontWeight: 800, color: G.textMuted,
                  letterSpacing: 0.7, textTransform: 'uppercase',
                  textAlign: i >= 3 && i <= 6 ? 'right' : i === 7 ? 'center' : 'left',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((c, i) => {
                const isAtivo = c.status_cliente === 'A';
                const diasCrit = (c.dias_inatividade ?? 0) > 90;
                return (
                  <motion.tr
                    key={c.cliente_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    style={{ borderBottom: `1px solid ${G.border}`, background: i % 2 === 0 ? G.card : G.bg }}
                  >
                    {/* Cliente */}
                    <td style={{ padding: '10px 16px', maxWidth: 220 }}>
                      <div style={{ fontWeight: 800, color: G.text, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.nome_fantasia || c.razao_social}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MapPin size={10} style={{ color: G.textMuted, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                          {c.cidade} - {c.uf}
                        </span>
                      </div>
                    </td>
                    {/* Vendedor */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: G.cardHi, border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Briefcase size={11} style={{ color: G.textMuted }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                          {c.vendedor_nome}
                        </span>
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 900,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: isAtivo ? '#DCFCE7' : '#F3F4F6',
                        color: isAtivo ? '#16A34A' : '#6B7280',
                        border: `1px solid ${isAtivo ? '#BBF7D0' : '#E5E7EB'}`,
                      }}>
                        {isAtivo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {/* Faturamento */}
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 900, color: G.text, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtR$(Number(c.total_faturado))}
                    </td>
                    {/* Mix SKUs */}
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: G.cardHi, borderRadius: 7, border: `1px solid ${G.border}` }}>
                        <Package size={11} style={{ color: G.textMuted }} />
                        <span style={{ fontSize: 12, fontWeight: 800, color: G.text }}>{c.total_skus.toLocaleString('pt-BR')}</span>
                      </div>
                    </td>
                    {/* Última Compra */}
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <Calendar size={12} style={{ color: G.textMuted, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: G.textSec }}>
                          {fmtDate(c.data_ultima_compra)}
                        </span>
                      </div>
                    </td>
                    {/* Inatividade */}
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {c.dias_inatividade !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                          <Clock size={12} style={{ color: diasCrit ? '#DC2626' : G.textMuted, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: diasCrit ? 900 : 600, color: diasCrit ? '#DC2626' : G.textSec }}>
                            {c.dias_inatividade} dias{diasCrit && <span style={{ fontSize: 8, marginLeft: 3, color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.4 }}> · crítico</span>}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: G.textMuted, fontStyle: 'italic' }}>Sem histórico</span>
                      )}
                    </td>
                    {/* Ação */}
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <button style={{ padding: 6, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: G.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Ver ficha do cliente">
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
