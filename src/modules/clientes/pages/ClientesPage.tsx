import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, MapPin, History, X, Package, ShoppingBag } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  StatusBadge, G,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import FichaClientePage from './FichaClientePage';

function fmtCnpj(v?: string) {
  if (!v) return '—';
  const d = v.replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return v;
}

interface Cliente {
  cli_codigo: number;
  cli_nomred: string;
  cli_nome: string;
  cli_fantasia: string;
  cli_cnpj: string;
  cli_cidade: string;
  cli_uf: string;
  cli_redeloja: string;
  cli_vendedor_nome: string;
  cli_tipopes: string;
}

export default function ClientesPage() {
  const [data, setData]             = useState<Cliente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string>('novo');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [historicoId, setHistoricoId] = useState<number | null>(null);
  const [historicoNome, setHistoricoNome] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clients?limit=5000&active=${showInactive ? 'all' : 'true'}&search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [search, showInactive]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditingId('novo'); setSelectedId(null); setModalOpen(true); };
  const openEdit = (id: number) => { setEditingId(String(id)); setSelectedId(id); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); load(); };

  const [vinculando, setVinculando] = useState(false);
  const vincularRegioes = async () => {
    if (!confirm('Vincular regiões automaticamente para todos os clientes sem região, com base na cidade cadastrada?')) return;
    setVinculando(true);
    try {
      const r = await api.post('/clients/vincular-regioes');
      const n = r.data.atualizados ?? 0;
      alert(n > 0 ? `${n} cliente(s) vinculado(s) com sucesso!` : 'Nenhum cliente sem região encontrado.');
      if (n > 0) load();
    } catch {
      alert('Erro ao vincular regiões.');
    } finally {
      setVinculando(false);
    }
  };

  const openHistorico = (id: number, nome: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoricoId(id);
    setHistoricoNome(nome);
  };

  const inactivate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Inativar este cliente?')) return;
    await api.delete(`/clients/${id}`);
    load();
  };

  return (
    <>
      <CadastroShell
        title="Clientes"
        total={data.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Pesquisar por nome, CNPJ ou cidade..."
        onNew={openNew}
        newLabel="Novo Cliente"
        loading={loading}
        toolbar={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: G.textSec, cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Mostrar inativos
            </label>
            <button
              onClick={vincularRegioes}
              disabled={vinculando}
              title="Preenche automaticamente a região dos clientes sem região, com base na cidade cadastrada"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 7, border: `1px solid ${G.border}`,
                background: G.card, color: G.textSec, fontSize: 11, fontWeight: 700,
                cursor: vinculando ? 'not-allowed' : 'pointer', opacity: vinculando ? 0.6 : 1,
              }}>
              <MapPin size={12} />
              {vinculando ? 'Vinculando...' : 'Vincular Regiões'}
            </button>
          </div>
        }
      >
        <CadastroTable>
          <thead>
            <tr>
              <Th>Cód</Th>
              <Th>CNPJ</Th>
              <Th>Nome Reduzido</Th>
              <Th>Razão Social</Th>
              <Th>Rede / Lojas</Th>
              <Th>Vendedor</Th>
              <Th>Cidade / UF</Th>
              <Th align="center">Status</Th>
              <Th align="center">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum cliente encontrado.
              </td></tr>
            )}
            {data.map(row => {
              const isSelected = row.cli_codigo === selectedId;
              return (
                <TrHover
                  key={row.cli_codigo}
                  onClick={() => openEdit(row.cli_codigo)}
                  style={isSelected ? { background: `${G.mustard}22`, borderLeft: `3px solid ${G.mustard}` } : { borderLeft: '3px solid transparent' }}
                >
                  <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{row.cli_codigo}</span></Td>
                  <Td><span style={{ fontSize: 12, color: G.textMuted, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtCnpj(row.cli_cnpj)}</span></Td>
                  <Td>
                    <span style={{
                      display: 'inline-block',
                      width: 140,
                      textAlign: 'center',
                      padding: '2px 0',
                      borderRadius: 20,
                      background: isSelected ? `${G.mustard}44` : '#28374A14',
                      fontSize: 12,
                      fontWeight: 800,
                      color: G.text,
                    }}>
                      {row.cli_nomred}
                    </span>
                  </Td>
                  <Td><span style={{ color: G.textSec }}>{row.cli_nome}</span></Td>
                  <Td><span style={{ fontSize: 12, color: G.textMuted }}>{row.cli_redeloja || '—'}</span></Td>
                  <Td><span style={{ fontSize: 12, color: G.textMuted }}>{row.cli_vendedor_nome || '—'}</span></Td>
                  <Td><span style={{ fontSize: 12, color: G.textMuted }}>{row.cli_cidade}{row.cli_uf ? ` / ${row.cli_uf}` : ''}</span></Td>
                  <Td align="center"><StatusBadge active={row.cli_tipopes === 'A'} /></Td>
                  <Td align="center">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        title="Histórico do cliente"
                        onClick={e => openHistorico(row.cli_codigo, row.cli_nomred, e)}
                        style={{ ...actionBtn, color: G.mustard }}
                      >
                        <History size={13} />
                      </button>
                      <button onClick={e => inactivate(row.cli_codigo, e)} style={{ ...actionBtn, color: G.danger }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </Td>
                </TrHover>
              );
            })}
          </tbody>
        </CadastroTable>
      </CadastroShell>

      {historicoId !== null && (
        <ClienteHistoricoModal
          clienteId={historicoId}
          clienteNome={historicoNome}
          onClose={() => setHistoricoId(null)}
        />
      )}

      {/* Modal centralizado — mesmo padrão de IndustriasPage */}
      {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(40,55,74,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                width: '100%', maxWidth: 960,
                maxHeight: '92vh',
                background: G.bg,
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 24px 80px rgba(40,55,74,0.35)',
                display: 'flex', flexDirection: 'column',
              }}
            >
              <FichaClientePage overrideId={editingId} onClose={closeModal} />
            </motion.div>
          </motion.div>
        )}
    </>
  );
}

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

