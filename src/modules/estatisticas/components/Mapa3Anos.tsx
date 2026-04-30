import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Props { dataInicio: string; dataFim: string; }
interface RawRow { chave: string; ano: number; valor: number; }
interface IndOpt  { id: number; nome: string; }
interface CliOpt  { id: number; nome: string; }

type Modo      = 'valor' | 'quantidade';
type Categoria = 'mes' | 'codigo';

const NAVY      = '#1E2D3D';
const NAVY_DARK = '#162436';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function mesLabel(chave: string) {
  const n = parseInt(chave, 10);
  return (n >= 1 && n <= 12) ? `${MESES[n - 1]} (${chave})` : chave;
}

function Delta({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0 && curr === 0) return <span style={{ color: G.textMuted, fontSize: 10 }}>—</span>;
  if (prev === 0) return <span style={{ color: '#16A34A', fontSize: 10, fontWeight: 700 }}>novo</span>;
  const pct = ((curr - prev) / prev) * 100;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const color = pct > 0 ? '#16A34A' : pct < 0 ? '#EF4444' : G.textMuted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color, fontSize: 10, fontWeight: 700 }}>
      <Icon size={10} />{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function Mapa3Anos(_: Props) {
  const anoAtual = new Date().getFullYear();

  const [rows,       setRows]       = useState<RawRow[]>([]);
  const [anos,       setAnos]       = useState<number[]>([anoAtual, anoAtual-1, anoAtual-2]);
  const [industrias, setIndustrias] = useState<IndOpt[]>([]);
  const [clientes,   setClientes]   = useState<CliOpt[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const [anoBase,    setAnoBase]    = useState(String(anoAtual));
  const [industria,  setIndustria]  = useState('');
  const [cliente,    setCliente]    = useState('ALL');
  const [modo,       setModo]       = useState<Modo>('valor');
  const [categoria,  setCategoria]  = useState<Categoria>('mes');

  useEffect(() => {
    api.get('/aux/industrias').then(r =>
      setIndustrias((r.data.data || []).map((f: any) => ({ id: f.for_codigo, nome: f.for_nomered || f.for_nome })))
    ).catch(() => {});
    api.get('/clients?limit=2000').then(r =>
      setClientes((r.data.data || []).map((c: any) => ({ id: c.cli_codigo, nome: c.cli_nomred || c.cli_nome })))
    ).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!industria) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ anoBase, industria, cliente, modo, categoria });
      const r = await api.get(`/estatisticas/mapa-3-anos?${params}`);
      setRows(r.data.data || []);
      setAnos(r.data.anos || [Number(anoBase), Number(anoBase)-1, Number(anoBase)-2]);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [anoBase, industria, cliente, modo, categoria]);

  useEffect(() => { if (industria) load(); }, [load]);

  // ── Pivot ────────────────────────────────────────────────────────────────
  const { pivotRows, totais } = useMemo(() => {
    const map = new Map<string, Record<number, number>>();
    for (const r of rows) {
      if (!map.has(r.chave)) map.set(r.chave, {});
      map.get(r.chave)![r.ano] = r.valor;
    }

    let chaves = [...map.keys()];
    if (categoria === 'mes') {
      chaves = chaves.sort((a, b) => parseInt(a) - parseInt(b));
    } else {
      chaves = chaves.sort();
    }

    const pivotRows = chaves.map(chave => ({
      chave,
      v: anos.map(a => map.get(chave)?.[a] ?? 0),
    }));

    const totais = anos.map((_, i) => pivotRows.reduce((s, r) => s + r.v[i], 0));

    return { pivotRows, totais };
  }, [rows, anos, categoria]);

  const fmtVal = (n: number) => modo === 'valor'
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : n.toLocaleString('pt-BR');

  const anosDisponiveis = Array.from({ length: 6 }, (_, i) => anoAtual - i);

  // Year header colors — newest = bright, older = muted
  const ANO_COLORS = ['#FFD200', '#94A3B8', '#64748B'];

  const toggleBtn = (active: boolean) => ({
    padding: '5px 14px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? NAVY : G.cardHi,
    color: active ? G.mustard : G.textMuted,
    transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div style={{ padding: '20px 24px', background: G.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtros ── */}
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>

        {/* Ano Base */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Ano Base</label>
          <select value={anoBase} onChange={e => setAnoBase(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer', minWidth: 90 }}>
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Indústria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Indústria <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <select value={industria} onChange={e => setIndustria(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${!industria ? '#EF4444' : G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}>
            <option value="">Selecione...</option>
            {industrias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>

        {/* Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Cliente</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${G.border}`, background: G.cardHi, color: G.text, outline: 'none', cursor: 'pointer' }}>
            <option value="ALL">Todos os Clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Modo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Modo</label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${G.border}` }}>
            <button onClick={() => setModo('valor')}     style={toggleBtn(modo === 'valor')}>Valor</button>
            <button onClick={() => setModo('quantidade')} style={toggleBtn(modo === 'quantidade')}>Qtd</button>
          </div>
        </div>

        {/* Categoria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Categoria</label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${G.border}` }}>
            <button onClick={() => setCategoria('mes')}    style={toggleBtn(categoria === 'mes')}>Mês</button>
            <button onClick={() => setCategoria('codigo')} style={toggleBtn(categoria === 'codigo')}>Código</button>
          </div>
        </div>

        <button onClick={load} disabled={!industria || loading} style={{
          padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: industria ? G.mustard : G.border,
          color: industria ? G.text : G.textMuted,
          border: 'none', cursor: industria ? 'pointer' : 'not-allowed',
          marginLeft: 'auto', alignSelf: 'flex-end',
        }}>
          {loading ? 'Carregando...' : 'Buscar'}
        </button>
      </div>

      {/* Empty */}
      {!industria && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: G.textMuted }}>
          <Calendar size={40} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Selecione uma indústria para carregar o mapa</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Info */}
      {!loading && pivotRows.length > 0 && (
        <div style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>
          {pivotRows.length} {categoria === 'mes' ? 'meses' : 'produtos'} · comparando {anos.join(' / ')}
        </div>
      )}

      {/* ── Pivot Grid ── */}
      {!loading && pivotRows.length > 0 && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', borderRadius: 12, border: `1px solid ${G.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              {/* Anos */}
              <tr>
                <th style={{
                  position: 'sticky', left: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                  borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', minWidth: categoria === 'mes' ? 120 : 130,
                }}>
                  {categoria === 'mes' ? 'Mês' : 'Código'}
                </th>
                {anos.map((ano, i) => (
                  <th key={ano} colSpan={2} style={{
                    background: i === 0 ? NAVY : NAVY_DARK,
                    color: ANO_COLORS[i],
                    padding: '10px 14px', textAlign: 'center', fontWeight: 800,
                    borderRight: `1px solid ${NAVY}`, borderBottom: `1px solid ${NAVY}`,
                    whiteSpace: 'nowrap', minWidth: 180,
                    fontSize: i === 0 ? 13 : 11,
                  }}>
                    {ano} {i === 0 ? '★' : ''}
                  </th>
                ))}
                <th style={{
                  background: NAVY_DARK, color: G.mustard,
                  padding: '10px 14px', textAlign: 'center', fontWeight: 700,
                  borderBottom: `1px solid ${NAVY}`,
                  whiteSpace: 'nowrap', fontSize: 10,
                }}>
                  Δ {anos[0]}/{anos[1]}
                </th>
              </tr>
              {/* Sub-headers */}
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 3, background: NAVY_DARK, borderRight: `1px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}` }} />
                {anos.map((ano, i) => [
                  <th key={`${ano}-v`} style={{
                    background: i === 0 ? NAVY : `${NAVY_DARK}CC`,
                    color: ANO_COLORS[i], padding: '5px 12px', textAlign: 'right',
                    fontWeight: 600, fontSize: 10,
                    borderRight: `1px solid ${NAVY}99`, borderBottom: `2px solid ${NAVY}`,
                    whiteSpace: 'nowrap', minWidth: 120,
                  }}>
                    {modo === 'valor' ? 'Valor (R$)' : 'Quantidade'}
                  </th>,
                  <th key={`${ano}-pct`} style={{
                    background: i === 0 ? NAVY : `${NAVY_DARK}CC`,
                    color: ANO_COLORS[i], padding: '5px 12px', textAlign: 'center',
                    fontWeight: 600, fontSize: 10,
                    borderRight: `1px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`,
                    whiteSpace: 'nowrap', minWidth: 70,
                  }}>
                    % vs {anos[i + 1] ?? '—'}
                  </th>,
                ])}
                <th style={{ background: NAVY_DARK, borderBottom: `2px solid ${NAVY}` }} />
              </tr>
            </thead>
            <tbody>
              {pivotRows.map((row, idx) => (
                <tr key={row.chave} style={{ background: idx % 2 === 0 ? G.card : G.bg }}>
                  {/* Label */}
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: idx % 2 === 0 ? G.card : G.bg,
                    padding: '7px 14px', fontWeight: categoria === 'mes' ? 700 : 600,
                    fontFamily: categoria === 'codigo' ? 'monospace' : 'inherit',
                    fontSize: categoria === 'codigo' ? 12 : 11,
                    color: G.text, borderRight: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                  }}>
                    {categoria === 'mes' ? mesLabel(row.chave) : row.chave}
                  </td>
                  {/* Anos */}
                  {anos.map((ano, i) => [
                    <td key={`${ano}-v`} style={{
                      padding: '7px 12px', textAlign: 'right',
                      color: row.v[i] === 0 ? G.textMuted : G.text,
                      fontWeight: row.v[i] === 0 ? 400 : 600,
                      borderRight: `1px solid ${G.border}99`,
                    }}>
                      {row.v[i] === 0 ? '—' : fmtVal(row.v[i])}
                    </td>,
                    <td key={`${ano}-pct`} style={{
                      padding: '7px 10px', textAlign: 'center',
                      borderRight: `1px solid ${G.border}`,
                    }}>
                      <Delta curr={row.v[i]} prev={row.v[i + 1] ?? 0} />
                    </td>,
                  ])}
                  {/* Δ ano base vs anterior */}
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    <Delta curr={row.v[0]} prev={row.v[1]} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 3,
                  background: NAVY_DARK, color: G.mustard,
                  padding: '9px 14px', fontWeight: 800, fontSize: 11,
                  borderTop: `2px solid ${NAVY}`, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>TOTAL</td>
                {anos.map((ano, i) => [
                  <td key={`${ano}-v`} style={{
                    background: i === 0 ? NAVY : NAVY_DARK, color: ANO_COLORS[i],
                    padding: '9px 12px', textAlign: 'right', fontWeight: 700,
                    borderTop: `2px solid ${NAVY}`, borderRight: `1px solid ${NAVY_DARK}`,
                  }}>
                    {fmtVal(totais[i])}
                  </td>,
                  <td key={`${ano}-pct`} style={{
                    background: i === 0 ? NAVY : NAVY_DARK,
                    padding: '9px 10px', textAlign: 'center',
                    borderTop: `2px solid ${NAVY}`, borderRight: `1px solid ${NAVY}`,
                  }}>
                    <Delta curr={totais[i]} prev={totais[i + 1] ?? 0} />
                  </td>,
                ])}
                <td style={{
                  background: NAVY_DARK, padding: '9px 10px', textAlign: 'center',
                  borderTop: `2px solid ${NAVY}`,
                }}>
                  <Delta curr={totais[0]} prev={totais[1]} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.textMuted, fontSize: 13, fontWeight: 600 }}>
          Carregando mapa 3 anos...
        </div>
      )}
    </div>
  );
}
