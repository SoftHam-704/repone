import { useEffect, useState } from 'react';
import { db }           from '../db/db';
import { api }          from '@/shared/lib/api';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileProduct, MobilePrice } from '../db/types';

interface Row extends MobileProduct {
  preco:    number | null;
  tabela_id: number | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function TabelaPrecosPage() {
  const [industrias,  setIndustrias]  = useState<{ id: number; nome: string }[]>([]);
  const [selectedInd, setSelectedInd] = useState<number | null>(null);
  const [search,      setSearch]      = useState('');
  const [rows,        setRows]        = useState<Row[]>([]);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    api.get('/aux/industrias')
      .then(r => {
        const inds = (r.data.data || []).map((f: any) => ({
          id:   Number(f.for_codigo),
          nome: f.for_nomered || f.for_nome,
        }));
        setIndustrias(inds);
        if (inds.length > 0) setSelectedInd(inds[0].id);
      })
      .catch(async () => {
        const prods = await db.products.toArray();
        const map   = new Map<number, boolean>();
        prods.forEach(p => map.set(p.pro_industria, true));
        const inds  = Array.from(map.keys()).map(id => ({ id, nome: String(id) }));
        setIndustrias(inds);
        if (inds.length > 0) setSelectedInd(inds[0].id);
      });
  }, []);

  useEffect(() => {
    if (selectedInd == null) return;
    setLoading(true);
    async function load() {
      const prods = await db.products
        .where('pro_industria').equals(selectedInd!)
        .toArray();
      const result: Row[] = await Promise.all(
        prods.map(async p => {
          const price = await db.prices
            .where('pro_codprod').equals(p.pro_codprod)
            .first() as MobilePrice | undefined;
          return { ...p, preco: price?.preco ?? null, tabela_id: price?.tabela_id ?? null };
        })
      );
      setRows(result);
      setLoading(false);
    }
    load();
  }, [selectedInd]);

  const shown = search.trim()
    ? rows.filter(r =>
        r.pro_codprod.toLowerCase().includes(search.toLowerCase()) ||
        r.pro_nome.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MobileHeader title="Tabela de Preços" showBack />

      <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {industrias.map(ind => (
            <button key={ind.id}
              onClick={() => { setSelectedInd(ind.id); setSearch(''); }}
              className="pill"
              style={{ background: selectedInd === ind.id ? 'var(--navy)' : 'var(--sand-card)',
                color: selectedInd === ind.id ? '#FFF' : 'var(--navy)', flexShrink: 0 }}>
              {ind.nome}
            </button>
          ))}
        </div>
        <input
          placeholder="Buscar por código ou nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' as const,
            marginBottom: 8 }}
        />
      </div>

      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
            Carregando...
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 32 }}>
            {rows.length === 0
              ? 'Nenhum produto local. Use "Sincronizar para visita" na Home.'
              : 'Nenhum resultado.'}
          </div>
        ) : (
          shown.map(row => (
            <div key={row.pro_codprod} className="prod-row">
              <span style={{ fontFamily: 'monospace', fontWeight: 900,
                fontSize: 13, color: '#1D4ED8', minWidth: 82 }}>
                {row.pro_codprod}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--navy)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.pro_nome}
              </span>
              <span style={{ fontSize: 11, color: 'var(--navy-muted)',
                marginRight: 6, flexShrink: 0 }}>
                {row.unidade}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700,
                fontSize: 13, color: 'var(--navy)', minWidth: 96, textAlign: 'right' }}>
                {row.preco != null ? fmtBRL(row.preco) : '—'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
