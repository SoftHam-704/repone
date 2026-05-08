import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Package }                  from 'lucide-react';
import { db }           from '../db/db';
import { api }          from '@/shared/lib/api';
import { useOffline }   from '../hooks/useOffline';
import { MobileHeader } from '../components/MobileHeader';
import type { MobileProduct, MobilePrice } from '../db/types';

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface Industria   { id: number; nome: string }
interface Tabela      { nome_tabela: string; total_produtos: number }
interface ProdRow {
  pro_codigo:    string;
  pro_nome:      string;
  pro_embalagem: string;
  preco_bruto:   number;
  preco_promo:   number | null;
  preco_especial:number | null;
  ipi:           number;
  st:            number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* bruto × descontos cascata × (1 + IPI) × (1 + ST) */
function calcLiquido(bruto: number, discounts: string[], ipi: number, st: number): number {
  let p = bruto;
  for (const d of discounts) {
    const pct = parseFloat(d.replace(',', '.'));
    if (pct > 0 && pct < 100) p *= (1 - pct / 100);
  }
  return p * (1 + ipi / 100) * (1 + st / 100);
}

const fmtDiscount = (v: string): string => {
  const num = parseFloat(v.replace(',', '.'));
  if (isNaN(num) || num <= 0) return '';
  return num.toFixed(2).replace('.', ',');
};

const maskDiscount = (value: string): string => {
  // aceita dígitos, vírgula e ponto (ponto vira vírgula)
  let v = value.replace(/[^0-9,\.]/g, '').replace('.', ',');
  // apenas uma vírgula
  const parts = v.split(',');
  if (parts.length > 2) v = parts[0] + ',' + parts.slice(1).join('');
  // máximo 2 casas decimais
  if (v.includes(',')) {
    const [int, dec] = v.split(',');
    v = int + ',' + dec.slice(0, 2);
  }
  // máximo 99,99
  const num = parseFloat(v.replace(',', '.'));
  if (!isNaN(num) && num > 99) return '99,99';
  return v;
};

/* ─── Pill ───────────────────────────────────────────────────────────────────── */
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="pill" style={{
      background: active ? 'var(--navy)' : 'var(--sand-card)',
      color:      active ? '#FFF'        : 'var(--navy)',
      flexShrink: 0,
    }}>
      {label}
    </button>
  );
}

