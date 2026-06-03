import { useEffect, useState }   from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Loader2, UserCheck } from 'lucide-react';
import { api }                    from '@/shared/lib/api';
import { MobileHeader }           from '../components/MobileHeader';

const OPCOES_ATUACAO = [
  { value: 'P',    label: 'Prospect' },
  { value: 'VAR',  label: 'Varejo' },
  { value: 'OFC',  label: 'Oficina' },
  { value: 'DIST', label: 'Distribuição' },
  { value: 'ATA',  label: 'Atacado' },
  { value: 'FRO',  label: 'Frotas' },
  { value: 'IND',  label: 'Indústria' },
];

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

interface ClienteData {
  cli_codigo:    number;
  cli_nome:      string;
  cli_fantasia:  string;
  cli_nomred:    string;
  cli_cnpj:      string;
  cli_inscricao: string;
  cli_fone1:     string;
  cli_fone2:     string;
  cli_fone3:     string;
  cli_email:     string;
  cli_emailnfe:  string;
  cli_emailfinanc: string;
  cli_cidade:    string;
  cli_uf:        string;
  cli_endereco:  string;
  cli_endnum:    string;
  cli_bairro:    string;
  cli_cep:       string;
  cli_atuacao:   string;
  cli_obspedido: string;
  cli_latitude:  string;
  cli_longitude: string;
  [key: string]: any;
}

function Field({
  label, name, value, onChange, type = 'text', textarea = false, readOnly = false,
}: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void;
  type?: string; textarea?: boolean; readOnly?: boolean;
}) {
  const base: React.CSSProperties = {
    width: '100%', borderRadius: 10, fontSize: 14, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: readOnly ? '#f8f9fa' : '#fff',
    color: readOnly ? 'var(--navy-muted)' : 'var(--navy)', outline: 'none',
    padding: textarea ? '10px 12px' : '11px 12px',
    boxSizing: 'border-box' as const, resize: 'none' as const,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
        textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</label>
      {textarea ? (
        <textarea rows={3} style={base} value={value ?? ''}
          onChange={e => onChange(name, e.target.value)} readOnly={readOnly} />
      ) : (
        <input type={type} style={base} value={value ?? ''}
          onChange={e => onChange(name, e.target.value)} readOnly={readOnly} />
      )}
    </div>
  );
}

