import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, User,
  MapPin, AlertTriangle,
  Phone, Search, Copy, Plus, Pencil, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppSidebar } from '@/shared/components/layout/AppSidebar';
import { G, inp, label } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

// Converte dd/MM/yyyy ou timestamp para yyyy-MM-dd (formato do input type="date")
const toISODate = (v?: string) => {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.substring(0, 10);
  const [d, m, y] = v.split('/');
  return (d && m && y) ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Cliente {
  cli_codigo: number;
  cli_cnpj: string;
  cli_inscricao: string;
  cli_tipopes: string;
  cli_nome: string;
  cli_nomred: string;
  cli_fantasia: string;
  cli_redeloja: string;
  cli_dtabertura: string;
  // endereço
  cli_cep: string;
  cli_endereco: string;
  cli_endnum: string;
  cli_complemento: string;
  cli_bairro: string;
  cli_cidade: string;
  cli_uf: string;
  cli_idcidade: number;
  // contato
  cli_email: string;
  cli_fone1: string;
  cli_fone2: string;
  cli_fone3: string;
  cli_emailnfe: string;
  cli_emailfinanc: string;
  cli_suframa: string;
  // cobrança
  cli_cepcob: string;
  cli_endcob: string;
  cli_baicob: string;
  cli_cidcob: string;
  cli_ufcob: string;
  // distribuição
  cli_vendedor: number;
  cli_vendedor_id: number;
  cli_regiao_id: number;
  cli_atividade: string;
  cli_setor_id: number | null;
  cli_obspedido: string;
  cli_latitude: string;
  cli_longitude: string;
  // whatsapp (fone3 usado como whatsapp business)
}

interface Seller { value: number; label: string; }
interface Regiao  { reg_codigo: number; reg_nome: string; }
interface Setor   { set_codigo: number; set_nome: string; cid_nome?: string; }

interface Contato {
  ani_lancto: number;
  ani_cliente: number;
  ani_nome: string;
  ani_funcao: string;
  ani_fone: string;
  ani_email: string;
  ani_diaaniv: number | null;
  ani_mes: number | null;
  ani_timequetorce: string;
  ani_esportepreferido: string;
  ani_hobby: string;
  ani_obs: string;
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const emptyContato: Partial<Contato> = {};

interface CliInd {
  cli_lancamento: number;
  cli_codigo: number;
  cli_forcodigo: number;
  industria_nome: string;
  transportadora_nome: string;
  cli_transportadora: number | null;
  cli_prazopg: string;
  cli_tabela: string;
  cli_codcliind: string;
  cli_frete: string;
  cli_comprador: string;
  cli_emailcomprador: string;
  cli_obsparticular: string;
  cli_desc1: number; cli_desc2: number; cli_desc3: number;
  cli_desc4: number; cli_desc5: number; cli_desc6: number;
  cli_desc7: number; cli_desc8: number; cli_desc9: number;
  cli_desc10: number; cli_desc11: number;
}

const emptyCliInd: Partial<CliInd> = {
  cli_desc1:0, cli_desc2:0, cli_desc3:0, cli_desc4:0, cli_desc5:0,
  cli_desc6:0, cli_desc7:0, cli_desc8:0, cli_desc9:0, cli_desc10:0, cli_desc11:0,
};

const FRETES = ['CIF','FOB','CIF+IPI','FOB+IPI','CIF+IPI+ST','FOB+IPI+ST'];

interface CliDescpro {
  cli_codigo: number;
  cli_forcodigo: number;
  cli_grupo: number;
  industria_nome: string;
  grupo_nome: string;
  cli_desc1: number; cli_desc2: number; cli_desc3: number;
  cli_desc4: number; cli_desc5: number; cli_desc6: number;
  cli_desc7: number; cli_desc8: number; cli_desc9: number;
}

const emptyDescpro: Partial<CliDescpro> = {
  cli_desc1:0, cli_desc2:0, cli_desc3:0, cli_desc4:0, cli_desc5:0,
  cli_desc6:0, cli_desc7:0, cli_desc8:0, cli_desc9:0,
};

const TABS = ['GERAL', 'CONTATOS', 'INDÚSTRIAS', 'DESCONTOS', 'PROSPECÇÃO', 'ÁREAS'] as const;
type Tab = typeof TABS[number];

const empty: Partial<Cliente> = { cli_tipopes: 'A' };

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const section: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: '24px 28px',
  marginBottom: 20,
  border: `1px solid ${G.border}`,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: G.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const row: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  marginBottom: 16,
};

function Field({ label: lbl, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <span style={label}>{lbl}</span>
      {children}
    </div>
  );
}

// ─── CidadeCombobox ───────────────────────────────────────────────────────────
interface Cidade { cid_codigo: number; cid_nome: string; cid_uf: string; }

function CidadeCombobox({
  value, onChange,
}: {
  value: string;
  onChange: (cidade: Cidade) => void;
}) {
  const [query,   setQuery]   = useState(value);
  const [options, setOptions] = useState<Cidade[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open || query.length < 2) { setOptions([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get(`/cidades?search=${encodeURIComponent(query)}&limit=10`);
        setOptions(r.data.data || []);
      } finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c: Cidade) => {
    setQuery(c.cid_nome);
    setOpen(false);
    onChange(c);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        style={inp}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Digite para buscar..."
        autoComplete="off"
      />
      {loading && (
        <Loader2 size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, animation: 'spin 1s linear infinite' }} />
      )}
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: `1px solid ${G.border}`, borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2, overflow: 'hidden',
        }}>
          {options.map(c => (
            <button
              key={c.cid_codigo}
              onMouseDown={() => select(c)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12, color: G.text,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = G.cardHi)}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 600 }}>{c.cid_nome}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, background: G.bg, padding: '2px 6px', borderRadius: 4 }}>{c.cid_uf}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FichaClientePage({ overrideId, onClose }: { overrideId?: string; onClose?: () => void }) {
  const params     = useParams<{ id: string }>();
  const id         = overrideId || params.id;
  const navigate     = useNavigate();
  const isNew        = id === 'novo';
  const close        = onClose ?? (() => navigate('/clientes'));

  const [data, setData]       = useState<Partial<Cliente>>(empty);
  const [tab, setTab]         = useState<Tab>('GERAL');
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [contacts, setContacts] = useState<Contato[]>([]);
  const [contactModal, setContactModal] = useState<{ open: boolean; editing: Partial<Contato> }>({ open: false, editing: emptyContato });
  const [savingContact, setSavingContact] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [loadingCEP, setLoadingCEP]   = useState(false);
  const cnpjLookupRef = useRef(false);
  const [industries, setIndustries]   = useState<CliInd[]>([]);
  const [allIndustrias, setAllIndustrias] = useState<{value:number;label:string}[]>([]);
  const [carriers, setCarriers]       = useState<{value:number;label:string}[]>([]);
  const [priceTables, setPriceTables] = useState<{value:string;label:string}[]>([]);
  const [indModal, setIndModal]       = useState<{open:boolean;editing:Partial<CliInd>}>({ open:false, editing:emptyCliInd });
  const [savingInd, setSavingInd]     = useState(false);
  const [discounts, setDiscounts]     = useState<CliDescpro[]>([]);
  const [grupos, setGrupos]           = useState<{value:number;label:string}[]>([]);
  const [discModal, setDiscModal]     = useState<{open:boolean;editing:Partial<CliDescpro>}>({ open:false, editing:emptyDescpro });
  const [savingDisc, setSavingDisc]   = useState(false);

  // Carregar dados do cliente
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api.get(`/clients/${id}`)
      .then(r => {
        const d = r.data.data || {};
        setData({ ...d, cli_dtabertura: toISODate(d.cli_dtabertura) });
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, isNew, navigate]);

  // Auxiliares
  useEffect(() => {
    api.get('/aux/vendedores').then(r => setSellers(r.data.data || [])).catch(() => {});
    api.get('/aux/regioes').then(r => setRegioes(r.data.data || [])).catch(() => {});
    api.get('/setores?limit=200').then(r => setSetores(r.data.data || [])).catch(() => {});
  }, []);

  const loadContacts = useCallback(() => {
    if (isNew) return;
    api.get(`/clients/${id}/contacts`).then(r => setContacts(r.data.data || [])).catch(() => {});
  }, [id, isNew]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const saveContact = async () => {
    const c = contactModal.editing;
    if (!c.ani_nome?.trim()) return;
    setSavingContact(true);
    try {
      if (c.ani_lancto) {
        await api.put(`/clients/${id}/contacts/${c.ani_lancto}`, c);
      } else {
        await api.post(`/clients/${id}/contacts`, c);
      }
      setContactModal({ open: false, editing: emptyContato });
      loadContacts();
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (lancto: number) => {
    if (!confirm('Remover este contato?')) return;
    await api.delete(`/clients/${id}/contacts/${lancto}`);
    loadContacts();
  };

  // ── Industries (cli_ind) ─────────────────────────────────────────────────────
  const loadIndustries = useCallback(() => {
    if (isNew) return;
    api.get(`/clients/${id}/industries`).then(r => setIndustries(r.data.data || [])).catch(() => {});
  }, [id, isNew]);

  useEffect(() => { loadIndustries(); }, [loadIndustries]);

  // load carriers + industrias once
  useEffect(() => {
    api.get('/aux/transportadoras').then(r => setCarriers(r.data.data || [])).catch(() => {});
    api.get('/aux/industrias').then(r => setAllIndustrias(r.data.data || [])).catch(() => {});
  }, []);

  const openIndModal = (ind?: CliInd) => {
    const editing = ind ? { ...ind } : { ...emptyCliInd };
    setIndModal({ open: true, editing });
    if (ind?.cli_forcodigo) loadPriceTables(ind.cli_forcodigo);
    else setPriceTables([]);
  };

  const loadPriceTables = (forCodigo: number) => {
    api.get(`/aux/price-tables/${forCodigo}`).then(r => setPriceTables(r.data.data || [])).catch(() => setPriceTables([]));
  };

  const saveIndustry = async () => {
    if (!indModal.editing.cli_forcodigo) return;
    setSavingInd(true);
    try {
      await api.post(`/clients/${id}/industries`, indModal.editing);
      setIndModal({ open: false, editing: emptyCliInd });
      loadIndustries();
    } finally {
      setSavingInd(false);
    }
  };

  const deleteIndustry = async (lancamento: number) => {
    if (!confirm('Remover condições desta indústria?')) return;
    await api.delete(`/clients/${id}/industries/${lancamento}`);
    loadIndustries();
  };

  // ── Discounts (cli_descpro) ──────────────────────────────────────────────────
  const loadDiscounts = useCallback(() => {
    if (isNew) return;
    api.get(`/clients/${id}/discounts`).then(r => setDiscounts(r.data.data || [])).catch(() => {});
  }, [id, isNew]);

  useEffect(() => { loadDiscounts(); }, [loadDiscounts]);

  const openDiscModal = (disc?: CliDescpro) => {
    setDiscModal({ open: true, editing: disc ? { ...disc } : { ...emptyDescpro } });
    if (disc?.cli_forcodigo) loadGrupos(disc.cli_forcodigo);
    else setGrupos([]);
  };

  const loadGrupos = (forCodigo: number) => {
    api.get(`/aux/grupos/${forCodigo}`).then(r => setGrupos(r.data.data || [])).catch(() => setGrupos([]));
  };

  const saveDiscount = async () => {
    const d = discModal.editing;
    if (!d.cli_forcodigo || !d.cli_grupo) return;
    setSavingDisc(true);
    try {
      await api.post(`/clients/${id}/discounts`, d);
      setDiscModal({ open: false, editing: emptyDescpro });
      loadDiscounts();
    } finally {
      setSavingDisc(false);
    }
  };

  const deleteDiscount = async (industryId: number, groupId: number) => {
    if (!confirm('Remover este desconto?')) return;
    await api.delete(`/clients/${id}/discounts/${industryId}/${groupId}`);
    loadDiscounts();
  };

  // Busca cid_codigo pelo nome da cidade e atualiza idcidade + regiao automaticamente
  const resolveCity = async (nomeCidade: string, uf: string) => {
    if (!nomeCidade) return;
    try {
      const r = await api.get(`/cidades?search=${encodeURIComponent(nomeCidade)}&limit=5`);
      const cidades: any[] = r.data.data || [];
      const match = cidades.find(c =>
        c.cid_nome.toLowerCase() === nomeCidade.toLowerCase() &&
        (!uf || c.cid_uf?.toLowerCase() === uf.toLowerCase())
      ) || cidades[0];
      if (!match) return;
      setData(prev => ({ ...prev, cli_idcidade: match.cid_codigo }));
      const rr = await api.get(`/aux/regiao-by-cidade/${match.cid_codigo}`);
      if (rr.data.data?.reg_codigo) {
        setData(prev => ({ ...prev, cli_regiao_id: rr.data.data.reg_codigo }));
      }
    } catch {}
  };

  const lookupCNPJ = async () => {
    if (cnpjLookupRef.current) return;
    const raw = (data.cli_cnpj || '').replace(/\D/g, '');
    if (raw.length !== 14) return;
    cnpjLookupRef.current = true;
    setLoadingCNPJ(true);
    try {
      const res = await api.get(`/aux/cnpj/${raw}`);
      if (!res.data.success) throw new Error(res.data.message || 'CNPJ não encontrado');
      const d = res.data.data;
      const fmtCep = (v?: string) => { const c = (v || '').replace(/\D/g, ''); return c.length === 8 ? `${c.slice(0,5)}-${c.slice(5)}` : v || ''; };
      const fmtCnpj = (v?: string) => { const c = (v || '').replace(/\D/g, ''); return c.length === 14 ? `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}` : v || ''; };
      setData(prev => ({
        ...prev,
        cli_cnpj:        fmtCnpj(d.cnpj)                                       || prev.cli_cnpj,
        cli_nome:        d.razao_social                                          || prev.cli_nome,
        cli_fantasia:    d.nome_fantasia                                         || prev.cli_fantasia,
        cli_nomred:      prev.cli_nomred || (d.nome_fantasia || d.razao_social || '').substring(0, 30),
        cli_endereco:    d.logradouro                                            || prev.cli_endereco,
        cli_endnum:      d.numero                                                || prev.cli_endnum,
        cli_complemento: d.complemento                                           || prev.cli_complemento,
        cli_bairro:      d.bairro                                                || prev.cli_bairro,
        cli_cidade:      d.municipio                                             || prev.cli_cidade,
        cli_uf:          d.uf                                                    || prev.cli_uf,
        cli_cep:         fmtCep(d.cep)                                          || prev.cli_cep,
        cli_email:       d.email                                                 || prev.cli_email,
        cli_dtabertura:  toISODate(d.data_inicio_atividade)                     || prev.cli_dtabertura,
      }));
      // Resolve cidade → idcidade + região
      await resolveCity(d.municipio || '', d.uf || '');
    } catch (e: any) {
      toast.error(e.message || 'CNPJ não encontrado na Receita Federal.');
    } finally {
      setLoadingCNPJ(false);
      cnpjLookupRef.current = false;
    }
  };

  const lookupCEP = async (cepValue?: string) => {
    const raw = (cepValue ?? data.cli_cep ?? '').replace(/\D/g, '');
    if (raw.length !== 8) return;
    setLoadingCEP(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await res.json();
      if (d.erro) throw new Error('CEP não encontrado');
      setData(prev => ({
        ...prev,
        cli_cep:      d.cep        || prev.cli_cep,
        cli_endereco: d.logradouro || prev.cli_endereco,
        cli_bairro:   d.bairro     || prev.cli_bairro,
        cli_cidade:   d.localidade || prev.cli_cidade,
        cli_uf:       d.uf         || prev.cli_uf,
      }));
      // Resolve cidade → idcidade + região
      await resolveCity(d.localidade || '', d.uf || '');
    } catch {
      alert('CEP não encontrado.');
    } finally {
      setLoadingCEP(false);
    }
  };

  const set = useCallback((field: keyof Cliente, value: any) =>
    setData(prev => ({ ...prev, [field]: value })), []);

  const save = async () => {
    if (!data.cli_nome) return;
    setSaving(true);
    try {
      if (isNew) {
        const r = await api.post('/clients', data);
        toast.success('Cliente cadastrado com sucesso!');
        if (onClose) { onClose(); return; }
        navigate(`/clientes/${r.data.id}`, { replace: true });
      } else {
        await api.put(`/clients/${id}`, data);
        toast.success('Cliente atualizado com sucesso!');
        close();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar cliente. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const copiarEnderecoCobranca = () => {
    setData(prev => ({
      ...prev,
      cli_cepcob:  prev.cli_cep,
      cli_endcob:  prev.cli_endereco,
      cli_baicob:  prev.cli_bairro,
      cli_cidcob:  prev.cli_cidade,
      cli_ufcob:   prev.cli_uf,
    }));
  };

  const isAtivo = data.cli_tipopes === 'A';
  const displayName = data.cli_nomred || data.cli_nome || '—';

  return (
    <div style={{ display: 'flex', minHeight: onClose ? '0' : '100vh', flex: onClose ? 1 : undefined, background: G.bg }}>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{
          background: G.text, color: '#fff',
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 2px 8px #0003',
          flexShrink: 0,
        }}>
          <button
            onClick={() => close()}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8, padding: 4 }}
          >
            <ArrowLeft size={16} />
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}>Ficha do Cliente</span>
              {!isNew && (
                <span style={{
                  fontSize: 11, fontWeight: 700, background: G.mustard,
                  color: G.text, padding: '2px 8px', borderRadius: 6,
                }}>
                  ID: {String(data.cli_codigo || '').padStart(5, '0')}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{displayName}</div>
          </div>

          <button
            onClick={() => close()}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '9px 20px',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>

          <button
            onClick={save}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: G.mustard, color: G.text,
              border: 'none', borderRadius: 10, padding: '9px 20px',
              fontWeight: 800, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderBottom: `1px solid ${G.border}`,
          display: 'flex',
          padding: '0 24px',
          flexShrink: 0,
        }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '14px 20px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: tab === t ? G.text : G.textMuted,
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === t ? G.mustard : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={28} style={{ color: G.textMuted, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : loadError ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <AlertTriangle size={32} style={{ color: G.danger }} />
            <span style={{ fontSize: 14, color: G.textMuted }}>Não foi possível carregar os dados do cliente.</span>
            <button onClick={close} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: G.navy, color: '#fff', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
            {tab === 'GERAL' && (
              <div style={{ maxWidth: 860 }}>
                  {/* I - IDENTIFICAÇÃO COMERCIAL */}
                  <div style={section}>
                    <div style={sectionTitle}>
                      <span style={{ color: G.success }}>✓</span>
                      I — IDENTIFICAÇÃO COMERCIAL
                    </div>

                    {/* Linha 1 — CNPJ e Inscrição em destaque */}
                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
                      <Field label="CNPJ / CPF">
                        <div style={{ position: 'relative' }}>
                          <input
                            style={{ ...inp, paddingRight: 34, fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}
                            value={data.cli_cnpj || ''}
                            onChange={e => set('cli_cnpj', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && lookupCNPJ()}
                            placeholder="00.000.000/0000-00"
                          />
                          <button
                            onClick={lookupCNPJ}
                            disabled={loadingCNPJ}
                            title="Consultar Receita Federal"
                            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: G.textMuted, display: 'flex', alignItems: 'center' }}
                          >
                            {loadingCNPJ ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                          </button>
                        </div>
                      </Field>
                      <Field label="INSCRIÇÃO ESTADUAL">
                        <input style={{ ...inp, fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }} value={data.cli_inscricao || ''} onChange={e => set('cli_inscricao', e.target.value)} />
                      </Field>
                    </div>

                    {/* Linha 2 — Razão Social */}
                    <div style={{ ...row, gridTemplateColumns: '1fr', marginBottom: 16 }}>
                      <Field label="RAZÃO SOCIAL">
                        <input style={inp} value={data.cli_nome || ''} onChange={e => set('cli_nome', e.target.value)} />
                      </Field>
                    </div>

                    {/* Linha 3 — Nome Fantasia */}
                    <div style={{ ...row, gridTemplateColumns: '1fr', marginBottom: 16 }}>
                      <Field label="NOME FANTASIA">
                        <input style={inp} value={data.cli_fantasia || ''} onChange={e => set('cli_fantasia', e.target.value)} />
                      </Field>
                    </div>

                    {/* Linha 4 — Nome Reduzido e Rede */}
                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
                      <Field label="NOME REDUZIDO (ERP)">
                        <input
                          style={{ ...inp, color: '#C0392B', fontWeight: 800 }}
                          value={data.cli_nomred || ''}
                          onChange={e => set('cli_nomred', e.target.value)}
                        />
                      </Field>
                      <Field label="REDE DE LOJAS / HOLDING">
                        <input
                          style={{ ...inp, color: '#2980B9', fontWeight: 700 }}
                          value={data.cli_redeloja || ''}
                          onChange={e => set('cli_redeloja', e.target.value)}
                        />
                      </Field>
                    </div>

                    {/* Linha 5 — Status e Data de Abertura */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                      <Field label="STATUS">
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: G.card, border: `1px solid ${G.border}`,
                          borderRadius: 10, padding: '8px 16px',
                          cursor: 'pointer', userSelect: 'none', width: 'fit-content',
                        }}
                          onClick={() => set('cli_tipopes', isAtivo ? 'I' : 'A')}
                        >
                          <div style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: isAtivo ? G.success : G.border,
                            position: 'relative', transition: 'background .2s',
                          }}>
                            <div style={{
                              position: 'absolute', top: 2,
                              left: isAtivo ? 18 : 2,
                              width: 16, height: 16, borderRadius: '50%',
                              background: '#fff', transition: 'left .2s',
                              boxShadow: '0 1px 3px #0003',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isAtivo ? G.success : G.textMuted }}>
                            {isAtivo ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </div>
                      </Field>
                      <Field label="DATA DE ABERTURA">
                        <input style={{ ...inp, width: 180 }} type="date" value={(data.cli_dtabertura || '').substring(0, 10)} onChange={e => set('cli_dtabertura', e.target.value)} />
                      </Field>
                    </div>
                  </div>

                  {/* II - LOCALIZAÇÃO E LOGÍSTICA */}
                  <div style={section}>
                    <div style={sectionTitle}>
                      <MapPin size={13} style={{ color: G.textMuted }} />
                      II — LOCALIZAÇÃO E LOGÍSTICA
                    </div>

                    {/* Linha 1 — CEP + Endereço + Nº */}
                    <div style={{ ...row, gridTemplateColumns: '150px 1fr 80px', marginBottom: 16 }}>
                      <Field label="CEP">
                        <div style={{ position: 'relative' }}>
                          <input
                            style={{ ...inp, paddingRight: 34 }}
                            value={data.cli_cep || ''}
                            onChange={e => set('cli_cep', e.target.value)}
                            onBlur={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length === 8) lookupCEP(v); }}
                            onKeyDown={e => e.key === 'Enter' && lookupCEP()}
                            placeholder="00000-000"
                          />
                          <button
                            onClick={() => lookupCEP()}
                            disabled={loadingCEP}
                            title="Buscar endereço pelo CEP"
                            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: G.textMuted, display: 'flex', alignItems: 'center' }}
                          >
                            {loadingCEP ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                          </button>
                        </div>
                      </Field>
                      <Field label="ENDEREÇO">
                        <input style={inp} value={data.cli_endereco || ''} onChange={e => set('cli_endereco', e.target.value)} />
                      </Field>
                      <Field label="Nº">
                        <input style={inp} value={data.cli_endnum || ''} onChange={e => set('cli_endnum', e.target.value)} />
                      </Field>
                    </div>

                    {/* Linha 2 — Cidade + Bairro + UF + Complemento */}
                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr 72px 180px', marginBottom: 16 }}>
                      <Field label="CIDADE">
                        <CidadeCombobox
                          value={data.cli_cidade || ''}
                          onChange={async c => {
                            setData(prev => ({
                              ...prev,
                              cli_cidade:   c.cid_nome,
                              cli_uf:       c.cid_uf,
                              cli_idcidade: c.cid_codigo,
                            }));
                            try {
                              const r = await api.get(`/aux/regiao-by-cidade/${c.cid_codigo}`);
                              if (r.data.data?.reg_codigo) {
                                setData(prev => ({ ...prev, cli_regiao_id: r.data.data.reg_codigo }));
                              }
                            } catch {}
                          }}
                        />
                      </Field>
                      <Field label="BAIRRO">
                        <input style={inp} value={data.cli_bairro || ''} onChange={e => set('cli_bairro', e.target.value)} />
                      </Field>
                      <Field label="UF">
                        <input style={{ ...inp, textTransform: 'uppercase' }} maxLength={2}
                          value={data.cli_uf || ''} onChange={e => set('cli_uf', e.target.value.toUpperCase())} />
                      </Field>
                      <Field label="COMPLEMENTO">
                        <input style={inp} value={data.cli_complemento || ''} onChange={e => set('cli_complemento', e.target.value)} placeholder="Apto, Sala, etc." />
                      </Field>
                    </div>

                    {/* Linha 3 — Telefones + Suframa */}
                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr 200px', marginBottom: 16 }}>
                      <Field label="TELEFONE 1">
                        <div style={{ position: 'relative' }}>
                          <input style={{ ...inp, paddingLeft: 30 }} value={data.cli_fone1 || ''} onChange={e => set('cli_fone1', e.target.value)} placeholder="(00) 00000-0000" />
                          <Phone size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
                        </div>
                      </Field>
                      <Field label="TELEFONE 2">
                        <div style={{ position: 'relative' }}>
                          <input style={{ ...inp, paddingLeft: 30 }} value={data.cli_fone2 || ''} onChange={e => set('cli_fone2', e.target.value)} placeholder="(00) 00000-0000" />
                          <Phone size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
                        </div>
                      </Field>
                      <Field label="SUFRAMA">
                        <input style={inp} value={data.cli_suframa || ''} onChange={e => set('cli_suframa', e.target.value)} placeholder="Inscrição Suframa" />
                      </Field>
                    </div>

                    {/* Linha 4 — E-mail principal (full width) */}
                    <div style={{ ...row, gridTemplateColumns: '1fr', marginBottom: 16 }}>
                      <Field label="E-MAIL PRINCIPAL">
                        <input style={inp} type="email" value={data.cli_email || ''} onChange={e => set('cli_email', e.target.value)} placeholder="contato@empresa.com.br" />
                      </Field>
                    </div>

                    {/* Linha 5 — E-mail NF-e + E-mail Financeiro */}
                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
                      <Field label="E-MAIL PARA NF-e">
                        <input style={inp} type="email" value={data.cli_emailnfe || ''} onChange={e => set('cli_emailnfe', e.target.value)} placeholder="nfe@empresa.com.br" />
                      </Field>
                      <Field label="E-MAIL PARA FINANCEIRO">
                        <input style={inp} type="email" value={data.cli_emailfinanc || ''} onChange={e => set('cli_emailfinanc', e.target.value)} placeholder="financeiro@empresa.com.br" />
                      </Field>
                    </div>
                  </div>

                  {/* III - DADOS PARA COBRANÇA */}
                  <div style={section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={sectionTitle}>
                        <span style={{ fontSize: 14 }}>💳</span>
                        III — DADOS PARA COBRANÇA
                      </div>
                      <button
                        onClick={copiarEnderecoCobranca}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 11, fontWeight: 700, color: G.textSec,
                          background: 'none', border: `1px solid ${G.border}`,
                          borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                        }}
                      >
                        <Copy size={11} /> COPIAR ENDEREÇO PRINCIPAL
                      </button>
                    </div>

                    <div style={{ ...row, gridTemplateColumns: '120px 1fr', marginBottom: 16 }}>
                      <Field label="CEP COBRANÇA">
                        <input style={inp} value={data.cli_cepcob || ''} onChange={e => set('cli_cepcob', e.target.value)} placeholder="00000-000" />
                      </Field>
                      <Field label="ENDEREÇO DE COBRANÇA">
                        <input style={inp} value={data.cli_endcob || ''} onChange={e => set('cli_endcob', e.target.value)} placeholder="Rua, Avenida, etc." />
                      </Field>
                    </div>

                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr 80px' }}>
                      <Field label="CIDADE COBRANÇA">
                        <input style={inp} value={data.cli_cidcob || ''} onChange={e => set('cli_cidcob', e.target.value)} />
                      </Field>
                      <Field label="BAIRRO COBRANÇA">
                        <input style={inp} value={data.cli_baicob || ''} onChange={e => set('cli_baicob', e.target.value)} />
                      </Field>
                      <Field label="UF COB.">
                        <input style={{ ...inp, textTransform: 'uppercase' }} maxLength={2}
                          value={data.cli_ufcob || ''} onChange={e => set('cli_ufcob', e.target.value.toUpperCase())} />
                      </Field>
                    </div>
                  </div>

                  {/* IV - DISTRIBUIÇÃO E LOCALIZAÇÃO */}
                  <div style={section}>
                    <div style={sectionTitle}>
                      <span style={{ fontSize: 14 }}>📦</span>
                      IV — DISTRIBUIÇÃO E LOCALIZAÇÃO
                    </div>

                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                      <Field label="VENDEDOR">
                        <select style={{ ...inp, appearance: 'none' }}
                          value={data.cli_vendedor_id || data.cli_vendedor || ''}
                          onChange={e => set('cli_vendedor_id', parseInt(e.target.value) || null)}>
                          <option value="">Selecione...</option>
                          {sellers.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </Field>
                      <Field label="REGIÃO">
                        <select style={{ ...inp, appearance: 'none' }}
                          value={data.cli_regiao_id || ''}
                          onChange={e => set('cli_regiao_id', parseInt(e.target.value) || null)}>
                          <option value="">Selecione...</option>
                          {regioes.map(r => <option key={r.reg_codigo} value={r.reg_codigo}>{r.reg_nome}</option>)}
                        </select>
                      </Field>
                      <Field label="SETOR / BAIRRO">
                        <select style={{ ...inp, appearance: 'none' }}
                          value={data.cli_setor_id || ''}
                          onChange={e => set('cli_setor_id', parseInt(e.target.value) || null)}>
                          <option value="">— Sem setor —</option>
                          {setores.map(s => (
                            <option key={s.set_codigo} value={s.set_codigo}>
                              {s.set_nome}{s.cid_nome ? ` (${s.cid_nome})` : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div style={{ ...row, gridTemplateColumns: '1fr', marginBottom: 16 }}>
                      <Field label="OBSERVAÇÃO NO PEDIDO">
                        <textarea
                          style={{ ...inp, resize: 'vertical', minHeight: 36 } as any}
                          value={data.cli_obspedido || ''}
                          onChange={e => set('cli_obspedido', e.target.value)}
                          placeholder="Instruções para o vendedor..."
                        />
                      </Field>
                    </div>

                    <div style={{ ...row, gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
                      <Field label="LATITUDE">
                        <input style={inp} value={data.cli_latitude || ''} onChange={e => set('cli_latitude', e.target.value)} />
                      </Field>
                      <Field label="LONGITUDE">
                        <input style={inp} value={data.cli_longitude || ''} onChange={e => set('cli_longitude', e.target.value)} />
                      </Field>
                    </div>

                    {/* Mapa placeholder */}
                    <div style={{
                      background: G.card, border: `1px solid ${G.border}`,
                      borderRadius: 10, height: 140,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 6, marginBottom: 12,
                      position: 'relative',
                    }}>
                      <MapPin size={24} style={{ color: G.border }} />
                      <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>
                        {data.cli_latitude && data.cli_longitude ? 'COORDENADAS DISPONÍVEIS' : 'COORDENADAS AUSENTES'}
                      </span>
                      <span style={{
                        position: 'absolute', bottom: 8, right: 8,
                        fontSize: 10, fontWeight: 800, color: '#fff',
                        background: G.success, padding: '3px 8px', borderRadius: 5,
                      }}>LIVE MAP</span>
                    </div>

                    <Field label="WHATSAPP BUSINESS">
                      <div style={{ position: 'relative' }}>
                        <input
                          style={{
                            ...inp,
                            borderColor: '#25D366',
                            color: '#25D366',
                            fontWeight: 700,
                            paddingLeft: 30,
                          }}
                          value={data.cli_fone3 || ''}
                          onChange={e => set('cli_fone3', e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                        <Phone size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#25D366' }} />
                      </div>
                    </Field>
                  </div>
              </div>
            )}

            {tab === 'CONTATOS' && (
              <div style={{ maxWidth: 900 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>Contatos & Aniversariantes</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{contacts.length} contato{contacts.length !== 1 ? 's' : ''} cadastrado{contacts.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => setContactModal({ open: true, editing: emptyContato })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: G.text, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '9px 18px',
                      fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} /> Novo Contato
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <div style={{
                    background: '#fff', borderRadius: 14, padding: 40,
                    border: `1px solid ${G.border}`, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 13, color: G.textMuted }}>Nenhum contato cadastrado.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contacts.map(c => (
                      <div key={c.ani_lancto} style={{
                        background: '#fff', borderRadius: 12, padding: '14px 18px',
                        border: `1px solid ${G.border}`,
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: G.card, border: `1px solid ${G.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <User size={18} style={{ color: G.textMuted }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: G.text }}>{c.ani_nome}</div>
                          <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>
                            {c.ani_funcao && <span style={{ marginRight: 12 }}>{c.ani_funcao}</span>}
                            {c.ani_fone && <span style={{ marginRight: 12 }}>📞 {c.ani_fone}</span>}
                            {c.ani_email && <span style={{ marginRight: 12 }}>✉️ {c.ani_email}</span>}
                            {c.ani_diaaniv && c.ani_mes && (
                              <span style={{
                                background: '#FFD20020', color: '#B8860B',
                                border: '1px solid #FFD70040', borderRadius: 4,
                                padding: '1px 6px', fontSize: 11, fontWeight: 700,
                              }}>
                                🎂 {String(c.ani_diaaniv).padStart(2,'0')}/{MESES[(c.ani_mes ?? 1) - 1]}
                              </span>
                            )}
                          </div>
                          {(c.ani_timequetorce || c.ani_esportepreferido || c.ani_hobby) && (
                            <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>
                              {c.ani_timequetorce && <span style={{ marginRight: 10 }}>⚽ {c.ani_timequetorce}</span>}
                              {c.ani_esportepreferido && <span style={{ marginRight: 10 }}>🏋️ {c.ani_esportepreferido}</span>}
                              {c.ani_hobby && <span>🎯 {c.ani_hobby}</span>}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => setContactModal({ open: true, editing: { ...c } })}
                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.textSec }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deleteContact(c.ani_lancto)}
                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.danger }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === 'INDÚSTRIAS' && (
              <div style={{ maxWidth: 1100 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: G.text }}>Indústrias & Condições Comerciais</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{industries.length} indústria{industries.length !== 1 ? 's' : ''} vinculada{industries.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => openIndModal()}
                    style={{ display:'flex', alignItems:'center', gap:7, background:G.text, color:'#fff', border:'none', borderRadius:10, padding:'9px 18px', fontWeight:800, fontSize:12, cursor:'pointer' }}
                  >
                    <Plus size={13} /> Nova Indústria
                  </button>
                </div>

                {industries.length === 0 ? (
                  <div style={{ background:'#fff', borderRadius:14, padding:40, border:`1px solid ${G.border}`, textAlign:'center' }}>
                    <div style={{ fontSize:13, color:G.textMuted }}>Nenhuma indústria vinculada a este cliente.</div>
                  </div>
                ) : (
                  <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${G.border}`, overflow:'hidden' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:G.card, borderBottom:`1px solid ${G.border}` }}>
                          {['Indústria','Tabela','Cond. Pagto','Frete','Descontos (1º-9º)','% add','Cód. Indústria','Ações'].map(h => (
                            <th key={h} style={{ padding:'10px 14px', fontSize:10, fontWeight:800, color:G.textMuted, textAlign:'left', textTransform:'uppercase', letterSpacing:0.8, whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {industries.map((ind, i) => (
                          <tr key={ind.cli_lancamento} style={{ borderBottom: i < industries.length-1 ? `1px solid ${G.border}` : 'none' }}>
                            <td style={{ padding:'12px 14px' }}>
                              <span style={{ fontWeight:800, fontSize:13, color:G.text }}>{ind.industria_nome || `#${ind.cli_forcodigo}`}</span>
                              {ind.transportadora_nome && <div style={{ fontSize:11, color:G.textMuted, marginTop:2 }}>🚚 {ind.transportadora_nome}</div>}
                            </td>
                            <td style={{ padding:'12px 14px', fontSize:12, color:G.textSec }}>{ind.cli_tabela || '—'}</td>
                            <td style={{ padding:'12px 14px', fontSize:12, color:G.textSec }}>{ind.cli_prazopg || '—'}</td>
                            <td style={{ padding:'12px 14px' }}>
                              {ind.cli_frete ? (
                                <span style={{ fontSize:11, fontWeight:700, background:G.card, border:`1px solid ${G.border}`, borderRadius:4, padding:'2px 7px', color:G.textSec }}>{ind.cli_frete}</span>
                              ) : '—'}
                            </td>
                            <td style={{ padding:'12px 14px', fontSize:11, color:G.text, fontFamily:'monospace', whiteSpace:'nowrap' }}>
                              {[ind.cli_desc1,ind.cli_desc2,ind.cli_desc3,ind.cli_desc4,ind.cli_desc5,ind.cli_desc6,ind.cli_desc7,ind.cli_desc8,ind.cli_desc9]
                                .filter(v => v > 0)
                                .map(v => `${v}%`)
                                .join(' / ') || '—'}
                            </td>
                            <td style={{ padding:'12px 14px', fontSize:12, color:G.textSec }}>
                              {ind.cli_desc10 > 0 ? `${ind.cli_desc10}%` : '—'}
                            </td>
                            <td style={{ padding:'12px 14px' }}>
                              {ind.cli_codcliind ? (
                                <span style={{ fontSize:12, fontWeight:700, background:'#FFF3CD', color:'#856404', border:'1px solid #FFD70040', borderRadius:4, padding:'2px 8px' }}>
                                  {ind.cli_codcliind}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding:'12px 14px' }}>
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => openIndModal(ind)} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${G.border}`, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:G.textSec }}>
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => deleteIndustry(ind.cli_lancamento)} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${G.border}`, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:G.danger }}>
                                  <Trash2 size={12} />
                                </button>
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
            {tab === 'DESCONTOS' && (
              <div style={{ maxWidth: 900 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:G.text }}>Descontos por Grupo de Produto</div>
                    <div style={{ fontSize:12, color:G.textMuted, marginTop:2 }}>{discounts.length} regra{discounts.length !== 1 ? 's' : ''} cadastrada{discounts.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => openDiscModal()}
                    style={{ display:'flex', alignItems:'center', gap:7, background:G.text, color:'#fff', border:'none', borderRadius:10, padding:'9px 18px', fontWeight:800, fontSize:12, cursor:'pointer' }}
                  >
                    <Plus size={13} /> Adicionar Desconto
                  </button>
                </div>

                {discounts.length === 0 ? (
                  <div style={{ background:'#fff', borderRadius:14, padding:40, border:`1px solid ${G.border}`, textAlign:'center' }}>
                    <div style={{ fontSize:13, color:G.textMuted }}>Nenhum desconto especial cadastrado para este cliente.</div>
                  </div>
                ) : (
                  <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${G.border}`, overflow:'hidden' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:G.card, borderBottom:`1px solid ${G.border}` }}>
                          {['Indústria','Grupo','1º','2º','3º','4º','5º','6º','7º','8º','9º','Ações'].map(h => (
                            <th key={h} style={{ padding:'10px 12px', fontSize:10, fontWeight:800, color:G.textMuted, textAlign: ['1º','2º','3º','4º','5º','6º','7º','8º','9º'].includes(h) ? 'center' : 'left', textTransform:'uppercase', letterSpacing:0.8 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {discounts.map((d, i) => (
                          <tr key={`${d.cli_forcodigo}-${d.cli_grupo}`} style={{ borderBottom: i < discounts.length-1 ? `1px solid ${G.border}` : 'none' }}>
                            <td style={{ padding:'10px 12px', fontWeight:700, fontSize:13, color:G.text }}>{d.industria_nome || `#${d.cli_forcodigo}`}</td>
                            <td style={{ padding:'10px 12px', fontSize:12, color:G.textSec }}>{d.grupo_nome || `#${d.cli_grupo}`}</td>
                            {([d.cli_desc1,d.cli_desc2,d.cli_desc3,d.cli_desc4,d.cli_desc5,d.cli_desc6,d.cli_desc7,d.cli_desc8,d.cli_desc9]).map((v, idx) => (
                              <td key={idx} style={{ padding:'10px 12px', textAlign:'center', fontSize:12, color: v > 0 ? G.success : G.textMuted, fontWeight: v > 0 ? 700 : 400 }}>
                                {v > 0 ? `${v}%` : '—'}
                              </td>
                            ))}
                            <td style={{ padding:'10px 12px' }}>
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => openDiscModal(d)} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${G.border}`, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:G.textSec }}>
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => deleteDiscount(d.cli_forcodigo, d.cli_grupo)} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${G.border}`, background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:G.danger }}>
                                  <Trash2 size={12} />
                                </button>
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
            {tab === 'PROSPECÇÃO' && <ProspeccaoTab cliId={data.cli_codigo} />}
            {tab === 'ÁREAS' && <AreasTab cliId={data.cli_codigo} />}
          </div>
        )}
      </div>

      {/* ── Modal de Indústria ────────────────────────────────────────────── */}
      {indModal.open && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(40,55,74,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={e => { if (e.target === e.currentTarget) setIndModal({ open:false, editing:emptyCliInd }); }}
        >
          <div style={{ width:'100%', maxWidth:680, background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 24px 80px rgba(40,55,74,0.35)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'16px 24px', background:G.text, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:1.2 }}>
                  {indModal.editing.cli_lancamento ? 'Editando' : 'Nova'} Informação na Indústria
                </div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>
                  {indModal.editing.industria_nome || 'Nova Indústria'}
                </div>
              </div>
              <button onClick={() => setIndModal({ open:false, editing:emptyCliInd })} style={{ width:32, height:32, borderRadius:9, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,0.7)' }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding:24, overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
              {/* Row 1: Indústria + Transportadora */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <span style={label}>INDÚSTRIA *</span>
                  <select
                    style={{ ...inp, appearance:'none' }}
                    value={indModal.editing.cli_forcodigo || ''}
                    disabled={!!indModal.editing.cli_lancamento}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 0;
                      const nome = allIndustrias.find(x => x.value === v)?.label || '';
                      setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_forcodigo: v, industria_nome: nome } }));
                      if (v) loadPriceTables(v); else setPriceTables([]);
                    }}
                  >
                    <option value="">Selecione...</option>
                    {allIndustrias.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </div>
                <div>
                  <span style={label}>TRANSPORTADORA</span>
                  <select style={{ ...inp, appearance:'none' }} value={indModal.editing.cli_transportadora || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_transportadora: parseInt(e.target.value) || null } }))}>
                    <option value="">Selecione...</option>
                    {carriers.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Condições pagto + Resp. compras + E-mail compras */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div>
                  <span style={label}>CONDIÇÕES PAGTO</span>
                  <input style={inp} value={indModal.editing.cli_prazopg || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_prazopg: e.target.value } }))} placeholder="Ex: 28/35/42 DDL" />
                </div>
                <div>
                  <span style={label}>RESP. COMPRAS</span>
                  <input style={inp} value={indModal.editing.cli_comprador || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_comprador: e.target.value } }))} />
                </div>
                <div>
                  <span style={label}>E-MAIL COMPRAS</span>
                  <input style={inp} type="email" value={indModal.editing.cli_emailcomprador || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_emailcomprador: e.target.value } }))} />
                </div>
              </div>

              {/* Row 3: Tabela + Cód. Indústria + Frete + % add + % especial */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 160px 130px 90px 90px', gap:12 }}>
                <div>
                  <span style={label}>TABELA DE PREÇO</span>
                  <select style={{ ...inp, appearance:'none' }} value={indModal.editing.cli_tabela || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_tabela: e.target.value } }))}>
                    <option value="">Selecione...</option>
                    {priceTables.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <span style={{ ...label, color:G.danger }}>CÓD. NA INDÚSTRIA</span>
                  <input style={{ ...inp, background:'#FFF3CD', borderColor:'#FFD700', fontWeight:700, color:'#856404' }} value={indModal.editing.cli_codcliind || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_codcliind: e.target.value } }))} />
                </div>
                <div>
                  <span style={label}>FRETE</span>
                  <select style={{ ...inp, appearance:'none' }} value={indModal.editing.cli_frete || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_frete: e.target.value } }))}>
                    <option value="">—</option>
                    {FRETES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <span style={label}>% ADD</span>
                  <input style={{ ...inp, textAlign:'right' }} type="number" step="0.01" value={indModal.editing.cli_desc10 ?? 0} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_desc10: parseFloat(e.target.value) || 0 } }))} />
                </div>
                <div>
                  <span style={label}>% ESPECIAL</span>
                  <input style={{ ...inp, textAlign:'right' }} type="number" step="0.01" value={indModal.editing.cli_desc11 ?? 0} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_desc11: parseFloat(e.target.value) || 0 } }))} />
                </div>
              </div>

              {/* Row 4: Observações */}
              <div>
                <span style={label}>OBSERVAÇÕES (sairá nos pedidos)</span>
                <textarea style={{ ...inp, resize:'vertical', minHeight:64 } as any} value={indModal.editing.cli_obsparticular || ''} onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, cli_obsparticular: e.target.value } }))} />
              </div>

              {/* Row 5: Descontos 1º-9º */}
              <div>
                <span style={{ ...label, display:'block', marginBottom:8 }}>DESCONTOS</span>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:6 }}>
                  {([1,2,3,4,5,6,7,8,9] as const).map(n => {
                    const k = `cli_desc${n}` as keyof CliInd;
                    return (
                      <div key={n}>
                        <div style={{ fontSize:10, fontWeight:700, color:G.textMuted, textAlign:'center', marginBottom:3 }}>{n}º</div>
                        <input
                          style={{ ...inp, textAlign:'center', padding:'6px 4px' }}
                          type="number" step="0.01" min={0}
                          value={(indModal.editing[k] as number) ?? 0}
                          onChange={e => setIndModal(prev => ({ ...prev, editing: { ...prev.editing, [k]: parseFloat(e.target.value) || 0 } }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 24px', borderTop:`1px solid ${G.border}`, display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0 }}>
              <button onClick={() => setIndModal({ open:false, editing:emptyCliInd })} style={{ padding:'9px 20px', borderRadius:9, border:`1px solid ${G.border}`, background:'transparent', fontWeight:700, fontSize:12, color:G.textSec, cursor:'pointer' }}>
                <X size={12} style={{ display:'inline', marginRight:4 }} /> Cancelar
              </button>
              <button
                onClick={saveIndustry}
                disabled={savingInd || !indModal.editing.cli_forcodigo}
                style={{ display:'flex', alignItems:'center', gap:7, background:G.success, color:'#fff', border:'none', borderRadius:9, padding:'9px 20px', fontWeight:800, fontSize:12, cursor:savingInd ? 'not-allowed' : 'pointer', opacity:!indModal.editing.cli_forcodigo ? 0.5 : 1 }}
              >
                {savingInd ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Desconto ────────────────────────────────────────────── */}
      {discModal.open && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(40,55,74,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={e => { if (e.target === e.currentTarget) setDiscModal({ open:false, editing:emptyDescpro }); }}
        >
          <div style={{ width:'100%', maxWidth:560, background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 24px 80px rgba(40,55,74,0.35)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'16px 24px', background:G.text, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:1.2 }}>
                  {discModal.editing.cli_grupo ? 'Editando' : 'Novo'} Desconto por Grupo
                </div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>
                  {discModal.editing.industria_nome || 'Novo Desconto'}
                </div>
              </div>
              <button onClick={() => setDiscModal({ open:false, editing:emptyDescpro })} style={{ width:32, height:32, borderRadius:9, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,0.7)' }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding:24, overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
              {/* Row 1: Indústria + Grupo */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <span style={label}>INDÚSTRIA *</span>
                  <select
                    style={{ ...inp, appearance:'none' }}
                    value={discModal.editing.cli_forcodigo || ''}
                    disabled={!!discModal.editing.cli_grupo}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 0;
                      const nome = allIndustrias.find(x => x.value === v)?.label || '';
                      setDiscModal(prev => ({ ...prev, editing: { ...prev.editing, cli_forcodigo: v, industria_nome: nome, cli_grupo: undefined } }));
                      if (v) loadGrupos(v); else setGrupos([]);
                    }}
                  >
                    <option value="">Selecione...</option>
                    {allIndustrias.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </div>
                <div>
                  <span style={label}>GRUPO DE PRODUTO *</span>
                  <select
                    style={{ ...inp, appearance:'none' }}
                    value={discModal.editing.cli_grupo || ''}
                    disabled={!!discModal.editing.cli_grupo}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 0;
                      const nome = grupos.find(x => x.value === v)?.label || '';
                      setDiscModal(prev => ({ ...prev, editing: { ...prev.editing, cli_grupo: v, grupo_nome: nome } }));
                    }}
                  >
                    <option value="">Selecione...</option>
                    {grupos.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Descontos 1º-9º */}
              <div>
                <span style={{ ...label, display:'block', marginBottom:8 }}>DESCONTOS (1º AO 9º)</span>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:6 }}>
                  {([1,2,3,4,5,6,7,8,9] as const).map(n => {
                    const k = `cli_desc${n}` as keyof CliDescpro;
                    return (
                      <div key={n}>
                        <div style={{ fontSize:10, fontWeight:700, color:G.textMuted, textAlign:'center', marginBottom:3 }}>{n}º</div>
                        <input
                          style={{ ...inp, textAlign:'center', padding:'6px 4px' }}
                          type="number" step="0.01" min={0}
                          value={(discModal.editing[k] as number) ?? 0}
                          onChange={e => setDiscModal(prev => ({ ...prev, editing: { ...prev.editing, [k]: parseFloat(e.target.value) || 0 } }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 24px', borderTop:`1px solid ${G.border}`, display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0 }}>
              <button onClick={() => setDiscModal({ open:false, editing:emptyDescpro })} style={{ padding:'9px 20px', borderRadius:9, border:`1px solid ${G.border}`, background:'transparent', fontWeight:700, fontSize:12, color:G.textSec, cursor:'pointer' }}>
                <X size={12} style={{ display:'inline', marginRight:4 }} /> Cancelar
              </button>
              <button
                onClick={saveDiscount}
                disabled={savingDisc || !discModal.editing.cli_forcodigo || !discModal.editing.cli_grupo}
                style={{ display:'flex', alignItems:'center', gap:7, background:G.success, color:'#fff', border:'none', borderRadius:9, padding:'9px 20px', fontWeight:800, fontSize:12, cursor:savingDisc ? 'not-allowed' : 'pointer', opacity:(!discModal.editing.cli_forcodigo || !discModal.editing.cli_grupo) ? 0.5 : 1 }}
              >
                {savingDisc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Contato ──────────────────────────────────────────────── */}
      {contactModal.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(40,55,74,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setContactModal({ open: false, editing: emptyContato }); }}
        >
          <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(40,55,74,0.35)' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  {contactModal.editing.ani_lancto ? 'Editando' : 'Novo'} Contato
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
                  {contactModal.editing.ani_lancto ? contactModal.editing.ani_nome : 'Novo Contato'}
                </div>
              </div>
              <button
                onClick={() => setContactModal({ open: false, editing: emptyContato })}
                style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label}>NOME *</span>
                  <input style={inp} value={contactModal.editing.ani_nome || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_nome: e.target.value } }))} placeholder="Nome completo" autoFocus />
                </div>
                <div>
                  <span style={label}>CARGO / FUNÇÃO</span>
                  <input style={inp} value={contactModal.editing.ani_funcao || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_funcao: e.target.value } }))} placeholder="Ex: Comprador, Gerente..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label}>TELEFONE</span>
                  <input style={inp} value={contactModal.editing.ani_fone || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_fone: e.target.value } }))} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <span style={label}>E-MAIL</span>
                  <input style={inp} type="email" value={contactModal.editing.ani_email || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_email: e.target.value } }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr', gap: 12 }}>
                <div>
                  <span style={label}>DIA ANIV.</span>
                  <input style={inp} type="number" min={1} max={31} value={contactModal.editing.ani_diaaniv || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_diaaniv: parseInt(e.target.value) || null } }))} placeholder="DD" />
                </div>
                <div>
                  <span style={label}>MÊS ANIV.</span>
                  <select style={{ ...inp, appearance: 'none' }} value={contactModal.editing.ani_mes || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_mes: parseInt(e.target.value) || null } }))}>
                    <option value="">—</option>
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <span style={label}>TIME QUE TORCE</span>
                  <input style={inp} value={contactModal.editing.ani_timequetorce || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_timequetorce: e.target.value } }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label}>ESPORTE PREFERIDO</span>
                  <input style={inp} value={contactModal.editing.ani_esportepreferido || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_esportepreferido: e.target.value } }))} />
                </div>
                <div>
                  <span style={label}>HOBBY</span>
                  <input style={inp} value={contactModal.editing.ani_hobby || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_hobby: e.target.value } }))} />
                </div>
              </div>
              <div>
                <span style={label}>OBSERVAÇÕES</span>
                <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 } as any} value={contactModal.editing.ani_obs || ''} onChange={e => setContactModal(prev => ({ ...prev, editing: { ...prev.editing, ani_obs: e.target.value } }))} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setContactModal({ open: false, editing: emptyContato })}
                style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${G.border}`, background: 'transparent', fontWeight: 700, fontSize: 12, color: G.textSec, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={saveContact}
                disabled={savingContact || !contactModal.editing.ani_nome?.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: G.mustard, color: G.text,
                  border: 'none', borderRadius: 9, padding: '9px 20px',
                  fontWeight: 800, fontSize: 12, cursor: savingContact ? 'not-allowed' : 'pointer',
                  opacity: !contactModal.editing.ani_nome?.trim() ? 0.5 : 1,
                }}
              >
                {savingContact ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {contactModal.editing.ani_lancto ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba Prospecção ───────────────────────────────────────────────────────────
function ProspeccaoTab({ cliId }: { cliId: number }) {
  const [items, setItems] = useState<{ id: number; nome: string; nome_completo: string; selected: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!cliId) return;
    setLoading(true);
    api.get(`/clients/${cliId}/prospeccao`)
      .then(r => setItems(r.data.data || []))
      .finally(() => setLoading(false));
  }, [cliId]);

  const toggle = (id: number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${cliId}/prospeccao`, {
        industryIds: items.filter(i => i.selected).map(i => i.id),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const selected = items.filter(i => i.selected);
  const unselected = items.filter(i => !i.selected);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>Carregando...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${G.border}`, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>Indústrias de Prospecção</div>
            <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>
              Marque as indústrias que este cliente pode comprar. Relatórios usarão apenas estas.
            </div>
          </div>
          <button onClick={save} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: saved ? '#22C55E' : G.mustard, color: saved ? '#fff' : G.text, fontWeight: 700, fontSize: 13,
          }}>
            {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {selected.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Selecionadas ({selected.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.map(i => (
                <button key={i.id} onClick={() => toggle(i.id)} title={i.nome_completo} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 8, border: `2px solid ${G.mustard}`, background: `${G.mustard}20`,
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: G.text,
                }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: G.mustard, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: G.text, flexShrink: 0 }}>✓</span>
                  {i.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          {selected.length > 0 ? `Disponíveis (${unselected.length})` : `Todas as indústrias (${items.length})`}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {unselected.map(i => (
            <button key={i.id} onClick={() => toggle(i.id)} title={i.nome_completo} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, border: `1px solid ${G.border}`, background: '#fff',
              cursor: 'pointer', fontSize: 12, color: G.textMuted,
            }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${G.border}`, display: 'inline-block', flexShrink: 0 }} />
              {i.nome}
            </button>
          ))}
        </div>
        {items.length === 0 && (
          <div style={{ fontSize: 13, color: G.textMuted, textAlign: 'center', padding: 20 }}>
            Nenhuma indústria cadastrada no sistema.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aba Áreas de Atuação ─────────────────────────────────────────────────────
function AreasTab({ cliId }: { cliId: number }) {
  const [items, setItems] = useState<{ id: number; nome: string; selected: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!cliId) return;
    setLoading(true);
    api.get(`/clients/${cliId}/areas`)
      .then(r => setItems(r.data.data || []))
      .finally(() => setLoading(false));
  }, [cliId]);

  const toggle = (id: number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${cliId}/areas`, {
        areaIds: items.filter(i => i.selected).map(i => i.id),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const selected = items.filter(i => i.selected);
  const unselected = items.filter(i => !i.selected);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>Carregando...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${G.border}`, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>Áreas de Atuação</div>
            <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>
              Marque os segmentos em que este cliente atua. Ex: Linha Leve, Linha Pesada, Agrícola.
            </div>
          </div>
          <button onClick={save} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: saved ? '#22C55E' : G.mustard, color: saved ? '#fff' : G.text, fontWeight: 700, fontSize: 13,
          }}>
            {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {selected.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Selecionadas ({selected.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selected.map(i => (
                <button key={i.id} onClick={() => toggle(i.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 8, border: `2px solid #3B82F6`, background: '#EFF6FF',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1D4ED8',
                }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: '#3B82F6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>✓</span>
                  {i.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          {selected.length > 0 ? `Disponíveis (${unselected.length})` : `Todas as áreas (${items.length})`}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {unselected.map(i => (
            <button key={i.id} onClick={() => toggle(i.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, border: `1px solid ${G.border}`, background: '#fff',
              cursor: 'pointer', fontSize: 12, color: G.textMuted,
            }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${G.border}`, display: 'inline-block', flexShrink: 0 }} />
              {i.nome}
            </button>
          ))}
        </div>
        {items.length === 0 && (
          <div style={{ fontSize: 13, color: G.textMuted, textAlign: 'center', padding: 20 }}>
            Nenhuma área cadastrada. Acesse Cadastros → Áreas de Atuação para criar.
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 40,
      border: `1px solid ${G.border}`, textAlign: 'center',
      maxWidth: 500, margin: '0 auto',
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: G.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: G.textMuted }}>{desc}</div>
      <div style={{
        marginTop: 16, fontSize: 11, color: G.textMuted,
        background: G.card, padding: '8px 16px', borderRadius: 8,
        border: `1px dashed ${G.border}`,
      }}>
        Em implementação — backend e frontend desta aba serão adicionados em breve.
      </div>
    </div>
  );
}