/* ─── ProductRow ─────────────────────────────────────────────────────────────── */
function ProductRow({ row, discounts }: { row: ProdRow; discounts: string[] }) {
  const isPromo = !!(row.preco_promo && row.preco_promo > 0 && row.preco_promo < row.preco_bruto);

  const hasDiscount = discounts.some(d => parseFloat(d.replace(',', '.')) > 0);
  const hasImposto  = row.ipi > 0 || row.st > 0;

  /* liquido só para itens sem promo */
  const liquido = (!isPromo && row.preco_bruto > 0 && (hasDiscount || hasImposto))
    ? calcLiquido(row.preco_bruto, discounts, row.ipi, row.st)
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 16px', borderBottom: '1px solid var(--border)',
      background: '#FFF',
    }}>
      {/* código */}
      <span style={{
        fontFamily: 'monospace', fontWeight: 900, fontSize: 14,
        color: '#1D4ED8', minWidth: 88, flexShrink: 0,
      }}>
        {row.pro_codigo}
      </span>

      {/* nome */}
      <span style={{
        flex: 1, fontSize: 13, color: 'var(--navy)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}>
        {row.pro_nome}
      </span>

      {/* embalagem */}
      {row.pro_embalagem && (
        <span style={{
          fontSize: 10, color: 'var(--navy-muted)', fontWeight: 700,
          flexShrink: 0, marginRight: 4, textTransform: 'uppercase',
        }}>
          {row.pro_embalagem}
        </span>
      )}

      {/* preços */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>

        {isPromo ? (
          /* ── item em promoção: já é líquido, sem desconto ── */
          <>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 14, color: '#059669' }}>
              {fmtBRL(row.preco_promo!)}
            </div>
            {row.preco_bruto > 0 && (
              <div style={{ fontSize: 10, color: 'var(--navy-muted)',
                textDecoration: 'line-through', fontFamily: 'monospace' }}>
                {fmtBRL(row.preco_bruto)}
              </div>
            )}
            <div style={{ fontSize: 9, color: '#059669', fontWeight: 900, letterSpacing: 0.3 }}>
              PROMO · LÍQUIDO
            </div>
          </>
        ) : (
          /* ── item normal: bruto + líquido calculado ── */
          <>
            {/* bruto — fica muted quando há líquido diferente */}
            <div style={{
              fontFamily: 'monospace', fontWeight: liquido ? 600 : 900,
              fontSize: liquido ? 11 : 14,
              color: liquido ? 'var(--navy-muted)' : 'var(--navy)',
              textDecoration: (liquido && hasDiscount) ? 'line-through' : 'none',
            }}>
              {row.preco_bruto > 0 ? fmtBRL(row.preco_bruto) : '—'}
            </div>

            {/* líquido */}
            {liquido !== null && (
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 14, color: '#059669' }}>
                {fmtBRL(liquido)}
              </div>
            )}

            {/* label LÍQUIDO quando há imposto mas sem desconto */}
            {liquido !== null && !hasDiscount && (
              <div style={{ fontSize: 9, color: '#059669', fontWeight: 900, letterSpacing: 0.3 }}>
                C/ IMPOSTOS
              </div>
            )}

            {/* impostos */}
            {hasImposto && (
              <div style={{ fontSize: 9, color: '#D97706', fontWeight: 700 }}>
                {row.ipi > 0 ? `IPI ${row.ipi}%` : ''}
                {row.ipi > 0 && row.st > 0 ? ' · ' : ''}
                {row.st > 0 ? `ST ${row.st}%` : ''}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function TabelaPrecosPage() {
  const { isOnline } = useOffline();

  const [industrias,    setIndustrias]    = useState<Industria[]>([]);
  const [selectedInd,   setSelectedInd]   = useState<number | null>(null);
  const [tabelas,       setTabelas]       = useState<Tabela[]>([]);
  const [selectedTab,   setSelectedTab]   = useState<string | null>(null);
  const [rows,          setRows]          = useState<ProdRow[]>([]);
  const [search,        setSearch]        = useState('');
  const [loadingInds,   setLoadingInds]   = useState(false);
  const [loadingTabs,   setLoadingTabs]   = useState(false);
  const [loadingRows,   setLoadingRows]   = useState(false);
  const [discounts,     setDiscounts]     = useState<string[]>(['','','','','']);
  const cache = useRef<Map<string, ProdRow[]>>(new Map());

  /* ── 1. Load industries ── */
  useEffect(() => {
    setLoadingInds(true);
    if (isOnline) {
      api.get('/aux/industrias')
        .then(r => {
          const inds: Industria[] = (r.data.data || []).map((f: any) => ({
            id:   Number(f.for_codigo),
            nome: f.for_nomered || f.for_nome,
          }));
          setIndustrias(inds);
          if (inds.length > 0) setSelectedInd(inds[0].id);
        })
        .catch(() => loadIndustriasOffline())
        .finally(() => setLoadingInds(false));
    } else {
      loadIndustriasOffline().finally(() => setLoadingInds(false));
    }
  }, [isOnline]);

  async function loadIndustriasOffline() {
    const prods = await db.products.toArray();
    const map   = new Map<number, boolean>();
    prods.forEach(p => map.set(p.pro_industria, true));
    const inds = Array.from(map.keys()).map(id => ({ id, nome: `Indústria ${id}` }));
    setIndustrias(inds);
    if (inds.length > 0) setSelectedInd(inds[0].id);
  }

  /* ── 2. Load tabelas when industry changes ── */
  const loadTabelas = useCallback(async (indId: number) => {
    setTabelas([]); setSelectedTab(null); setRows([]);
    setLoadingTabs(true);
    if (isOnline) {
      try {
        const r = await api.get(`/price-tables/${indId}`);
        const tabs: Tabela[] = (r.data.data || []).map((t: any) => ({
          nome_tabela:    t.nome_tabela,
          total_produtos: Number(t.total_produtos),
        }));
        setTabelas(tabs);
        if (tabs.length > 0) setSelectedTab(tabs[0].nome_tabela);
      } catch {
        await loadTabelasOffline(indId);
      }
    } else {
      await loadTabelasOffline(indId);
    }
    setLoadingTabs(false);
  }, [isOnline]);

  async function loadTabelasOffline(indId: number) {
    const prices = await db.prices.where('industria_id').equals(indId).toArray();
    const ids    = [...new Set(prices.map(p => p.tabela_id))];
    const tabs   = ids.map(id => ({ nome_tabela: id === 0 ? 'LOCAL' : String(id), total_produtos: 0 }));
    setTabelas(tabs);
    if (tabs.length > 0) setSelectedTab(tabs[0].nome_tabela);
  }

  useEffect(() => { if (selectedInd != null) loadTabelas(selectedInd); }, [selectedInd, loadTabelas]);

  /* ── 3. Load rows when table changes ── */
  const loadRows = useCallback(async (indId: number, tabName: string) => {
    const key = `${indId}::${tabName}`;

    // cache hit — instantâneo
    if (cache.current.has(key)) {
      setRows(cache.current.get(key)!);
      setSearch('');
      return;
    }

    setRows([]); setSearch(''); setLoadingRows(true);
    try {
      if (isOnline) {
        const r = await api.get(
          `/price-tables/${indId}/items?tabela=${encodeURIComponent(tabName)}`
        );
        const mapped: ProdRow[] = (r.data.data || []).map((p: any) => ({
          pro_codigo:     p.pro_codigo     || '',
          pro_nome:       p.pro_nome       || '',
          pro_embalagem:  p.pro_embalagem  || '',
          preco_bruto:    parseFloat(p.preco_bruto  ?? '0'),
          preco_promo:    p.preco_promo    ? parseFloat(p.preco_promo)    : null,
          preco_especial: p.preco_especial ? parseFloat(p.preco_especial) : null,
          ipi: parseFloat(p.ipi ?? '0'),
          st:  parseFloat(p.st  ?? '0'),
        }));
        cache.current.set(key, mapped);
        setRows(mapped);
      } else {
        await loadRowsOffline(indId, tabName, key);
      }
    } catch {
      await loadRowsOffline(indId, tabName, key);
    } finally {
      setLoadingRows(false);
    }
  }, [isOnline]);

  async function loadRowsOffline(indId: number, tabName: string, key: string) {
    const tabelaIdNum = tabName === 'LOCAL' ? 0 : parseInt(tabName) || 0;
    const prods: MobileProduct[] = await db.products.where('pro_industria').equals(indId).toArray();
    const result: ProdRow[] = await Promise.all(
      prods.map(async p => {
        const price: MobilePrice | undefined = await db.prices
          .where('[pro_codprod+tabela_id]')
          .equals([p.pro_codprod, tabelaIdNum])
          .first()
          ?? await db.prices.where('pro_codprod').equals(p.pro_codprod).first();
        return {
          pro_codigo:     p.pro_codprod,
          pro_nome:       p.pro_nome,
          pro_embalagem:  p.unidade,
          preco_bruto:    price?.preco ?? 0,
          preco_promo:    null,
          preco_especial: null,
          ipi: 0, st: 0,
        };
      })
    );
    cache.current.set(key, result);
    setRows(result);
  }

  useEffect(() => {
    if (selectedInd != null && selectedTab != null) loadRows(selectedInd, selectedTab);
  }, [selectedInd, selectedTab, loadRows]);

  /* ── filter ── */
  const shown = search.trim()
    ? rows.filter(r =>
        r.pro_codigo.toLowerCase().includes(search.toLowerCase()) ||
        r.pro_nome.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const isLoading = loadingInds || loadingTabs || loadingRows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sand-bg)' }}>
      <MobileHeader title="Tabela de Preços" showBack />

      {/* ── filter header ── */}
      <div style={{ padding: '12px 16px 0', background: 'var(--sand-bg)', flexShrink: 0 }}>

        {/* industrias */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {industrias.map(ind => (
            <Pill key={ind.id} label={ind.nome}
              active={selectedInd === ind.id}
              onClick={() => { setSelectedInd(ind.id); }} />
          ))}
        </div>

        {/* tabelas */}
        {tabelas.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
            {tabelas.map(t => (
              <button key={t.nome_tabela}
                onClick={() => setSelectedTab(t.nome_tabela)}
                style={{
                  background: selectedTab === t.nome_tabela
                    ? 'rgba(255,210,0,0.22)' : 'rgba(40,55,74,0.06)',
                  border: selectedTab === t.nome_tabela
                    ? '1.5px solid rgba(255,210,0,0.75)' : '1px solid var(--border)',
                  borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                  fontSize: 12, fontWeight: 900, flexShrink: 0, fontFamily: 'inherit',
                  color: selectedTab === t.nome_tabela ? 'var(--navy)' : 'var(--navy-muted)',
                }}>
                {t.nome_tabela}
                {t.total_produtos > 0 && (
                  <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.6 }}>
                    ({t.total_produtos})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* descontos */}
        {!isLoading && rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            overflowX: 'auto', paddingBottom: 8, margin: '0 -16px', padding: '0 16px 8px' }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--navy-muted)',
              textTransform: 'uppercase', flexShrink: 0, letterSpacing: 0.5 }}>
              Desc.
            </span>
            {discounts.map((d, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0, width: 72 }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={d}
                  placeholder="0,00"
                  onChange={e => {
                    const next = [...discounts];
                    next[i] = maskDiscount(e.target.value);
                    setDiscounts(next);
                  }}
                  onBlur={e => {
                    const next = [...discounts];
                    next[i] = fmtDiscount(e.target.value);
                    setDiscounts(next);
                  }}
                  style={{
                    width: '100%', padding: '7px 20px 7px 7px',
                    borderRadius: 9, fontSize: 13, fontWeight: 700,
                    border: d ? '1.5px solid rgba(255,210,0,0.8)' : '1px solid var(--border)',
                    background: d ? 'rgba(255,210,0,0.10)' : 'var(--sand-card)',
                    color: 'var(--navy)', outline: 'none',
                    textAlign: 'right', boxSizing: 'border-box' as const,
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ position: 'absolute', right: 6, top: '50%',
                  transform: 'translateY(-50%)', fontSize: 11,
                  color: 'var(--navy-muted)', pointerEvents: 'none' }}>
                  %
                </span>
              </div>
            ))}
            {discounts.some(d => parseFloat(d) > 0) && (
              <button
                onClick={() => setDiscounts(['','','','',''])}
                style={{ flexShrink: 0, background: 'none', border: 'none',
                  fontSize: 11, color: '#DC2626', fontWeight: 700,
                  cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit' }}>
                Limpar
              </button>
            )}
          </div>
        )}

        {/* busca */}
        <input
          placeholder="Buscar por código ou nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 14,
            border: '1px solid var(--border)', background: 'var(--sand-card)',
            color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' as const,
            marginBottom: 8,
          }}
        />

        {/* stats bar */}
        {!isLoading && rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
            <Package size={12} color="var(--navy-muted)" />
            <span style={{ fontSize: 11, color: 'var(--navy-muted)', fontWeight: 700 }}>
              {shown.length === rows.length
                ? `${rows.length} produto${rows.length !== 1 ? 's' : ''}`
                : `${shown.length} de ${rows.length}`}
              {!isOnline && <span style={{ color: '#D97706', marginLeft: 6 }}>· Dados locais</span>}
            </span>
          </div>
        )}
      </div>

      {/* ── list ── */}
      <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 40, color: 'var(--navy-muted)', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
            Carregando...
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--navy-muted)', fontSize: 13, padding: 40 }}>
            {rows.length === 0
              ? 'Nenhum produto. Sincronize ou selecione outra tabela.'
              : 'Nenhum resultado para a busca.'}
          </div>
        ) : (
          shown.map(row => <ProductRow key={row.pro_codigo} row={row} discounts={discounts} />)
        )}
      </div>
    </div>
  );
}
