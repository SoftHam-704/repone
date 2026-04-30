import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table as TableIcon, Upload, TrendingUp, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { api } from '@/shared/lib/api';
import {
  CadastroShell,
} from '@/shared/components/layout/CadastroShell';

interface TabelaRow {
  industria: number;
  industria_nome: string;
  nome_tabela: string;
  data_criacao: string | null;
  data_vencimento: string | null;
  total_produtos: number;
  todas_ativas: boolean;
}

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    const iso = d.substring(0, 10);
    const [y, m, day] = iso.split('-').map(Number);
    return format(new Date(y, m - 1, day), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return d;
  }
};

type ContextMenu = { x: number; y: number; row: TabelaRow } | null;
type AdjustModal = { row: TabelaRow } | null;

export default function TabelasPrecosPage() {
  const navigate = useNavigate();
  const [tables,      setTables]      = useState<TabelaRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [ctxMenu,     setCtxMenu]     = useState<ContextMenu>(null);
  const [adjustModal, setAdjustModal] = useState<AdjustModal>(null);
  const [pct,         setPct]         = useState('');
  const [applying,    setApplying]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const r = await api.get('/price-tables');
      if (r.data.success) setTables(r.data.data || []);
    } catch {
      toast.error('Erro ao carregar tabelas de preço.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, []);

  // Fecha o context menu ao clicar em qualquer lugar
  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Foca o input ao abrir o modal
  useEffect(() => {
    if (adjustModal) { setPct(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [adjustModal]);

  const openCtxMenu = useCallback((e: React.MouseEvent, row: TabelaRow) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, row });
  }, []);

  const applyAdjust = async () => {
    if (!adjustModal) return;
    const percentual = parseFloat(pct.replace(',', '.'));
    if (isNaN(percentual) || percentual === 0) { toast.error('Informe um percentual válido.'); return; }
    setApplying(true);
    try {
      const r = await api.put(
        `/price-tables/adjust-linear/${adjustModal.row.industria}?tabela=${encodeURIComponent(adjustModal.row.nome_tabela)}`,
        { percentual }
      );
      toast.success(r.data.message);
      setAdjustModal(null);
      fetchTables();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao aplicar ajuste.');
    } finally {
      setApplying(false);
    }
  };

  const filtered = tables.filter(t => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.nome_tabela.toLowerCase().includes(q) ||
      (t.industria_nome && t.industria_nome.toLowerCase().includes(q))
    );
  });

  return (
    <CadastroShell
      title="Tabelas de Preço"
      search={searchTerm}
      onSearch={setSearchTerm}
      onNew={() => navigate('/utilitarios/importacao-precos')}
      newLabel="Nova Importação"
      loading={loading}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#5E7282', fontWeight: 600 }}>
          Carregando tabelas...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#5E7282', fontWeight: 600 }}>
          {searchTerm ? 'Nenhuma tabela encontrada para a busca.' : 'Nenhuma tabela importada ainda.'}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => navigate('/utilitarios/importacao-precos')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#1D1D1D', color: '#FFD200', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}>
              <Upload size={15} /> Importar Primeira Tabela
            </button>
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E8E1D4' }}>
                {['Indústria', 'Tabela', 'Data Tabela', 'Vencimento', 'Qtd. Itens', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                    fontSize: 10, color: '#5E7282', textTransform: 'uppercase', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}
                  style={{ borderBottom: '1px solid #E8E1D4', transition: 'background .15s', cursor: 'context-menu' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8F5F0')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onContextMenu={e => openCtxMenu(e, row)}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 700, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 6, padding: '2px 8px', fontSize: 12, whiteSpace: 'nowrap', display: 'inline-block' }}>
                      {row.industria_nome || `ID: ${row.industria}`}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, textTransform: 'uppercase', color: '#28374A' }}>
                    {row.nome_tabela}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#5E7282', fontFamily: 'monospace', fontSize: 12 }}>
                    {fmtDate(row.data_criacao)}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#5E7282', fontFamily: 'monospace', fontSize: 12 }}>
                    {fmtDate(row.data_vencimento)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{ background: '#F1F5F9', color: '#475569', borderRadius: 6, padding: '2px 8px', fontSize: 12, display: 'inline-block' }}>{row.total_produtos}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={row.todas_ativas
                      ? { background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 6, padding: '2px 8px', fontSize: 12, display: 'inline-block' }
                      : { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6, padding: '2px 8px', fontSize: 12, display: 'inline-block' }}>
                      {row.todas_ativas ? 'ATIVA' : 'INATIVA'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px', fontSize: 11, color: '#5E7282', fontWeight: 600, borderTop: '1px solid #E8E1D4' }}>
            {filtered.length} tabela{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
      {/* ── Context Menu ─────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 9999,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: 220, overflow: 'hidden',
          }}>
          <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #F1F5F9' }}>
            {ctxMenu.row.industria_nome} · {ctxMenu.row.nome_tabela}
          </div>
          <button
            onClick={() => { setAdjustModal({ row: ctxMenu.row }); setCtxMenu(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, color: '#28374A', textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <TrendingUp size={14} color="#10B981" />
            Ajuste linear de preço (%)
          </button>
        </div>
      )}

      {/* ── Modal Ajuste Linear ───────────────────────────────────────── */}
      {adjustModal && (
        <div
          onClick={() => setAdjustModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: 400, maxWidth: '90vw',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
            }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E8E1D4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} color="#10B981" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#28374A' }}>Ajuste Linear de Preço</div>
                  <div style={{ fontSize: 11, color: '#5E7282', fontWeight: 600 }}>{adjustModal.row.industria_nome} · {adjustModal.row.nome_tabela}</div>
                </div>
              </div>
              <button onClick={() => setAdjustModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 20px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#5E7282', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Percentual de ajuste
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  value={pct}
                  onChange={e => setPct(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyAdjust()}
                  placeholder="Ex: 5 para +5% ou -3 para -3%"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 15,
                    fontWeight: 700, color: '#28374A', outline: 'none',
                    border: '2px solid #E2E8F0', transition: 'border .2s',
                  }}
                  onFocus={e => (e.currentTarget.style.border = '2px solid #10B981')}
                  onBlur={e => (e.currentTarget.style.border = '2px solid #E2E8F0')}
                />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontWeight: 900, color: '#94A3B8' }}>%</span>
              </div>
              {pct && !isNaN(parseFloat(pct.replace(',', '.'))) && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: parseFloat(pct.replace(',', '.')) >= 0 ? '#ECFDF5' : '#FEF2F2', fontSize: 12, fontWeight: 700, color: parseFloat(pct.replace(',', '.')) >= 0 ? '#10B981' : '#EF4444' }}>
                  {parseFloat(pct.replace(',', '.')) >= 0 ? '▲' : '▼'} Todos os preços de {adjustModal.row.total_produtos} produto(s) serão {parseFloat(pct.replace(',', '.')) >= 0 ? 'aumentados' : 'reduzidos'} em {Math.abs(parseFloat(pct.replace(',', '.')))}%
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E8E1D4', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdjustModal(null)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, color: '#5E7282', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={applyAdjust} disabled={applying || !pct}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 800,
                  background: applying || !pct ? '#E2E8F0' : '#10B981', color: applying || !pct ? '#94A3B8' : '#fff',
                  cursor: applying || !pct ? 'not-allowed' : 'pointer', transition: 'all .2s',
                }}>
                {applying ? 'Aplicando...' : 'Aplicar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CadastroShell>
  );
}
