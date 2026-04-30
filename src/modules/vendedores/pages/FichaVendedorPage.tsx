import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Pencil, X,
} from 'lucide-react';
import { AppSidebar } from '@/shared/components/layout/AppSidebar';
import { G, inp, label } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { onEnterTab } from '@/shared/lib/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Vendedor {
  ven_codigo: number;
  ven_nome: string;
  ven_endereco: string;
  ven_bairro: string;
  ven_cidade: string;
  ven_cep: string;
  ven_uf: string;
  ven_fone1: string;
  ven_fone2: string;
  ven_aniversario: string;
  ven_cpf: string;
  ven_rg: string;
  ven_ctps: string;
  ven_filiacao: string;
  ven_email: string;
  ven_nomeusu: string;
  ven_dtadmissao: string;
  ven_dtdemissao: string;
  ven_status: string;
  ven_cumpremetas: string;
  ven_obs: string;
  ven_codusu: number;
}

interface SellerIndustry {
  vin_industria: number;
  vin_codigo: number;
  vin_percom: number;
  for_nomered: string;
  for_nome: string;
}

interface SellerRegion {
  vin_codigo: number;
  vin_regiao: number;
  reg_nome: string;
  reg_codigo: number;
}

interface Meta {
  met_id: number;
  met_ano: number;
  met_industria: number;
  met_vendedor: number;
  industria_nome: string;
  met_jan: number; met_fev: number; met_mar: number; met_abr: number;
  met_mai: number; met_jun: number; met_jul: number; met_ago: number;
  met_set: number; met_out: number; met_nov: number; met_dez: number;
}

const MONTHS_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'] as const;
const MONTHS_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const TABS = ['DADOS','INDÚSTRIAS','REGIÕES','METAS'] as const;
type Tab = typeof TABS[number];

