import { useState, useEffect, useRef } from 'react';
import { Save, Search, Image } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface EmpresaData {
  emp_situacao: string;
  emp_nome: string;
  emp_endereco: string;
  emp_bairro: string;
  emp_cidade: string;
  emp_uf: string;
  emp_cep: string;
  emp_cnpj: string;
  emp_inscricao: string;
  emp_fones: string;
  emp_logotipo: string;
}

const inp: React.CSSProperties = {
  width: '100%', border: `1px solid ${G.border}`, borderRadius: 8,
  padding: '8px 12px', fontSize: 13, background: G.bg, color: G.text,
  boxSizing: 'border-box', outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: G.textSec,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>;
}

export default function ConfiguracoesPage() {
  const [data, setData]     = useState<Partial<EmpresaData>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/empresa').then(r => {
      if (r.data.data) setData(r.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const set = (k: keyof EmpresaData, v: string) =>
    setData(prev => ({ ...prev, [k]: v }));

  // ── Consulta CNPJ na Receita Federal ─────────────────────────────────────────
  const consultarCNPJ = async () => {
    const cnpj = data.emp_cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;
    try {
      const res = await api.get(`/aux/cnpj/${cnpj}`);
      if (!res.data.success) throw new Error(res.data.message);
      const r = res.data.data;
      setData(prev => ({
        ...prev,
        emp_nome:     r.razao_social || prev.emp_nome,
        emp_endereco: r.logradouro   || prev.emp_endereco,
        emp_bairro:   r.bairro       || prev.emp_bairro,
        emp_cidade:   r.municipio    || prev.emp_cidade,
        emp_uf:       r.uf           || prev.emp_uf,
        emp_cep:      (r.cep || '').replace(/\D/g, '') || prev.emp_cep,
      }));
    } catch (e: any) { setMsg({ type: 'err', text: e.message || 'CNPJ não encontrado na Receita Federal.' }); }
  };

  // ── Upload de logotipo ────────────────────────────────────────────────────────
  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('emp_logotipo', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Salvar ────────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put('/empresa', data);
      setMsg({ type: 'ok', text: 'Configurações salvas com sucesso!' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Erro ao salvar.' });
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: G.textMuted }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: G.text }}>⚙ Configurações do Sistema</div>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${G.border}`, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

        {/* Tab: Dados da Empresa */}
        <div style={{ borderBottom: `2px solid ${G.text}`, paddingBottom: 8, marginBottom: 28, fontSize: 12, fontWeight: 800, color: G.text, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dados da Empresa
        </div>

        {/* CNPJ */}
        <Field label="CNPJ">
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inp} value={data.emp_cnpj || ''} onChange={e => set('emp_cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            <button onClick={consultarCNPJ} title="Consultar Receita Federal"
              style={{ width: 40, height: 38, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Search size={15} color={G.textSec} />
            </button>
          </div>
        </Field>

        <Row>
          <Field label="Situação">
            <select style={{ ...inp, cursor: 'pointer' }} value={data.emp_situacao || 'A'} onChange={e => set('emp_situacao', e.target.value)}>
              <option value="A">Ativo</option>
              <option value="I">Inativo</option>
            </select>
          </Field>
          <Field label="Nome da Empresa *">
            <input style={inp} value={data.emp_nome || ''} onChange={e => set('emp_nome', e.target.value)} placeholder="Razão social" />
          </Field>
        </Row>

        <Field label="Endereço">
          <input style={inp} value={data.emp_endereco || ''} onChange={e => set('emp_endereco', e.target.value)} placeholder="Logradouro, número" />
        </Field>

        <Row>
          <Field label="Bairro">
            <input style={inp} value={data.emp_bairro || ''} onChange={e => set('emp_bairro', e.target.value)} />
          </Field>
          <Field label="Cidade">
            <input style={inp} value={data.emp_cidade || ''} onChange={e => set('emp_cidade', e.target.value)} />
          </Field>
        </Row>

        <Row>
          <Field label="UF">
            <input style={{ ...inp, maxWidth: 80 }} value={data.emp_uf || ''} maxLength={2} onChange={e => set('emp_uf', e.target.value.toUpperCase())} />
          </Field>
          <Field label="CEP">
            <input style={inp} value={data.emp_cep || ''} onChange={e => set('emp_cep', e.target.value)} placeholder="00000-000" />
          </Field>
        </Row>

        <Row>
          <Field label="Inscrição Estadual">
            <input style={inp} value={data.emp_inscricao || ''} onChange={e => set('emp_inscricao', e.target.value)} placeholder="Inscrição estadual" />
          </Field>
          <Field label="Telefones">
            <input style={inp} value={data.emp_fones || ''} onChange={e => set('emp_fones', e.target.value)} placeholder="(00) 0000-0000" />
          </Field>
        </Row>

        {/* Logotipo */}
        <Field label="Logotipo">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, fontSize: 11, color: G.textMuted }} readOnly
                  value={data.emp_logotipo ? (data.emp_logotipo.startsWith('data:') ? 'IMAGEM CARREGADA (Base64)' : data.emp_logotipo) : ''} />
                <button onClick={() => fileRef.current?.click()} title="Selecionar imagem"
                  style={{ width: 40, height: 38, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Image size={15} color={G.textSec} />
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
            </div>
            {data.emp_logotipo && (
              <img src={data.emp_logotipo} alt="Logo" style={{ height: 60, borderRadius: 8, border: `1px solid ${G.border}`, objectFit: 'contain', background: '#fff', padding: 4 }} />
            )}
          </div>
        </Field>

        {/* Feedback */}
        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: msg.type === 'ok' ? '#e8f5e9' : '#fdecea',
            color: msg.type === 'ok' ? '#2e7d32' : '#c62828',
            border: `1px solid ${msg.type === 'ok' ? '#a5d6a7' : '#ef9a9a'}` }}>
            {msg.text}
          </div>
        )}

        {/* Botão salvar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={save} disabled={saving}
            style={{ background: saving ? G.border : G.mustard, border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', color: G.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    </div>
  );
}
