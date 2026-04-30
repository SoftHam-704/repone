import { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  FormSection, Field, G, inp,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

interface Setor {
  set_codigo: number;
  set_nome: string;
  set_obs: string;
  set_cidade_id: number | null;
  set_ordem: number;
  set_cor: string;
  set_ativo: boolean;
  cid_nome?: string;
  cid_uf?: string;
}

interface Cidade { cid_codigo: number; cid_nome: string; cid_uf: string; }

const empty: Partial<Setor> = { set_cidade_id: null, set_ordem: 0, set_cor: '#FFD200', set_ativo: true };

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: `1px solid ${G.border}`, background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

export default function SetoresPage() {
  const [data, setData]             = useState<Setor[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [activeTab, setActiveTab]   = useState<'lista' | 'cadastro'>('lista');
  const [editing, setEditing]       = useState<Partial<Setor>>(empty);
  const [saving, setSaving]         = useState(false);

  // Busca de cidade
  const [cidadeSearch, setCidadeSearch] = useState('');
  const [cidadeSugs, setCidadeSugs]     = useState<Cidade[]>([]);
  const cidadeTimer                     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/setores?search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Autocompletar cidade
  useEffect(() => {
    clearTimeout(cidadeTimer.current);
    if (cidadeSearch.length < 2) { setCidadeSugs([]); return; }
    cidadeTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/cidades?search=${encodeURIComponent(cidadeSearch)}&limit=8`);
        setCidadeSugs(res.data.data || []);
      } catch { /* ignore */ }
    }, 300);
  }, [cidadeSearch]);

  const selectCidade = (c: Cidade) => {
    setEditing(prev => ({ ...prev, set_cidade_id: c.cid_codigo, cid_nome: c.cid_nome, cid_uf: c.cid_uf }));
    setCidadeSearch(`${c.cid_nome} — ${c.cid_uf}`);
    setCidadeSugs([]);
  };

  const openNew = () => {
    setEditing(empty);
    setCidadeSearch('');
    setCidadeSugs([]);
    setActiveTab('cadastro');
  };

  const cancel = () => { setActiveTab('lista'); setEditing(empty); setCidadeSearch(''); };

  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/setores/${id}`);
      const s = res.data.data;
      setEditing(s);
      setCidadeSearch(s.cid_nome ? `${s.cid_nome} — ${s.cid_uf}` : '');
      setActiveTab('cadastro');
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!editing.set_nome?.trim()) return;
    setSaving(true);
    try {
      if (editing.set_codigo) {
        await api.put(`/setores/${editing.set_codigo}`, editing);
      } else {
        await api.post('/setores', editing);
      }
      cancel(); load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remover este setor?')) return;
    try { await api.delete(`/setores/${id}`); load(); }
    catch (err: any) { alert(err?.response?.data?.message || 'Erro ao excluir.'); }
  };

  const set = (field: keyof Setor, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  return (
    <CadastroShell
      title="Setores / Bairros"
      total={data.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Pesquisar por nome..."
      onNew={openNew}
      newLabel="Novo Setor"
      loading={loading}
      activeTab={activeTab}
      formTitle={editing.set_codigo ? `Editar — ${editing.set_nome}` : 'Novo Setor'}
      onSave={save}
      onCancel={cancel}
      saving={saving}
      form={
        <FormSection title="Dados do Setor">
          <Field label="Nome do Setor *">
            <input style={inp} value={editing.set_nome || ''} autoFocus
              onChange={e => set('set_nome', e.target.value)} onKeyDown={onEnterTab}
              placeholder="Ex: SETOR BUENO, VILA MARIANA, CENTRO..." />
          </Field>

          <Field label="Cidade">
            <div style={{ position: 'relative' }}>
              <input
                style={inp}
                value={cidadeSearch}
                onChange={e => { setCidadeSearch(e.target.value); if (!e.target.value) set('set_cidade_id', null); }}
                placeholder="Buscar cidade..."
                autoComplete="off"
              />
              {cidadeSugs.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#fff', border: `1px solid ${G.border}`, borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto',
                }}>
                  {cidadeSugs.map(c => (
                    <div
                      key={c.cid_codigo}
                      onClick={() => selectCidade(c)}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${G.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = G.bg}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <b>{c.cid_nome}</b> <span style={{ color: G.textSec, fontSize: 11 }}>— {c.cid_uf}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Ordem de Visita">
              <input style={inp} type="number" min={0}
                value={editing.set_ordem ?? 0}
                onChange={e => set('set_ordem', parseInt(e.target.value) || 0)}
                placeholder="0" />
            </Field>
            <Field label="Cor (mapa)">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={editing.set_cor || '#FFD200'}
                  onChange={e => set('set_cor', e.target.value)}
                  style={{ width: 40, height: 36, border: `1px solid ${G.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <input style={{ ...inp, flex: 1 }} value={editing.set_cor || '#FFD200'}
                  onChange={e => set('set_cor', e.target.value)}
                  placeholder="#FFD200" />
              </div>
            </Field>
          </div>

          <Field label="Observações">
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 72 }}
              value={editing.set_obs || ''}
              onChange={e => set('set_obs', e.target.value)}
              placeholder="Referências, limites do setor, observações..." />
          </Field>

          <Field label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={editing.set_ativo ?? true}
                onChange={e => set('set_ativo', e.target.checked)} />
              <span style={{ color: G.text, fontWeight: 600 }}>Setor ativo</span>
            </label>
          </Field>
        </FormSection>
      }
    >
      <CadastroTable>
        <thead>
          <tr>
            <Th>Cód</Th>
            <Th>Nome do Setor</Th>
            <Th>Cidade</Th>
            <Th>Ordem</Th>
            <Th>Cor</Th>
            <Th align="center">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>Nenhum setor encontrado.</td></tr>
          )}
          {data.map(row => (
            <TrHover key={row.set_codigo} onClick={() => openEdit(row.set_codigo)}>
              <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{String(row.set_codigo).padStart(3, '0')}</span></Td>
              <Td>
                <span style={{ fontWeight: 700 }}>{row.set_nome}</span>
                {!row.set_ativo && <span style={{ marginLeft: 6, fontSize: 10, background: '#e0e0e0', color: G.textSec, borderRadius: 4, padding: '1px 5px' }}>inativo</span>}
              </Td>
              <Td>
                {row.cid_nome
                  ? <span style={{ fontSize: 12 }}>{row.cid_nome} <span style={{ color: G.textSec }}>— {row.cid_uf}</span></span>
                  : <span style={{ color: G.textMuted, fontSize: 12 }}>—</span>}
              </Td>
              <Td><span style={{ fontSize: 12, color: G.textSec }}>{row.set_ordem ?? 0}</span></Td>
              <Td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: row.set_cor || G.mustard, border: `1px solid ${G.border}` }} />
                  <span style={{ fontSize: 11, color: G.textSec }}>{row.set_cor || G.mustard}</span>
                </div>
              </Td>
              <Td align="center">
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(row.set_codigo); }} style={actionBtn}><Pencil size={13} /></button>
                  <button onClick={e => remove(row.set_codigo, e)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={13} /></button>
                </div>
              </Td>
            </TrHover>
          ))}
        </tbody>
      </CadastroTable>
    </CadastroShell>
  );
}
