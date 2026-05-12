import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, Plus, X, Save, Loader2, UserPlus, Users, ShoppingCart, FileText, Target, Bot } from 'lucide-react';
import {
  CadastroShell, CadastroTable, Th, Td, TrHover,
  StatusBadge, G, inp, label,
} from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Industria {
  for_codigo: number; for_nomered: string; for_nome: string;
  for_cgc: string; for_email: string; for_fone: string;
  for_cidade: string; for_uf: string; for_percom: number; for_tipo2: string;
  for_inscricao?: string; for_endereco?: string; for_bairro?: string;
  for_cep?: string; for_tipofrete?: string; for_fone2?: string;
  for_des1?: number; for_des2?: number; for_des3?: number;
  for_des4?: number; for_des5?: number; for_des6?: number;
  for_des7?: number; for_des8?: number; for_des9?: number; for_des10?: number;
  for_obs2?: string; for_codrep?: string; for_homepage?: string;
  for_logotipo?: string; for_min_order?: number;
  for_usa_menor_preco?: boolean;
}

interface Contato {
  con_codigo: number;
  con_fornec: number;
  con_nome: string;
  con_cargo: string;
  con_telefone: string;
  con_celular: string;
  con_email: string;
  con_dtnasc: string;        // retorna como ISO date string
  con_obs: string;
  con_timequetorce: string;
  con_esportepreferido: string;
  con_hobby: string;
}

interface MetaAnual {
  met_jan: number; met_fev: number; met_mar: number; met_abr: number;
  met_mai: number; met_jun: number; met_jul: number; met_ago: number;
  met_set: number; met_out: number; met_nov: number; met_dez: number;
}

const emptyIndustria: Partial<Industria> = {
  for_tipo2: 'A', for_percom: 0, for_tipofrete: 'C',
  for_des1: 0, for_des2: 0, for_des3: 0, for_des4: 0, for_des5: 0,
  for_des6: 0, for_des7: 0, for_des8: 0, for_des9: 0, for_des10: 0,
  for_min_order: 0,
};

const emptyContato: Partial<Contato> = {};

// ISO date "2001-02-19T..." → "19/02" (DD/MM para exibição)
// Usa regex direto — sem new Date() para evitar virada de dia por fuso horário
const dateToDDMM = (iso: string | undefined): string => {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}$/.test(iso)) return iso; // já está em DD/MM
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}`; // DD/MM
};

// "19/02" → "2001-02-19" para salvar no banco (ano 2001 fixo, invisível)
const ddmmToDate = (ddmm: string): string => {
  if (!ddmm) return '';
  const [dd, mm] = ddmm.split('/');
  if (!dd || !mm) return '';
  return `2001-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

const emptyMeta: MetaAnual = {
  met_jan: 0, met_fev: 0, met_mar: 0, met_abr: 0,
  met_mai: 0, met_jun: 0, met_jul: 0, met_ago: 0,
  met_set: 0, met_out: 0, met_nov: 0, met_dez: 0,
};

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_KEYS = ['met_jan','met_fev','met_mar','met_abr','met_mai','met_jun','met_jul','met_ago','met_set','met_out','met_nov','met_dez'] as const;

const fmtBRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const parseCurrency = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  return parseFloat(cleanValue) / 100;
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IndustriasPage() {
  const [data, setData]           = useState<Industria[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Industria>>(emptyIndustria);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/suppliers?active=${showInactive ? 'all' : 'true'}&search=${encodeURIComponent(search)}`);
      setData(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [search, showInactive]);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setEditing(emptyIndustria); setModalOpen(true); };
  const openEdit = async (id: number) => {
    try {
      const res = await api.get(`/suppliers/${id}`);
      setEditing(res.data.data);
      setModalOpen(true);
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!editing.for_nome || !editing.for_nomered) return;
    setSaving(true);
    try {
      if (editing.for_codigo) await api.put(`/suppliers/${editing.for_codigo}`, editing);
      else                    await api.post('/suppliers', editing);
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const inactivate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Inativar esta indústria?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  };

  const set = (field: keyof Industria, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }));

  return (
    <>
      <CadastroShell
        title="Indústrias"
        total={data.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Pesquisar por nome ou CNPJ..."
        onNew={openNew}
        newLabel="Nova Indústria"
        loading={loading}
        toolbar={
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: G.textSec, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Mostrar inativas
          </label>
        }
      >
        <CadastroTable>
          <thead>
            <tr>
              <Th>Cód</Th>
              <Th>Nome Reduzido</Th>
              <Th>Razão Social</Th>
              <Th>Cidade / UF</Th>
              <Th align="right">Comissão</Th>
              <Th align="center">Status</Th>
              <Th align="center">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
                Nenhuma indústria encontrada.
              </td></tr>
            )}
            {data.map(row => (
              <TrHover key={row.for_codigo} onClick={() => openEdit(row.for_codigo)}>
                <Td><span style={{ fontSize: 11, color: G.textMuted, fontWeight: 700 }}>#{row.for_codigo}</span></Td>
                <Td>
                  <span style={{ 
                    display: 'inline-block', 
                    width: 130, 
                    textAlign: 'center', 
                    padding: '2px 0', 
                    borderRadius: 20, 
                    background: '#28374A14', 
                    fontSize: 12, 
                    fontWeight: 800, 
                    color: G.text 
                  }}>
                    {row.for_nomered}
                  </span>
                </Td>
                <Td><span style={{ color: G.textSec }}>{row.for_nome}</span></Td>
                <Td><span style={{ color: G.textMuted, fontSize: 12 }}>{row.for_cidade}{row.for_uf ? ` / ${row.for_uf}` : ''}</span></Td>
                <Td align="right"><span style={{ fontWeight: 700 }}>{Number(row.for_percom || 0).toFixed(1)}%</span></Td>
                <Td align="center"><StatusBadge active={row.for_tipo2 === 'A' || !row.for_tipo2} /></Td>
                <Td align="center">
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); openEdit(row.for_codigo); }} style={actionBtn}><Pencil size={13} /></button>
                    <button onClick={e => inactivate(row.for_codigo, e)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={13} /></button>
                  </div>
                </Td>
              </TrHover>
            ))}
          </tbody>
        </CadastroTable>
      </CadastroShell>

      {/* Full-screen modal */}
      {modalOpen && (
        <IndustriaModal
          data={editing}
          set={set}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* Remove arrows from numeric inputs */
        input::-webkit-outer-spin-button, 
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </>
  );
}

// ─── Modal fullscreen ─────────────────────────────────────────────────────────
function IndustriaModal({ data, set, saving, onClose, onSave }: {
  data: Partial<Industria>;
  set: (f: keyof Industria, v: any) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [topTab, setTopTab]       = useState<'principal' | 'complemento'>('principal');
  const [bottomTab, setBottomTab] = useState<'contatos' | 'clientes' | 'comercial' | 'meta' | 'ia'>('contatos');

  const TOP_TABS = [
    { key: 'principal',   label: 'Principal' },
    { key: 'complemento', label: 'Complemento' },
  ] as const;

  const BOTTOM_TABS = [
    { key: 'contatos',   label: 'Contatos',                    icon: Users },
    { key: 'clientes',   label: 'Clientes que já compraram',   icon: ShoppingCart },
    { key: 'comercial',  label: 'Política Comercial',          icon: FileText },
    { key: 'meta',       label: 'Meta Anual',                  icon: Target },
    { key: 'ia',         label: 'IA / WhatsApp',               icon: Bot },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(40,55,74,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ width: '100%', maxWidth: 900, maxHeight: '90vh', background: '#fff', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(40,55,74,0.35)' }}>

        {/* Modal header — navy */}
        <div style={{ padding: '18px 24px', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {data.for_codigo ? 'Editando' : 'Nova'} Indústria
            </span>
            <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>
              {data.for_codigo ? (data.for_nomered || data.for_nome) : 'Nova Indústria'}
            </h2>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Top tabs — branco com underline mustard */}
        <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: `1px solid ${G.border}`, background: '#fff', flexShrink: 0 }}>
          {TOP_TABS.map(t => (
            <button key={t.key} onClick={() => setTopTab(t.key)} style={{
              padding: '10px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              border: 'none', background: 'transparent', transition: 'all .15s',
              color: topTab === t.key ? G.text : G.textMuted,
              borderBottom: topTab === t.key ? `2px solid ${G.mustard}` : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Form area (scrollable) — branco */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0', minHeight: 0, background: '#fff' }}>
          {topTab === 'principal' && <PrincipalTab data={data} set={set} />}
          {topTab === 'complemento' && <ComplementoTab data={data} set={set} />}
        </div>

        {/* Bottom tabs bar — areia separando visualmente */}
        {data.for_codigo && (
          <>
            <div style={{ padding: '0 24px', background: G.bg, borderTop: `1px solid ${G.border}`, borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 2, overflowX: 'auto', flexShrink: 0 }}>
              {BOTTOM_TABS.map(t => {
                const Icon = t.icon;
                const active = bottomTab === t.key;
                return (
                  <button key={t.key} onClick={() => setBottomTab(t.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '9px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: 'none', whiteSpace: 'nowrap', transition: 'all .15s',
                    background: active ? '#fff' : 'transparent',
                    color: active ? G.text : G.textMuted,
                    borderBottom: active ? `2px solid ${G.mustard}` : '2px solid transparent',
                    borderRadius: active ? '6px 6px 0 0' : undefined,
                  }}>
                    <Icon size={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div style={{ height: bottomTab === 'ia' ? 360 : 220, overflowY: 'auto', padding: bottomTab === 'ia' ? '20px 28px' : '16px 24px', background: '#fff', flexShrink: 0 }}>
              {bottomTab === 'contatos'  && <ContatosTab supplierId={data.for_codigo!} />}
              {bottomTab === 'clientes'  && <ClientesTab supplierId={data.for_codigo!} />}
              {bottomTab === 'comercial' && <ComercialTab data={data} set={set} />}
              {bottomTab === 'meta'      && <MetaAnualTab supplierId={data.for_codigo!} />}
              {bottomTab === 'ia'        && <IaTab supplierId={data.for_codigo!} />}
            </div>
          </>
        )}

        {/* Footer — branco com borda */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${G.border}`, background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 10, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 22px', borderRadius: 10, border: 'none', background: saving ? G.border : G.mustard, color: G.text, fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />Salvando...</> : <><Save size={13} />Salvar</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Tab: Principal ───────────────────────────────────────────────────────────
function PrincipalTab({ data, set }: { data: Partial<Industria>; set: (f: keyof Industria, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 20 }}>
      <Section title="Identificação e Status">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 12 }}>
          <F label="CNPJ"><input style={inp} value={data.for_cgc || ''} onChange={e => set('for_cgc', e.target.value)} placeholder="00.000.000/0000-00" /></F>
          <F label="Inscrição Estadual"><input style={inp} value={data.for_inscricao || ''} onChange={e => set('for_inscricao', e.target.value)} /></F>
          <F label="Situação">
            <select style={{ ...inp, appearance: 'none' }} value={data.for_tipo2 || 'A'} onChange={e => set('for_tipo2', e.target.value)}>
              <option value="A">● Ativo</option>
              <option value="I">● Inativo</option>
            </select>
          </F>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
          <F label="Razão Social Completa *"><input style={inp} value={data.for_nome || ''} onChange={e => set('for_nome', e.target.value)} placeholder="Razão Social" /></F>
          <F label="Nome Reduzido *"><input style={{ ...inp, fontWeight: 800, color: '#754437' }} value={data.for_nomered || ''} onChange={e => set('for_nomered', e.target.value)} placeholder="Nome Reduzido" /></F>
        </div>
      </Section>

      <Section title="Endereço e Localização">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <F label="Logradouro / Endereço"><input style={inp} value={data.for_endereco || ''} onChange={e => set('for_endereco', e.target.value)} /></F>
          <F label="Bairro"><input style={inp} value={data.for_bairro || ''} onChange={e => set('for_bairro', e.target.value)} /></F>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 140px', gap: 12 }}>
          <F label="Cidade"><input style={inp} value={data.for_cidade || ''} onChange={e => set('for_cidade', e.target.value)} /></F>
          <F label="UF"><input style={{ ...inp, textTransform: 'uppercase', textAlign: 'center' }} maxLength={2} value={data.for_uf || ''} onChange={e => set('for_uf', e.target.value.toUpperCase())} /></F>
          <F label="CEP"><input style={{ ...inp, fontFamily: 'monospace' }} value={data.for_cep || ''} onChange={e => set('for_cep', e.target.value)} /></F>
        </div>
      </Section>

      <Section title="Comunicação Direta">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <F label="Telefone Fixo"><input style={{ ...inp, fontFamily: 'monospace' }} value={data.for_fone || ''} onChange={e => set('for_fone', e.target.value)} placeholder="(00) 0000-0000" /></F>
          <F label="Telefone Auxiliar"><input style={{ ...inp, fontFamily: 'monospace' }} value={data.for_fone2 || ''} onChange={e => set('for_fone2', e.target.value)} placeholder="(00) 0000-0000" /></F>
          <F label="E-mail Corporativo"><input style={inp} type="email" value={data.for_email || ''} onChange={e => set('for_email', e.target.value)} placeholder="contato@empresa.com" /></F>
        </div>
      </Section>
    </div>
  );
}

