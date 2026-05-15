import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronDown, ChevronRight, Package, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row { cliente_nome: string; produto_codigo: string; produto_desc: string; quantidade: number; }
interface IndOpt { id: number; nome: string; }

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

const CLI_COLORS = [
  '#0891B2','#7C3AED','#16A34A','#D97706',
  '#BE185D','#0F766E','#1D4ED8','#DC2626',
  '#B45309','#059669',
];

function ClienteAccordion({ nome, rows, color, defaultOpen }: {
  nome: string; rows: Row[]; color: string; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalQtd = rows.reduce((s, r) => s + r.quantidade, 0);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', background: open ? `${color}12` : G.card,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? `1px solid ${G.border}` : 'none',
          transition: 'background 0.15s',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `${color}20`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={14} style={{ color }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: open ? color : G.text, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nome}
          </div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>
            {rows.length} produto{rows.length !== 1 ? 's' : ''} · única compra no período
          </div>
        </div>

        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Total Peças</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.text }}>{totalQtd.toLocaleString('pt-BR')}</div>
        </div>

        {open
          ? <ChevronDown size={15} style={{ color, flexShrink: 0 }} />
          : <ChevronRight size={15} style={{ color: G.textMuted, flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
              <thead>
                <tr style={{ background: G.cardHi }}>
                  <th style={{ padding: '6px 12px', textAlign: 'left',  color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap', minWidth: 110 }}>Código</th>
                  <th style={{ padding: '6px 14px', textAlign: 'left',  color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}` }}>Produto</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap', minWidth: 90 }}>Qtd</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.produto_codigo} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: G.text, letterSpacing: 0.3, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>
                      {r.produto_codigo}
                    </td>
                    <td style={{ padding: '7px 14px', color: G.text, fontWeight: 500, borderBottom: `1px solid ${G.border}` }}>
                      {r.produto_desc}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: color, borderBottom: `1px solid ${G.border}` }}>
                      {r.quantidade.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: `${color}10` }}>
                  <td colSpan={2} style={{ padding: '7px 14px', fontWeight: 800, fontSize: 11, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Subtotal {nome}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color }}>
                    {totalQtd.toLocaleString('pt-BR')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProdUnicaCompra({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [industria,  setIndustria]  = useState('');

  useEffect(() => {
    api.get('/aux/industrias').then(r =>
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))
    ).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!industria) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ dataInicial: dataInicio, dataFinal: dataFim, industria });
      const r = await api.get(`/estatisticas/prod-unica-compra?${params}`);
      setRows(r.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria]);

  useEffect(() => { if (industria) load(); }, [load]);

  const grupos = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      if (!map.has(r.cliente_nome)) map.set(r.cliente_nome, []);
      map.get(r.cliente_nome)!.push(r);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  const totalProdutos = rows.length;
  const totalClientes = grupos.length;
  const totalQtd      = rows.reduce((s, r) => s + r.quantidade, 0);

  function exportExcel() {
    const data = rows.map(r => ({
      'Cliente': r.cliente_nome,
      'Código': r.produto_codigo,
      'Produto': r.produto_desc,
      'Qtd': r.quantidade,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 50 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Única Compra');
    XLSX.writeFile(wb, `prod-unica-compra.xlsx`);
  }

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtro */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={industria} onChange={e => setIndustria(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${!industria ? '#EF4444' : G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}>
            <option value="">Selecione...</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={!industria || loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: industria ? G.mustard : G.border,
          color: industria ? G.text : G.textMuted,
          border: 'none', cursor: industria ? 'pointer' : 'not-allowed',
        }}>
          {loading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {!industria && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <ShoppingCart size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione uma indústria para identificar produtos de única compra</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* KPIs + Export */}
      {!loading && grupos.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={exportExcel}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: '#1D6F42', color: '#fff', border: 'none', cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            <Download size={13} /> Excel
          </button>
          {[
            { label: 'Clientes com única compra', val: String(totalClientes), color: '#7C3AED' },
            { label: 'Produtos identificados',    val: String(totalProdutos), color: '#D97706' },
            { label: 'Total de peças',            val: totalQtd.toLocaleString('pt-BR'), color: '#0891B2' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: G.text }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acordeões */}
      {!loading && grupos.length > 0 && (
        <div style={{ flex: 1 }}>
          {grupos.map(([nome, grupoRows], idx) => (
            <ClienteAccordion
              key={nome}
              nome={nome}
              rows={grupoRows}
              color={CLI_COLORS[idx % CLI_COLORS.length]}
              defaultOpen={idx === 0}
            />
          ))}

          {/* Grand total */}
          <div style={{
            background: NAVY_DARK, borderRadius: 12, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TOTAL — {totalClientes} cliente{totalClientes !== 1 ? 's' : ''} · {totalProdutos} produto{totalProdutos !== 1 ? 's' : ''}
            </span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Total Peças</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: G.mustard }}>{totalQtd.toLocaleString('pt-BR')}</div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Analisando compras únicas...
        </div>
      )}
    </div>
  );
}
