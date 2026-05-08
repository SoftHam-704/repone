import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate }           from 'react-router-dom';
import { motion }                           from 'framer-motion';
import {
  ShoppingCart, Package, Zap, Sparkles,
  ChevronDown, ChevronUp, Edit3, MapPin,
  Phone, Mail, UserPlus, Trash2, Loader2,
  CheckCircle2, X, User,
} from 'lucide-react';
import { db }           from '../db/db';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileClient } from '../db/types';

/* ─── types ────────────────────────────────────────────────────────────────── */
interface ClientDetail {
  resumo:    { total_valor: number; total_pedidos: number; total_skus: number; total_itens: number };
  pedidos:   { ped_pedido: string; ped_data: string; industria: string; ped_totliq: number; total_skus: number; total_itens: number }[];
  industrias:{ industria: string; total_valor: number; total_pedidos: number; total_skus: number; ultimo_pedido: string }[];
}

interface Contact {
  ani_lancto:  number;
  ani_nome:    string;
  ani_funcao:  string;
  ani_fone:    string;
  ani_email:   string;
  ani_diaaniv: number | null;
  ani_mes:     number | null;
}

interface ContactForm {
  ani_nome:    string;
  ani_funcao:  string;
  ani_fone:    string;
  ani_email:   string;
  ani_diaaniv: string;
  ani_mes:     string;
}
const EMPTY_FORM: ContactForm = { ani_nome: '', ani_funcao: '', ani_fone: '', ani_email: '', ani_diaaniv: '', ani_mes: '' };

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const fmtBRL   = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDate  = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const RISK_COLOR: Record<string, string> = { ativo: '#16A34A', em_queda: '#D97706', burnout: '#DC2626' };
const RISK_LABEL: Record<string, string> = { ativo: 'Ativo', em_queda: 'Em queda', burnout: 'Burnout' };