// ─── Tab: Complemento ─────────────────────────────────────────────────────────
function ComplementoTab({ data, set }: { data: Partial<Industria>; set: (f: keyof Industria, v: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      // Draw maintaining aspect ratio, centered with white bg
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 200);
      const ratio = Math.min(300 / img.width, 200 / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      ctx.drawImage(img, (300 - w) / 2, (200 - h) / 2, w, h);
      set('for_logotipo', canvas.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, paddingBottom: 20, alignItems: 'start' }}>
      {/* ── Coluna Esquerda: Logo + Campos comerciais ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Logo card */}
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Logotipo Institucional</span>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ fontSize: 11, fontWeight: 700, color: G.text, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              + Trocar Imagem
            </button>
          </div>
          <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            {data.for_logotipo
              ? <img src={data.for_logotipo} alt="Logo" style={{ maxWidth: '100%', maxHeight: 130, objectFit: 'contain' }} />
              : <span style={{ fontSize: 12, color: G.textMuted }}>Clique para adicionar logo</span>
            }
          </div>
          <div style={{ padding: '5px 14px', borderTop: `1px solid ${G.border}`, fontSize: 10, color: G.textMuted, textAlign: 'center' }}>
            IMAGEM SERÁ COMPRIMIDA AUTOMATICAMENTE • MÁX 300X200PX • JPEG
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />

        {/* Cód. Rep + Comissão */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <F label="Cód. Representante">
            <input style={inp} value={data.for_codrep || ''} onChange={e => set('for_codrep', e.target.value)} placeholder="Ex: 1" />
          </F>
          <F label="Comissão de Venda (%)">
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 30, fontWeight: 800, color: G.success, textAlign: 'center' }}
                type="number" min={0} max={100} step={0.01}
                value={data.for_percom ?? 0}
                onChange={e => set('for_percom', parseFloat(e.target.value) || 0)} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: G.textMuted, fontWeight: 800 }}>%</span>
            </div>
          </F>
        </div>

        {/* Site / Homepage */}
        <F label="Site / Homepage">
          <input style={inp} value={data.for_homepage || ''} onChange={e => set('for_homepage', e.target.value)} placeholder="https://..." />
        </F>

        {/* Volume Mínimo */}
        <F label="Pedido Mínimo (Faturamento)">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: G.textMuted, fontWeight: 800 }}>R$</span>
            <input 
              style={{ ...inp, paddingLeft: 34, fontWeight: 800, color: G.text }}
              type="text" 
              value={formatCurrency(data.for_min_order ?? 0)}
              onChange={e => {
                const val = parseCurrency(e.target.value);
                set('for_min_order', val);
              }} 
            />
          </div>
        </F>
      </div>

      {/* ── Coluna Direita: Descontos + Observações ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Descontos D1-D10 */}
        <div style={{ background: G.text, borderRadius: 12, padding: '14px 16px' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Descontos Padrão (D1-D10)
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
            {[1,2,3,4,5].map(n => (
              <div key={n}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>D{n}</span>
                <input
                  style={{ ...inp, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '6px 4px' }}
                  type="number" min={0} max={100} step={0.01}
                  value={(data as any)[`for_des${n}`] ?? 0}
                  onChange={e => set(`for_des${n}` as any, parseFloat(e.target.value) || 0)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 8 }}>
            {[6,7,8,9,10].map(n => (
              <div key={n}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>D{n}</span>
                <input
                  style={{ ...inp, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '6px 4px' }}
                  type="number" min={0} max={100} step={0.01}
                  value={(data as any)[`for_des${n}`] ?? 0}
                  onChange={e => set(`for_des${n}` as any, parseFloat(e.target.value) || 0)} />
              </div>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div>
          <span style={{ ...label, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Observações Internas (Notas Privadas)</span>
          <textarea
            style={{ ...inp, resize: 'vertical', minHeight: 110 } as any}
            value={data.for_obs2 || ''}
            onChange={e => set('for_obs2', e.target.value)}
            placeholder="Instruções internas..." />
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Tab: Contatos ─────────────────────────────────────────────────────
function ContatosTab({ supplierId }: { supplierId: number }) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<Partial<Contato> | null>(null);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/suppliers/${supplierId}/contacts`);
      setContatos(res.data.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [supplierId]);

  const save = async () => {
    if (!form?.con_nome) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        con_dtnasc: form.con_dtnasc ? ddmmToDate(form.con_dtnasc) : null,
      };
      if (form.con_codigo) await api.put(`/suppliers/${supplierId}/contacts/${form.con_codigo}`, payload);
      else                 await api.post(`/suppliers/${supplierId}/contacts`, payload);
      setForm(null); load();
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Remover este contato?')) return;
    await api.delete(`/suppliers/${supplierId}/contacts/${id}`);
    load();
  };

  const sf = (f: keyof Contato, v: any) => setForm(prev => prev ? { ...prev, [f]: v } : prev);

  if (form !== null) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: G.text }}>{form.con_codigo ? 'Editar Contato' : 'Novo Contato'}</span>
        <button onClick={() => setForm(null)} style={{ fontSize: 11, color: G.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>← Voltar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <F label="Nome *"><input style={inp} value={form.con_nome || ''} onChange={e => sf('con_nome', e.target.value)} /></F>
          <F label="Cargo"><input style={inp} value={form.con_cargo || ''} onChange={e => sf('con_cargo', e.target.value)} /></F>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <F label="Telefone"><input style={{ ...inp, fontFamily: 'monospace' }} value={form.con_telefone || ''} onChange={e => sf('con_telefone', e.target.value)} /></F>
          <F label="Celular"><input style={{ ...inp, fontFamily: 'monospace' }} value={form.con_celular || ''} onChange={e => sf('con_celular', e.target.value)} /></F>
        </div>
        <F label="E-mail"><input style={inp} type="email" value={form.con_email || ''} onChange={e => sf('con_email', e.target.value)} /></F>
        <div style={{ width: 140 }}>
          <F label="Dia/Mês Aniversário">
            <input
              style={{ ...inp, fontFamily: 'monospace' }}
              value={form.con_dtnasc || ''}
              onChange={e => {
                let v = e.target.value.replace(/\D/g, '');
                if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                sf('con_dtnasc', v);
              }}
              placeholder="DD/MM"
              maxLength={5}
            />
          </F>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <F label="Time que Torce"><input style={inp} value={form.con_timequetorce || ''} onChange={e => sf('con_timequetorce', e.target.value)} placeholder="TIME" /></F>
          <F label="Esporte Preferido"><input style={inp} value={form.con_esportepreferido || ''} onChange={e => sf('con_esportepreferido', e.target.value)} placeholder="ESPORTE" /></F>
          <F label="Hobby"><input style={inp} value={form.con_hobby || ''} onChange={e => sf('con_hobby', e.target.value)} placeholder="HOBBY" /></F>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => setForm(null)} style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
        <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 8, border: 'none', background: G.success, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
          Salvar
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: G.text }}>Time de Atendimento</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: G.success, background: '#16A34A18', border: '1px solid #16A34A33', borderRadius: 20, padding: '2px 8px' }}>
            {contatos.length} CADASTRADOS
          </span>
        </div>
        <button onClick={() => setForm(emptyContato)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: G.success, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
          <UserPlus size={12} /> + Adicionar Integrante
        </button>
      </div>
      {loading ? <div style={{ textAlign: 'center', color: G.textMuted, fontSize: 12 }}>Carregando...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${G.border}` }}>
              {['Nome Completo','Cargo / Função','Ramal / Fixo','Celular / WhatsApp','Aniversário','Gerenciar'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contatos.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '20px 10px', textAlign: 'center', color: G.textMuted }}>Nenhum contato cadastrado.</td></tr>
            )}
            {contatos.map(c => (
              <tr key={c.con_codigo} style={{ borderBottom: `1px solid ${G.border}` }}
                onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 800, color: G.text, textTransform: 'uppercase', fontSize: 11 }}>{c.con_nome}</div>
                  {c.con_email && <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>{c.con_email}</div>}
                </td>
                <td style={{ padding: '8px 10px', color: G.textSec, textTransform: 'uppercase', fontSize: 11 }}>{c.con_cargo || '—'}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: G.textSec }}>{c.con_telefone || '—'}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>
                  {c.con_celular
                    ? <span style={{ color: G.success, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: G.success, flexShrink: 0 }} />
                        {c.con_celular}
                      </span>
                    : <span style={{ color: G.textMuted }}>—</span>
                  }
                </td>
                <td style={{ padding: '8px 10px', color: G.textMuted, fontFamily: 'monospace' }}>{dateToDDMM(c.con_dtnasc) || '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setForm({ ...c, con_dtnasc: dateToDDMM(c.con_dtnasc) })} style={smallBtn}><Pencil size={11} /></button>
                    <button onClick={() => remove(c.con_codigo)} style={{ ...smallBtn, color: G.danger }}><Trash2 size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Bottom Tab: Clientes que já compraram ────────────────────────────────────
function ClientesTab({ supplierId }: { supplierId: number }) {
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/suppliers/${supplierId}/customers`).then(r => setRows(r.data.data || [])).finally(() => setLoading(false));
  }, [supplierId]);

  const total = rows.reduce((s, r) => s + parseFloat(r.total_compras || 0), 0);

  const exportExcel = () => {
    const header = ['Código','Cliente','CNPJ','Última Compra','Qtd. Pedidos','Total Compras'];
    const csvRows = rows.map(r => [
      r.cli_codigo,
      r.cli_nomred,
      r.cli_cnpj || '',
      r.ultima_compra ? new Date(r.ultima_compra).toLocaleDateString('pt-BR') : '',
      r.qtd_pedidos,
      parseFloat(r.total_compras || 0).toFixed(2).replace('.',','),
    ]);
    const csv = [header, ...csvRows].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `clientes_industria_${supplierId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ textAlign: 'center', color: G.textMuted, fontSize: 12, padding: 20 }}>Carregando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: G.text }}>Clientes que já compraram ({rows.length})</span>
          <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: `1px solid ${G.success}`, background: 'transparent', color: G.success, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
            ↓ EXPORTAR EXCEL
          </button>
        </div>
        <span style={{ fontSize: 12, color: G.textMuted }}>Total: <strong style={{ color: G.success, fontSize: 13 }}>{fmtBRL(total)}</strong></span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${G.border}` }}>
            {['Cliente','CNPJ','Última Compra','Qtd. Pedidos','Total Compras'].map((h, i) => (
              <th key={h} style={{ padding: '5px 10px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: G.textMuted }}>Nenhum cliente encontrado.</td></tr>}
          {rows.map(r => (
            <tr key={r.cli_codigo} style={{ borderBottom: `1px solid ${G.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '7px 10px' }}>
                <div style={{ fontWeight: 700, color: G.text }}>{r.cli_nomred}</div>
                <div style={{ fontSize: 10, color: G.textMuted, marginTop: 1 }}>Cód: {r.cli_codigo}</div>
              </td>
              <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: G.textMuted, fontSize: 11 }}>{r.cli_cnpj || '—'}</td>
              <td style={{ padding: '7px 10px', color: G.textSec }}>{r.ultima_compra ? new Date(r.ultima_compra).toLocaleDateString('pt-BR') : '—'}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', color: G.textSec }}>{r.qtd_pedidos}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: G.success }}>{fmtBRL(parseFloat(r.total_compras || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Bottom Tab: Política de Descontos ───────────────────────────────────────
