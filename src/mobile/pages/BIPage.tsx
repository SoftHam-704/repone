import { useEffect, useState } from 'react';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';

interface KPI { label: string; value: string }

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BIPage() {
  const { isOnline }           = useOffline();
  const [kpis,    setKpis]     = useState<KPI[]>([]);
  const [loading, setLoading]  = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    setLoading(true);
    const now = new Date();
    api.get(`/bi/overview?ano=${now.getFullYear()}&mes=${now.getMonth() + 1}`)
      .then(r => {
        const d = r.data.data || r.data || {};
        setKpis([
          { label: 'Faturamento do Mês',
            value: fmtBRL(parseFloat(d.faturamento_mes ?? d.fat_mes ?? '0')) },
          { label: 'Faturamento do Ano',
            value: fmtBRL(parseFloat(d.faturamento_ano ?? d.fat_ano ?? '0')) },
          { label: 'Ticket Médio',
            value: fmtBRL(parseFloat(d.ticket_medio ?? d.ticket ?? '0')) },
        ]);
      })
      .catch(() => setKpis([]))
      .finally(() => setLoading(false));
  }, [isOnline]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="BI" />
      {!isOnline ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <span style={{ fontSize: 48 }}>📊</span>
          <div style={{ fontSize: 14, color: 'var(--navy-muted)', textAlign: 'center' }}>
            BI Intelligence requer conexão com a internet.
          </div>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--navy-muted)', fontSize: 13 }}>
          Carregando...
        </div>
      ) : (
        <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {kpis.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--navy-muted)',
              fontSize: 13, padding: 24 }}>
              Sem dados disponíveis.
            </div>
          ) : (
            kpis.map(kpi => (
              <div key={kpi.label} className="card">
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>
                  {kpi.value}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