/* ─── SectionTitle ─────────────────────────────────────────────────────────── */
function SectionTitle({
  icon: Icon, label, accent, action,
}: { icon: any; label: string; accent?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 10,
          background: accent ?? 'var(--navy)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color="#FFF" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)',
          textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      </div>
      {action}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div style={{ background: `${color}0F`, borderRadius: 14, padding: '10px 4px',
      textAlign: 'center', border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ─── ContactFormInline ────────────────────────────────────────────────────── */
function ContactFormInline({
  initial, onSave, onCancel, saving,
}: { initial: ContactForm; onSave: (f: ContactForm) => void; onCancel: () => void; saving: boolean }) {
  const [form, setForm] = useState<ContactForm>(initial);
  const set = (k: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: 9, fontSize: 13, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: '#f8fafc',
    color: 'var(--navy)', outline: 'none', padding: '9px 11px',
    boxSizing: 'border-box' as const,
  };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as const, cursor: 'pointer' };

  return (
    <div style={{ background: 'rgba(255,210,0,0.04)', border: '1px solid rgba(255,210,0,0.25)',
      borderRadius: 12, padding: 12, marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', marginBottom: 4 }}>Nome *</div>
          <input style={inp} value={form.ani_nome}    onChange={set('ani_nome')}    placeholder="Nome completo" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', marginBottom: 4 }}>Cargo</div>
          <input style={inp} value={form.ani_funcao}  onChange={set('ani_funcao')}  placeholder="Cargo / Função" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', marginBottom: 4 }}>Telefone</div>
          <input style={inp} value={form.ani_fone}    onChange={set('ani_fone')}    placeholder="(00) 00000-0000" type="tel" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', marginBottom: 4 }}>E-mail</div>
          <input style={inp} value={form.ani_email}   onChange={set('ani_email')}   placeholder="email@empresa.com" type="email" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', marginBottom: 4 }}>🎂 Dia aniv.</div>
          <select style={sel} value={form.ani_diaaniv} onChange={set('ani_diaaniv')}>
            <option value="">—</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
            textTransform: 'uppercase', marginBottom: 4 }}>Mês aniv.</div>
          <select style={sel} value={form.ani_mes} onChange={set('ani_mes')}>
            <option value="">—</option>
            {MESES_PT.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} disabled={saving}
          style={{ flex: 1, background: '#f1f5f9', border: '1px solid var(--border)',
            borderRadius: 9, padding: '9px 0', fontSize: 12, fontWeight: 800,
            color: 'var(--navy-muted)', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={() => form.ani_nome.trim() && onSave(form)} disabled={saving || !form.ani_nome.trim()}
          style={{ flex: 2, background: 'var(--navy)', border: 'none',
            borderRadius: 9, padding: '9px 0', fontSize: 12, fontWeight: 800,
            color: '#FFF', cursor: form.ani_nome.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: form.ani_nome.trim() ? 1 : 0.5 }}>
          {saving
            ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <CheckCircle2 size={13} />}
          Salvar
        </button>
      </div>
    </div>
  );
}

/* ─── ContactsSection ──────────────────────────────────────────────────────── */
function ContactsSection({ clientId, isOnline }: { clientId: number; isOnline: boolean }) {
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [loading,  setLoading]      = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editId,   setEditId]       = useState<number | null>(null);
  const [editInit, setEditInit]     = useState<ContactForm>(EMPTY_FORM);
  const [saving,   setSaving]       = useState(false);
  const [deleting, setDeleting]     = useState<number | null>(null);

  const load = useCallback(() => {
    if (!isOnline) return;
    setLoading(true);
    api.get(`/clients/${clientId}/contacts`)
      .then(r => { if (r.data.success) setContacts(r.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId, isOnline]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: ContactForm) {
    setSaving(true);
    try {
      if (editId !== null) {
        await api.put(`/clients/${clientId}/contacts/${editId}`, form);
      } else {
        await api.post(`/clients/${clientId}/contacts`, form);
      }
      setShowForm(false); setEditId(null); setEditInit(EMPTY_FORM);
      load();
    } catch {}
    finally { setSaving(false); }
  }

  async function handleDelete(lancto: number) {
    if (!confirm('Remover este contato?')) return;
    setDeleting(lancto);
    try {
      await api.delete(`/clients/${clientId}/contacts/${lancto}`);
      setContacts(cs => cs.filter(c => c.ani_lancto !== lancto));
    } catch {}
    finally { setDeleting(null); }
  }

  function startEdit(c: Contact) {
    setEditId(c.ani_lancto);
    setEditInit({
      ani_nome:    c.ani_nome,
      ani_funcao:  c.ani_funcao,
      ani_fone:    c.ani_fone,
      ani_email:   c.ani_email,
      ani_diaaniv: c.ani_diaaniv ? String(c.ani_diaaniv) : '',
      ani_mes:     c.ani_mes     ? String(c.ani_mes)     : '',
    });
    setShowForm(true);
  }

  const addBtn = isOnline ? (
    <button onClick={() => { setShowForm(true); setEditId(null); setEditInit(EMPTY_FORM); }}
      style={{ background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.3)',
        borderRadius: 9, padding: '5px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5 }}>
      <UserPlus size={12} color="var(--mustard)" />
      <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--mustard)', letterSpacing: 0.5 }}>ADICIONAR</span>
    </button>
  ) : null;

  return (
    <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.22 }}
      style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
        border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
      <SectionTitle icon={User} label="Contatos" accent="#7c3aed" action={addBtn} />

      {!isOnline ? (
        <p style={{ fontSize: 12, color: 'var(--navy-muted)', fontStyle: 'italic', margin: 0 }}>
          Disponível apenas online.
        </p>
      ) : loading ? (
        <div style={{ fontSize: 12, color: 'var(--navy-muted)' }}>Carregando...</div>
      ) : contacts.length === 0 && !showForm ? (
        <div style={{ fontSize: 12, color: 'var(--navy-muted)', fontStyle: 'italic' }}>
          Nenhum contato cadastrado.
        </div>
      ) : (
        contacts.map((c, i) => (
          <div key={c.ani_lancto}>
            {editId === c.ani_lancto && showForm ? (
              <ContactFormInline
                initial={editInit}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditId(null); }}
                saving={saving}
              />
            ) : (
              <div style={{ padding: '10px 0',
                borderBottom: i < contacts.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#7c3aed' }}>
                    {(c.ani_nome || 'C')[0]}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', textTransform: 'uppercase' }}>
                    {c.ani_nome}
                  </div>
                  {c.ani_funcao && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)',
                      textTransform: 'uppercase', marginTop: 1 }}>
                      {c.ani_funcao}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' as const }}>
                    {c.ani_fone && (
                      <a href={`tel:${c.ani_fone}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                        <Phone size={11} /> {c.ani_fone}
                      </a>
                    )}
                    {c.ani_email && (
                      <a href={`mailto:${c.ani_email}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, color: '#059669', fontWeight: 700, textDecoration: 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        <Mail size={11} /> {c.ani_email}
                      </a>
                    )}
                    {c.ani_diaaniv && c.ani_mes && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 11, color: '#DB2777', fontWeight: 700 }}>
                        🎂 {String(c.ani_diaaniv).padStart(2,'0')}/{MESES_PT[c.ani_mes - 1]}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEdit(c)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                      borderRadius: 8, display: 'flex' }}>
                    <Edit3 size={14} color="var(--navy-muted)" />
                  </button>
                  <button onClick={() => handleDelete(c.ani_lancto)} disabled={deleting === c.ani_lancto}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                      borderRadius: 8, display: 'flex' }}>
                    {deleting === c.ani_lancto
                      ? <Loader2 size={14} color="#dc2626" style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <Trash2 size={14} color="#dc2626" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {/* add form (new contact) */}
      {showForm && editId === null && (
        <ContactFormInline
          initial={EMPTY_FORM}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}
    </motion.div>
  );
}

/* ─── GeoSection ───────────────────────────────────────────────────────────── */
function GeoSection({ clientId, initialLat, initialLng, isOnline }: {
  clientId: number; initialLat: string; initialLng: string; isOnline: boolean;
}) {
  const [lat,     setLat]     = useState(initialLat ?? '');
  const [lng,     setLng]     = useState(initialLng ?? '');
  const [preview, setPreview] = useState<{ lat: string; lng: string } | null>(null);
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'saved'>('idle');
  const [error,   setError]   = useState('');

  function capture() {
    if (!navigator.geolocation) { setError('GPS não disponível neste dispositivo.'); return; }
    setStatus('loading'); setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPreview({
          lat: String(pos.coords.latitude.toFixed(7)),
          lng: String(pos.coords.longitude.toFixed(7)),
        });
        setStatus('idle');
      },
      () => { setError('Não foi possível obter a localização. Verifique as permissões.'); setStatus('idle'); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function confirmGeo() {
    if (!preview || !isOnline) return;
    setStatus('loading');
    try {
      const r = await api.get(`/clients/${clientId}`);
      if (r.data.success) {
        await api.put(`/clients/${clientId}`, {
          ...r.data.data,
          cli_latitude:  preview.lat,
          cli_longitude: preview.lng,
        });
        setLat(preview.lat); setLng(preview.lng);
        setPreview(null); setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      }
    } catch { setError('Erro ao salvar localização.'); setStatus('idle'); }
  }

  const hasGeo = lat && lng;

  return (
    <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.26 }}
      style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
        border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
      <SectionTitle icon={MapPin} label="Localização" accent="#2563eb" />

      {hasGeo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ background: 'rgba(37,99,235,0.06)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--navy-muted)',
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Coordenadas salvas</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
              {lat}, {lng}
            </div>
          </div>
          <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            style={{ background: '#2563eb', color: '#FFF', borderRadius: 10, padding: '8px 12px',
              fontSize: 11, fontWeight: 800, textDecoration: 'none', flexShrink: 0 }}>
            Ver mapa
          </a>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginBottom: 12, fontStyle: 'italic' }}>
          Sem localização cadastrada.
        </div>
      )}

      {preview && (
        <div style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#2563eb',
            textTransform: 'uppercase', marginBottom: 4 }}>Nova posição capturada</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            {preview.lat}, {preview.lng}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPreview(null)}
              style={{ flex: 1, background: '#f1f5f9', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 800,
                color: 'var(--navy-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <X size={12} /> Cancelar
            </button>
            <button onClick={confirmGeo} disabled={status === 'loading'}
              style={{ flex: 2, background: '#2563eb', border: 'none',
                borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 800,
                color: '#FFF', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {status === 'loading'
                ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <CheckCircle2 size={12} />}
              Confirmar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{error}</div>
      )}

      {isOnline && (
        <button onClick={capture} disabled={status === 'loading'}
          style={{ width: '100%', background: status === 'saved' ? '#059669' : 'var(--navy)',
            border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 800,
            color: '#FFF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'background 0.2s', opacity: status === 'loading' ? 0.7 : 1 }}>
          {status === 'loading'
            ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
            : status === 'saved'
            ? <CheckCircle2 size={15} />
            : <MapPin size={15} />}
          {status === 'loading' ? 'Capturando GPS...'
            : status === 'saved' ? 'Localização salva!'
            : hasGeo ? 'Atualizar localização' : 'Marcar minha posição atual'}
        </button>
      )}
    </motion.div>
  );
}

/* ─── BriefingPage ─────────────────────────────────────────────────────────── */
export default function BriefingPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnline } = useOffline();

  const [cliente,   setCliente]   = useState<MobileClient | null>(null);
  const [fullCli,   setFullCli]   = useState<any | null>(null);
  const [detail,    setDetail]    = useState<ClientDetail | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loadingD,  setLoadingD]  = useState(false);
  const [loadingN,  setLoadingN]  = useState(false);
  const [showAll,   setShowAll]   = useState(false);

  /* load Dexie client */
  useEffect(() => {
    if (!id) return;
    db.clients.get(Number(id)).then(c => setCliente(c ?? null));
  }, [id]);

  /* load full client + detail + narrative when online */
  useEffect(() => {
    if (!id || !isOnline) return;
    setLoadingD(true);

    Promise.all([
      api.get(`/clients/${id}`).then(r => r.data.success ? setFullCli(r.data.data) : null).catch(() => {}),
      api.get(`/dashboard/mobile-client/${id}`).then(r => { if (r.data.success) setDetail(r.data.data); }).catch(() => {}),
    ]).finally(() => setLoadingD(false));

    setLoadingN(true);
    api.post('/orders/iris-panel-narrative', { clienteId: Number(id) })
      .then(r => setNarrative(r.data.data?.narrative ?? r.data.narrative ?? null))
      .catch(() => setNarrative(null))
      .finally(() => setLoadingN(false));
  }, [id, isOnline]);

  if (!cliente && !loadingD) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <MobileHeader title="Briefing" showBack />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--navy-muted)', fontSize: 13 }}>
          Cliente não encontrado. Sincronize primeiro.
        </div>
      </div>
    );
  }

  const riskColor    = RISK_COLOR[cliente?.risk ?? ''] ?? 'var(--navy-muted)';
  const pedidosShown = showAll ? (detail?.pedidos ?? []) : (detail?.pedidos ?? []).slice(0, 4);
  const totalInds    = detail?.industrias?.reduce((s, i) => s + Number(i.total_valor), 0) ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title={cliente?.cli_nomred ?? '...'} showBack />

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 100px' }}>

        {/* ── Identity card ──────────────────────────────────────────── */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          style={{ background: '#FFF', borderRadius: 16, padding: '16px', marginBottom: 14,
            border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>
                {cliente?.cli_nomred ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--navy-muted)' }}>
                {cliente?.cli_cidade}{cliente?.cli_uf ? ` — ${cliente.cli_uf}` : ''}
              </div>
              {fullCli?.cli_fone1 && (
                <a href={`tel:${fullCli.cli_fone1}`}
                  style={{ fontSize: 12, color: '#2563eb', fontWeight: 700,
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                  <Phone size={12} /> {fullCli.cli_fone1}
                </a>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              {cliente?.risk && (
                <span style={{ fontSize: 11, fontWeight: 700, color: riskColor,
                  background: `${riskColor}1A`, padding: '4px 12px', borderRadius: 8 }}>
                  {RISK_LABEL[cliente.risk] ?? cliente.risk}
                </span>
              )}
              {isOnline && (
                <button onClick={() => navigate(`/mobile/clientes/${id}/editar`)}
                  style={{ background: 'rgba(255,210,0,0.12)', border: '1px solid rgba(255,210,0,0.3)',
                    borderRadius: 9, padding: '6px 10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Edit3 size={12} color="var(--mustard)" />
                  <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--mustard)', letterSpacing: 0.5 }}>
                    EDITAR
                  </span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Resumo trimestre ────────────────────────────────────────── */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
            border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <SectionTitle icon={ShoppingCart} label="Trimestre (90 dias)" />
          {loadingD ? (
            <div style={{ fontSize: 12, color: 'var(--navy-muted)' }}>Carregando...</div>
          ) : detail ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy)',
                letterSpacing: -1, marginBottom: 4 }}>
                {fmtBRL(detail.resumo.total_valor)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <StatChip label="Pedidos"     value={detail.resumo.total_pedidos} color="#2563eb" />
                <StatChip label="SKUs únicos" value={detail.resumo.total_skus}   color="#7c3aed" />
                <StatChip label="Total itens" value={Math.round(Number(detail.resumo.total_itens))} color="#059669" />
              </div>
            </>
          ) : !isOnline ? (
            <div style={{ fontSize: 12, color: 'var(--navy-muted)', fontStyle: 'italic' }}>Disponível apenas online</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--navy-muted)' }}>Sem pedidos no trimestre</div>
          )}
        </motion.div>

        {/* ── Últimos pedidos ──────────────────────────────────────────── */}
        {detail && detail.pedidos.length > 0 && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.14 }}
            style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
              border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
            <SectionTitle icon={Package} label="Últimos Pedidos" />
            {pedidosShown.map((p, i) => (
              <div key={p.ped_pedido}
                style={{ padding: '11px 0', borderBottom: i < pedidosShown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--mustard)',
                        textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        #{p.ped_pedido}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>{fmtDate(p.ped_data)}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
                      marginTop: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.industria}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)', marginTop: 4, display: 'block' }}>
                      {p.total_skus} SKUs · {Math.round(Number(p.total_itens))} itens
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)',
                    letterSpacing: -0.5, flexShrink: 0, marginLeft: 8 }}>
                    {fmtBRL(p.ped_totliq)}
                  </div>
                </div>
              </div>
            ))}
            {detail.pedidos.length > 4 && (
              <button onClick={() => setShowAll(v => !v)}
                style={{ width: '100%', marginTop: 10, background: 'none', border: 'none',
                  color: 'var(--mustard)', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {showAll ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver todos ({detail.pedidos.length})</>}
              </button>
            )}
          </motion.div>
        )}

        {/* ── Indústrias ───────────────────────────────────────────────── */}
        {detail && detail.industrias.length > 0 && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14,
              border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
            <SectionTitle icon={Package} label="Indústrias (12 meses)" accent="#059669" />
            {detail.industrias.map((ind, i) => {
              const pct = totalInds > 0 ? Math.round((Number(ind.total_valor) / totalInds) * 100) : 0;
              return (
                <div key={ind.industria}
                  style={{ padding: '10px 0', borderBottom: i < detail.industrias.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)',
                      textTransform: 'uppercase', flex: 1, minWidth: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ind.industria}
                    </span>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)' }}>
                        {fmtShort(ind.total_valor)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--navy-muted)', marginLeft: 6 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--mustard)', borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>{ind.total_pedidos} pedidos</span>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>{ind.total_skus} SKUs</span>
                    <span style={{ fontSize: 10, color: 'var(--navy-muted)' }}>último: {fmtDate(ind.ultimo_pedido)}</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Contatos ─────────────────────────────────────────────────── */}
        <ContactsSection clientId={Number(id)} isOnline={isOnline} />

        {/* ── Localização ──────────────────────────────────────────────── */}
        <GeoSection
          clientId={Number(id)}
          initialLat={fullCli?.cli_latitude ?? ''}
          initialLng={fullCli?.cli_longitude ?? ''}
          isOnline={isOnline}
        />

        {/* ── IRIS Narrative ────────────────────────────────────────────── */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ background: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
            border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(40,55,74,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionTitle icon={Zap} label="Narrativa IRIS" accent="var(--mustard)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px',
              borderRadius: 20, background: 'rgba(255,210,0,0.1)', border: '1px solid rgba(255,210,0,0.25)' }}>
              <Sparkles size={9} color="var(--mustard)" />
              <span style={{ fontSize: 8, fontWeight: 900, color: 'var(--mustard)',
                textTransform: 'uppercase', letterSpacing: 1 }}>IA</span>
            </div>
          </div>
          {!isOnline ? (
            <p style={{ fontSize: 13, color: 'var(--navy-muted)', fontStyle: 'italic', margin: 0 }}>
              Narrativa IRIS indisponível sem conexão.
            </p>
          ) : loadingN ? (
            <p style={{ fontSize: 13, color: 'var(--navy-muted)', margin: 0 }}>Gerando análise com IA...</p>
          ) : narrative ? (
            <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.7, margin: 0 }}>{narrative}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--navy-muted)', fontStyle: 'italic', margin: 0 }}>
              Análise não disponível para este cliente.
            </p>
          )}
        </motion.div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <button onClick={() => navigate(`/mobile/pedido?cliente=${id}&nome=${encodeURIComponent(cliente?.cli_nomred ?? '')}&cidade=${encodeURIComponent(cliente?.cli_cidade ?? '')}`)}
          style={{ background: 'var(--mustard)', color: 'var(--navy)', border: 'none',
            borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 800,
            cursor: 'pointer', width: '100%', boxShadow: '0 4px 14px rgba(255,210,0,0.35)' }}>
          Fazer Pedido →
        </button>
      </div>
    </div>
  );
}