function DescontosTab({ data, set }: { data: Partial<Industria>; set: (f: keyof Industria, v: any) => void }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: G.textMuted, marginBottom: 12 }}>Níveis de desconto padrão aplicados aos pedidos desta indústria.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <div key={n}>
            <span style={{ ...label, fontSize: 9 }}>Desconto {n}</span>
            <input style={{ ...inp, fontFamily: 'monospace', fontWeight: 800, textAlign: 'center' }}
              type="number" min={0} max={100} step={0.01}
              value={(data as any)[`for_des${n}`] ?? 0}
              onChange={e => set(`for_des${n}` as any, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bottom Tab: Política Comercial ──────────────────────────────────────────
function ComercialTab({ data, set }: { data: Partial<Industria>; set: (f: keyof Industria, v: any) => void }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: G.textMuted, marginBottom: 10 }}>Condições comerciais, prazo mínimo, frete, bonificações e regras regionais.</p>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
        padding: '10px 14px', borderRadius: 10,
        background: data.for_usa_menor_preco ? '#FFF8DC' : G.card,
        border: `1px solid ${data.for_usa_menor_preco ? '#E6C200' : G.border}`,
        transition: 'all .2s',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
          <input
            type="checkbox"
            checked={!!data.for_usa_menor_preco}
            onChange={e => set('for_usa_menor_preco', e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#D4A800' }}
          />
          <span style={{ fontSize: 12, fontWeight: 800, color: G.text }}>
            Política de Menor Preço
          </span>
        </label>
        <span style={{ fontSize: 11, color: G.textSec }}>
          Usa min(Bruto c/ desc., Promoção, Especial) por item
        </span>
      </div>
      <textarea
        style={{ ...inp, resize: 'none', height: 120, fontSize: 12 } as any}
        value={data.for_obs2 || ''}
        onChange={e => set('for_obs2', e.target.value)}
        placeholder="Ex: Frete CIF acima de R$ 3.000 · Pedido mínimo R$ 1.500 · Desconto por pontualidade 2%..." />
    </div>
  );
}

// ─── Bottom Tab: Meta Anual ───────────────────────────────────────────────────
function MetaAnualTab({ supplierId }: { supplierId: number }) {
  const [year, setYear]     = useState(new Date().getFullYear());
  const [meta, setMeta]     = useState<MetaAnual>(emptyMeta);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    api.get(`/suppliers/${supplierId}/goals/${year}`)
      .then(r => setMeta(r.data.data || emptyMeta))
      .catch(() => setMeta(emptyMeta));
  }, [supplierId, year]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/suppliers/${supplierId}/goals/${year}`, meta);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const years = [2024, 2025, 2026, 2027, 2028];

  return (
    <div>
      {/* Header escuro */}
      <div style={{ background: G.text, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={16} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.8, textTransform: 'uppercase' }}>Planejamento Estratégico de Volume de Vendas</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Defina as metas mensais para acompanhamento de performance</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved && <span style={{ fontSize: 11, color: '#4ade80' }}>✓ Salvo</span>}
          <select
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
            value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y} style={{ background: G.text }}>{y}</option>)}
          </select>
          <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7, border: 'none', background: G.mustard, color: G.text, fontSize: 11, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={11} />}
            Salvar
          </button>
        </div>
      </div>

      {/* Grid de meses — 4 colunas, 3 linhas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {MONTH_KEYS.map((k, i) => {
          const val = meta[k] || 0;
          const hasValue = val > 0;
          return (
            <div key={k} style={{ border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{MONTHS[i]}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasValue ? G.success : G.border }} />
              </div>
              <input
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: hasValue ? G.text : G.textMuted, padding: 0, fontFamily: 'monospace' }}
                type="number" min={0} step={500}
                value={val || ''}
                placeholder="R$ 0,00"
                onChange={e => setMeta(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.select()}
              />
              {hasValue && <div style={{ fontSize: 10, color: G.textMuted, marginTop: 2 }}>{fmtBRL(val)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bottom Tab: IA / WhatsApp ────────────────────────────────────────────────
interface IaData {
  nome_marca?: string;
  persona_ia?: string;
  palavras_chave?: string;
  resumo_negocio?: string;
}

function IaTab({ supplierId }: { supplierId: number }) {
  const [data, setData]     = useState<IaData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/suppliers/${supplierId}/ia-knowledge`)
      .then(res => setData(res.data.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [supplierId]);

  const set = (field: keyof IaData, value: string) =>
    setData(prev => ({ ...prev, [field]: value }));

  const [saveError, setSaveError] = useState('');

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await api.post(`/suppliers/${supplierId}/ia-knowledge`, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Erro ao salvar. Tente novamente.');
      setTimeout(() => setSaveError(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: G.textMuted, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Carregando...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #7C3AED12 0%, #4F46E508 100%)',
        border: '1px solid #7C3AED22', borderRadius: 12, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #7C3AED40' }}>
            <Bot size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: G.text, letterSpacing: 0.3 }}>Inteligência Artificial &amp; WhatsApp</div>
            <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>Ensine a IA como apresentar e vender esta marca para seus clientes</div>
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px',
          borderRadius: 9, border: 'none', flexShrink: 0,
          background: saved ? '#22C55E' : saving ? G.border : '#7C3AED',
          color: saving ? G.textMuted : '#fff',
          fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          boxShadow: saving || saved ? 'none' : '0 2px 8px #7C3AED40',
          transition: 'background .2s',
        }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saved ? '✓ Salvo!' : 'Salvar Conhecimento'}
        </button>
      </div>
      {saveError && (
        <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, padding: '6px 4px' }}>
          ⚠ {saveError}
        </div>
      )}

      {/* Campos — linha 1: 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <IaField label="Nome da Marca (Para a IA)" hint="Como a IA deve chamar a empresa nas conversas.">
          <input style={inp} value={data.nome_marca || ''} onChange={e => set('nome_marca', e.target.value)} placeholder="Ex: Moraes, Vanucci, Auto Peças XPTO" />
        </IaField>
        <IaField label="Persona / Tom de Voz" hint='Como a IRIS deve se comportar com os lojistas. Ex: "Atendente simpática e objetiva" ou "Consultora técnica, linguagem profissional". Quanto mais detalhado, melhor.'>
          <input style={inp} value={data.persona_ia || ''} onChange={e => set('persona_ia', e.target.value)} placeholder="Ex: Consultor Técnico Especialista" />
        </IaField>
      </div>

      {/* Campos — linha 2: palavras-chave */}
      <IaField label="Palavras-Chave (Match Rápido)" hint="Termos que ativam esta marca imediatamente. Separe por vírgula.">
        <input style={inp} value={data.palavras_chave || ''} onChange={e => set('palavras_chave', e.target.value)} placeholder="Ex: amortecedor, suspensão, freio, promoção xpto" />
      </IaField>

      {/* Campos — linha 3: resumo completo */}
      <IaField label="Resumo do Negócio (Conhecimento Base)" hint="A IA usará este texto para responder dúvidas sobre esta indústria.">
        <textarea
          style={{ ...inp, height: 100, resize: 'vertical', lineHeight: 1.7 } as any}
          value={data.resumo_negocio || ''}
          onChange={e => set('resumo_negocio', e.target.value)}
          placeholder={'Descreva aqui o negócio desta indústria para a IA.\nExemplo: Somos especialistas em linha pesada. Nossa entrega é em 24h para SP e RJ. Pedido mínimo R$ 500,00.'} />
      </IaField>

    </div>
  );
}

