import { useEffect, useState } from 'react';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';

interface SellOutItem {
  produto?: string;
  nome?:    string;
  valor?:   number;
  total?:   number;
  [key: string]: unknown;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SellOutPage() {
  const { isOnline }           = useOffline();
  const [data,    setData]     = useState<SellOutItem[]>([]);
  const [loading, setLoading]  = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    setLoading(true);
    const now     = new Date();
    const dtInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const dtFim    = now.toISOString().split('T')[0];
    api.get(`/estatisticas/sellout-real?dataInicio=${dtInicio}&dataFim=${dtFim}`)
      .then(r => setData(r.data.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [isOnline]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="Sell-Out" />
      {!isOnline ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <span style={{ fontSize: 48 }}>📶</span>
          <div style={{ fontSize: 14, color: 'var(--navy-muted)', textAlign: 'center' }}>
            Sell-Out requer conexão com a internet.
          </div>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--navy-muted)', fontSize: 13 }}>
          Carregando...
        </div>
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--navy-muted)', fontSize: 13 }}>
          Nenhum dado de sell-out disponível.
        </div>
      ) : (
        <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {data.map((row, idx) => {
            const nome  = String(row.produto ?? row.nome ?? `Item ${idx + 1}`);
            const valor = Number(row.valor ?? row.total ?? 0);
            return (
              <div key={idx} className="prod-row">
                <span style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>{nome}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700,
                  fontSize: 13, color: 'var(--navy)' }}>
                  {fmtBRL(valor)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
