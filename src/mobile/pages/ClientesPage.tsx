import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, MapPin, Plus, X, Loader2, LogIn, LogOut } from 'lucide-react';
import { db }                       from '../db/db';
import { api }                      from '@/shared/lib/api';
import { MobileHeader }             from '../components/MobileHeader';
import { useAuthStore }             from '@/shared/stores/useAuthStore';
import type { MobileClient }        from '../db/types';
import { CheckoutResultadoModal }   from '../components/CheckoutResultadoModal';

const SS_KEY = 'mobile_clientes_ui';

type Filter = 'Todos' | 'Ativos' | 'Em queda' | 'Burnout' | 'Prospects';

const FILTER_RISK: Record<Filter, MobileClient['risk'] | null> = {
  'Todos':     null,
  'Ativos':    'ativo',
  'Em queda':  'em_queda',
  'Burnout':   'burnout',
  'Prospects': null,
};

const RISK_LABEL: Record<MobileClient['risk'], string> = {
  ativo:    'Ativo',
  em_queda: 'Em queda',
  burnout:  'Burnout',
};

const RISK_COLOR: Record<MobileClient['risk'], string> = {
  ativo:    '#16A34A',
  em_queda: '#D97706',
  burnout:  '#DC2626',
};

function mapsUrl(c: MobileClient): string {
  const parts = [
    c.cli_endereco && c.cli_endnum
      ? `${c.cli_endereco}, ${c.cli_endnum}`
      : c.cli_endereco || '',
    c.cli_bairro || '',
    c.cli_cidade && c.cli_uf ? `${c.cli_cidade}-${c.cli_uf}` : c.cli_cidade || '',
  ].filter(Boolean);

  const query = parts.length >= 2
    ? parts.join(', ')
    : `${c.cli_nomred} ${c.cli_cidade} ${c.cli_uf}`.trim();

  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}

function readSS() {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); } catch { return {}; }
}

interface ProspectForm {
  cli_nomred: string;
  cli_fantasia: string;
  cli_fone1: string;
  cli_cidade: string;
  obs: string;
}

