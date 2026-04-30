import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Shield, RefreshCw,
  Eye, EyeOff, Crown, Briefcase, UserCheck, X, Check,
} from 'lucide-react';
import { G, inp } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserGroup  { grupo: string; descricao: string; total_usuarios: number }
interface UserRecord { codigo: number; nome: string; sobrenome: string; usuario: string; grupo: string | null; master: boolean; gerencia: boolean; ativo: boolean }
interface Permission { indice: number; descricao: string; invisivel: boolean; incluir: boolean; modificar: boolean; excluir: boolean }
interface UserForm   { codigo?: number; nome: string; sobrenome: string; usuario: string; senha: string; confirmarSenha: string; grupo: string; master: boolean; gerencia: boolean; ativo: boolean }

// ─── Module structure for permissions ────────────────────────────────────────
const MENU_STRUCTURE = [
  { idx: 10,  label: 'CADASTROS',              isParent: true  },
  { idx: 100, label: 'Clientes'                               },
  { idx: 101, label: 'Indústrias'                             },
  { idx: 102, label: 'Vendedores'                             },
  { idx: 103, label: 'Grupos de Produtos'                     },
  { idx: 104, label: 'Grupos de Descontos'                    },
  { idx: 105, label: 'Regiões'                                },
  { idx: 106, label: 'Setores / Bairros'                      },
  { idx: 107, label: 'Itinerários de Visita'                  },
  { idx: 108, label: 'Área de Atuação'                        },
  { idx: 109, label: 'Transportadoras'                        },
  { idx: 110, label: 'Config. Tabelas de Preços'              },
  { idx: 20,  label: 'MOVIMENTAÇÕES',           isParent: true },
  { idx: 200, label: 'Pedidos de Venda'                       },
  { idx: 201, label: 'Carrinho em Lote'                       },
  { idx: 202, label: 'Baixa via XML'                          },
  { idx: 203, label: 'Sell-Out'                               },
  { idx: 30,  label: 'PRODUTOS',                isParent: true },
  { idx: 300, label: 'Tabela de Preços'                       },
  { idx: 301, label: 'Importação de Preços'                   },
  { idx: 302, label: 'Catálogo Digital'                       },
  { idx: 40,  label: 'BI / ANÁLISES',           isParent: true },
  { idx: 400, label: 'BI Intelligence'                        },
  { idx: 401, label: 'Metas'                                  },
  { idx: 50,  label: 'UTILITÁRIOS',             isParent: true },
  { idx: 500, label: 'Usuários do Sistema'                    },
  { idx: 501, label: 'Parâmetros'                             },
  { idx: 502, label: 'Configurações'                          },
];

// Permission toggle colors
const PERM_COLORS = {
  visivel:   '#16A34A',
  incluir:   '#2563EB',
  modificar: '#D97706',
  excluir:   '#DC2626',
};

const emptyForm: UserForm = {
  nome: '', sobrenome: '', usuario: '', senha: '', confirmarSenha: '',
  grupo: '', master: false, gerencia: false, ativo: true,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermToggle({ active, color, label, onChange }: { active: boolean; color: string; label: string; onChange: () => void }) {
  return (
    <button onClick={onChange} title={label} style={{
      width: 30, height: 30, borderRadius: '50%', border: 'none',
      background: active ? color : '#C9C2B8',
      cursor: 'pointer', transition: 'all .18s',
      boxShadow: active ? `0 2px 8px ${color}55` : 'none',
      flexShrink: 0,
    }} />
  );
}

function Avatar({ nome, sobrenome, size = 36, master, gerencia }: { nome: string; sobrenome: string; size?: number; master?: boolean; gerencia?: boolean }) {
  const bg = master ? '#DC2626' : gerencia ? '#2563EB' : '#5E7282';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 800, color: '#fff', flexShrink: 0,
      letterSpacing: '-0.5px',
    }}>
      {(nome?.[0] || '?')}{(sobrenome?.[0] || '')}
    </div>
  );
}