function IaField({ label: l, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLSpanElement>(null);

  const handleShow = (v: boolean) => {
    if (v && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setShow(v);
  };

  const above = rect ? rect.top > 180 : true;

  return (
    <div style={{ background: '#FAFAF8', border: `1px solid ${G.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: G.text, letterSpacing: 0.3 }}>{l}</span>
        <span
          ref={btnRef}
          onMouseEnter={() => handleShow(true)}
          onMouseLeave={() => handleShow(false)}
          onClick={() => handleShow(!show)}
          style={{
            width: 15, height: 15, borderRadius: '50%', border: `1px solid ${G.border}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: G.textMuted, cursor: 'help', flexShrink: 0,
            background: show ? G.border : 'transparent', transition: 'background .15s',
          }}>?</span>
        {show && rect && (
          <div style={{
            position: 'fixed',
            top: above ? rect.top - 8 : rect.bottom + 8,
            left: Math.min(rect.left + rect.width / 2, window.innerWidth - 140),
            transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            background: '#1E2D3D', color: '#E2D9C8', fontSize: 11, lineHeight: 1.6,
            padding: '8px 12px', borderRadius: 8, whiteSpace: 'normal', maxWidth: 260,
            zIndex: 99999, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'none',
          }}>
            {above && <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: '#1E2D3D', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />}
            {!above && <div style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: '#1E2D3D', clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />}
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: G.border }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function F({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={label}>{l}</span>
      {children}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`,
  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};

const smallBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: `1px solid ${G.border}`,
  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: G.textSec,
};
