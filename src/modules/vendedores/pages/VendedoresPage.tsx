import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover, G,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

interface Vendedor {
  ven_codigo: number;
  ven_nome: string;
  ven_fone1: string;
  ven_email: string;
  ven_nomeusu: string;
  ven_status: string;
  ven_cidade: string;
  ven_uf: string;
}

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

export default function VendedoresPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sellers?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remover este vendedor?')) return;
    await api.delete(`/sellers/${id}`);
    load();
  };

  const filtered = data.filter(r =>
    !search || [r.ven_nome, r.ven_email, r.ven_nomeusu, r.ven_cidade].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <CadastroShell
      title="Vendedores"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por nome, e-mail ou usuário..."
      onNew={() => navigate('/vendedores/novo')}
      newLabel="Novo Vendedor"
      loading={loading}
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Cód</Th>
            <Th>Nome</Th>
            <Th>Cidade / UF</Th>
            <Th>Telefone</Th>
            <Th>E-mail</Th>
            <Th>Usuário</Th>
            <Th>Status</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhum vendedor encontrado.
              </td>
            </tr>
          )}
          {filtered.map(row => (
            <TrHover key={row.ven_codigo} onClick={() => navigate(`/vendedores/${row.ven_codigo}`)}>
              <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{row.ven_codigo}</span></Td>
              <Td><span style={{ fontWeight: 800 }}>{row.ven_nome}</span></Td>
              <Td>
                <span style={{ fontSize: 12, color: G.textSec }}>
                  {[row.ven_cidade, row.ven_uf].filter(Boolean).join(' / ') || '—'}
                </span>
              </Td>
              <Td><span style={{ color: G.textSec, fontSize: 12 }}>{row.ven_fone1 || '—'}</span></Td>
              <Td><span style={{ color: G.textSec, fontSize: 12 }}>{row.ven_email || '—'}</span></Td>
              <Td>
                {row.ven_nomeusu ? (
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: '#28374A14', fontSize: 11, fontWeight: 700, color: G.textSec, fontFamily: 'monospace' }}>
                    {row.ven_nomeusu}
                  </span>
                ) : '—'}
              </Td>
              <Td>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
                  background: row.ven_status !== 'I' ? '#16A34A18' : '#C0392B18',
                  color: row.ven_status !== 'I' ? G.success : G.danger,
                  border: `1px solid ${row.ven_status !== 'I' ? '#16A34A33' : '#C0392B33'}`,
                }}>
                  {row.ven_status === 'I' ? 'INATIVO' : 'ATIVO'}
                </span>
              </Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); navigate(`/vendedores/${row.ven_codigo}`); }} style={actionBtn}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => remove(row.ven_codigo, e)} style={{ ...actionBtn, color: G.danger }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </Td>
            </TrHover>
          ))}
        </tbody>
      </CadastroTable>
    </CadastroShell>
  );
}
