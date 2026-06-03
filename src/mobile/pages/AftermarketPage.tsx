import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Loader2, Crosshair, MapPin, Wrench, Phone, Search } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { buscarCep, reverseGeocode } from '@/shared/lib/geo';
import { MobileHeader } from '../components/MobileHeader';

// ─── Estágios do funil (mesmas cores do web) ──────────────────────────────────
const ESTAGIOS = [
  { v: 'identificado',      label: 'Identificado',      color: '#94A3B8' },
  { v: 'visitado',          label: 'Visitado',          color: '#3B82F6' },
  { v: 'material_entregue', label: 'Material entregue',  color: '#06B6D4' },
  { v: 'em_negociacao',     label: 'Em negociação',      color: '#B8860B' },
  { v: 'convertido',        label: 'Convertido',         color: '#16A34A' },
  { v: 'perdido',           label: 'Perdido',            color: '#94A3B8' },
  { v: 'pausado',           label: 'Pausado',            color: '#A855F7' },
] as const;
const estInfo = (v: string) => ESTAGIOS.find(e => e.v === v) || ESTAGIOS[0];

interface Ponto {
  id?: string;
  razao_social: string; nome_fantasia?: string;
  telefone?: string; whatsapp?: string; segmento?: string;
  endereco?: { cidade?: string; uf?: string; logradouro?: string; numero?: string; bairro?: string; cep?: string } | null;
  latitude?: number | string | null; longitude?: number | string | null;
  status?: string; observacoes?: string;
}
const EMPTY: Ponto = { razao_social: '', status: 'identificado', endereco: {} };

const inputSt: React.CSSProperties = {
  borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
  background: '#fff', color: 'var(--navy)', padding: '11px 12px',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const lblSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
  textTransform: 'uppercase', letterSpacing: 0.6,
};