const emptyMeta = {
  met_ano: new Date().getFullYear(),
  met_industria: 0,
  met_jan:0, met_fev:0, met_mar:0, met_abr:0, met_mai:0, met_jun:0,
  met_jul:0, met_ago:0, met_set:0, met_out:0, met_nov:0, met_dez:0,
};

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Estilos ──────────────────────────────────────────────────────────────────
const section: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '20px 24px',
  marginBottom: 16, border: `1px solid ${G.border}`,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14,
};
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 };
const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 };
const actionBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`,
  background: 'transparent', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', color: G.textSec,
};

function Field({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={label}>{lbl}</span>
      {children}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FichaVendedorPage({ overrideId }: { overrideId?: string }) {
  const params     = useParams<{ id: string }>();
  const id         = overrideId || params.id;
  const navigate   = useNavigate();
  const isNew      = id === 'novo';

  const [data, setData]       = useState<Partial<Vendedor>>({ ven_status: 'A', ven_cumpremetas: 'S' });
  const [tab, setTab]         = useState<Tab>('DADOS');
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(!isNew);

  // sub-tables
  const [industries, setIndustries]   = useState<SellerIndustry[]>([]);
  const [allInds, setAllInds]         = useState<{value:number;label:string}[]>([]);
  const [indModal, setIndModal]       = useState<{open:boolean;editing:Partial<SellerIndustry>}>({ open:false, editing:{} });
  const [savingInd, setSavingInd]     = useState(false);

  const [regions, setRegions]         = useState<SellerRegion[]>([]);
  const [allRegioes, setAllRegioes]   = useState<{reg_codigo:number;reg_nome:string}[]>([]);
  const [regModal, setRegModal]       = useState(false);
  const [regSel, setRegSel]           = useState(0);

  const [metas, setMetas]             = useState<Meta[]>([]);
  const [metaModal, setMetaModal]     = useState<{open:boolean;editing:Partial<Meta>}>({ open:false, editing:emptyMeta });
  const [savingMeta, setSavingMeta]   = useState(false);
  const [anoFilter, setAnoFilter]     = useState(new Date().getFullYear());

  const set = (field: keyof Vendedor, value: any) =>
    setData(prev => ({ ...prev, [field]: value }));

  // Carga principal
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api.get(`/sellers/${id}`)
      .then(r => setData(r.data.data || {}))
      .catch(() => navigate('/vendedores'))
      .finally(() => setLoading(false));
  }, [id, isNew, navigate]);

  // Auxiliares
  useEffect(() => {
    api.get('/aux/industrias').then(r => setAllInds(r.data.data || [])).catch(() => {});
    api.get('/aux/regioes').then(r => setAllRegioes(r.data.data || [])).catch(() => {});
  }, []);

  // Indústrias
  const loadIndustries = useCallback(() => {
    if (isNew) return;
    api.get(`/sellers/${id}/industries`).then(r => setIndustries(r.data.data || [])).catch(() => {});
  }, [id, isNew]);
  useEffect(() => { loadIndustries(); }, [loadIndustries]);

  const saveIndustry = async () => {
    const e = indModal.editing;
    if (!e.vin_industria) return;
    setSavingInd(true);
    try {
      if (industries.find(i => i.vin_industria === e.vin_industria)) {
        await api.put(`/sellers/${id}/industries/${e.vin_industria}`, { vin_percom: e.vin_percom });
      } else {
        await api.post(`/sellers/${id}/industries`, e);
      }
      setIndModal({ open: false, editing: {} });
      loadIndustries();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSavingInd(false);
    }
  };

  const deleteIndustry = async (industryId: number) => {
    if (!confirm('Remover esta indústria?')) return;
    await api.delete(`/sellers/${id}/industries/${industryId}`);
    loadIndustries();
  };

  // Regiões
  const loadRegions = useCallback(() => {
    if (isNew) return;
    api.get(`/sellers/${id}/regions`).then(r => setRegions(r.data.data || [])).catch(() => {});
  }, [id, isNew]);
  useEffect(() => { loadRegions(); }, [loadRegions]);

  const addRegion = async () => {
    if (!regSel) return;
    try {
      await api.post(`/sellers/${id}/regions`, { vin_regiao: regSel });
      setRegModal(false);
      setRegSel(0);
      loadRegions();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao vincular região.');
    }
  };

  const deleteRegion = async (regionId: number) => {
    if (!confirm('Remover esta região?')) return;
    await api.delete(`/sellers/${id}/regions/${regionId}`);
    loadRegions();
  };

  // Metas
  const loadMetas = useCallback(() => {
    if (isNew) return;
    api.get(`/sellers/${id}/metas?ano=${anoFilter}`).then(r => setMetas(r.data.data || [])).catch(() => {});
  }, [id, isNew, anoFilter]);
  useEffect(() => { loadMetas(); }, [loadMetas]);

  const saveMeta = async () => {
    const e = metaModal.editing;
    if (!e.met_industria || !e.met_ano) return;
    setSavingMeta(true);
    try {
      if (e.met_id) {
        await api.put(`/sellers/${id}/metas/${e.met_id}`, e);
      } else {
        await api.post(`/sellers/${id}/metas`, e);
      }
      setMetaModal({ open: false, editing: emptyMeta });
      loadMetas();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar meta.');
    } finally {
      setSavingMeta(false);
    }
  };

  const deleteMeta = async (metaId: number) => {
    if (!confirm('Remover esta meta?')) return;
    await api.delete(`/sellers/${id}/metas/${metaId}`);
    loadMetas();
  };

  // Salvar vendedor
  const save = async () => {
    if (!data.ven_nome?.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const r = await api.post('/sellers', data);
        navigate(`/vendedores/${r.data.id}`, { replace: true });
      } else {
        await api.put(`/sellers/${id}`, data);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: G.bg }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={28} style={{ color: G.textMuted, animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: G.bg }}>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          background: G.text, color: '#fff', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 2px 8px #0003', flexShrink: 0,
        }}>
          <button onClick={() => navigate('/vendedores')}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8, padding: 4 }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Ficha do Vendedor</span>
              {!isNew && (
                <span style={{ fontSize: 11, fontWeight: 700, background: G.mustard, color: G.text, padding: '2px 8px', borderRadius: 6 }}>
                  ID: {String(data.ven_codigo || '').padStart(4, '0')}
                </span>
              )}
              {data.ven_status === 'I' && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#C0392B20', color: G.danger, padding: '2px 8px', borderRadius: 6, border: `1px solid ${G.danger}30` }}>
                  INATIVO
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{data.ven_nome || 'Novo Vendedor'}</div>
          </div>
          <button onClick={save} disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: G.mustard, color: G.text, border: 'none', borderRadius: 10,
            padding: '9px 20px', fontWeight: 800, fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ background: '#fff', borderBottom: `1px solid ${G.border}`, display: 'flex', padding: '0 24px', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '14px 20px', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              color: tab === t ? G.text : G.textMuted, background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t ? G.mustard : 'transparent'}`,
              cursor: 'pointer', transition: 'all .15s',
            }}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* ── DADOS ─────────────────────────────────────────────────────── */}
          {tab === 'DADOS' && (
            <div style={{ maxWidth: 860 }}>
              <div style={section}>
                <div style={sectionTitle}>I — IDENTIFICAÇÃO</div>
                <div style={{ marginBottom: 12 }}>
                  <Field lbl="NOME *">
                    <input style={inp} value={data.ven_nome || ''} onChange={e => set('ven_nome', e.target.value)} onKeyDown={onEnterTab} autoFocus />
                  </Field>
                </div>
                <div style={{ ...row3, gridTemplateColumns: '160px 160px 1fr' }}>
                  <Field lbl="CPF">
                    <input style={inp} value={data.ven_cpf || ''} onChange={e => set('ven_cpf', e.target.value)} onKeyDown={onEnterTab} placeholder="000.000.000-00" />
                  </Field>
                  <Field lbl="RG">
                    <input style={inp} value={data.ven_rg || ''} onChange={e => set('ven_rg', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                  <Field lbl="CTPS">
                    <input style={inp} value={data.ven_ctps || ''} onChange={e => set('ven_ctps', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                </div>
                <div style={row2}>
                  <Field lbl="ANIVERSÁRIO">
                    <input style={inp} value={data.ven_aniversario || ''} onChange={e => set('ven_aniversario', e.target.value)} onKeyDown={onEnterTab} placeholder="DD/MM" maxLength={5} />
                  </Field>
                  <Field lbl="FILIAÇÃO">
                    <input style={inp} value={data.ven_filiacao || ''} onChange={e => set('ven_filiacao', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                </div>
              </div>

              <div style={section}>
                <div style={sectionTitle}>II — ENDEREÇO</div>
                <div style={{ marginBottom: 12 }}>
                  <Field lbl="ENDEREÇO">
                    <input style={inp} value={data.ven_endereco || ''} onChange={e => set('ven_endereco', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                </div>
                <div style={{ ...row3, gridTemplateColumns: '1fr 1fr 90px 80px' }}>
                  <Field lbl="BAIRRO">
                    <input style={inp} value={data.ven_bairro || ''} onChange={e => set('ven_bairro', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                  <Field lbl="CIDADE">
                    <input style={inp} value={data.ven_cidade || ''} onChange={e => set('ven_cidade', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                  <Field lbl="CEP">
                    <input style={inp} value={data.ven_cep || ''} onChange={e => set('ven_cep', e.target.value)} onKeyDown={onEnterTab} placeholder="00000-000" />
                  </Field>
                  <Field lbl="UF">
                    <input style={{ ...inp, textTransform: 'uppercase' }} maxLength={2} value={data.ven_uf || ''} onChange={e => set('ven_uf', e.target.value.toUpperCase())} onKeyDown={onEnterTab} />
                  </Field>
                </div>
              </div>

              <div style={section}>
                <div style={sectionTitle}>III — CONTATO</div>
                <div style={row3}>
                  <Field lbl="TELEFONE">
                    <input style={inp} value={data.ven_fone1 || ''} onChange={e => set('ven_fone1', e.target.value)} onKeyDown={onEnterTab} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field lbl="CELULAR">
                    <input style={inp} value={data.ven_fone2 || ''} onChange={e => set('ven_fone2', e.target.value)} onKeyDown={onEnterTab} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field lbl="E-MAIL">
                    <input style={inp} type="email" value={data.ven_email || ''} onChange={e => set('ven_email', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                </div>
                <div style={row2}>
                  <Field lbl="USUÁRIO (ACESSO)">
                    <input style={{ ...inp, fontFamily: 'monospace', fontWeight: 700 }} value={data.ven_nomeusu || ''} onChange={e => set('ven_nomeusu', e.target.value)} onKeyDown={onEnterTab} placeholder="login do sistema" />
                  </Field>
                </div>
              </div>

              <div style={section}>
                <div style={sectionTitle}>IV — VÍNCULO EMPREGATÍCIO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 120px 120px', gap: 12, marginBottom: 12 }}>
                  <Field lbl="DATA ADMISSÃO">
                    <input style={inp} type="date" value={data.ven_dtadmissao || ''} onChange={e => set('ven_dtadmissao', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                  <Field lbl="DATA DEMISSÃO">
                    <input style={inp} type="date" value={data.ven_dtdemissao || ''} onChange={e => set('ven_dtdemissao', e.target.value)} onKeyDown={onEnterTab} />
                  </Field>
                  <Field lbl="STATUS">
                    <select style={{ ...inp, appearance: 'none' }} value={data.ven_status || 'A'} onChange={e => set('ven_status', e.target.value)}>
                      <option value="A">Ativo</option>
                      <option value="I">Inativo</option>
                    </select>
                  </Field>
                  <Field lbl="CUMPRE METAS">
                    <select style={{ ...inp, appearance: 'none' }} value={data.ven_cumpremetas || 'S'} onChange={e => set('ven_cumpremetas', e.target.value)}>
                      <option value="S">SIM</option>
                      <option value="N">NÃO</option>
                    </select>
                  </Field>
                </div>
                <Field lbl="OBSERVAÇÕES">
                  <textarea
                    style={{ ...inp, resize: 'vertical', minHeight: 80 } as any}
                    value={data.ven_obs || ''}
                    onChange={e => set('ven_obs', e.target.value)}
                    placeholder="Observações..."
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── INDÚSTRIAS ─────────────────────────────────────────────────── */}
          {tab === 'INDÚSTRIAS' && (
            <div style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>Indústrias que Atende</div>
                  <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{industries.length} indústria{industries.length !== 1 ? 's' : ''} vinculada{industries.length !== 1 ? 's' : ''}</div>
                </div>
                <button
                  onClick={() => setIndModal({ open: true, editing: {} })}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: G.text, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  <Plus size={13} /> Vincular Indústria
                </button>
              </div>
              {industries.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 40, border: `1px solid ${G.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: G.textMuted }}>Nenhuma indústria vinculada.</div>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${G.border}`, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: G.card, borderBottom: `1px solid ${G.border}` }}>
                        {['Indústria','% Comissão','Ações'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 800, color: G.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {industries.map((ind, i) => (
                        <tr key={ind.vin_industria} style={{ borderBottom: i < industries.length - 1 ? `1px solid ${G.border}` : 'none' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: G.text }}>{ind.for_nomered}</div>
                            {ind.for_nome !== ind.for_nomered && <div style={{ fontSize: 11, color: G.textMuted }}>{ind.for_nome}</div>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 700, color: ind.vin_percom > 0 ? G.success : G.textMuted }}>
                              {ind.vin_percom > 0 ? `${Number(ind.vin_percom).toFixed(2)}%` : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setIndModal({ open: true, editing: { ...ind } })} style={actionBtn}><Pencil size={12} /></button>
                              <button onClick={() => deleteIndustry(ind.vin_industria)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── REGIÕES ───────────────────────────────────────────────────── */}
          {tab === 'REGIÕES' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>Regiões Atendidas</div>
                  <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{regions.length} região{regions.length !== 1 ? 'ões' : ''}</div>
                </div>
                <button
                  onClick={() => setRegModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: G.text, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  <Plus size={13} /> Vincular Região
                </button>
              </div>
              {regions.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 40, border: `1px solid ${G.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: G.textMuted }}>Nenhuma região vinculada.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {regions.map(r => (
                    <div key={r.vin_regiao} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: G.text }}>{r.reg_nome}</span>
                      <button onClick={() => deleteRegion(r.vin_regiao)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── METAS ─────────────────────────────────────────────────────── */}
          {tab === 'METAS' && (
            <div style={{ maxWidth: 1100 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>Lançamento de Metas</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => setAnoFilter(a => a - 1)} style={{ ...actionBtn, borderRadius: 6 }}>◀</button>
                    <span style={{ fontWeight: 800, fontSize: 14, color: G.text, minWidth: 50, textAlign: 'center' }}>{anoFilter}</span>
                    <button onClick={() => setAnoFilter(a => a + 1)} style={{ ...actionBtn, borderRadius: 6 }}>▶</button>
                  </div>
                </div>
                <button
                  onClick={() => setMetaModal({ open: true, editing: { ...emptyMeta, met_ano: anoFilter } })}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: G.text, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  <Plus size={13} /> Nova Meta
                </button>
              </div>

              {metas.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 40, border: `1px solid ${G.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: G.textMuted }}>Nenhuma meta lançada para {anoFilter}.</div>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${G.border}`, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: G.card, borderBottom: `1px solid ${G.border}` }}>
                        <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 800, color: G.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>Indústria</th>
                        {MONTHS_LABELS.map(m => (
                          <th key={m} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 800, color: G.textMuted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.8 }}>{m}</th>
                        ))}
                        <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 800, color: G.textMuted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total</th>
                        <th style={{ padding: '10px 14px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {metas.map((m, i) => {
                        const total = MONTHS_KEYS.reduce((s, k) => s + (m[`met_${k}` as keyof Meta] as number || 0), 0);
                        return (
                          <tr key={m.met_id} style={{ borderBottom: i < metas.length - 1 ? `1px solid ${G.border}` : 'none' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 800, fontSize: 13, color: G.text, whiteSpace: 'nowrap' }}>{m.industria_nome || `#${m.met_industria}`}</td>
                            {MONTHS_KEYS.map(k => (
                              <td key={k} style={{ padding: '10px 8px', textAlign: 'right', fontSize: 11, color: G.textSec }}>
                                {Number(m[`met_${k}` as keyof Meta] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                            ))}
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: 12, color: G.success }}>{fmtBRL(total)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setMetaModal({ open: true, editing: { ...m } })} style={actionBtn}><Pencil size={12} /></button>
                                <button onClick={() => deleteMeta(m.met_id)} style={{ ...actionBtn, color: G.danger }}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Indústria ────────────────────────────────────────────────── */}
      {indModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,55,74,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setIndModal({ open: false, editing: {} }); }}>
          <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(40,55,74,0.35)' }}>
            <div style={{ padding: '16px 24px', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
                {indModal.editing.vin_industria ? 'Editar Comissão' : 'Vincular Indústria'}
              </div>
              <button onClick={() => setIndModal({ open: false, editing: {} })} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span style={label}>INDÚSTRIA *</span>
                <select style={{ ...inp, appearance: 'none' }}
                  value={indModal.editing.vin_industria || ''}
                  disabled={!!indModal.editing.vin_industria}
                  onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, vin_industria: parseInt(e.target.value) } }))}>
                  <option value="">Selecione...</option>
                  {allInds.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <span style={label}>% COMISSÃO</span>
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" min={0}
                  value={indModal.editing.vin_percom ?? 0}
                  onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, vin_percom: parseFloat(e.target.value) || 0 } }))}
                  onKeyDown={onEnterTab} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setIndModal({ open: false, editing: {} })} style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${G.border}`, background: 'transparent', fontWeight: 700, fontSize: 12, color: G.textSec, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveIndustry} disabled={savingInd || !indModal.editing.vin_industria}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: G.success, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: !indModal.editing.vin_industria ? 0.5 : 1 }}>
                {savingInd ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Região ───────────────────────────────────────────────────── */}
      {regModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,55,74,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setRegModal(false); }}>
          <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(40,55,74,0.35)' }}>
            <div style={{ padding: '16px 24px', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>Vincular Região</div>
              <button onClick={() => setRegModal(false)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <span style={label}>REGIÃO *</span>
              <select style={{ ...inp, appearance: 'none' }} value={regSel} onChange={e => setRegSel(parseInt(e.target.value))}>
                <option value={0}>Selecione...</option>
                {allRegioes
                  .filter(r => !regions.find(rv => rv.vin_regiao === r.reg_codigo))
                  .map(r => <option key={r.reg_codigo} value={r.reg_codigo}>{r.reg_nome}</option>)}
              </select>
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setRegModal(false)} style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${G.border}`, background: 'transparent', fontWeight: 700, fontSize: 12, color: G.textSec, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={addRegion} disabled={!regSel}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: G.success, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: !regSel ? 0.5 : 1 }}>
                <Save size={13} /> Vincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Meta ─────────────────────────────────────────────────────── */}
      {metaModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(40,55,74,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setMetaModal({ open: false, editing: emptyMeta }); }}>
          <div style={{ width: '100%', maxWidth: 700, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(40,55,74,0.35)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
                {metaModal.editing.met_id ? 'Editar Meta' : 'Nova Meta'}
              </div>
              <button onClick={() => setMetaModal({ open: false, editing: emptyMeta })} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <div>
                  <span style={label}>ANO *</span>
                  <input style={inp} type="number" value={metaModal.editing.met_ano || ''} onKeyDown={onEnterTab}
                    disabled={!!metaModal.editing.met_id}
                    onChange={e => setMetaModal(prev => ({ ...prev, editing: { ...prev.editing, met_ano: parseInt(e.target.value) } }))} />
                </div>
                <div>
                  <span style={label}>INDÚSTRIA *</span>
                  <select style={{ ...inp, appearance: 'none' }}
                    value={metaModal.editing.met_industria || ''}
                    disabled={!!metaModal.editing.met_id}
                    onChange={e => setMetaModal(prev => ({ ...prev, editing: { ...prev.editing, met_industria: parseInt(e.target.value) } }))}>
                    <option value="">Selecione...</option>
                    {industries.map(ind => <option key={ind.vin_industria} value={ind.vin_industria}>{ind.for_nomered}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Metas Mensais (R$)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                  {MONTHS_KEYS.map((k, i) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textAlign: 'center', marginBottom: 4 }}>{MONTHS_LABELS[i]}</div>
                      <input
                        style={{ ...inp, textAlign: 'right', padding: '6px 6px' }}
                        type="number" step="100" min={0}
                        value={(metaModal.editing[`met_${k}` as keyof Meta] as number) ?? 0}
                        onKeyDown={onEnterTab}
                        onChange={e => setMetaModal(prev => ({ ...prev, editing: { ...prev.editing, [`met_${k}`]: parseFloat(e.target.value) || 0 } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setMetaModal({ open: false, editing: emptyMeta })} style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${G.border}`, background: 'transparent', fontWeight: 700, fontSize: 12, color: G.textSec, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveMeta} disabled={savingMeta || !metaModal.editing.met_industria}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: G.success, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: !metaModal.editing.met_industria ? 0.5 : 1 }}>
                {savingMeta ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
