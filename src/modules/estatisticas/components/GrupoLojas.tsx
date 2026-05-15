import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, ChevronDown, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row {
  grupo: string; cliente: string; pedido: string;
  data: string;  total: number;   quant: number;
}
interface IndOpt { id: number; nome: string; }

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

const GROUP_COLORS = [
  '#0891B2','#7C3AED','#16A34A','#D97706',
  '#BE185D','#0F766E','#1D4ED8','#DC2626',
  '#B45309','#059669',
];

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function GrupoAccordion({
  grupo, rows, color, defaultOpen,
}: {
  grupo: string; rows: Row[]; color: string; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const totalVal  = rows.reduce((s, r) => s + r.total, 0);
  const totalQtd  = rows.reduce((s, r) => s + r.quant, 0);
  const pedidos   = new Set(rows.map(r => r.pedido)).size;
  const clientes  = new Set(rows.map(r => r.cliente)).size;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}`, marginBottom: 8 }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: open ? `${color}12` : G.card,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? `1px solid ${G.border}` : 'none',
          transition: 'background 0.15s',
        }}
      >
        {/* Ícone grupo */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `${color}20`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Store size={15} style={{ color }} />
        </div>

        {/* Nome */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: open ? color : G.text, letterSpacing: -0.2 }}>
            {grupo}
          </div>
          <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>
            {clientes} cliente{clientes !== 1 ? 's' : ''} · {pedidos} pedido{pedidos !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Totais no header */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginRight: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Qtd Peças</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{totalQtd.toLocaleString('pt-BR')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600 }}>Faturamento</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#16A34A' }}>{fmt(totalVal)}</div>
          </div>
        </div>

        {open ? <ChevronDown size={16} style={{ color, flexShrink: 0 }} />
               : <ChevronRight size={16} style={{ color: G.textMuted, flexShrink: 0 }} />}
      </button>

      {/* Tabela interna */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
              <thead>
                <tr style={{ background: G.cardHi }}>
                  <th style={{ padding: '7px 14px', textAlign: 'left',  color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>Cliente</th>
                  <th style={{ padding: '7px 12px', textAlign: 'left',  color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>Pedido</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center',color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>Data</th>
                  <th style={{ padding: '7px 12px', textAlign: 'right', color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>Qtd</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', color: G.textMuted, fontWeight: 700, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.pedido}-${i}`} style={{ background: i % 2 === 0 ? G.card : G.bg }}>
                    <td style={{ padding: '7px 14px', color: G.text, fontWeight: 500, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.cliente}
                    </td>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: G.text, borderBottom: `1px solid ${G.border}` }}>
                      {r.pedido}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'center', color: G.textMuted, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>
                      {fmtDate(r.data)}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: G.text, fontWeight: 600, borderBottom: `1px solid ${G.border}` }}>
                      {r.quant.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', color: G.text, fontWeight: 600, borderBottom: `1px solid ${G.border}` }}>
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Subtotal do grupo */}
              <tfoot>
                <tr style={{ background: `${color}10` }}>
                  <td colSpan={3} style={{ padding: '8px 14px', fontWeight: 800, fontSize: 11, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Subtotal {grupo}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color, borderTop: `1px solid ${color}30` }}>
                    {totalQtd.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#16A34A', borderTop: `1px solid ${color}30` }}>
                    {fmt(totalVal)}
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

export default function GrupoLojas({ dataInicio, dataFim }: Props) {
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
      const r = await api.get(`/estatisticas/grupo-lojas?${params}`);
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
      if (!map.has(r.grupo)) map.set(r.grupo, []);
      map.get(r.grupo)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const grandVal = rows.reduce((s, r) => s + r.total, 0);
  const grandQtd = rows.reduce((s, r) => s + r.quant, 0);

  function exportExcel() {
    const data = rows.map(r => ({
      'Grupo': r.grupo,
      'Cliente': r.cliente,
      'Pedido': r.pedido,
      'Data': r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '',
      'Qtd Peças': r.quant,
      'Valor': r.total,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Grupo de Lojas');
    XLSX.writeFile(wb, `grupo-lojas.xlsx`);
  }

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filtro */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select
            value={industria}
            onChange={e => setIndustria(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${!industria ? '#EF4444' : G.border}`,
              background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer',
            }}
          >
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

      {/* Empty state */}
      {!industria && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <Store size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione uma indústria para carregar os grupos</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Totalizador geral + Export */}
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
            { label: 'Grupos de Lojas', val: String(grupos.length) },
            { label: 'Total de Pedidos', val: rows.length.toLocaleString('pt-BR') },
            { label: 'Total de Peças',   val: grandQtd.toLocaleString('pt-BR') },
            { label: 'Faturamento Total', val: fmt(grandVal), green: true },
          ].map(k => (
            <div key={k.label} style={{
              flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10,
              padding: '10px 14px', borderLeft: `3px solid ${k.green ? '#16A34A' : G.mustard}`,
            }}>
              <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: k.green ? '#16A34A' : G.text }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acordeões */}
      {!loading && grupos.length > 0 && (
        <div style={{ flex: 1 }}>
          {grupos.map(([grupo, grupoRows], idx) => (
            <GrupoAccordion
              key={grupo}
              grupo={grupo}
              rows={grupoRows}
              color={GROUP_COLORS[idx % GROUP_COLORS.length]}
              defaultOpen={idx === 0}
            />
          ))}

          {/* Grand total */}
          <div style={{
            background: NAVY_DARK, borderRadius: 12, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: G.mustard, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TOTAL GERAL — {grupos.length} grupo{grupos.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Total Peças</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: G.mustard }}>{grandQtd.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Faturamento</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#4ADE80' }}>{fmt(grandVal)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando grupos de lojas...
        </div>
      )}
    </div>
  );
}
