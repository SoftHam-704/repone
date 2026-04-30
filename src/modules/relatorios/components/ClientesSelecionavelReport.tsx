import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, MapPin, Building2, Users,
  Calendar, UserCheck, Loader2, Check,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Cliente {
  cli_codigo: number;
  cli_nome: string;
  cli_nomred: string;
  cli_cnpj: string;
  cli_cidade: string;
  cli_uf: string;
  cli_tipopes: string;
  cli_fone1: string;
  cli_email: string;
}

const FILTER_MODES = [
  { id: 'all',      label: 'Todos',                    icon: UserCheck  },
  { id: 'region',   label: 'Por região',               icon: MapPin     },
  { id: 'city',     label: 'Por cidade',               icon: Building2  },
  { id: 'seller',   label: 'Por vendedor',             icon: Users      },
  { id: 'state',    label: 'Por estado',               icon: MapPin     },
  { id: 'area',     label: 'Por área de atuação',      icon: Filter     },
  { id: 'industry', label: 'Por indústria',            icon: Building2  },
  { id: 'period',   label: 'Compraram no período',     icon: Calendar   },
] as const;

type FilterModeId = typeof FILTER_MODES[number]['id'];

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// ─── Estilos reutilizáveis ────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
  border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none',
};

const sel: React.CSSProperties = {
  ...inp, cursor: 'pointer',
};