export default function ClienteEditPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data,    setData]    = useState<ClienteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [converting,   setConverting]   = useState(false);
  const [convertArea,  setConvertArea]  = useState('');
  const [error,        setError]        = useState('');
  const [saved,        setSaved]        = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/clients/${id}`)
      .then(r => { if (r.data.success) setData(r.data.data); })
      .catch(() => setError('Erro ao carregar cadastro.'))
      .finally(() => setLoading(false));
  }, [id]);

  function onChange(name: string, value: string) {
    setData(prev => prev ? { ...prev, [name]: value } : prev);
    setSaved(false);
  }

  async function handleSave() {
    if (!data || !id) return;
    if (!data.cli_nomred?.trim()) { setError('Nome Reduzido é obrigatório.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/clients/${id}`, data);
      setSaved(true);
      setTimeout(() => navigate(-1), 800);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (!convertArea) { setError('Selecione a área de atuação para converter.'); return; }
    if (!data || !id) return;
    setConverting(true); setError('');
    try {
      await api.put(`/clients/${id}`, { ...data, cli_atuacao: convertArea });
      navigate(-1);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao converter.');
    } finally {
      setConverting(false);
    }
  }

  const isProspect = data?.cli_atuacao === 'P';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title="Editar Cadastro" showBack />

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={22} color="var(--navy)" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : !data ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'var(--navy-muted)', padding: 20 }}>
          {error || 'Cliente não encontrado.'}
        </div>
      ) : (
        <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 120px' }}>

          {/* ── Banner Prospect ── */}
          {isProspect && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12,
              padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>Cliente em Prospecção</div>
                <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                  Complete o cadastro e converta quando fechar negócio.
                </div>
              </div>
            </div>
          )}

          {/* ── Identificação ── */}
          <Section label="Identificação">
            <Row>
              <Field label="Nome Reduzido *" name="cli_nomred" value={data.cli_nomred} onChange={onChange} />
              <Field label="Fantasia" name="cli_fantasia" value={data.cli_fantasia} onChange={onChange} />
            </Row>
            <Field label="Razão Social" name="cli_nome" value={data.cli_nome} onChange={onChange} />
            <Row>
              <Field label="CNPJ / CPF" name="cli_cnpj" value={data.cli_cnpj} onChange={onChange} readOnly />
              <Field label="Inscrição Est." name="cli_inscricao" value={data.cli_inscricao} onChange={onChange} />
            </Row>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
                textTransform: 'uppercase', letterSpacing: 0.6 }}>Área de Atuação</label>
              <select
                value={data.cli_atuacao ?? ''}
                onChange={e => onChange('cli_atuacao', e.target.value)}
                style={{ borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
                  background: '#fff', color: 'var(--navy)', padding: '11px 12px',
                  fontFamily: 'inherit', outline: 'none' }}
              >
                <option value="">—</option>
                {OPCOES_ATUACAO.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </Section>

          {/* ── Contato ── */}
          <Section label="Contato">
            <Row>
              <Field label="Telefone 1" name="cli_fone1" value={data.cli_fone1} onChange={onChange} type="tel" />
              <Field label="Telefone 2" name="cli_fone2" value={data.cli_fone2} onChange={onChange} type="tel" />
            </Row>
            <Field label="E-mail" name="cli_email" value={data.cli_email} onChange={onChange} type="email" />
            <Field label="E-mail Financeiro" name="cli_emailfinanc" value={data.cli_emailfinanc} onChange={onChange} type="email" />
            <Field label="E-mail NF-e" name="cli_emailnfe" value={data.cli_emailnfe} onChange={onChange} type="email" />
          </Section>

          {/* ── Endereço ── */}
          <Section label="Endereço">
            <Row>
              <Field label="Logradouro" name="cli_endereco" value={data.cli_endereco} onChange={onChange} />
              <Field label="Nº" name="cli_endnum" value={data.cli_endnum} onChange={onChange} />
            </Row>
            <Row>
              <Field label="Bairro" name="cli_bairro" value={data.cli_bairro} onChange={onChange} />
              <Field label="CEP" name="cli_cep" value={data.cli_cep} onChange={onChange} />
            </Row>
            <Row>
              <Field label="Cidade" name="cli_cidade" value={data.cli_cidade} onChange={onChange} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.6 }}>UF</label>
                <select value={data.cli_uf ?? ''} onChange={e => onChange('cli_uf', e.target.value)}
                  style={{ borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
                    background: '#fff', color: 'var(--navy)', padding: '11px 10px',
                    fontFamily: 'inherit', outline: 'none' }}>
                  <option value="">—</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </Row>
          </Section>

          {/* ── Notas ── */}
          <Section label="Notas">
            <Field label="Observações para Pedido" name="cli_obspedido"
              value={data.cli_obspedido} onChange={onChange} textarea />
          </Section>

          {/* ── Converter em Cliente ── */}
          {isProspect && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16,
              padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--mustard)',
                textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 8,
                borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                Converter em Cliente
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.6 }}>Área de Atuação</label>
                <select value={convertArea} onChange={e => setConvertArea(e.target.value)}
                  style={{ borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
                    background: '#fff', color: 'var(--navy)', padding: '11px 12px',
                    fontFamily: 'inherit', outline: 'none' }}>
                  <option value="">— Selecione —</option>
                  <option value="VAR">Varejo</option>
                  <option value="OFC">Oficina</option>
                  <option value="DIST">Distribuição</option>
                  <option value="ATA">Atacado</option>
                  <option value="FRO">Frotas</option>
                  <option value="IND">Indústria</option>
                </select>
              </div>
              <button onClick={handleConvert} disabled={converting}
                style={{ width: '100%', background: '#059669', color: '#fff', border: 'none',
                  borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: converting ? 0.7 : 1 }}>
                {converting
                  ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <UserCheck size={18} />}
                {converting ? 'Convertendo...' : 'Converter em Cliente'}
              </button>
            </div>
          )}

          {/* ── Error / Save ── */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Sticky Save button ── */}
      {data && (
        <div style={{ padding: '12px 16px 28px', background: 'var(--sand-bg)',
          borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', background: saved ? '#059669' : 'var(--navy)',
              color: '#FFF', border: 'none', borderRadius: 14, padding: 16,
              fontSize: 16, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}>
            {saving
              ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Save size={18} />}
            {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Layout helpers ── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
      border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)',
      display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--mustard)',
        textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 4,
        borderBottom: '1px solid var(--border)' }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {children}
    </div>
  );
}