function GroupItem({ g, selected, onSelect, onPolicies, onEdit, onDelete }: {
  g: UserGroup; selected: boolean;
  onSelect: () => void; onPolicies: () => void; onEdit: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '10px 14px', cursor: 'pointer',
        background: selected ? G.text : 'transparent',
        borderBottom: `1px solid ${selected ? 'transparent' : G.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'background .15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? '#FFD200' : G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {g.descricao}
        </div>
        <div style={{ fontSize: 10, color: selected ? '#C9C2B8' : G.textMuted, marginTop: 1 }}>
          {g.grupo} · {g.total_usuarios} usuário{g.total_usuarios !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
        <button onClick={onPolicies} title="Políticas" style={iconBtn(selected ? '#FFD200' : '#2563EB')}>
          <Shield size={11} />
        </button>
        <button onClick={onEdit} title="Editar" style={iconBtn(selected ? '#C9C2B8' : G.textSec)}>
          <Pencil size={11} />
        </button>
        <button onClick={onDelete} title="Excluir" style={iconBtn(selected ? '#FF8080' : G.danger)}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 4, border: `1px solid ${color}44`,
    background: 'transparent', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', color,
  };
}

const sel: React.CSSProperties = {
  ...inp, appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235E7282' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  paddingRight: 32, cursor: 'pointer',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'politicas' | 'usuarios';

export default function UsuariosPage() {
  const [tab, setTab]             = useState<Tab>('politicas');
  const [groups, setGroups]       = useState<UserGroup[]>([]);
  const [users, setUsers]         = useState<UserRecord[]>([]);
  const [selGroup, setSelGroup]   = useState<UserGroup | null>(null);
  const [loadingG, setLoadingG]   = useState(false);
  const [loadingU, setLoadingU]   = useState(false);

  // Group inline form
  const [showGForm, setShowGForm]       = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [gCode, setGCode]               = useState('');
  const [gDesc, setGDesc]               = useState('');
  const [savingG, setSavingG]           = useState(false);

  // Permissions
  const [perms, setPerms]         = useState<Permission[]>([]);
  const [loadingPerms, setLP]     = useState(false);
  const [savingPerms, setSP]      = useState(false);

  // User form (slide-in panel)
  const [showUForm, setShowUForm]   = useState(false);
  const [editUser, setEditUser]     = useState<UserForm>(emptyForm);
  const [savingU, setSavingU]       = useState(false);
  const [showPwd, setShowPwd]       = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    setLoadingG(true);
    try {
      const r = await api.get('/users/groups');
      const data: UserGroup[] = r.data.data || [];
      setGroups(data);
      // Auto-select first group
      if (data.length > 0 && !selGroup) setSelGroup(data[0]);
    } catch { toast.error('Erro ao carregar grupos.'); }
    finally { setLoadingG(false); }
  }, []); // eslint-disable-line

  const loadUsers = useCallback(async () => {
    setLoadingU(true);
    try {
      const r = await api.get('/users');
      setUsers(r.data.data || []);
    } catch { toast.error('Erro ao carregar usuários.'); }
    finally { setLoadingU(false); }
  }, []);

  const loadPerms = useCallback(async (g: UserGroup) => {
    setLP(true);
    try {
      const r = await api.get(`/users/groups/${g.grupo}/permissions`);
      setPerms(r.data.data || []);
    } catch { toast.error('Erro ao carregar políticas.'); }
    finally { setLP(false); }
  }, []);

  useEffect(() => { loadGroups(); loadUsers(); }, [loadGroups, loadUsers]);
  useEffect(() => { if (selGroup) loadPerms(selGroup); }, [selGroup, loadPerms]);

  // ── Group CRUD ─────────────────────────────────────────────────────────────
  const openNewGroup = () => { setEditingGroup(null); setGCode(''); setGDesc(''); setShowGForm(true); };
  const openEditGroup = (g: UserGroup) => { setEditingGroup(g); setGCode(g.grupo); setGDesc(g.descricao); setShowGForm(true); };
  const cancelGroup = () => { setShowGForm(false); setEditingGroup(null); };

  const saveGroup = async () => {
    if (!gCode.trim() || !gDesc.trim()) { toast.error('Código e descrição são obrigatórios.'); return; }
    setSavingG(true);
    try {
      if (editingGroup) {
        await api.put(`/users/groups/${editingGroup.grupo}`, { descricao: gDesc });
        toast.success('Grupo atualizado.');
      } else {
        await api.post('/users/groups', { grupo: gCode, descricao: gDesc });
        toast.success('Grupo criado.');
      }
      cancelGroup(); loadGroups();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar grupo.'); }
    finally { setSavingG(false); }
  };

  const removeGroup = async (g: UserGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Excluir o grupo "${g.descricao}"?`)) return;
    try {
      await api.delete(`/users/groups/${g.grupo}`);
      toast.success('Grupo excluído.');
      if (selGroup?.grupo === g.grupo) setSelGroup(groups.find(x => x.grupo !== g.grupo) || null);
      loadGroups(); loadUsers();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao excluir grupo.'); }
  };

  // ── Permissions ────────────────────────────────────────────────────────────
  const togglePerm = (indice: number, field: keyof Permission, value: boolean) =>
    setPerms(prev => prev.map(p => p.indice === indice ? { ...p, [field]: value } : p));

  const savePerms = async () => {
    if (!selGroup) return;
    setSP(true);
    try {
      await api.put(`/users/groups/${selGroup.grupo}/permissions`, { permissions: perms });
      toast.success('Políticas salvas.');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar políticas.'); }
    finally { setSP(false); }
  };

  const permMap: Record<number, Permission> = {};
  perms.forEach(p => { permMap[p.indice] = p; });

  // ── User CRUD ──────────────────────────────────────────────────────────────
  const openNewUser = () => {
    setEditUser({ ...emptyForm, grupo: selGroup?.grupo || '' });
    setShowPwd(false); setShowUForm(true);
  };
  const openEditUser = (u: UserRecord) => {
    setEditUser({ codigo: u.codigo, nome: u.nome, sobrenome: u.sobrenome,
      usuario: u.usuario, senha: '', confirmarSenha: '',
      grupo: u.grupo || '', master: u.master, gerencia: u.gerencia, ativo: u.ativo });
    setShowPwd(false); setShowUForm(true);
  };
  const cancelUser = () => { setShowUForm(false); setEditUser(emptyForm); };

  const saveUser = async () => {
    if (!editUser.nome.trim() || !editUser.sobrenome.trim() || !editUser.usuario.trim()) {
      toast.error('Nome, sobrenome e login são obrigatórios.'); return;
    }
    if (!editUser.codigo && !editUser.senha.trim()) {
      toast.error('Senha é obrigatória para novo usuário.'); return;
    }
    if (editUser.senha && editUser.senha !== editUser.confirmarSenha) {
      toast.error('As senhas não conferem.'); return;
    }
    setSavingU(true);
    try {
      const body = { nome: editUser.nome, sobrenome: editUser.sobrenome, usuario: editUser.usuario,
        senha: editUser.senha || undefined, grupo: editUser.grupo || null,
        master: editUser.master, gerencia: editUser.gerencia, ativo: editUser.ativo };
      if (editUser.codigo) {
        await api.put(`/users/${editUser.codigo}`, body);
        toast.success('Usuário atualizado.');
      } else {
        await api.post('/users', body);
        toast.success('Usuário criado.');
      }
      cancelUser(); loadUsers(); loadGroups();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar usuário.'); }
    finally { setSavingU(false); }
  };

  const removeUser = async (u: UserRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Excluir "${u.nome} ${u.sobrenome}"?`)) return;
    try {
      await api.delete(`/users/${u.codigo}`);
      toast.success('Usuário excluído.'); loadUsers(); loadGroups();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao excluir usuário.'); }
  };

  const setF = (field: keyof UserForm, val: any) => setEditUser(p => ({ ...p, [field]: val }));

  const filteredUsers = selGroup
    ? users.filter(u => u.grupo === selGroup.grupo)
    : users;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg }}>

      {/* ── Top header with tabs ─────────────────────────────────────────── */}
      <div style={{
        background: G.card, borderBottom: `1px solid ${G.border}`,
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: G.text, paddingRight: 20, borderRight: `1px solid ${G.border}`, marginRight: 20, paddingTop: 12, paddingBottom: 12 }}>
          Gestão de Identidade
        </span>
        {([['politicas', 'POLÍTICAS DE GRUPO'], ['usuarios', 'BASE DE USUÁRIOS']] as [Tab, string][]).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.07em',
            color: tab === t ? G.text : G.textMuted,
            borderBottom: tab === t ? `2.5px solid ${G.mustard}` : '2.5px solid transparent',
            transition: 'all .15s',
          }}>{lbl}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => { loadGroups(); loadUsers(); }} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7,
          border: `1px solid ${G.border}`, background: 'transparent',
          fontSize: 11, fontWeight: 700, color: G.textSec, cursor: 'pointer',
        }}>
          <RefreshCw size={12} style={{ animation: (loadingG || loadingU) ? 'spin 1s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {/* ── Split layout ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT: Groups sidebar ─────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${G.border}`, background: G.card, display: 'flex', flexDirection: 'column' }}>

          {/* Groups header */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>Grupos</span>
            <button onClick={openNewGroup} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.textSec }}>
              <Plus size={11} />
            </button>
          </div>

          {/* Group inline form */}
          {showGForm && (
            <div style={{ padding: 10, borderBottom: `1px solid ${G.border}`, background: G.bg }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, marginBottom: 6, textTransform: 'uppercase' }}>
                {editingGroup ? 'Editar grupo' : 'Novo grupo'}
              </div>
              {!editingGroup && (
                <input style={{ ...inp, marginBottom: 5, fontSize: 12 }} value={gCode}
                  onChange={e => setGCode(e.target.value.toUpperCase())}
                  placeholder="Código (ex: ADM)" maxLength={6} autoFocus />
              )}
              <input style={{ ...inp, marginBottom: 6, fontSize: 12 }} value={gDesc}
                onChange={e => setGDesc(e.target.value)} placeholder="Descrição"
                maxLength={30} autoFocus={!!editingGroup}
                onKeyDown={e => { if (e.key === 'Enter') saveGroup(); if (e.key === 'Escape') cancelGroup(); }} />
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={saveGroup} disabled={savingG} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: G.mustard, fontSize: 11, fontWeight: 800, color: G.text, cursor: 'pointer' }}>
                  {savingG ? '...' : editingGroup ? 'Salvar' : 'Criar'}
                </button>
                <button onClick={cancelGroup} style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', cursor: 'pointer', color: G.textSec }}>
                  <X size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Groups list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingG
              ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: G.textMuted }}>Carregando...</div>
              : groups.length === 0
                ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: G.textMuted }}>Nenhum grupo cadastrado.</div>
                : groups.map(g => (
                  <GroupItem key={g.grupo} g={g} selected={selGroup?.grupo === g.grupo}
                    onSelect={() => setSelGroup(g)}
                    onPolicies={() => { setSelGroup(g); setTab('politicas'); }}
                    onEdit={() => openEditGroup(g)}
                    onDelete={(e: React.MouseEvent) => { void removeGroup(g, e); }}
                  />
                ))
            }
          </div>
        </div>

        {/* ── RIGHT: tab content ───────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── POLÍTICAS DE GRUPO ───────────────────────────────────── */}
          {tab === 'politicas' && (
            <>
              {/* Subheader */}
              <div style={{
                background: G.card, borderBottom: `1px solid ${G.border}`,
                padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
              }}>
                <Shield size={14} color={G.mustard} />
                <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
                  Políticas para{' '}
                  {selGroup
                    ? <span style={{ background: G.text, color: G.mustard, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, marginLeft: 4 }}>{selGroup.descricao}</span>
                    : <span style={{ color: G.textMuted, fontSize: 12 }}>nenhum grupo selecionado</span>
                  }
                </span>
                <span style={{ flex: 1 }} />
                {/* Column headers legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 16 }}>
                  {[['Visível', PERM_COLORS.visivel], ['Incluir', PERM_COLORS.incluir], ['Modificar', PERM_COLORS.modificar], ['Excluir', PERM_COLORS.excluir]].map(([lbl, color]) => (
                    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted }}>{lbl}</span>
                    </div>
                  ))}
                </div>
                <button onClick={savePerms} disabled={!selGroup || savingPerms} style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none',
                  background: selGroup && !savingPerms ? G.mustard : G.border,
                  fontSize: 12, fontWeight: 800, color: G.text,
                  cursor: selGroup && !savingPerms ? 'pointer' : 'not-allowed',
                }}>
                  {savingPerms ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>

              {/* Permissions list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {!selGroup ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: G.textMuted }}>
                    <Shield size={36} strokeWidth={1.2} />
                    <span style={{ fontSize: 13 }}>Selecione um grupo para ver as políticas.</span>
                  </div>
                ) : loadingPerms ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: G.textMuted, fontSize: 13 }}>Carregando políticas...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {MENU_STRUCTURE.map((item) => {
                      const perm = permMap[item.idx];
                      if (item.isParent) {
                        return (
                          <div key={item.idx} style={{
                            padding: '8px 16px', marginTop: 8,
                            background: G.text, borderRadius: 8,
                            fontSize: 10, fontWeight: 800, color: G.mustard,
                            letterSpacing: '0.12em',
                          }}>
                            {item.label}
                          </div>
                        );
                      }
                      return (
                        <div key={item.idx} style={{
                          display: 'flex', alignItems: 'center',
                          padding: '10px 16px', background: G.card,
                          borderRadius: 8, border: `1px solid ${G.border}`,
                        }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: G.text }}>{item.label}</span>
                          {perm ? (
                            <div style={{ display: 'flex', gap: 10 }}>
                              <PermToggle active={!perm.invisivel}   color={PERM_COLORS.visivel}   label="Visível"   onChange={() => togglePerm(item.idx, 'invisivel', !perm.invisivel)} />
                              <PermToggle active={perm.incluir}      color={PERM_COLORS.incluir}   label="Incluir"   onChange={() => togglePerm(item.idx, 'incluir',   !perm.incluir)} />
                              <PermToggle active={perm.modificar}    color={PERM_COLORS.modificar} label="Modificar" onChange={() => togglePerm(item.idx, 'modificar', !perm.modificar)} />
                              <PermToggle active={perm.excluir}      color={PERM_COLORS.excluir}   label="Excluir"   onChange={() => togglePerm(item.idx, 'excluir',   !perm.excluir)} />
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: G.textMuted }}>não configurado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── BASE DE USUÁRIOS ──────────────────────────────────────── */}
          {tab === 'usuarios' && (
            <>
              {/* Subheader */}
              <div style={{
                background: G.card, borderBottom: `1px solid ${G.border}`,
                padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: G.text, flex: 1 }}>
                  {selGroup
                    ? <><span style={{ color: G.textMuted }}>Usuários de </span>{selGroup.descricao}</>
                    : 'Todos os usuários'
                  }
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: G.textMuted }}>
                    ({filteredUsers.length})
                  </span>
                </span>
                <button onClick={openNewUser} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8,
                  border: 'none', background: G.mustard, fontSize: 12, fontWeight: 800, color: G.text, cursor: 'pointer',
                }}>
                  <Plus size={13} /> Novo Usuário
                </button>
              </div>

              {/* Users list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loadingU ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: G.textMuted, fontSize: 13 }}>Carregando...</div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: G.textMuted, fontSize: 13 }}>
                    {selGroup ? `Nenhum usuário no grupo "${selGroup.descricao}".` : 'Nenhum usuário cadastrado.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Usuário', 'Login', 'Grupo', 'Nível', 'Status', ''].map(h => (
                          <th key={h} style={{
                            padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800,
                            color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em',
                            borderBottom: `1.5px solid ${G.border}`, background: G.bg,
                            position: 'sticky', top: 0, zIndex: 2,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u, idx) => {
                        const grpLabel = groups.find(g => g.grupo === u.grupo)?.descricao || u.grupo || '—';
                        return (
                          <tr key={u.codigo}
                            style={{ background: idx % 2 === 0 ? G.card : G.bg, cursor: 'pointer', transition: 'background .1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
                            onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? G.card : G.bg)}
                            onClick={() => openEditUser(u)}
                          >
                            <td style={{ padding: '10px 14px', fontSize: 12, color: G.textMuted, fontWeight: 700, width: 40 }}>{idx + 1}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar nome={u.nome} sobrenome={u.sobrenome} master={u.master} gerencia={u.gerencia} />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{u.nome} {u.sobrenome}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: G.textSec, fontFamily: 'monospace' }}>{u.usuario}</td>
                            <td style={{ padding: '10px 14px' }}>
                              {u.grupo
                                ? <span style={{ padding: '2px 8px', borderRadius: 6, background: G.bg, border: `1px solid ${G.border}`, fontSize: 11, fontWeight: 700, color: G.textSec }}>{grpLabel}</span>
                                : <span style={{ fontSize: 11, color: G.textMuted }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {u.master
                                ? <span style={{ padding: '2px 9px', borderRadius: 99, background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 800 }}>MASTER</span>
                                : u.gerencia
                                  ? <span style={{ padding: '2px 9px', borderRadius: 99, background: '#DBEAFE', color: '#1D4ED8', fontSize: 11, fontWeight: 800 }}>GERÊNCIA</span>
                                  : <span style={{ padding: '2px 9px', borderRadius: 99, background: G.bg, border: `1px solid ${G.border}`, color: G.textSec, fontSize: 11, fontWeight: 700 }}>OPERADOR</span>
                              }
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: u.ativo ? '#ECFDF5' : '#F3F4F6' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.ativo ? '#16A34A' : '#9CA3AF' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: u.ativo ? '#065F46' : '#6B7280' }}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => openEditUser(u)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.textSec }}>
                                  <Pencil size={12} />
                                </button>
                                <button onClick={e => removeUser(u, e)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.danger }}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── User form slide-in panel ──────────────────────────────────────── */}
      {showUForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        }}>
          {/* Overlay */}
          <div onClick={cancelUser} style={{ position: 'absolute', inset: 0, background: 'rgba(40,55,74,0.35)' }} />

          {/* Panel */}
          <div style={{
            position: 'relative', width: 460, height: '100%',
            background: G.card, borderLeft: `1px solid ${G.border}`,
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          }}>
            {/* Panel header */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: G.text, flex: 1 }}>
                {editUser.codigo ? 'Editar Usuário' : 'Novo Usuário'}
              </span>
              <button onClick={cancelUser} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.textSec }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Avatar preview */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
                <Avatar nome={editUser.nome || '?'} sobrenome={editUser.sobrenome || ''} size={56} master={editUser.master} gerencia={editUser.gerencia} />
              </div>

              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Nome *</label>
                  <input style={inp} value={editUser.nome} autoFocus onChange={e => setF('nome', e.target.value)} placeholder="Primeiro nome" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Sobrenome *</label>
                  <input style={inp} value={editUser.sobrenome} onChange={e => setF('sobrenome', e.target.value)} placeholder="Sobrenome" />
                </div>
              </div>

              {/* Login */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Login de acesso *</label>
                <input style={{ ...inp, fontFamily: 'monospace' }} value={editUser.usuario} onChange={e => setF('usuario', e.target.value.trim())} placeholder="ex: hamilton.silva" autoComplete="off" />
              </div>

              {/* Group */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Grupo de permissões</label>
                <select style={sel} value={editUser.grupo} onChange={e => setF('grupo', e.target.value)}>
                  <option value="">Sem grupo (acesso irrestrito)</option>
                  {groups.map(g => <option key={g.grupo} value={g.grupo}>{g.descricao} ({g.grupo})</option>)}
                </select>
              </div>

              {/* Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>
                    {editUser.codigo ? 'Nova senha' : 'Senha *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inp, paddingRight: 38 }} type={showPwd ? 'text' : 'password'}
                      value={editUser.senha} onChange={e => setF('senha', e.target.value)}
                      placeholder={editUser.codigo ? 'Deixe vazio p/ manter' : 'Mínimo 4 caracteres'} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: G.textMuted, padding: 0 }}>
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Confirmar</label>
                  <input style={{ ...inp, borderColor: editUser.senha && editUser.senha !== editUser.confirmarSenha ? '#EF4444' : undefined }}
                    type={showPwd ? 'text' : 'password'} value={editUser.confirmarSenha}
                    onChange={e => setF('confirmarSenha', e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
                </div>
              </div>

              {/* Profile flags */}
              <div style={{ padding: 14, background: G.bg, borderRadius: 10, border: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Perfil</span>
                {([
                  ['ativo',    'Usuário ativo',        UserCheck, '#16A34A'],
                  ['gerencia', 'Nível gerência',        Briefcase, '#2563EB'],
                  ['master',   'Administrador master',  Crown,     '#DC2626'],
                ] as [keyof UserForm, string, any, string][]).map(([field, label, Icon, color]) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <div
                      onClick={() => setF(field, !editUser[field])}
                      style={{
                        width: 20, height: 20, borderRadius: 5,
                        border: `1.5px solid ${editUser[field] ? color : G.border}`,
                        background: editUser[field] ? color : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {editUser[field] && <Check size={12} strokeWidth={3} color="#fff" />}
                    </div>
                    <Icon size={14} color={editUser[field] ? color : G.textMuted} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: G.textSec }}>{label}</span>
                  </label>
                ))}
                {editUser.master && (
                  <div style={{ marginTop: 4, padding: '7px 10px', borderRadius: 7, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 11, color: '#991B1B', fontWeight: 600 }}>
                    Usuário master tem acesso irrestrito a todos os módulos.
                  </div>
                )}
              </div>
            </div>

            {/* Panel footer */}
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={cancelUser} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', fontSize: 13, fontWeight: 700, color: G.textSec, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={saveUser} disabled={savingU} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: savingU ? G.border : G.mustard, fontSize: 13, fontWeight: 800, color: G.text, cursor: savingU ? 'not-allowed' : 'pointer' }}>
                {savingU ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
