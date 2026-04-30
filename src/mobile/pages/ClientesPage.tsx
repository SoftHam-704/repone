import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db }           from '../db/db';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileClient } from '../db/types';

type Filter = 'Todos' | 'Ativos' | 'Em queda' | 'Burnout';

const FILTER_RISK: Record<Filter, MobileClient['risk'] | null> = {
  'Todos':    null,
  'Ativos':   'ativo',
  'Em queda': 'em_queda',
  'Burnout':  'burnout',
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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<MobileClient[]>([]);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<Filter>('Todos');
  const navigate = useNavigate();

  useEffect(() => { db.clients.toArray().then(setClientes); }, []);

  const shown = clientes.filter(c => {
    const risk  = FILTER_RISK[filter];
    if (risk != null && c.risk !== risk) return false;
    const q = search.toLowerCase();
    return !q ||
      c.cli_nomred.toLowerCase().includes(q) ||
      c.cli_cidade.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="Clientes" />

      <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>
        <input
          placeholder="Buscar por nome ou cidade..."
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

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto',
        padding: '8px 16px 16px' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)',
            fontSize: 13, padding: 32 }}>
            {clientes.length === 0
              ? 'Nenhum cliente local. Use "Sincronizar para visita".'
              : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          shown.map(c => (
            <div key={c.cli_codigo} className="card"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => navigate(`/mobile/clientes/${c.cli_codigo}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.cli_nomred}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2 }}>
                    {c.cli_cidade}{c.cli_uf ? ` — ${c.cli_uf}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700,
                  color: RISK_COLOR[c.risk],
                  background: `${RISK_COLOR[c.risk]}1A`,
                  padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {RISK_LABEL[c.risk]}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
