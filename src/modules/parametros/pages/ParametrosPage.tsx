import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings2, Monitor, Package, FileText, Mail, User,
  Plus, Save, ArrowLeft, Trash2, Loader2, CheckCircle2,
  Eye, EyeOff, Send,
} from 'lucide-react';
import {
  CadastroShell, G, inp, label as labelStyle,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Parametros {
  par_id?: number;
  par_usuario: number | null;
  par_ordemped: string;
  par_qtdenter: number;
  par_fmtpesquisa: string;
  par_tipopesquisa: string;
  par_telemkttipo: string;
  par_itemduplicado: string;
  par_usadecimais: string;
  par_qtddecimais: number;
  par_zerapromo: string;
  par_mostracodori: string;
  par_validapromocao: string;
  par_salvapedidoauto: string;
  par_descontogrupo: string;
  par_mostrapednovos: string;
  par_mostraimpostos: string;
  par_ordemimpressao: string;
  par_tipofretepadrao: string;
  par_solicitarconfemail: string;
  par_separalinhas: string;
  par_pedidopadrao: number;
  par_iniciapedido: string;
  par_obs_padrao: string;
  par_emailserver: string;
  par_email: string;
  par_emailuser: string;
  par_emailporta: number;
  par_emailpassword: string;
  par_emailtls: boolean;
  par_emailssl: boolean;
  par_emailalternativo: string;
  par_baixa_xml_fecha: string;
  par_email_central_ativo: boolean;
  par_imap_server: string;
  par_imap_porta: number;
  par_imap_ssl: boolean;
  // join
  usu_nome?: string;
  usu_sobrenome?: string;
  usu_login?: string;
}

interface SystemUser {
  id: number;
  nome: string;
  sobrenome: string;
  login: string;
  e_admin: boolean;
}

const DEFAULT: Omit<Parametros, 'par_id'> = {
  par_usuario: null,
  par_ordemped: 'D', par_qtdenter: 2, par_fmtpesquisa: 'D', par_tipopesquisa: 'N', par_telemkttipo: 'E',
  par_itemduplicado: 'N', par_usadecimais: 'S', par_qtddecimais: 2, par_zerapromo: 'N',
  par_mostracodori: 'N', par_validapromocao: 'S', par_salvapedidoauto: 'S', par_descontogrupo: 'N',
  par_mostrapednovos: 'S', par_mostraimpostos: 'S',
  par_ordemimpressao: 'N', par_tipofretepadrao: 'C', par_solicitarconfemail: 'N',
  par_separalinhas: 'N', par_pedidopadrao: 1, par_iniciapedido: 'P', par_obs_padrao: '',
  par_emailserver: '', par_email: '', par_emailuser: '', par_emailporta: 587,
  par_emailpassword: '', par_emailtls: false, par_emailssl: false, par_emailalternativo: '',
  par_baixa_xml_fecha: 'N',
  par_email_central_ativo: false,
  par_imap_server: '',
  par_imap_porta: 993,
  par_imap_ssl: true,
};

// ─── Radio Option ─────────────────────────────────────────────────────────────
function RadioOpt({
  field, value, label, current, onChange,
}: {
  field: string; value: string; label: string; current: string; onChange: (f: string, v: string) => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onChange(field, value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: active ? `${G.mustard}22` : G.bg,
        border: `1.5px solid ${active ? G.mustard : G.border}`,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'all .12s',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        border: `2px solid ${active ? G.mustard : G.border}`,
        background: active ? G.mustard : 'transparent',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: G.text }} />}
      </div>
      <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? G.text : G.textSec }}>
        {label}
      </span>
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({
  icon: Icon, title, color, children,
}: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: G.card, borderRadius: 16, border: `1px solid ${G.border}`,
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '0 0 0 16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Field group ──────────────────────────────────────────────────────────────
function FieldGroup({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>{lbl}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ParametrosPage() {
  const [view, setView]         = useState<'list' | 'form'>('list');
  const [list, setList]         = useState<Parametros[]>([]);
  const [users, setUsers]       = useState<SystemUser[]>([]);
  const [form, setForm]         = useState<Parametros>({ ...DEFAULT } as Parametros);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testMsg, setTestMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [testMsgImap, setTestMsgImap] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [search, setSearch]     = useState('');

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [parRes, usrRes] = await Promise.all([
        api.get('/parametros'),
        api.get('/parametros/users'),
      ]);
      setList(parRes.data.data || []);
      setUsers(usrRes.data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ ...DEFAULT } as Parametros);
    setView('form');
    setTestMsg(null);
  };

  const openEdit = (p: Parametros) => {
    setForm({ ...DEFAULT, ...p });
    setView('form');
    setTestMsg(null);
    setTestMsgImap(null);
  };

  const handleSave = async () => {
    if (!form.par_usuario) { alert('Selecione um usuário.'); return; }
    setSaving(true);
    try {
      await api.post('/parametros', form);
      setView('list');
      load();
    } catch (e: any) {
      alert(`Erro ao salvar parâmetros: ${e?.response?.data?.message || e?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Remover parâmetros deste usuário?')) return;
    await api.delete(`/parametros/${userId}`);
    load();
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await api.post('/email/test-connection', {
        par_emailserver:   form.par_emailserver,
        par_emailporta:    form.par_emailporta,
        par_email:         form.par_email,
        par_emailuser:     form.par_emailuser,
        par_emailpassword: form.par_emailpassword,
        par_emailtls:      form.par_emailtls,
        par_emailssl:      form.par_emailssl,
      });
      setTestMsg({ ok: true, text: res.data.message || 'Conexão estabelecida com sucesso!' });
    } catch (e: any) {
      setTestMsg({ ok: false, text: e?.response?.data?.message || 'Falha na conexão SMTP.' });
    } finally {
      setTesting(false);
    }
  };

  const handleTestImap = async () => {
    setTestingImap(true);
    setTestMsgImap(null);
    try {
      const res = await api.post('/email-central/test-connection', {
        host:     form.par_imap_server || form.par_emailserver,
        port:     form.par_imap_porta,
        secure:   form.par_imap_ssl,
        user:     form.par_emailuser || form.par_email,
        password: form.par_emailpassword,
      });
      setTestMsgImap({ ok: true, text: res.data.message || 'Conexão IMAP OK!' });
    } catch (e: any) {
      setTestMsgImap({ ok: false, text: e?.response?.data?.message || 'Falha na conexão IMAP.' });
    } finally {
      setTestingImap(false);
    }
  };

  const filtered = list.filter(p => {
    const name = `${p.usu_nome || ''} ${p.usu_sobrenome || ''} ${p.usu_login || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  const listContent = (
    <div style={{ background: G.card, borderRadius: 16, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: G.cardHi }}>
            {['Usuário', 'Login', 'Frete Padrão', 'Inicia Como', 'Layout', 'Decimais', 'Ações'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `1px solid ${G.border}` }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
              Nenhum parâmetro configurado.
            </td></tr>
          )}
          {filtered.map(p => (
            <tr
              key={p.par_id}
              onClick={() => openEdit(p)}
              style={{ borderBottom: `1px solid ${G.border}`, cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '11px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${G.mustard}22`, border: `1px solid ${G.mustard}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: G.textSec }}>
                    {(p.usu_nome || '?')[0]}{(p.usu_sobrenome || '')[0]}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{p.usu_nome} {p.usu_sobrenome}</span>
                </div>
              </td>
              <td style={{ padding: '11px 16px', fontSize: 12, color: G.textMuted, fontFamily: 'monospace', fontWeight: 700 }}>{p.usu_login}</td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: p.par_tipofretepadrao === 'C' ? '#0891B212' : '#D9760012', color: p.par_tipofretepadrao === 'C' ? '#0891B2' : '#D97600' }}>
                  {p.par_tipofretepadrao === 'C' ? 'CIF' : 'FOB'}
                </span>
              </td>
              <td style={{ padding: '11px 16px', fontSize: 12, color: G.textSec }}>{p.par_iniciapedido === 'P' ? 'Pedido' : 'Cotação'}</td>
              <td style={{ padding: '11px 16px', fontSize: 12, color: G.textSec }}>Layout {p.par_pedidopadrao}</td>
              <td style={{ padding: '11px 16px', fontSize: 12, color: G.textSec }}>{p.par_qtddecimais} casas</td>
              <td style={{ padding: '11px 16px' }}>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(p.par_usuario!); }}
                  style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.danger }}
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── FORM VIEW ───────────────────────────────────────────────────────────────
  const formContent = (
    <div style={{ maxWidth: 1100 }}>

      {/* Seleção de Usuário */}
      <SectionCard icon={User} title="Usuário" color="#0891B2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <span style={labelStyle}>Usuário do Sistema</span>
            <select
              value={form.par_usuario ?? ''}
              onChange={e => set('par_usuario', e.target.value ? parseInt(e.target.value) : null)}
              style={{ ...inp }}
            >
              <option value="">— Selecione —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.nome} {u.sobrenome} ({u.login})</option>
              ))}
            </select>
          </div>
          {form.par_usuario && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: `${G.mustard}18`, borderRadius: 10, border: `1px solid ${G.mustard}44` }}>
              <Settings2 size={14} style={{ color: G.textSec }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Configurando</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: G.text }}>
                  {users.find(u => u.id === form.par_usuario)?.nome} {users.find(u => u.id === form.par_usuario)?.sobrenome}
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Interface & Operação */}
      <SectionCard icon={Monitor} title="Interface & Operação" color="#7C3AED">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <FieldGroup label="Ordem dos Pedidos">
            <RadioOpt field="par_ordemped" value="D" label="Por Data" current={form.par_ordemped} onChange={set} />
            <RadioOpt field="par_ordemped" value="N" label="Numérico" current={form.par_ordemped} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Velocidade de Digitação">
            {[['1','Explosivo'],['2','Rápido'],['3','Padrão'],['4','Cuidadoso']].map(([v,l]) => (
              <RadioOpt key={v} field="par_qtdenter" value={v} label={l} current={String(form.par_qtdenter)} onChange={(f,val) => set(f, parseInt(val))} />
            ))}
          </FieldGroup>
          <FieldGroup label="Formato de Pesquisa Produto">
            <RadioOpt field="par_fmtpesquisa" value="C" label="Só Código" current={form.par_fmtpesquisa} onChange={set} />
            <RadioOpt field="par_fmtpesquisa" value="D" label="Código + Descrição" current={form.par_fmtpesquisa} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Pesquisa de Clientes">
            <RadioOpt field="par_tipopesquisa" value="R" label="Razão Social" current={form.par_tipopesquisa} onChange={set} />
            <RadioOpt field="par_tipopesquisa" value="N" label="Nome Reduzido" current={form.par_tipopesquisa} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Tipo CRM / Telemarketing">
            <RadioOpt field="par_telemkttipo" value="E" label="Efetivo" current={form.par_telemkttipo} onChange={set} />
            <RadioOpt field="par_telemkttipo" value="P" label="Prospectando" current={form.par_telemkttipo} onChange={set} />
          </FieldGroup>
        </div>
      </SectionCard>

      {/* Regras de Negócio */}
      <SectionCard icon={Package} title="Regras de Negócio & Produtos" color="#16A34A">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <FieldGroup label="Itens Duplicados">
            <RadioOpt field="par_itemduplicado" value="S" label="Permitir" current={form.par_itemduplicado} onChange={set} />
            <RadioOpt field="par_itemduplicado" value="N" label="Bloquear" current={form.par_itemduplicado} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Usar Decimais">
            <RadioOpt field="par_usadecimais" value="S" label="Ativo" current={form.par_usadecimais} onChange={set} />
            <RadioOpt field="par_usadecimais" value="N" label="Inativo" current={form.par_usadecimais} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Precisão Decimais">
            {['2','3','4'].map(v => (
              <RadioOpt key={v} field="par_qtddecimais" value={v} label={`${v} casas`} current={String(form.par_qtddecimais)} onChange={(f,val) => set(f, parseInt(val))} />
            ))}
          </FieldGroup>
          <FieldGroup label="Zerar Desc. Promo">
            <RadioOpt field="par_zerapromo" value="S" label="Sim" current={form.par_zerapromo} onChange={set} />
            <RadioOpt field="par_zerapromo" value="N" label="Não" current={form.par_zerapromo} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Código Original">
            <RadioOpt field="par_mostracodori" value="S" label="Mostrar" current={form.par_mostracodori} onChange={set} />
            <RadioOpt field="par_mostracodori" value="N" label="Ocultar" current={form.par_mostracodori} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Gerenciar Validades">
            <RadioOpt field="par_validapromocao" value="S" label="Ativo" current={form.par_validapromocao} onChange={set} />
            <RadioOpt field="par_validapromocao" value="N" label="Inativo" current={form.par_validapromocao} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Salvar Automático">
            <RadioOpt field="par_salvapedidoauto" value="S" label="Sim" current={form.par_salvapedidoauto} onChange={set} />
            <RadioOpt field="par_salvapedidoauto" value="N" label="Não" current={form.par_salvapedidoauto} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Desconto por Grupos">
            <RadioOpt field="par_descontogrupo" value="S" label="Ativo" current={form.par_descontogrupo} onChange={set} />
            <RadioOpt field="par_descontogrupo" value="N" label="Inativo" current={form.par_descontogrupo} onChange={set} />
          </FieldGroup>
        </div>
      </SectionCard>

      {/* Processamento & Logística */}
      <SectionCard icon={FileText} title="Processamento & Logística" color="#D97600">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <FieldGroup label="Iniciar Pedido Como">
            <RadioOpt field="par_iniciapedido" value="P" label="Pedido" current={form.par_iniciapedido} onChange={set} />
            <RadioOpt field="par_iniciapedido" value="C" label="Cotação" current={form.par_iniciapedido} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Tipo de Frete Padrão">
            <RadioOpt field="par_tipofretepadrao" value="C" label="CIF — Ind. paga" current={form.par_tipofretepadrao} onChange={set} />
            <RadioOpt field="par_tipofretepadrao" value="F" label="FOB — Cliente paga" current={form.par_tipofretepadrao} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Ordem de Impressão">
            <RadioOpt field="par_ordemimpressao" value="N" label="Numérico" current={form.par_ordemimpressao} onChange={set} />
            <RadioOpt field="par_ordemimpressao" value="D" label="Ordem de Entrada" current={form.par_ordemimpressao} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Confirmar Recebimento E-mail">
            <RadioOpt field="par_solicitarconfemail" value="S" label="Solicitar" current={form.par_solicitarconfemail} onChange={set} />
            <RadioOpt field="par_solicitarconfemail" value="N" label="Ignorar" current={form.par_solicitarconfemail} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Separar Itens por Grupos">
            <RadioOpt field="par_separalinhas" value="S" label="Ativo" current={form.par_separalinhas} onChange={set} />
            <RadioOpt field="par_separalinhas" value="N" label="Inativo" current={form.par_separalinhas} onChange={set} />
          </FieldGroup>
          <FieldGroup label="Baixa XML — Fechar Pedido Automaticamente">
            <RadioOpt field="par_baixa_xml_fecha" value="S" label="Sim — fechar quando saldo zerar" current={form.par_baixa_xml_fecha} onChange={set} />
            <RadioOpt field="par_baixa_xml_fecha" value="N" label="Não — manter em aberto (padrão)" current={form.par_baixa_xml_fecha} onChange={set} />
          </FieldGroup>
          <div>
            <span style={labelStyle}>Layout Padrão do Pedido</span>
            <select
              value={form.par_pedidopadrao}
              onChange={e => set('par_pedidopadrao', parseInt(e.target.value))}
              style={{ ...inp, marginTop: 8 }}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i + 1} value={i + 1}>LAYOUT MODELO {i + 1}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <span style={labelStyle}>Mensagem Padrão de Observações</span>
          <textarea
            value={form.par_obs_padrao}
            onChange={e => set('par_obs_padrao', e.target.value)}
            rows={3}
            placeholder="Template de observações que será pré-preenchido em novos pedidos..."
            style={{ ...inp, marginTop: 6, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit', height: 'auto' }}
          />
        </div>
      </SectionCard>

      {/* Configuração de E-mail */}
      <div style={{
        background: G.text, borderRadius: 16,
        padding: '20px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,210,0,0.08), transparent)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${G.mustard}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={14} style={{ color: G.mustard }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff99', textTransform: 'uppercase', letterSpacing: 0.8 }}>Configuração de E-mail (SMTP)</span>
          </div>

          {/* Linha 1: Servidor (largo) | Porta (fixo) | Segurança (fixo) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: 12, marginBottom: 12 }}>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Servidor SMTP</span>
              <input value={form.par_emailserver} onChange={e => set('par_emailserver', e.target.value)} placeholder="smtp.office365.com" style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }} />
            </div>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Porta</span>
              <input type="number" value={form.par_emailporta} onChange={e => set('par_emailporta', parseInt(e.target.value) || 587)} placeholder="587" style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }} />
            </div>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Segurança</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[['par_emailtls','TLS'],['par_emailssl','SSL']].map(([field, lbl]) => (
                  <button key={field} onClick={() => set(field, !(form as any)[field])} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: (form as any)[field] ? G.mustard : '#ffffff15', border: `1px solid ${(form as any)[field] ? G.mustard : '#ffffff25'}`, color: (form as any)[field] ? G.text : '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Linha 2: E-mail de Envio | Usuário / Login */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>E-mail de Envio</span>
              <input type="email" value={form.par_email || ''} onChange={e => set('par_email', e.target.value)} placeholder="usuario@empresa.com" style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }} />
            </div>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Usuário / Login SMTP</span>
              <input value={form.par_emailuser || ''} onChange={e => set('par_emailuser', e.target.value)} placeholder="usuario@empresa.com" style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }} />
            </div>
          </div>

          {/* Linha 3: Senha | E-mail Alternativo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Senha / App Password</span>
              <div style={{ position: 'relative', marginTop: 4 }}>
                <input type={showPass ? 'text' : 'password'} value={form.par_emailpassword || ''} onChange={e => set('par_emailpassword', e.target.value)} style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', paddingRight: 36 }} />
                <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff88' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>E-mail Alternativo (CC)</span>
              <input type="email" value={form.par_emailalternativo || ''} onChange={e => set('par_emailalternativo', e.target.value)} placeholder="copia@empresa.com" style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }} />
            </div>
          </div>

          {/* Testar conexão */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleTestEmail}
              disabled={testing || !form.par_emailserver}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                borderRadius: 10, border: 'none',
                background: testing || !form.par_emailserver ? '#ffffff22' : G.mustard,
                color: testing || !form.par_emailserver ? '#ffffff88' : G.text,
                fontSize: 12, fontWeight: 800, cursor: testing || !form.par_emailserver ? 'not-allowed' : 'pointer',
              }}
            >
              {testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              Testar Configurações
            </button>
            {testMsg && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: testMsg.ok ? G.mustard : '#FF6B6B' }}
                >
                  <CheckCircle2 size={13} />
                  {testMsg.text}
                </motion.div>
              )}
          </div>
        </div>
      </div>

      {/* Central de Emails — IMAP */}
      <div style={{
        background: '#1A2F45', borderRadius: 16,
        padding: '20px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(37,99,235,0.12), transparent)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#2563EB22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={14} style={{ color: '#60A5FA' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff99', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Central de Emails — IMAP (Recebimento)
              </span>
            </div>
            {/* Toggle ativo */}
            <button
              onClick={() => set('par_email_central_ativo', !form.par_email_central_ativo)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px',
                borderRadius: 20, border: 'none', cursor: 'pointer',
                background: form.par_email_central_ativo ? G.mustard : '#ffffff22',
                color: form.par_email_central_ativo ? G.text : '#ffffff88',
                fontSize: 11, fontWeight: 800, transition: 'all .2s',
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: form.par_email_central_ativo ? G.text : '#ffffff44',
              }} />
              {form.par_email_central_ativo ? 'Central Ativa' : 'Central Inativa'}
            </button>
          </div>

          <div style={{ fontSize: 11, color: '#ffffff55', marginBottom: 16, lineHeight: 1.6 }}>
            A IRIS usará estas credenciais para ler emails recebidos e classificar automaticamente cotações, pedidos e leads.
            O servidor IMAP geralmente é o mesmo do SMTP, com porta 993 (SSL) ou 143 (TLS).
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 12 }}>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Servidor IMAP</span>
              <input
                value={form.par_imap_server || ''}
                onChange={e => set('par_imap_server', e.target.value)}
                placeholder="imap.empresa.com (vazio = igual ao SMTP)"
                style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }}
              />
            </div>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>Porta IMAP</span>
              <input
                type="number"
                value={form.par_imap_porta}
                onChange={e => set('par_imap_porta', parseInt(e.target.value) || 993)}
                placeholder="993"
                style={{ ...inp, background: '#ffffff15', color: '#fff', border: '1px solid #ffffff25', marginTop: 4 }}
              />
            </div>
            <div>
              <span style={{ ...labelStyle, color: '#ffffff88' }}>SSL/TLS</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => set('par_imap_ssl', !form.par_imap_ssl)}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: form.par_imap_ssl ? G.mustard : '#ffffff15',
                    color: form.par_imap_ssl ? G.text : '#ffffff88',
                    fontSize: 11, fontWeight: 800,
                  }}
                >
                  {form.par_imap_ssl ? 'SSL Ativo' : 'SSL Inativo'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleTestImap}
              disabled={testingImap || (!form.par_imap_server && !form.par_emailserver)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                borderRadius: 10, border: 'none',
                background: testingImap ? '#ffffff22' : '#2563EB',
                color: '#fff',
                fontSize: 12, fontWeight: 800, cursor: testingImap ? 'not-allowed' : 'pointer',
              }}
            >
              {testingImap ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              Testar IMAP
            </button>
            {testMsgImap && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: testMsgImap.ok ? '#93C5FD' : '#FF6B6B' }}
                >
                  <CheckCircle2 size={13} />
                  {testMsgImap.text}
                </motion.div>
              )}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: '#ffffff44' }}>
            Login e senha usados são os mesmos da configuração SMTP acima.
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      <CadastroShell
        title="Parâmetros"
        total={view === 'list' ? list.length : undefined}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Pesquisar usuário..."
        onNew={openNew}
        newLabel="Novo"
        loading={loading && view === 'list'}
        activeTab={view === 'form' ? 'cadastro' : 'lista'}
        formTitle={form.par_usuario ? `${users.find(u => u.id === form.par_usuario)?.nome || 'Usuário'}` : 'Novo'}
        onCancel={() => setView('list')}
        onSave={handleSave}
        saving={saving}
        form={formContent}
      >
        {listContent}
      </CadastroShell>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
