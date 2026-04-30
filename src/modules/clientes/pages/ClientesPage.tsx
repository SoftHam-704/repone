import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: G.textSec, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Mostrar inativos
          </label>
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
