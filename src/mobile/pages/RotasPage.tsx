// src/mobile/pages/RotasPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { MobileHeader } from '../components/MobileHeader';

interface Rota {
  iti_codigo: number;
  iti_descricao: string;
  iti_frequencia: string | null;
  regiao_nome: string | null;
  total_paradas: number | string;
}

export default function RotasPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const r = await api.get('/itinerarios');
        setRows(r.data?.data || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <MobileHeader
        title="Rotas"
        helpItems={[
          {
            icon: '🗺️',
            title: 'O que é',
            text: 'Suas rotas (itinerários) cadastradas no sistema. Toque numa rota para ver os clientes no mapa e navegar.',
          },
        ]}
      />

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={26} style={{ color: 'var(--navy)', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--navy-muted)', fontSize: 14 }}>
            <RouteIcon size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
            <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Não foi possível carregar as rotas</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Verifique sua conexão e tente novamente.</p>
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--navy-muted)',
              fontSize: 14,
            }}
          >
            <RouteIcon size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
            <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Nenhuma rota cadastrada</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>As rotas são montadas no sistema web.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((r) => (
              <button
                key={r.iti_codigo}
                onClick={() => navigate(`/mobile/rotas/${r.iti_codigo}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#FFF',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(40,55,74,0.06)',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'var(--navy)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <RouteIcon size={20} color="#FFD200" strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      color: 'var(--navy)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {r.iti_descricao}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-muted)',
                      marginTop: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={12} /> {Number(r.total_paradas)} cliente{Number(r.total_paradas) === 1 ? '' : 's'}
                    </span>
                    {r.regiao_nome && <span>· {r.regiao_nome}</span>}
                    {r.iti_frequencia && <span>· {r.iti_frequencia}</span>}
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--navy-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