// ─── ClienteHistoricoModal ────────────────────────────────────────────────────

function fmtDate(v?: string) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR');
}

function fmtMoeda(v?: number | string) {
  const n = parseFloat(String(v ?? 0));
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface HistoricoData {
  industrias: { for_codigo: number; for_nomered: string; for_fantasia: string; ultima_compra: string }[];
  pedidos: { ped_pedido: string; ped_data: string; for_nomered: string; ped_totliq: number }[];
}

function ClienteHistoricoModal({ clienteId, clienteNome, onClose }: {
  clienteId: number;
  clienteNome: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'industrias' | 'pedidos'>('industrias');
  const [data, setData] = useState<HistoricoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/clients/${clienteId}/historico`)
      .then(r => setData(r.data))
      .catch(() => setData({ industrias: [], pedidos: [] }))
      .finally(() => setLoading(false));
  }, [clienteId]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 18px', borderRadius: 8,
    border: active ? `1.5px solid ${G.mustard}` : `1px solid ${G.border}`,
    background: active ? `${G.mustard}22` : 'transparent',
    color: active ? G.mustard : G.textSec,
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(40,55,74,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          width: '100%', maxWidth: 700,
          maxHeight: '85vh',
          background: G.bg, borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(40,55,74,0.35)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 14px', borderBottom: `1px solid ${G.border}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>Histórico</div>
            <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2 }}>{clienteNome}</div>
          </div>
          <button onClick={onClose} style={{ ...actionBtn, color: G.textSec }}>
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 24px', borderBottom: `1px solid ${G.border}` }}>
          <button style={tabStyle(tab === 'industrias')} onClick={() => setTab('industrias')}>
            <Package size={12} />
            Indústrias {data ? `(${data.industrias.length})` : ''}
          </button>
          <button style={tabStyle(tab === 'pedidos')} onClick={() => setTab('pedidos')}>
            <ShoppingBag size={12} />
            Pedidos {data ? `(${data.pedidos.length})` : ''}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>Carregando...</div>
          )}

          {!loading && tab === 'industrias' && (
            data?.industrias.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>Nenhuma compra registrada.</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${G.border}` }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: G.textMuted, fontWeight: 700, fontSize: 11 }}>Indústria</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: G.textMuted, fontWeight: 700, fontSize: 11 }}>Última Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.industrias.map(ind => (
                      <tr key={ind.for_codigo} style={{ borderBottom: `1px solid ${G.border}22` }}>
                        <td style={{ padding: '10px 10px', color: G.text, fontWeight: 700 }}>{ind.for_nomered || ind.for_fantasia}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: G.textMuted }}>{fmtDate(ind.ultima_compra)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}

          {!loading && tab === 'pedidos' && (
            data?.pedidos.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: G.textMuted, fontSize: 13 }}>Nenhum pedido registrado.</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${G.border}` }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: G.textMuted, fontWeight: 700, fontSize: 11 }}>Pedido</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: G.textMuted, fontWeight: 700, fontSize: 11 }}>Data</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: G.textMuted, fontWeight: 700, fontSize: 11 }}>Indústria</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: G.textMuted, fontWeight: 700, fontSize: 11 }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.pedidos.map((ped, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${G.border}22` }}>
                        <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: 700, color: G.text }}>{ped.ped_pedido}</td>
                        <td style={{ padding: '10px 10px', color: G.textMuted }}>{fmtDate(ped.ped_data)}</td>
                        <td style={{ padding: '10px 10px', color: G.textSec }}>{ped.for_nomered}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: G.text, fontWeight: 700 }}>{fmtMoeda(ped.ped_totliq)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
