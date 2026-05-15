import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }

interface Row {
  codigo: string; descricao: string;
  qtd_ref: number; val_ref: number;
  qtd_alvo: number; val_alvo: number;
}
interface IndOpt { id: number; nome: string; }
interface CliOpt { id: number; nome: string; }

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';
const REF_COLOR = '#0891B2';   // cyan — cliente referência
const ALVO_COLOR = '#7C3AED';  // purple — cliente alvo

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (n: number) => n.toLocaleString('pt-BR');

function DeltaPct({ valRef, alvo: vAlvo }: { valRef: number; alvo: number }) {
  const vRef = valRef;
  if (vRef === 0) return <span style={{ color: G.textMuted, fontSize: 10 }}>—</span>;
  if (vAlvo === 0) return <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>Não comprou</span>;
  const pct = ((vAlvo - vRef) / vRef) * 100;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const color = pct > 0 ? '#16A34A' : pct < 0 ? '#EF4444' : G.textMuted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontSize: 10, fontWeight: 700 }}>
      <Icon size={11} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function ComparativoClientes({ dataInicio, dataFim }: Props) {
  const [rows,       setRows]       = useState<Row[]>([]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [searched,   setSearched]   = useState(false);

  const [industria,   setIndustria]   = useState('');
  const [clienteRef,  setClienteRef]  = useState('');
  const [clienteAlvo, setClienteAlvo] = useState('');
  const [modo,        setModo]        = useState<'GAP' | 'FULL'>('GAP');

  useEffect(() => {
    api.get('/suppliers').then(r =>
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))
    ).catch(() => {});
    api.get('/clients?limit=2000').then(r =>
      setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })))
    ).catch(() => {});
  }, []);

  const canLoad = industria && clienteRef && clienteAlvo && clienteRef !== clienteAlvo;

  const load = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true); setError(''); setSearched(true);
    try {
      const params = new URLSearchParams({
        dataInicial: dataInicio, dataFinal: dataFim,
        industria, clienteRef, clienteAlvo, modo,
      });
      const r = await api.get(`/estatisticas/comparativo-clientes?${params}`);
      setRows(r.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, industria, clienteRef, clienteAlvo, modo, canLoad]);

  const refNome  = clientes.find(c => String(c.id) === clienteRef)?.nome  || 'Referência';
  const alvoNome = clientes.find(c => String(c.id) === clienteAlvo)?.nome || 'Alvo';

  function exportExcel() {
    const data = rows.map(r => ({
      'Código': r.codigo,
      'Descrição': r.descricao,
      [`${refNome} — Qtd`]: r.qtd_ref,
      [`${refNome} — Valor`]: r.val_ref,
      [`${alvoNome} — Qtd`]: r.qtd_alvo,
      [`${alvoNome} — Valor`]: r.val_alvo,
      'Δ Valor %': r.val_ref > 0 ? ((r.val_alvo - r.val_ref) / r.val_ref * 100).toFixed(1) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 16 }, { wch: 50 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativo Clientes');
    XLSX.writeFile(wb, `comparativo-clientes.xlsx`);
  }

  const totalValRef  = rows.reduce((s, r) => s + r.val_ref,  0);
  const totalValAlvo = rows.reduce((s, r) => s + r.val_alvo, 0);
  const totalQtdRef  = rows.reduce((s, r) => s + r.qtd_ref,  0);
  const totalQtdAlvo = rows.reduce((s, r) => s + r.qtd_alvo, 0);

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    border: `1px solid ${G.border}`, background: G.cardHi, color: G.text,
    outline: 'none', cursor: 'pointer',
  } as React.CSSProperties;

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>

        {/* Indústria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={industria} onChange={e => setIndustria(e.target.value)}
            style={{ ...selectStyle, borderColor: !industria ? '#EF4444' : G.border }}>
            <option value="">Selecione...</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>

        {/* Cliente Referência */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: REF_COLOR, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Cliente Referência <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={clienteRef} onChange={e => setClienteRef(e.target.value)}
            style={{ ...selectStyle, borderColor: clienteRef ? REF_COLOR + '80' : '#EF4444', outlineColor: REF_COLOR }}>
            <option value="">Selecione...</option>
            {clientes.filter(c => String(c.id) !== clienteAlvo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Seta */}
        <div style={{ paddingBottom: 4, color: G.textMuted }}>
          <ArrowLeftRight size={16} />
        </div>

        {/* Cliente Alvo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: ALVO_COLOR, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Cliente Alvo <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={clienteAlvo} onChange={e => setClienteAlvo(e.target.value)}
            style={{ ...selectStyle, borderColor: clienteAlvo ? ALVO_COLOR + '80' : '#EF4444', outlineColor: ALVO_COLOR }}>
            <option value="">Selecione...</option>
            {clientes.filter(c => String(c.id) !== clienteRef).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Modo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Modo</label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${G.border}` }}>
            {(['GAP', 'FULL'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)} style={{
                padding: '6px 16px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: modo === m ? NAVY : G.cardHi,
                color: modo === m ? G.mustard : G.textMuted,
                transition: 'all 0.15s',
              }}>
                {m === 'GAP' ? 'GAP (só Ref)' : 'FULL (ambos)'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={load} disabled={!canLoad || loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: canLoad ? G.mustard : G.border,
          color: canLoad ? G.text : G.textMuted,
          border: 'none', cursor: canLoad ? 'pointer' : 'not-allowed',
          marginLeft: 'auto', alignSelf: 'flex-end',
        }}>
          {loading ? 'Carregando...' : 'Comparar'}
        </button>
      </div>

      {/* Hint modo */}
      <div style={{ fontSize: 11, color: G.textMuted, fontStyle: 'italic', marginTop: -8 }}>
        {modo === 'GAP'
          ? '🔍 Modo GAP — produtos que a Referência compra mas o Alvo ainda não comprou (oportunidades de cross-sell)'
          : '📊 Modo FULL — produtos comprados pelos dois clientes no período'}
      </div>

      {/* ── Empty / Error ── */}
      {!canLoad && !rows.length && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <ArrowLeftRight size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione indústria e dois clientes diferentes</span>
        </div>
      )}

      {searched && canLoad && !loading && !error && rows.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <ArrowLeftRight size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nenhum produto encontrado para os filtros e período selecionados</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ── KPI strip + Export ── */}
      {!loading && rows.length > 0 && (
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
            { label: `${refNome} — Valor`, val: fmt(totalValRef), color: REF_COLOR },
            { label: `${refNome} — Qtd`,   val: fmtQtd(totalQtdRef) + ' pç', color: REF_COLOR },
            { label: `${alvoNome} — Valor`, val: fmt(totalValAlvo), color: ALVO_COLOR },
            { label: `${alvoNome} — Qtd`,   val: fmtQtd(totalQtdAlvo) + ' pç', color: ALVO_COLOR },
            { label: 'SKUs encontrados',    val: String(rows.length), color: G.mustard },
          ].map(k => (
            <div key={k.label} style={{
              flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10,
              padding: '10px 14px', borderLeft: `3px solid ${k.color}`,
            }}>
              <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabela ── */}
      {!loading && rows.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ background: NAVY_DARK, color: G.mustard, padding: '10px 12px', textAlign: 'left', fontWeight: 700, borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap', minWidth: 90, position: 'sticky', left: 0, zIndex: 3 }}>
                  Código
                </th>
                <th style={{ background: NAVY_DARK, color: G.mustard, padding: '10px 14px', textAlign: 'left', fontWeight: 700, borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, minWidth: 240, position: 'sticky', left: 90, zIndex: 3 }}>
                  Descrição
                </th>
                {/* REF group */}
                <th colSpan={2} style={{ background: REF_COLOR + '22', color: REF_COLOR, padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap' }}>
                  {refNome}
                </th>
                {/* ALVO group */}
                <th colSpan={2} style={{ background: ALVO_COLOR + '22', color: ALVO_COLOR, padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap' }}>
                  {alvoNome}
                </th>
                <th style={{ background: NAVY_DARK, color: G.mustard, padding: '10px 12px', textAlign: 'center', fontWeight: 700, borderBottom: `1px solid ${NAVY}`, whiteSpace: 'nowrap' }}>
                  Δ Valor
                </th>
              </tr>
              <tr>
                <th style={{ background: NAVY_DARK, borderRight: `1px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`, position: 'sticky', left: 0, zIndex: 3 }} />
                <th style={{ background: NAVY_DARK, borderRight: `1px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`, position: 'sticky', left: 90, zIndex: 3 }} />
                {[
                  { label: 'Qtd', color: REF_COLOR },
                  { label: 'Valor', color: REF_COLOR, last: true },
                  { label: 'Qtd', color: ALVO_COLOR },
                  { label: 'Valor', color: ALVO_COLOR, last: true },
                ].map((h, i) => (
                  <th key={i} style={{
                    background: i < 2 ? REF_COLOR + '15' : ALVO_COLOR + '15',
                    color: h.color, padding: '6px 12px', textAlign: 'right', fontWeight: 700,
                    borderRight: h.last ? `2px solid ${NAVY}` : `1px solid ${G.border}`,
                    borderBottom: `2px solid ${NAVY}`,
                    whiteSpace: 'nowrap', minWidth: 90, fontSize: 10,
                  }}>{h.label}</th>
                ))}
                <th style={{ background: NAVY_DARK, borderBottom: `2px solid ${NAVY}` }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.codigo} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: idx % 2 === 0 ? G.card : G.bg,
                    padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                    color: G.text, borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                  }}>{row.codigo}</td>
                  <td style={{
                    position: 'sticky', left: 90, zIndex: 2,
                    background: idx % 2 === 0 ? G.card : G.bg,
                    padding: '7px 14px', color: G.text, fontWeight: 500,
                    borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                    maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{row.descricao}</td>
                  {/* Ref */}
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: REF_COLOR, fontWeight: 600, borderRight: `1px solid ${G.border}` }}>
                    {fmtQtd(row.qtd_ref)}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: REF_COLOR, fontWeight: 600, borderRight: `2px solid ${NAVY}` }}>
                    {fmt(row.val_ref)}
                  </td>
                  {/* Alvo */}
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: row.qtd_alvo === 0 ? '#EF4444' : ALVO_COLOR, fontWeight: 600, borderRight: `1px solid ${G.border}` }}>
                    {row.qtd_alvo === 0 ? '—' : fmtQtd(row.qtd_alvo)}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: row.val_alvo === 0 ? '#EF4444' : ALVO_COLOR, fontWeight: 600, borderRight: `2px solid ${NAVY}` }}>
                    {row.val_alvo === 0 ? '—' : fmt(row.val_alvo)}
                  </td>
                  {/* Delta */}
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <DeltaPct valRef={row.val_ref} alvo={row.val_alvo} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 3, background: NAVY_DARK, color: G.mustard, padding: '9px 14px', fontWeight: 800, fontSize: 11, borderTop: `2px solid ${NAVY}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  TOTAL ({rows.length} SKUs)
                </td>
                <td style={{ background: NAVY, color: REF_COLOR, padding: '9px 12px', textAlign: 'right', fontWeight: 700, borderTop: `2px solid ${NAVY}`, borderRight: `1px solid ${NAVY_DARK}` }}>
                  {fmtQtd(totalQtdRef)}
                </td>
                <td style={{ background: NAVY, color: REF_COLOR, padding: '9px 12px', textAlign: 'right', fontWeight: 700, borderTop: `2px solid ${NAVY}`, borderRight: `2px solid ${NAVY_DARK}` }}>
                  {fmt(totalValRef)}
                </td>
                <td style={{ background: NAVY, color: ALVO_COLOR, padding: '9px 12px', textAlign: 'right', fontWeight: 700, borderTop: `2px solid ${NAVY}`, borderRight: `1px solid ${NAVY_DARK}` }}>
                  {fmtQtd(totalQtdAlvo)}
                </td>
                <td style={{ background: NAVY, color: ALVO_COLOR, padding: '9px 12px', textAlign: 'right', fontWeight: 700, borderTop: `2px solid ${NAVY}`, borderRight: `2px solid ${NAVY_DARK}` }}>
                  {fmt(totalValAlvo)}
                </td>
                <td style={{ background: NAVY_DARK, borderTop: `2px solid ${NAVY}` }}>
                  <DeltaPct valRef={totalValRef} alvo={totalValAlvo} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Comparando clientes...
        </div>
      )}
    </div>
  );
}
