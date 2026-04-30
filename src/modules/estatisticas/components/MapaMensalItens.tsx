import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Search } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface RawRow { codigo: string; descricao: string; mes: string; qtd: number; }
interface IndOpt  { id: number; nome: string; }
interface CliOpt  { id: number; nome: string; }

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

function parseMonthKey(mes: string) {
  const [mm, yyyy] = mes.split('/');
  return Number(yyyy) * 100 + Number(mm);
}

export default function MapaMensalItens({ dataInicio, dataFim }: Props) {
  const [rows,        setRows]        = useState<RawRow[]>([]);
  const [industrias,  setIndustrias]  = useState<IndOpt[]>([]);
  const [clientes,    setClientes]    = useState<CliOpt[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const [industria,   setIndustria]   = useState('');
  const [cliente,     setCliente]     = useState('ALL');
  const [itemCode,    setItemCode]    = useState('');
  const [grupo,       setGrupo]       = useState(false);

  // Load combos
  useEffect(() => {
    api.get('/suppliers').then(r => {
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/clients?limit=2000').then(r => {
      setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })));
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!industria) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        dataInicial: dataInicio, dataFinal: dataFim,
        industria, cliente,
        grupo: String(grupo),
        ...(itemCode.trim() ? { itemCode: itemCode.trim() } : {}),
      });
      const r = await api.get(`/estatisticas/mapa-mensal-itens?${params}`);
      setRows(r.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, cliente, itemCode, grupo]);

  useEffect(() => { if (industria) load(); }, [load]);

  // ─── Pivot ────────────────────────────────────────────────────────────────
  const { meses, produtos, pivot, totalPorMes, totalPorProd, grandTotal } = useMemo(() => {
    const mesesSet = new Set<string>();
    const prodMap  = new Map<string, string>(); // codigo → descricao

    for (const r of rows) {
      mesesSet.add(r.mes);
      if (!prodMap.has(r.codigo)) prodMap.set(r.codigo, r.descricao);
    }

    const meses    = [...mesesSet].sort((a, b) => parseMonthKey(a) - parseMonthKey(b));
    const produtos = [...prodMap.entries()].map(([codigo, descricao]) => ({ codigo, descricao }));

    const pivot: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!pivot[r.codigo]) pivot[r.codigo] = {};
      pivot[r.codigo][r.mes] = (pivot[r.codigo][r.mes] || 0) + r.qtd;
    }

    // Sort produtos by total descending
    produtos.sort((a, b) => {
      const ta = meses.reduce((s, m) => s + (pivot[a.codigo]?.[m] || 0), 0);
      const tb = meses.reduce((s, m) => s + (pivot[b.codigo]?.[m] || 0), 0);
      return tb - ta;
    });

    const totalPorMes:  Record<string, number> = {};
    const totalPorProd: Record<string, number> = {};
    let grandTotal = 0;

    for (const m of meses) {
      totalPorMes[m] = 0;
      for (const p of produtos) {
        const v = pivot[p.codigo]?.[m] || 0;
        totalPorMes[m]         += v;
        totalPorProd[p.codigo]  = (totalPorProd[p.codigo] || 0) + v;
        grandTotal             += v;
      }
    }

    return { meses, produtos, pivot, totalPorMes, totalPorProd, grandTotal };
  }, [rows]);

  const fmtQtd = (n: number) => n === 0 ? '—' : n.toLocaleString('pt-BR');

  const indRequired = !industria;

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{
        background: G.card, border: `1px solid ${G.border}`, borderRadius: 14,
        padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
      }}>
        {/* Indústria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select
            value={industria}
            onChange={e => setIndustria(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${indRequired ? '#EF4444' : G.border}`,
              background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Selecione...</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>

        {/* Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Cliente</label>
          <select
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}
          >
            <option value="ALL">Todos os Clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Código Item */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Código Item</label>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
            <input
              value={itemCode}
              onChange={e => setItemCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Filtrar por código..."
              style={{ padding: '6px 10px 6px 26px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        {/* Rede */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: G.text, paddingBottom: 2 }}>
          <input type="checkbox" checked={grupo} onChange={e => setGrupo(e.target.checked)}
            style={{ accentColor: G.mustard, width: 14, height: 14 }} />
          Grupo de Lojas
        </label>

        {/* Buscar */}
        <button
          onClick={load}
          disabled={!industria || loading}
          style={{
            padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: industria ? G.mustard : G.border,
            color: industria ? G.text : G.textMuted,
            border: 'none', cursor: industria ? 'pointer' : 'not-allowed',
            marginLeft: 'auto', alignSelf: 'flex-end',
          }}
        >
          {loading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {/* ── Estado vazio ── */}
      {!industria && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <Package size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione uma indústria para carregar o mapa</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ── Info ── */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: G.textMuted, fontWeight: 600 }}>
          <span>{produtos.length} SKU{produtos.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{meses.length} mês/meses</span>
          <span>·</span>
          <span>Total: <strong style={{ color: G.text }}>{grandTotal.toLocaleString('pt-BR')} peças</strong></span>
        </div>
      )}

      {/* ── Pivot Grid ── */}
      {!loading && produtos.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', tableLayout: 'auto' }}>
            <thead>
              <tr>
                {/* Código */}
                <th style={{
                  position: 'sticky', left: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 12px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', minWidth: 90,
                }}>Código</th>
                {/* Descrição */}
                <th style={{
                  position: 'sticky', left: 90, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', minWidth: 220,
                }}>Descrição</th>
                {/* Meses */}
                {meses.map(m => (
                  <th key={m} style={{
                    background: NAVY_DARK, color: G.mustard,
                    padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                    borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                    whiteSpace: 'nowrap', minWidth: 80,
                  }}>{m}</th>
                ))}
                {/* Total */}
                <th style={{
                  position: 'sticky', right: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 14px', textAlign: 'right', fontWeight: 700,
                  borderLeft: `2px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', minWidth: 90,
                }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((prod, idx) => {
                const total = totalPorProd[prod.codigo] || 0;
                return (
                  <tr key={prod.codigo} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                    {/* Código */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 2,
                      background: idx % 2 === 0 ? G.card : G.bg,
                      padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700,
                      fontSize: 12, color: G.text, letterSpacing: 0.3,
                      borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                    }}>{prod.codigo}</td>
                    {/* Descrição */}
                    <td style={{
                      position: 'sticky', left: 90, zIndex: 2,
                      background: idx % 2 === 0 ? G.card : G.bg,
                      padding: '7px 14px', color: G.text, fontWeight: 500,
                      borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                      maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{prod.descricao}</td>
                    {/* Células por mês */}
                    {meses.map(m => {
                      const v = pivot[prod.codigo]?.[m] || 0;
                      return (
                        <td key={m} style={{
                          padding: '7px 12px', textAlign: 'right',
                          color: v === 0 ? G.textMuted : G.text,
                          fontWeight: v === 0 ? 400 : 600,
                          borderRight: `1px solid ${G.border}`,
                        }}>{fmtQtd(v)}</td>
                      );
                    })}
                    {/* Total linha */}
                    <td style={{
                      position: 'sticky', right: 0, zIndex: 2,
                      background: NAVY, color: G.mustard,
                      padding: '7px 14px', textAlign: 'right', fontWeight: 700,
                      borderLeft: `2px solid ${NAVY_DARK}`,
                    }}>{total.toLocaleString('pt-BR')}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer de totais */}
            <tfoot>
              <tr>
                <td colSpan={2} style={{
                  position: 'sticky', left: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '9px 14px', fontWeight: 800, fontSize: 11,
                  borderTop: `2px solid ${NAVY}`, textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>TOTAL</td>
                {meses.map(m => (
                  <td key={m} style={{
                    background: NAVY, color: G.mustard,
                    padding: '9px 12px', textAlign: 'right', fontWeight: 700,
                    borderTop: `2px solid ${NAVY}`, borderRight: `1px solid ${NAVY_DARK}`,
                  }}>{totalPorMes[m].toLocaleString('pt-BR')}</td>
                ))}
                <td style={{
                  position: 'sticky', right: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '9px 14px', textAlign: 'right', fontWeight: 800,
                  borderTop: `2px solid ${NAVY}`, borderLeft: `2px solid ${NAVY}`,
                }}>{grandTotal.toLocaleString('pt-BR')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando mapa...
        </div>
      )}
    </div>
  );
}