export default function AftermarketPage() {
  const [rows, setRows] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estFiltro, setEstFiltro] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Ponto>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (estFiltro) params.estagio = estFiltro;
      const r = await api.get('/aftermarket', { params });
      setRows(r.data?.data || []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [search, estFiltro]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openNew = () => { setForm({ ...EMPTY, endereco: {} }); setErr(''); setModal(true); };
  const openEdit = (p: Ponto) => { setForm({ ...EMPTY, ...p, endereco: p.endereco || {} }); setErr(''); setModal(true); };
  const set = (k: keyof Ponto, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setEnd = (k: string, v: any) => setForm(f => ({ ...f, endereco: { ...f.endereco, [k]: v } }));

  const captureGps = () => {
    if (!navigator.geolocation) { setErr('GPS não disponível neste aparelho.'); return; }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = +pos.coords.latitude.toFixed(7), lon = +pos.coords.longitude.toFixed(7);
        set('latitude', lat); set('longitude', lon);
        // Reverse-geocode: preenche endereço pelo GPS (sem sobrescrever o que já foi digitado).
        const g = await reverseGeocode(lat, lon);
        if (g) setForm(f => ({ ...f, latitude: lat, longitude: lon, endereco: {
          ...f.endereco,
          logradouro: f.endereco?.logradouro || g.logradouro,
          bairro:     f.endereco?.bairro     || g.bairro,
          cidade:     f.endereco?.cidade     || g.cidade,
          uf:         f.endereco?.uf         || g.uf,
          cep:        f.endereco?.cep        || g.cep,
        } }));
        setGpsBusy(false);
      },
      e => { setErr('Falha no GPS: ' + e.message); setGpsBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const buscarCepHandler = async (cepVal: string) => {
    const raw = (cepVal || '').replace(/\D/g, '');
    if (raw.length !== 8) return;
    setCepBusy(true);
    const g = await buscarCep(raw);
    setCepBusy(false);
    if (!g) { setErr('CEP não encontrado.'); return; }
    setForm(f => ({ ...f, endereco: {
      ...f.endereco,
      cep:        g.cep || raw,
      logradouro: g.logradouro || f.endereco?.logradouro,
      bairro:     g.bairro     || f.endereco?.bairro,
      cidade:     g.cidade     || f.endereco?.cidade,
      uf:         g.uf         || f.endereco?.uf,
    } }));
  };

  const save = async () => {
    if (!form.razao_social.trim()) { setErr('Informe o nome do ponto.'); return; }
    setSaving(true); setErr('');
    try {
      const body = { ...form, latitude: form.latitude || null, longitude: form.longitude || null };
      if (form.id) await api.put(`/aftermarket/${form.id}`, body);
      else await api.post('/aftermarket', body);
      setModal(false); setForm(EMPTY); load();
    } catch (e: any) { setErr(e.response?.data?.error || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const hasGps = !!(form.latitude && form.longitude);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="Aftermarket" helpItems={[
        { icon: '🔧', title: 'Pontos aplicadores', text: 'Oficinas, auto-elétricas e lojas que ficam no fim da cadeia — quem aplica a peça no veículo.' },
        { icon: '📍', title: 'Cadastro em campo', text: 'Toque em "+ Ponto", preencha o básico e capture o GPS na hora da visita.' },
        { icon: '🎯', title: 'Funil', text: 'Acompanhe o estágio: Identificado → Visitado → Material entregue → Em negociação → Convertido.' },
      ]} />

      <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>
        <input
          placeholder="Buscar por nome ou CNPJ..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 8 }}>
          <button onClick={() => setEstFiltro('')} className="pill" style={{
            background: estFiltro === '' ? 'var(--navy)' : 'var(--sand-card)',
            color: estFiltro === '' ? '#FFF' : 'var(--navy)', flexShrink: 0 }}>Todos</button>
          {ESTAGIOS.map(e => (
            <button key={e.v} onClick={() => setEstFiltro(e.v)} className="pill" style={{
              background: estFiltro === e.v ? 'var(--navy)' : 'var(--sand-card)',
              color: estFiltro === e.v ? '#FFF' : 'var(--navy)', flexShrink: 0 }}>{e.label}</button>
          ))}
        </div>
      </div>

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 90px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader2 size={22} style={{ color: 'var(--mustard)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
            <Wrench size={28} style={{ opacity: 0.4, marginBottom: 10 }} /><br />
            Nenhum ponto cadastrado. Toque em "+ Ponto" para começar.
          </div>
        ) : rows.map(p => {
          const e = estInfo(p.status || 'identificado');
          const cidade = p.endereco?.cidade ? `${p.endereco.cidade}${p.endereco.uf ? ' — ' + p.endereco.uf : ''}` : '';
          return (
            <div key={p.id} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => openEdit(p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nome_fantasia || p.razao_social}
                  </div>
                  {cidade && <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2 }}>{cidade}</div>}
                  {p.segmento && <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: 2 }}>{p.segmento}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: e.color, background: `${e.color}1A`, padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>{e.label}</span>
                  <div style={{ display: 'flex', gap: 6 }} onClick={ev => ev.stopPropagation()}>
                    {(p.whatsapp || p.telefone) && (
                      <a href={`tel:${String(p.whatsapp || p.telefone).replace(/\D/g, '')}`}
                        style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #2563EB', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <Phone size={18} color="#2563EB" />
                      </a>
                    )}
                    {(p.latitude && p.longitude) && (
                      <a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer"
                        style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #16A34A', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <MapPin size={18} color="#16A34A" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={openNew} style={{ position: 'absolute', bottom: 76, right: 20,
        background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 28,
        padding: '12px 20px', fontSize: 14, fontWeight: 800, display: 'flex',
        alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,0.4)', zIndex: 20 }}>
        <Plus size={16} /> Ponto
      </button>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: '#0009', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ width: '100%', background: 'var(--sand-bg)', borderRadius: '20px 20px 0 0', padding: '20px 20px 90px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>{form.id ? 'Editar ponto' : 'Novo ponto aplicador'}</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="var(--navy-muted)" /></button>
            </div>

            <Campo label="Nome / Razão social *"><input style={inputSt} value={form.razao_social} onChange={e => set('razao_social', e.target.value)} placeholder="Ex: Auto Elétrica do João" /></Campo>
            <Campo label="Nome fantasia"><input style={inputSt} value={form.nome_fantasia || ''} onChange={e => set('nome_fantasia', e.target.value)} /></Campo>
            <div style={{ display: 'flex', gap: 10 }}>
              <Campo label="Telefone" flex><input style={inputSt} value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} /></Campo>
              <Campo label="WhatsApp" flex><input style={inputSt} value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} /></Campo>
            </div>
            <Campo label="Segmento"><input style={inputSt} value={form.segmento || ''} onChange={e => set('segmento', e.target.value)} placeholder="Oficina, auto-elétrica..." /></Campo>

            <Campo label="CEP (busca o endereço)">
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputSt} inputMode="numeric" value={form.endereco?.cep || ''} placeholder="00000-000"
                  onChange={e => setEnd('cep', e.target.value)}
                  onBlur={e => buscarCepHandler(e.target.value)} />
                <button type="button" onClick={() => buscarCepHandler(form.endereco?.cep || '')} disabled={cepBusy}
                  title="Buscar endereço pelo CEP"
                  style={{ flexShrink: 0, width: 48, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--sand-card)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {cepBusy ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                </button>
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: 10 }}>
              <Campo label="Logradouro" flex><input style={inputSt} value={form.endereco?.logradouro || ''} onChange={e => setEnd('logradouro', e.target.value)} /></Campo>
              <div style={{ width: 90 }}><Campo label="Número"><input style={inputSt} value={form.endereco?.numero || ''} onChange={e => setEnd('numero', e.target.value)} /></Campo></div>
            </div>
            <Campo label="Bairro"><input style={inputSt} value={form.endereco?.bairro || ''} onChange={e => setEnd('bairro', e.target.value)} /></Campo>
            <div style={{ display: 'flex', gap: 10 }}>
              <Campo label="Cidade" flex><input style={inputSt} value={form.endereco?.cidade || ''} onChange={e => setEnd('cidade', e.target.value)} /></Campo>
              <div style={{ width: 80 }}><Campo label="UF"><input style={inputSt} maxLength={2} value={form.endereco?.uf || ''} onChange={e => setEnd('uf', e.target.value.toUpperCase())} /></Campo></div>
            </div>

            <button type="button" onClick={captureGps} disabled={gpsBusy}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12,
                border: `1px solid ${hasGps ? '#16A34A' : 'var(--border)'}`, background: hasGps ? '#F0FDF4' : 'var(--sand-card)',
                color: hasGps ? '#16A34A' : 'var(--navy)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {gpsBusy ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Crosshair size={16} />}
              {gpsBusy ? 'Localizando...' : hasGps ? 'Localização capturada ✓' : 'Capturar GPS + endereço'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lblSt}>Estágio</label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {ESTAGIOS.map(e => {
                  const on = form.status === e.v;
                  return (
                    <button key={e.v} type="button" onClick={() => set('status', e.v)} style={{
                      padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: on ? 800 : 600,
                      background: on ? `${e.color}22` : '#fff', border: `1px solid ${on ? e.color : 'var(--border)'}`, color: 'var(--navy)' }}>{e.label}</button>
                  );
                })}
              </div>
            </div>

            <Campo label="Observações"><textarea style={{ ...inputSt, minHeight: 64, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} /></Campo>

            {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>{err}</div>}

            <button onClick={save} disabled={saving}
              style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={18} />}
              {saving ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Salvar ponto')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...(flex ? { flex: 1 } : {}) }}>
      <label style={lblSt}>{label}</label>
      {children}
    </div>
  );
}
