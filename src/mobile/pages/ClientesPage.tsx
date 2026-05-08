import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, MapPin }           from 'lucide-react';
import { db }                       from '../db/db';
import { MobileHeader }             from '../components/MobileHeader';
import type { MobileClient }        from '../db/types';

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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<MobileClient[]>([]);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<Filter>('Todos');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forPedido = searchParams.get('for') === 'pedido';

  useEffect(() => { db.clients.toArray().then(setClientes); }, []);

  const fmtCNPJ = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length !== 14) return v;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  const shown = clientes
    .filter(c => {
      const risk = FILTER_RISK[filter];
      if (risk != null && c.risk !== risk) return false;
      const q = search.toLowerCase().replace(/\D/g, '') || search.toLowerCase();
      if (!search.trim()) return true;
      const cnpjDigits = (c.cli_cnpj || '').replace(/\D/g, '');
      return c.cli_nomred.toLowerCase().includes(search.toLowerCase()) ||
             c.cli_cidade.toLowerCase().includes(search.toLowerCase()) ||
             (c.cli_fone1 || '').includes(search) ||
             cnpjDigits.includes(q);
    })
    .sort((a, b) => a.cli_nomred.localeCompare(b.cli_nomred, 'pt-BR'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title={forPedido ? 'Selecionar Cliente' : 'Clientes'} helpItems={[
        { icon: '👆', title: 'Selecionar cliente',     text: 'Toque no nome do cliente para ver os detalhes ou iniciar um pedido.' },
        { icon: '📞', title: 'Ligar direto',           text: 'Toque no ícone de telefone para ligar para o cliente sem sair do app.' },
        { icon: '📍', title: 'Navegar até o cliente',  text: 'Toque no ícone de localização para abrir o Google Maps com o endereço do cliente.' },
        { icon: '🔴', title: 'Burnout',                text: 'Cliente sem compra há mais de 60 dias — prioridade de contato.' },
        { icon: '🟡', title: 'Em queda',               text: 'Cliente que comprou entre 30 e 60 dias atrás — fique de olho.' },
        { icon: '🟢', title: 'Ativo',                  text: 'Comprou nos últimos 30 dias — tudo certo por aqui.' },
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

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
            {clientes.length === 0
              ? 'Nenhum cliente local. Use "Sincronizar para visita".'
              : 'Nenhum resultado encontrado.'}
          </div>
        ) : (
          shown.map(c => (
            <div key={c.cli_codigo} className="card"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => forPedido
                ? navigate(`/mobile/pedido?cliente=${c.cli_codigo}&nome=${encodeURIComponent(c.cli_nomred)}&cidade=${encodeURIComponent(c.cli_cidade)}`)
                : navigate(`/mobile/clientes/${c.cli_codigo}`)
              }>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 8 }}>

                {/* ── Info principal ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.cli_nomred}
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

                {/* ── Coluna direita: badge + ações ── */}
                <div style={{ display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700,
                    color: RISK_COLOR[c.risk],
                    background: `${RISK_COLOR[c.risk]}1A`,
                    padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                    {RISK_LABEL[c.risk]}
                  </span>

                  {/* Botões de ação rápida */}
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
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
