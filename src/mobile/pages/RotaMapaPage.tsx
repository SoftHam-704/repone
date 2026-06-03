// src/mobile/pages/RotaMapaPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navigation, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { MobileHeader } from '../components/MobileHeader';
import { RotaMap, type ParadaMapa } from '../components/RotaMap';
import { calcKm, mapsUrlRotaInteira, mapsUrlCliente, paradasForaDoLink } from '../lib/rota';

interface Parada extends ParadaMapa {
  itp_codigo: number;
  itp_ordem: number;
  cli_codigo: number;
}

export default function RotaMapaPage() {
  const { id } = useParams();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(true);
      return;
    }
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const r = await api.get(`/itinerarios/${id}/paradas`);
        // pg NUMERIC chega como string → coage p/ número (senão o center vira NaN e o Leaflet quebra)
        const data = (r.data?.data || []).map((p: any) => ({
          ...p,
          cli_latitude: p.cli_latitude != null ? Number(p.cli_latitude) : null,
          cli_longitude: p.cli_longitude != null ? Number(p.cli_longitude) : null,
          gps_real: p.gps_real === true || p.gps_real === 'true' || p.gps_real === 't',
        }));
        setParadas(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const geo = useMemo(
    () => paradas.map((p) => ({ lat: p.cli_latitude, lng: p.cli_longitude })),
    [paradas]
  );
  const kmTotal = useMemo(() => calcKm(geo), [geo]);
  const center = useMemo<[number, number]>(() => {
    const c = paradas.filter((p) => p.cli_latitude && p.cli_longitude);
    if (c.length === 0) return [-20.46, -54.62]; // fallback: Campo Grande/MS
    const lat = c.reduce((s, p) => s + p.cli_latitude!, 0) / c.length;
    const lng = c.reduce((s, p) => s + p.cli_longitude!, 0) / c.length;
    return [lat, lng];
  }, [paradas]);

  const fora = paradasForaDoLink(geo);
  const urlRota = mapsUrlRotaInteira(geo);

  return (
    <>
      <MobileHeader title="Rota no mapa" showBack />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={26} style={{ color: 'var(--navy)', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--navy-muted)', fontSize: 14 }}>
          <AlertCircle size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Não foi possível carregar a rota</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Verifique sua conexão e tente novamente.</p>
        </div>
      ) : paradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--navy-muted)', fontSize: 14 }}>
          <MapPin size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Esta rota ainda não tem clientes</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Adicione paradas pela rota no sistema web.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Mapa */}
          <div style={{ height: '42vh', minHeight: 240 }}>
            <RotaMap paradas={paradas} kmTotal={kmTotal} center={center} />
          </div>

          {/* Navegar rota inteira */}
          <div style={{ padding: '12px 16px 0' }}>
            <button
              disabled={!urlRota}
              onClick={() => urlRota && window.open(urlRota, '_blank')}
              style={{
                width: '100%',
                background: urlRota ? 'var(--navy)' : '#cbd5e1',
                color: '#FFF',
                border: 'none',
                borderRadius: 12,
                padding: '13px',
                fontWeight: 800,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: urlRota ? 'pointer' : 'default',
              }}
            >
              <Navigation size={18} style={{ color: '#FFD200' }} />
              Navegar rota inteira
            </button>
            {fora > 0 && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: '#92400e',
                  background: '#fef3c7',
                  borderRadius: 8,
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle size={14} /> O Google Maps abre as 10 primeiras paradas. {fora} restante
                {fora === 1 ? '' : 's'}: navegue uma a uma pela lista.
              </div>
            )}
          </div>

          {/* Lista de paradas */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paradas.map((p, idx) => {
              const url = mapsUrlCliente({ lat: p.cli_latitude, lng: p.cli_longitude });
              return (
                <button
                  key={p.itp_codigo}
                  disabled={!url}
                  onClick={() => url && window.open(url, '_blank')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#FFF',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    cursor: url ? 'pointer' : 'default',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--navy)',
                      color: '#FFF',
                      fontSize: 11,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--navy)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.cli_nome}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2 }}>
                      {p.cli_bairro ? p.cli_bairro + ' — ' : ''}
                      {p.cli_cidade}/{p.cli_uf}
                      {!p.gps_real && (
                        <span style={{ color: '#94a3b8' }}> · posição aproximada</span>
                      )}
                    </div>
                  </div>
                  {url && <Navigation size={16} style={{ color: 'var(--navy)', flexShrink: 0 }} />}
                  {!url && <MapPin size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
