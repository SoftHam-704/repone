import { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Trash2, Plus, X, Search } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, Field, G, inp,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

interface Regiao {
  reg_codigo: number;
  reg_descricao: string;
}

interface Cidade {
  cid_codigo: number;
  cid_nome: string;
  cid_uf: string;
}

const empty: Partial<Regiao> = {};

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

// ─── Aba de cidades vinculadas ─────────────────────────────────────────────────
function CidadesTab({ regId }: { regId: number }) {
  const [cidades, setCidades]         = useState<Cidade[]>([]);
  const [loading, setLoading]         = useState(true);
  const [busca, setBusca]             = useState('');
  const [resultados, setResultados]   = useState<Cidade[]>([]);
  const [buscando, setBuscando]       = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadCidades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/regioes/${regId}/cidades`);
      setCidades(res.data.data || []);
    } finally { setLoading(false); }
  }, [regId]);

  useEffect(() => { loadCidades(); }, [loadCidades]);

  const buscarCidade = (q: string) => {
    setBusca(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await api.get(`/cidades?search=${encodeURIComponent(q)}&limit=15`);
        setResultados(res.data.data || []);
      } finally { setBuscando(false); }
    }, 300);
  };

  const adicionar = async (cidade: Cidade) => {
    if (cidades.some(c => c.cid_codigo === cidade.cid_codigo)) return;
    try {
      await api.post(`/regioes/${regId}/cidades`, { cid_id: cidade.cid_codigo });
      setBusca(''); setResultados([]);
      loadCidades();
    } catch (err: any) { alert(err?.response?.data?.message || 'Erro ao adicionar cidade.'); }
  };

  const remover = async (cidId: number) => {
    if (!confirm('Remover esta cidade da região?')) return;
    try {
      await api.delete(`/regioes/${regId}/cidades/${cidId}`);
      loadCidades();
    } catch { /* ignore */ }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Busca para adicionar cidade */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          Adicionar Cidade
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
          <input
            style={{ ...inp, paddingLeft: 32 }}
            placeholder="Buscar cidade por nome..."
            value={busca}
            onChange={e => buscarCidade(e.target.value)}
          />
        </div>
        {resultados.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${G.border}`, borderRadius: 8, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', marginTop: 2 }}>
            {resultados.map(c => (
              <div
                key={c.cid_codigo}
                onClick={() => adicionar(c)}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${G.border}` }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f0e8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{c.cid_nome}</span>
                <span style={{ color: G.textMuted, fontSize: 11 }}>{c.cid_uf}</span>
              </div>
            ))}
          </div>
        )}
        {buscando && <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>Buscando...</div>}
      </div>

      {/* Lista de cidades vinculadas */}
      {loading ? (
        <div style={{ textAlign: 'center', color: G.textMuted, fontSize: 13, padding: 32 }}>Carregando...</div>
      ) : cidades.length === 0 ? (
        <div style={{ textAlign: 'center', color: G.textMuted, fontSize: 13, padding: 32 }}>Nenhuma cidade vinculada a esta região.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: G.bg }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>Cidade</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>UF</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {cidades.map(c => (
              <tr key={c.cid_codigo} style={{ borderBottom: `1px solid ${G.border}` }}>
                <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{c.cid_nome}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: G.textSec }}>{c.cid_uf}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button onClick={() => remover(c.cid_codigo)} style={{ ...actionBtn, color: G.danger }}>
                    <X size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function RegioesPage() {
  const [data, setData]           = useState<Regiao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [formTab, setFormTab]     = useState<'dados' | 'cidades'>('dados');
  const [editing, setEditing]     = useState<Partial<Regiao>>(empty);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/regioes?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(empty); setFormTab('dados'); setActiveTab('cadastro'); };
  const cancel   = () => { setActiveTab('lista'); setEditing(empty); };

  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/regioes/${id}`);
      setEditing(res.data.data);
      setFormTab('dados');
      setActiveTab('cadastro');
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!editing.reg_descricao?.trim()) return;
    setSaving(true);
    try {
      if (editing.reg_codigo) {
        await api.put(`/regioes/${editing.reg_codigo}`, editing);
      } else {
        await api.post('/regioes', editing);
      }
      cancel(); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remover esta região?')) return;
    try { await api.delete(`/regioes/${id}`); load(); }
    catch (err: any) { alert(err?.response?.data?.message || 'Erro ao excluir.'); }
  };

  const set = (field: keyof Regiao, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  const filtered = data.filter(r => !search || r.reg_descricao?.toLowerCase().includes(search.toLowerCase()));

  // Abas internas do formulário
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    borderBottom: active ? `2px solid ${G.text}` : '2px solid transparent',
    color: active ? G.text : G.textSec,
    background: 'transparent', border: 'none',
    textTransform: 'uppercase', letterSpacing: 1,
  });

  return (
    <CadastroShell
      title="Regiões"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por nome..."
      onNew={openNew}
      newLabel="Nova Região"
      loading={loading}
      activeTab={activeTab}
      formTitle={editing.reg_codigo ? `Editar — ${editing.reg_descricao}` : 'Nova Região'}
      onSave={formTab === 'dados' ? save : cancel}
      onCancel={cancel}
      saving={saving}
      form={
        <>
          {/* Sub-abas do form */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${G.border}`, marginBottom: 0, paddingLeft: 24 }}>
            <button style={tabStyle(formTab === 'dados')} onClick={() => setFormTab('dados')}>Dados</button>
            {editing.reg_codigo && (
              <button style={tabStyle(formTab === 'cidades')} onClick={() => setFormTab('cidades')}>Cidades</button>
            )}
          </div>

          {formTab === 'dados' && (
            <FormSection title="Dados da Região">
              <Field label="Nome da Região *">
                <input style={inp} value={editing.reg_descricao || ''} autoFocus
                  onChange={e => set('reg_descricao', e.target.value)} onKeyDown={onEnterTab}
                  placeholder="Ex: NORTE, SUL, GRANDE SP..." />
              </Field>
            </FormSection>
          )}

          {formTab === 'cidades' && editing.reg_codigo && (
            <CidadesTab regId={editing.reg_codigo} />
          )}
        </>
      }
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Cód</Th>
            <Th>Nome da Região</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={3} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>Nenhuma região encontrada.</td></tr>
          )}
          {filtered.map(row => (
            <TrHover key={row.reg_codigo} onClick={() => openEdit(row.reg_codigo)}>
              <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{String(row.reg_codigo).padStart(3, '0')}</span></Td>
              <Td><span style={{ fontWeight: 700 }}>{row.reg_descricao}</span></Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(row.reg_codigo); }} style={actionBtn}><Pencil size={13} /></button>
                  <button onClick={e => remove(row.reg_codigo, e)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={13} /></button>
                </div>
              </Td>
            </TrHover>
          ))}
        </tbody>
      </CadastroTable>
    </CadastroShell>
  );
}
