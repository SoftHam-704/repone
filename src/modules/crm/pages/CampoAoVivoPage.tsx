import { useEffect, useState, useCallback } from 'react';
import {
  MapPin, Users, CheckCircle2, XCircle, Loader2,
  Clock, RefreshCw, User, TrendingUp,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';
import { AppSidebar } from '@/shared/components/layout/AppSidebar';

// Fix Leaflet default icon in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function pinIcon(resultado: string | null) {
  const cor = resultado === 'positivou'     ? '#16A34A'
    : resultado === 'nao_positivou'         ? '#DC2626'
    : resultado === null                    ? '#F59E0B'
    : '#6B7280';
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${cor};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

interface Kpis {
  total_visitas: number;
  positivadas: number;
  nao_positivadas: number;
  em_visita: number;
}

interface Promotor {
  ven_codigo: number;
  promotor_nome: string;
  total_visitas: number;
  positivadas: number;
  nao_positivadas: number;
  em_visita: boolean;
  cliente_atual: string | null;
  checkin_atual: string | null;
}

interface Visita {
  id: number;
  cli_codigo: number;
  ven_codigo: number;
  checkin_at: string;
  checkout_at: string | null;
  resultado: string | null;
  motivo_nao_positivo: string | null;
  duracao_minutos: number | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  cliente_nome: string;
  cliente_razao: string;
  promotor_nome: string;
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function ResultadoBadge({ resultado }: { resultado: string | null }) {
  if (!resultado) return (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: 20, border: '1px solid #FDE68A' }}>
      Em visita
    </span>
  );
  const map: Record<string, [string, string, string]> = {
    positivou:     ['✅ Positivou',      '#16A34A', '#F0FDF4'],
    nao_positivou: ['❌ Não positivou',  '#DC2626', '#FEF2F2'],
    reagendou:     ['📅 Reagendou',      '#2563EB', '#EFF6FF'],
    ausente:       ['🚪 Ausente',        '#6B7280', '#F9FAFB'],
    fechado:       ['🔒 Fechado',        '#6B7280', '#F9FAFB'],
  };
  const [label, color, bg] = map[resultado] ?? [resultado, '#6B7280', '#F9FAFB'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}

function PromotorCard({ p }: { p: Promotor }) {
  const taxa = p.total_visitas > 0 ? Math.round((p.positivadas / p.total_visitas) * 100) : 0;
  const taxaColor = taxa >= 60 ? '#16A34A' : taxa >= 40 ? '#F59E0B' : '#DC2626';
  return (
    <div style={{
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 14,
      padding: 16, position: 'relative',
      boxShadow: p.em_visita ? '0 0 0 2px #F59E0B' : 'none',
    }}>
      {p.em_visita && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: '#FEF3C7', color: '#92400E',
          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
          border: '1px solid #FDE68A',
        }}>● EM VISITA</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={18} color={G.textMuted} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: G.text }}>{p.promotor_nome}</div>
          {p.em_visita && p.cliente_atual && (
            <div style={{ fontSize: 11, color: G.textMuted }}>
              {p.cliente_atual} · desde {p.checkin_atual ? fmtHora(p.checkin_atual) : '--'}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {([
          { label: 'Visitas',      value: p.total_visitas,    color: G.text    },
          { label: 'Positivadas',  value: p.positivadas,      color: '#16A34A' },
          { label: 'Não positiv.', value: p.nao_positivadas,  color: '#DC2626' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', background: G.bg, borderRadius: 10, padding: '8px 4px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
          </div>
        ))}
      </div>
      {p.total_visitas > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: G.textMuted }}>Taxa de positivação</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: taxaColor }}>{taxa}%</span>
          </div>
          <div style={{ height: 5, background: G.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${taxa}%`, background: taxaColor, borderRadius: 3, transition: 'width .4s' }} />
          </div>
        </div>
      )}
    </div>
  );
}

function VisitaRow({ v }: { v: Visita }) {
  return (
    <tr style={{ borderBottom: `1px solid ${G.border}` }}>
      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: G.text }}>
        {v.cliente_razao || v.cliente_nome}
        {v.cliente_razao && v.cliente_nome && (
          <div style={{ fontSize: 11, color: G.textMuted, fontWeight: 500 }}>{v.cliente_nome}</div>
        )}
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: G.textSec }}>{v.promotor_nome}</td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: G.text, fontFamily: 'monospace' }}>
        {fmtHora(v.checkin_at)}
        {v.checkout_at && <> → {fmtHora(v.checkout_at)}</>}
        {v.duracao_minutos != null && (
          <span style={{ fontSize: 11, color: G.textMuted, marginLeft: 6 }}>({v.duracao_minutos}min)</span>
        )}
      </td>
      <td style={{ padding: '10px 14px' }}>
        <ResultadoBadge resultado={v.resultado} />
      </td>
    </tr>
  );
}

export default function CampoAoVivoPage() {
  const [kpis, setKpis]             = useState<Kpis | null>(null);
  const [promotores, setPromotores] = useState<Promotor[]>([]);
  const [visitas, setVisitas]       = useState<Visita[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const r = await api.get('/crm/campo/ao-vivo');
      if (r.data.success) {
        setKpis(r.data.data.kpis);
        setPromotores(r.data.data.promotores);
        setVisitas(r.data.data.visitas);
        setLastUpdate(new Date());
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const visitasComCoord = visitas.filter(v => v.checkin_lat && v.checkin_lng);
  const mapCenter: [number, number] = visitasComCoord.length > 0
    ? [Number(visitasComCoord[0].checkin_lat), Number(visitasComCoord[0].checkin_lng)]
    : [-14.235, -51.925];

  const KPI_CONFIG = [
    { icon: <MapPin size={18} />,       label: 'Total de Visitas', key: 'total_visitas'   as const, color: G.text    },
    { icon: <CheckCircle2 size={18} />, label: 'Positivações',     key: 'positivadas'     as const, color: '#16A34A' },
    { icon: <XCircle size={18} />,      label: 'Não positivaram',  key: 'nao_positivadas' as const, color: '#DC2626' },
    { icon: <Clock size={18} />,        label: 'Em visita agora',  key: 'em_visita'       as const, color: '#F59E0B' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: G.bg }}>
      <AppSidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: G.bg, borderBottom: `1px solid ${G.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: G.text, margin: 0, letterSpacing: -0.5 }}>
              Campo Ao Vivo
              <span style={{ fontSize: 12, fontWeight: 700, color: G.textMuted, marginLeft: 8 }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: G.textMuted }}>
                Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => load(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${G.border}`, background: G.card, color: G.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Loader2 size={24} style={{ color: G.textMuted, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* KPI Strip */}
              {kpis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  {KPI_CONFIG.map(({ icon, label, key, color }) => (
                    <div key={key} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 8 }}>
                        {icon}
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{kpis[key]}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Promotor Cards */}
              {promotores.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} /> Promotores
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {promotores.map(p => <PromotorCard key={p.ven_codigo} p={p} />)}
                  </div>
                </div>
              )}

              {/* Map */}
              {visitasComCoord.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={13} /> Mapa de Cobertura
                  </div>
                  <div style={{ height: 360, borderRadius: 16, overflow: 'hidden', border: `1px solid ${G.border}` }}>
                    <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {visitasComCoord.map(v => (
                        <Marker
                          key={v.id}
                          position={[Number(v.checkin_lat), Number(v.checkin_lng)]}
                          icon={pinIcon(v.resultado)}>
                          <Popup>
                            <strong>{v.cliente_razao || v.cliente_nome}</strong><br />
                            {v.promotor_nome}<br />
                            {fmtHora(v.checkin_at)}{v.checkout_at && <> → {fmtHora(v.checkout_at)}</>}
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    {[
                      { cor: '#F59E0B', label: 'Em visita agora' },
                      { cor: '#16A34A', label: 'Positivou' },
                      { cor: '#DC2626', label: 'Não positivou' },
                      { cor: '#6B7280', label: 'Reagendou / Ausente' },
                    ].map(({ cor, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: cor, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 600 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visitas Table */}
              {visitas.length > 0 ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={13} /> Todas as Visitas ({visitas.length})
                  </div>
                  <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: G.cardHi }}>
                          {['Cliente', 'Promotor', 'Horário', 'Resultado'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, borderBottom: `1px solid ${G.border}` }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visitas.map(v => <VisitaRow key={v.id} v={v} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: G.textMuted, padding: '60px 0', fontSize: 14 }}>
                  Nenhuma visita registrada hoje ainda.
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