const th: React.CSSProperties = {
  padding: '9px 12px', fontSize: 10, fontWeight: 800,
  color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  borderBottom: `1px solid ${G.border}`, textAlign: 'left',
  background: G.cardHi, whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, color: G.text,
  borderBottom: `1px solid ${G.border}`,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ClientesSelecionavelReport() {
  const [mode, setMode]     = useState<FilterModeId>('all');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  // Aux data
  const [regioes, setRegioes]       = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [areas, setAreas]           = useState<any[]>([]);
  const [industrias, setIndustrias] = useState<any[]>([]);

  // Filter values
  const [selRegion,   setSelRegion]   = useState('all');
  const [selCity,     setSelCity]     = useState('');
  const [selSeller,   setSelSeller]   = useState('all');
  const [selState,    setSelState]    = useState('all');
  const [selArea,     setSelArea]     = useState('all');
  const [selIndustry, setSelIndustry] = useState('all');
  const [dateStart,   setDateStart]   = useState('');
  const [dateEnd,     setDateEnd]     = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/aux/regioes'),
      api.get('/aux/vendedores'),
      api.get('/area-atuacao'),
      api.get('/aux/industrias'),
    ]).then(([r, v, a, i]) => {
      if (r.data.success) setRegioes(r.data.data);
      if (v.data.success) setVendedores(v.data.data);
      if (a.data.success) setAreas(a.data.data);
      if (i.data.success) setIndustrias(i.data.data);
    });
  }, []);

  const buscar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      mode, status,
      region:   selRegion,
      city:     selCity,
      seller:   selSeller,
      area:     selArea,
      industry: selIndustry,
      state:    selState,
      start:    dateStart,
      end:      dateEnd,
    });
    try {
      const r = await api.get(`/reports/clientes/selecionavel?${params}`);
      if (r.data.success) {
        setClientes(r.data.data);
        setSelectedIds(new Set(r.data.data.map((c: Cliente) => c.cli_codigo)));
      }
    } finally {
      setLoading(false);
    }
  }, [mode, status, selRegion, selCity, selSeller, selArea, selIndustry, selState, dateStart, dateEnd]);

  const filteredClientes = clientes.filter(c =>
    !search
    || c.cli_nomred?.toLowerCase().includes(search.toLowerCase())
    || c.cli_nome?.toLowerCase().includes(search.toLowerCase())
    || String(c.cli_codigo).includes(search)
  );

  const toggleAll = () => {
    if (selectedIds.size === clientes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(clientes.map(c => c.cli_codigo)));
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Painel de filtros ── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: `1px solid ${G.border}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '12px 10px',
        background: G.cardHi, gap: 4,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.8, marginBottom: 4, padding: '0 4px' }}>
          MODO DE FILTRO
        </div>

        {FILTER_MODES.map(f => {
          const Icon = f.icon;
          const active = mode === f.id;
          return (
            <button key={f.id} onClick={() => setMode(f.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 9, fontSize: 11, fontWeight: 700,
              border: active ? `1.5px solid ${G.mustard}50` : '1.5px solid transparent',
              background: active ? `${G.mustard}15` : 'transparent',
              color: active ? G.mustard : G.textSec, cursor: 'pointer',
              transition: 'all 0.13s', textAlign: 'left',
            }}>
              <Icon size={13} />
              {f.label}
            </button>
          );
        })}

        {/* Sub-filtro dinâmico */}
        {mode !== 'all' && (
          <div style={{ marginTop: 8, padding: '10px 8px', borderRadius: 10, background: G.card, border: `1px solid ${G.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: G.mustard, letterSpacing: 0.8, marginBottom: 8 }}>
              OPÇÕES
            </div>

            {mode === 'region' && (
              <select style={sel} value={selRegion} onChange={e => setSelRegion(e.target.value)}>
                <option value="all">Todas as Regiões</option>
                {regioes.map(r => <option key={r.reg_codigo} value={r.reg_codigo}>{r.reg_nome}</option>)}
              </select>
            )}

            {mode === 'city' && (
              <input style={inp} placeholder="Nome da cidade..." value={selCity} onChange={e => setSelCity(e.target.value)} />
            )}

            {mode === 'seller' && (
              <select style={sel} value={selSeller} onChange={e => setSelSeller(e.target.value)}>
                <option value="all">Todos os Vendedores</option>
                {vendedores.map(v => <option key={v.ven_codigo} value={v.ven_codigo}>{v.ven_nome}</option>)}
              </select>
            )}

            {mode === 'state' && (
              <select style={sel} value={selState} onChange={e => setSelState(e.target.value)}>
                <option value="all">Todos os Estados</option>
                {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            )}

            {mode === 'area' && (
              <select style={sel} value={selArea} onChange={e => setSelArea(e.target.value)}>
                <option value="all">Todas as Áreas</option>
                {areas.map(a => <option key={a.atu_id} value={a.atu_id}>{a.atu_descricao}</option>)}
              </select>
            )}

            {mode === 'industry' && (
              <select style={sel} value={selIndustry} onChange={e => setSelIndustry(e.target.value)}>
                <option value="all">Todas as Indústrias</option>
                {industrias.map(i => <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>)}
              </select>
            )}

            {mode === 'period' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 700, marginBottom: 3 }}>INÍCIO</div>
                  <input type="date" style={inp} value={dateStart} onChange={e => setDateStart(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 700, marginBottom: 3 }}>FIM</div>
                  <input type="date" style={inp} value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, letterSpacing: 0.8, marginBottom: 6, padding: '0 4px' }}>STATUS</div>
          <select style={sel} value={status} onChange={e => setStatus(e.target.value as any)}>
            <option value="active">Clientes Ativos</option>
            <option value="inactive">Clientes Inativos</option>
            <option value="all">Todos</option>
          </select>
        </div>

        <button onClick={buscar} disabled={loading} style={{
          marginTop: 10, padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 800,
          border: 'none', background: G.mustard, color: G.text, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* ── Conteúdo principal ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Barra de busca + contadores */}
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${G.border}`,
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: G.cardHi,
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
            <input
              style={{ ...inp, paddingLeft: 30 }}
              placeholder="Buscar na lista (nome, código...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {clientes.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, whiteSpace: 'nowrap' }}>
              {selectedIds.size} de {filteredClientes.length} selecionados
            </span>
          )}
        </div>

        {/* Tabela */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {clientes.length === 0 && !loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
              {clientes.length === 0
                ? 'Configure o filtro e clique em Buscar'
                : 'Nenhum cliente encontrado'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '36px' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'center', width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === clientes.length && clientes.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', accentColor: G.mustard }}
                    />
                  </th>
                  <th style={th}>Cód.</th>
                  <th style={th}>Nome Fantasia</th>
                  <th style={th}>Razão Social</th>
                  <th style={th}>Cidade</th>
                  <th style={th}>UF</th>
                  <th style={th}>Telefone</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.map((c, i) => (
                  <tr
                    key={c.cli_codigo}
                    onClick={() => toggleOne(c.cli_codigo)}
                    style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30`, cursor: 'pointer' }}
                  >
                    <td style={{ ...td, textAlign: 'center' }}>
                      {selectedIds.has(c.cli_codigo)
                        ? <Check size={14} style={{ color: G.mustard }} />
                        : <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${G.border}` }} />
                      }
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.mustard }}>
                      {c.cli_codigo}
                    </td>
                    <td style={{ ...td, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.cli_nomred || '—'}
                    </td>
                    <td style={{ ...td, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.cli_nome}
                    </td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.cli_cidade || '—'}
                    </td>
                    <td style={td}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4,
                        background: `${G.border}60`, fontSize: 10, fontWeight: 800, color: G.textSec,
                      }}>
                        {c.cli_uf || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: G.textSec }}>
                      {c.cli_fone1 || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