const emptyProspect: ProspectForm = {
  cli_nomred: '', cli_fantasia: '', cli_fone1: '', cli_cidade: '', obs: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<MobileClient[]>([]);
  const [search,   setSearch]   = useState<string>(() => readSS().search || '');
  const [filter,   setFilter]   = useState<Filter>(() => readSS().filter  || 'Todos');
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [prospectForm, setProspectForm] = useState<ProspectForm>(emptyProspect);
  const [savingProspect, setSavingProspect] = useState(false);
  const [prospectError, setProspectError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forPedido = searchParams.get('for') === 'pedido';
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // ── Check-in state ─────────────────────────────────────────────────────────
  const [checkIns, setCheckIns] = useState<Set<number>>(new Set());
  const [loadingCI, setLoadingCI] = useState<number | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{ cli_codigo: number; nome: string } | null>(null);
  const [campoIds, setCampoIds] = useState<Map<number, number>>(new Map()); // cli_codigo → campo_id

  useEffect(() => {
    if (!user?.codigo) return;
    api.get(`/crm/visitas/hoje?ven_codigo=${user.codigo}`)
      .then(r => {
        if (r.data.success) {
          setCheckIns(new Set((r.data.data as any[]).map(v => v.cli_codigo)));
        }
      })
      .catch(() => {});
  }, [user?.codigo]);

  function getGPS(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  async function handleCheckin(e: React.MouseEvent, cli_codigo: number) {
    e.stopPropagation();
    if (!user?.codigo) return;
    setLoadingCI(cli_codigo);
    try {
      const gps = await getGPS();
      const r = await api.post('/crm/visitas/checkin', {
        ven_codigo: user.codigo, cli_codigo, ...gps,
      });
      if (r.data.success) {
        setCheckIns(prev => new Set([...prev, cli_codigo]));
        if (r.data.campo_id) {
          setCampoIds(prev => new Map(prev).set(cli_codigo, r.data.campo_id));
        }
        const dist = r.data.distancia_metros;
        const msg = dist != null ? ` (${dist}m do cadastro)` : '';
        alert(`Check-in registrado${msg}`);
      }
    } catch { alert('Erro ao registrar check-in.'); }
    finally { setLoadingCI(null); }
  }

  function openCheckoutModal(e: React.MouseEvent, cli_codigo: number, nome: string) {
    e.stopPropagation();
    if (!user?.codigo) return;
    setCheckoutModal({ cli_codigo, nome });
  }

  async function handleCheckoutConfirm(resultado: string, motivo: string | null) {
    if (!checkoutModal || !user?.codigo) return;
    const { cli_codigo } = checkoutModal;
    setLoadingCI(cli_codigo);
    try {
      const gps = await getGPS();
      const campo_id = campoIds.get(cli_codigo) ?? null;
      const r = await api.post('/crm/visitas/checkout', {
        ven_codigo: user.codigo, cli_codigo, resultado,
        motivo_nao_positivo: motivo,
        campo_id,
        ...gps,
      });
      if (r.data.success) {
        setCheckIns(prev => { const s = new Set(prev); s.delete(cli_codigo); return s; });
        setCampoIds(prev => { const m = new Map(prev); m.delete(cli_codigo); return m; });
        setCheckoutModal(null);
      }
    } catch { alert('Erro ao registrar check-out.'); }
    finally { setLoadingCI(null); }
  }

  useEffect(() => { db.clients.toArray().then(setClientes); }, []);

  useEffect(() => {
    if (clientes.length === 0) return;
    const saved = Number(readSS().scroll || 0);
    if (saved > 0 && scrollRef.current) scrollRef.current.scrollTop = saved;
  }, [clientes]);

  useEffect(() => {
    const cur = readSS();
    sessionStorage.setItem(SS_KEY, JSON.stringify({ ...cur, search, filter }));
  }, [search, filter]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const cur = readSS();
    sessionStorage.setItem(SS_KEY, JSON.stringify({ ...cur, scroll: e.currentTarget.scrollTop }));
  }, []);

  const fmtCNPJ = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length !== 14) return v;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  const shown = clientes
    .filter(c => {
      if (forPedido && c.cli_atuacao === 'P') return false;
      if (filter === 'Prospects') return c.cli_atuacao === 'P';
      const risk = FILTER_RISK[filter];
      if (risk != null && c.risk !== risk) return false;
      if (filter !== 'Todos' && filter !== 'Prospects' && c.cli_atuacao === 'P') return false;
      const q = search.toLowerCase().replace(/\D/g, '') || search.toLowerCase();
      if (!search.trim()) return true;
      const cnpjDigits = (c.cli_cnpj || '').replace(/\D/g, '');
      return c.cli_nomred.toLowerCase().includes(search.toLowerCase()) ||
             c.cli_cidade.toLowerCase().includes(search.toLowerCase()) ||
             (c.cli_fone1 || '').includes(search) ||
             cnpjDigits.includes(q);
    })
    .sort((a, b) => a.cli_nomred.localeCompare(b.cli_nomred, 'pt-BR'));

  async function saveProspect() {
    if (!prospectForm.cli_nomred.trim()) { setProspectError('Nome é obrigatório.'); return; }
    setSavingProspect(true); setProspectError('');
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS opcional */ }

      await api.post('/clients', {
        cli_nomred:   prospectForm.cli_nomred.trim(),
        cli_fantasia: prospectForm.cli_fantasia.trim(),
        cli_fone1:    prospectForm.cli_fone1.trim(),
        cli_cidade:   prospectForm.cli_cidade.trim(),
        cli_obspedido: prospectForm.obs.trim(),
        cli_atuacao:  'P',
        cli_tipopes:  'A',
        cli_latitude:  lat,
        cli_longitude: lng,
      });

      setShowProspectModal(false);
      setProspectForm(emptyProspect);
      // Re-sync clientes para incluir o novo prospect
      const r = await api.get('/clients?limit=5000');
      const rows: MobileClient[] = (r.data.data || []).map((c: any) => {
        const days = typeof c.dias_sem_compra === 'number' ? c.dias_sem_compra : 999;
        const risk: MobileClient['risk'] =
          days <= 30 ? 'ativo' : days <= 60 ? 'em_queda' : 'burnout';
        return {
          cli_codigo: Number(c.cli_codigo), cli_nomred: c.cli_nomred || c.cli_nome || '',
          cli_cidade: c.cli_cidade || '', cli_uf: c.cli_uf || '',
          cli_email: c.cli_email || '', cli_cnpj: c.cli_cnpj || '',
          cli_fone1: c.cli_fone1 || '', cli_atuacao: c.cli_atuacao || '',
          cli_endereco: c.cli_endereco || '', cli_endnum: c.cli_endnum || '',
          cli_bairro: c.cli_bairro || '', risk,
        };
      });
      await db.clients.clear();
      await db.clients.bulkPut(rows);
      setClientes(rows);
      setFilter('Prospects');
    } catch (e: any) {
      setProspectError(e?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSavingProspect(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title={forPedido ? 'Selecionar Cliente' : 'Clientes'} helpItems={[
        { icon: '👆', title: 'Selecionar cliente',     text: 'Toque no nome do cliente para ver os detalhes ou iniciar um pedido.' },
        { icon: '📞', title: 'Ligar direto',           text: 'Toque no ícone de telefone para ligar para o cliente sem sair do app.' },
        { icon: '📍', title: 'Navegar até o cliente',  text: 'Toque no ícone de localização para abrir o Google Maps com o endereço do cliente.' },
        { icon: '🔴', title: 'Burnout',                text: 'Cliente sem compra há mais de 60 dias — prioridade de contato.' },
        { icon: '🟡', title: 'Em queda',               text: 'Cliente que comprou entre 30 e 60 dias atrás — fique de olho.' },
        { icon: '🟢', title: 'Ativo',                  text: 'Comprou nos últimos 30 dias — tudo certo por aqui.' },
        { icon: '🎯', title: 'Prospects',              text: 'Clientes em prospecção — ainda não realizaram pedidos. Toque em "+ Prospect" para cadastrar um novo.' },
      ]} />

      <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>
        <input
          placeholder="Buscar por nome, cidade ou CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' as const }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {(Object.keys(FILTER_RISK) as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="pill" style={{
              background: filter === f ? 'var(--navy)' : 'var(--sand-card)',
              color:      filter === f ? '#FFF'        : 'var(--navy)',
              flexShrink: 0,
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="screen-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 80px' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
            {clientes.length === 0
              ? 'Nenhum cliente local. Use "Sincronizar para visita".'
              : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          shown.map(c => {
            const isProspect = c.cli_atuacao === 'P';
            return (
              <div key={c.cli_codigo} className="card"
                style={{ marginBottom: 8, cursor: 'pointer' }}
                onClick={() => forPedido
                  ? navigate(`/mobile/pedido?cliente=${c.cli_codigo}&nome=${encodeURIComponent(c.cli_nomred)}&cidade=${encodeURIComponent(c.cli_cidade)}`)
                  : navigate(`/mobile/clientes/${c.cli_codigo}`)
                }>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', gap: 8 }}>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.cli_nomred}
                      </span>
                      {isProspect && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E',
                          background: '#FEF3C7', border: '1px solid #FDE68A',
                          padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>
                          PROSPECT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2 }}>
                      {c.cli_cidade}{c.cli_uf ? ` — ${c.cli_uf}` : ''}
                    </div>
                    {c.cli_cnpj && (
                      <div style={{ fontSize: 11, color: 'var(--navy-muted)',
                        fontFamily: 'monospace', fontWeight: 600, marginTop: 2 }}>
                        {fmtCNPJ(c.cli_cnpj)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    {!isProspect && (
                      <span style={{ fontSize: 11, fontWeight: 700,
                        color: RISK_COLOR[c.risk],
                        background: `${RISK_COLOR[c.risk]}1A`,
                        padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                        {RISK_LABEL[c.risk]}
                      </span>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}
                      onClick={e => e.stopPropagation()}>
                      {c.cli_fone1 && (
                        <a href={`tel:${c.cli_fone1.replace(/\D/g, '')}`}
                          style={{ width: 32, height: 32, borderRadius: 8,
                            border: '1px solid #2563EB', background: '#EFF6FF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            textDecoration: 'none' }}>
                          <Phone size={14} color="#2563EB" />
                        </a>
                      )}
                      <a href={mapsUrl(c)} target="_blank" rel="noreferrer"
                        style={{ width: 32, height: 32, borderRadius: 8,
                          border: '1px solid #16A34A', background: '#F0FDF4',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          textDecoration: 'none' }}>
                        <MapPin size={14} color="#16A34A" />
                      </a>

                      {/* Check-in / Check-out */}
                      {!forPedido && (() => {
                        const isIn  = checkIns.has(c.cli_codigo);
                        const busy  = loadingCI === c.cli_codigo;
                        return (
                          <button
                            onClick={e => isIn
                              ? openCheckoutModal(e, c.cli_codigo, c.cli_nomred || String(c.cli_codigo))
                              : handleCheckin(e, c.cli_codigo)
                            }
                            disabled={busy}
                            style={{
                              width: 32, height: 32, borderRadius: 8, cursor: busy ? 'default' : 'pointer',
                              border: `1px solid ${isIn ? '#DC2626' : '#16A34A'}`,
                              background: isIn ? '#FEF2F2' : '#F0FDF4',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            {busy
                              ? <Loader2 size={13} color="#94A3B8" style={{ animation: 'spin 1s linear infinite' }} />
                              : isIn
                                ? <LogOut size={14} color="#DC2626" />
                                : <LogIn  size={14} color="#16A34A" />
                            }
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Botão flutuante + Prospect (oculto no modo forPedido) */}
      {!forPedido && (
        <button
          onClick={() => { setShowProspectModal(true); setProspectError(''); }}
          style={{ position: 'absolute', bottom: 76, right: 20,
            background: '#F59E0B', color: '#fff', border: 'none',
            borderRadius: 28, padding: '12px 20px', fontSize: 14, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(245,158,11,0.4)', zIndex: 20 }}>
          <Plus size={16} />
          Prospect
        </button>
      )}

      {/* Modal checkout resultado */}
      {checkoutModal && (
        <CheckoutResultadoModal
          clienteNome={checkoutModal.nome}
          onConfirm={handleCheckoutConfirm}
          onCancel={() => setCheckoutModal(null)}
        />
      )}

      {/* Modal prospect */}
      {showProspectModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#0009', zIndex: 100,
          display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setShowProspectModal(false); }}>
          <div style={{ width: '100%', background: 'var(--sand-bg)', borderRadius: '20px 20px 0 0',
            padding: '20px 20px 90px', display: 'flex', flexDirection: 'column', gap: 12,
            maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>
                Novo Prospect
              </div>
              <button onClick={() => setShowProspectModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="var(--navy-muted)" />
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--navy-muted)', marginTop: -4 }}>
              GPS capturado automaticamente. Complete o cadastro completo depois.
            </div>

            {[
              { label: 'Nome Reduzido *', key: 'cli_nomred', placeholder: 'Como você vai chamar' },
              { label: 'Fantasia / Razão',  key: 'cli_fantasia', placeholder: 'Nome completo do negócio' },
              { label: 'Telefone',         key: 'cli_fone1',   placeholder: '(00) 00000-0000' },
              { label: 'Cidade',           key: 'cli_cidade',  placeholder: 'Cidade' },
              { label: 'Observação',       key: 'obs',         placeholder: 'Notas da visita...' },
            ].map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.6 }}>{f.label}</label>
                <input
                  value={(prospectForm as any)[f.key]}
                  onChange={e => setProspectForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
                    background: '#fff', color: 'var(--navy)', padding: '11px 12px',
                    fontFamily: 'inherit', outline: 'none', width: '100%',
                    boxSizing: 'border-box' as const }}
                />
              </div>
            ))}

            {prospectError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                {prospectError}
              </div>
            )}

            <button onClick={saveProspect} disabled={savingProspect}
              style={{ background: '#F59E0B', color: '#fff', border: 'none',
                borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, opacity: savingProspect ? 0.7 : 1 }}>
              {savingProspect
                ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <Plus size={18} />}
              {savingProspect ? 'Salvando...' : 'Salvar Prospect'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
