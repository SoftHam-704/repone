import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Download, Play, Factory, User, Briefcase, Users, List, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria { for_codigo: number; for_nomered: string; }
interface Cliente   { cli_codigo: number; cli_nomred: string; }
interface Vendedor  { ven_codigo: number; ven_nome: string; }
interface DataRow   { industria: string; pedido?: string; cliente: string; data: string; valor: number; qtd: number; mes_ref: string; }

const fmtR$ = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtN = (v: number) => v.toLocaleString('pt-BR');
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const selStyle: React.CSSProperties = {
  height: 32, padding: '0 8px 0 26px', borderRadius: 7, fontSize: 11, fontWeight: 600,
  border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
  outline: 'none', cursor: 'pointer', minWidth: 160, maxWidth: 220,
};
const labelSt: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 3,
};
const chkLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  fontSize: 10, fontWeight: 700, color: G.textSec, userSelect: 'none',
};

// ─── IndustriaAccordion ───────────────────────────────────────────────────────
function IndustriaAccordion({ nome, rows, detalhada, color }: {
  nome: string; rows: DataRow[]; detalhada: boolean; color: string;
}) {
  const [open, setOpen] = useState(false);
  const totalValor = rows.reduce((s, r) => s + r.valor, 0);
  const totalQtd   = rows.reduce((s, r) => s + r.qtd,   0);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, marginBottom: 8 }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: open ? `${color}10` : G.card,
          border: 'none', cursor: 'pointer', gap: 12,
          borderBottom: open ? `1px solid ${G.border}` : 'none',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {open
            ? <ChevronDown size={14} style={{ color, flexShrink: 0 }} />
            : <ChevronRight size={14} style={{ color: G.textMuted, flexShrink: 0 }} />
          }
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Factory size={14} style={{ color }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 900, color: open ? color : G.text, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {nome}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, background: G.cardHi, border: `1px solid ${G.border}`, borderRadius: 5, padding: '1px 8px' }}>
            {rows.length} {detalhada ? 'pedidos' : 'clientes'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total Qtd</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: G.text }}>{fmtN(totalQtd)}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 120 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total Valor</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#16A34A' }}>{fmtR$(totalValor)}</div>
          </div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: G.bg, borderBottom: `1px solid ${G.border}` }}>
                  {detalhada && (
                    <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', width: 100 }}>
                      Pedido
                    </th>
                  )}
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Cliente
                  </th>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', width: 110 }}>
                    {detalhada ? 'Data' : 'Ref.'}
                  </th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', width: 90 }}>
                    Quantidade
                  </th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontSize: 9, fontWeight: 800, color: G.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', width: 130 }}>
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${G.border}`, background: i % 2 === 0 ? G.card : G.bg }}>
                    {detalhada && (
                      <td style={{ padding: '7px 14px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: G.textSec }}>
                        {row.pedido}
                      </td>
                    )}
                    <td style={{ padding: '7px 14px', fontWeight: 700, color: G.text }}>{row.cliente}</td>
                    <td style={{ padding: '7px 14px', color: G.textSec }}>
                      {detalhada ? fmtDate(row.data) : row.mes_ref}
                    </td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: G.text }}>
                      {fmtN(row.qtd)}
                    </td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtR$(row.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: `${color}12`, borderTop: `2px solid ${color}55` }}>
                  <td colSpan={detalhada ? 3 : 2} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Subtotal {nome}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 900, color: G.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(totalQtd)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 900, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>{fmtR$(totalValor)}</td>
                </tr>
              </tfoot>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Paleta de cores por indústria
const IND_COLORS = ['#0891B2','#7C3AED','#D97706','#16A34A','#DC2626','#0369A1','#BE185D','#B45309','#059669','#6D28D9'];

// ─── MapaCliIndustria ─────────────────────────────────────────────────────────
export default function MapaCliIndustria({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  const [industria, setIndustria] = useState('ALL');
  const [cliente,   setCliente]   = useState('ALL');
  const [vendedor,  setVendedor]  = useState('ALL');
  const [grupo,     setGrupo]     = useState(false);
  const [detalhada, setDetalhada] = useState(false);

  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustrias(r.data.data || []));
    api.get('/clients?limit=2000').then(r => setClientes(r.data.data || []));
    api.get('/sellers').then(r        => setVendedores(r.data.data  || []));
  }, []);

  const processar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/estatisticas/mapa-cli-industria', {
        params: { dataInicial: dataInicio, dataFinal: dataFim, industria, cliente, vendedor, grupo, detalhada },
      });
      setRawData(res.data.data || []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, vendedor, grupo, detalhada]);

  const grouped = useMemo(() => {
    const map = new Map<string, DataRow[]>();
    rawData.forEach(r => {
      const k = r.industria || 'Sem Indústria';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rawData]);

  const exportExcel = () => {
    if (!rawData.length) return;

    const header = [
      'Indústria',
      ...(detalhada ? ['Pedido'] : []),
      'Cliente',
      'Referência',
      'Quantidade',
      'Valor',
    ];
    const aoa: any[][] = [header];
    let grandQtd = 0, grandValor = 0;

    // Agrupado por indústria (mesma ordem da tela) — cada bloco fecha com um SUBTOTAL.
    grouped.forEach(([nome, rows]) => {
      rows.forEach(r => {
        aoa.push([
          nome,
          ...(detalhada ? [r.pedido] : []),
          r.cliente,
          detalhada ? fmtDate(r.data) : r.mes_ref,
          r.qtd,
          r.valor,
        ]);
      });
      const subQtd   = rows.reduce((s, r) => s + r.qtd,   0);
      const subValor = rows.reduce((s, r) => s + r.valor, 0);
      grandQtd += subQtd; grandValor += subValor;
      aoa.push([
        `SUBTOTAL ${nome}`,
        ...(detalhada ? [''] : []),
        '', '',
        subQtd, subValor,
      ]);
      aoa.push([]); // linha em branco separando indústrias
    });

    aoa.push([
      'TOTAL GERAL',
      ...(detalhada ? [''] : []),
      '', '',
      grandQtd, grandValor,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = header.map(h =>
      ({ wch: h === 'Cliente' ? 32 : h === 'Indústria' ? 22 : h === 'Valor' ? 16 : 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa_CLI_Industria');
    XLSX.writeFile(wb, `Mapa_CLI_Industria_${dataInicio}_${dataFim}.xlsx`);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Filtros ── */}
      <div style={{
        padding: '10px 18px', background: G.card, borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>
        {/* Indústria */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Indústria</div>
          <div style={{ position: 'relative' }}>
            <Factory size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={industria} onChange={e => setIndustria(e.target.value)}>
              <option value="ALL">Todas</option>
              {industrias.map(i => <option key={i.for_codigo} value={String(i.for_codigo)}>{i.for_nomered}</option>)}
            </select>
          </div>
        </div>

        {/* Vendedor */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Vendedor</div>
          <div style={{ position: 'relative' }}>
            <Briefcase size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={vendedor} onChange={e => setVendedor(e.target.value)}>
              <option value="ALL">Todos</option>
              {vendedores.map(v => <option key={v.ven_codigo} value={String(v.ven_codigo)}>{v.ven_nome}</option>)}
            </select>
          </div>
        </div>

        {/* Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={labelSt}>Cliente</div>
          <div style={{ position: 'relative' }}>
            <User size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
            <select style={selStyle} value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="ALL">Todos</option>
              {clientes.map(c => <option key={c.cli_codigo} value={String(c.cli_codigo)}>{c.cli_nomred}</option>)}
            </select>
          </div>
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 2 }}>
          <label style={chkLabel}>
            <input type="checkbox" checked={grupo} onChange={e => setGrupo(e.target.checked)}
              style={{ accentColor: G.mustard, width: 13, height: 13, cursor: 'pointer' }} />
            <Users size={11} style={{ color: G.textMuted }} /> Agrupar por Rede
          </label>
          <label style={chkLabel}>
            <input type="checkbox" checked={detalhada} onChange={e => setDetalhada(e.target.checked)}
              style={{ accentColor: G.mustard, width: 13, height: 13, cursor: 'pointer' }} />
            <List size={11} style={{ color: G.textMuted }} /> Pedido a Pedido
          </label>
        </div>

        <div style={{ flex: 1 }} />

        <button
          style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', opacity: rawData.length ? 1 : 0.4 }}
          onClick={exportExcel} disabled={!rawData.length}
        >
          <Download size={12} /> Excel
        </button>

        <button
          onClick={processar} disabled={loading}
          style={{ height: 32, padding: '0 18px', borderRadius: 7, fontSize: 11, fontWeight: 800, border: 'none', background: G.text, color: G.mustard, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', opacity: loading ? 0.6 : 1 }}
        >
          {loading
            ? <><span style={{ width: 11, height: 11, border: `2px solid rgba(255,210,0,0.3)`, borderTopColor: G.mustard, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Processando...</>
            : <><Play size={12} /> Processar</>
          }
        </button>
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {!loaded ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <Building2 size={40} style={{ color: G.border }} />
            <span style={{ fontSize: 12, color: G.textMuted }}>Configure os filtros e clique em Processar</span>
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: G.textMuted }}>Nenhum registro encontrado para o período</span>
          </div>
        ) : (
          grouped.map(([nome, rows], i) => (
            <IndustriaAccordion
              key={nome}
              nome={nome}
              rows={rows}
              detalhada={detalhada}
              color={IND_COLORS[i % IND_COLORS.length]}
            />
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
