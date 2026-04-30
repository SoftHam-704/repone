import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Building2, Users } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { BI } from './biTokens';
import { useBIStore, type BIVisao } from '../store/useBIStore';

export const BIExtraFilters = () => {
  const { visao, setVisao } = useBIStore();
  const [industries, setIndustries] = useState<any[]>([]);
  const [loadingInd, setLoadingInd] = useState(false);

  useEffect(() => {
    setLoadingInd(true);
    api.get('/bi/ranking-industrias?anos=' + new Date().getFullYear())
      .then(r => r.data.success && setIndustries(r.data.data))
      .catch(console.error)
      .finally(() => setLoadingInd(false));
  }, []);

  return (
    <div className="flex items-center gap-3">
      <IndustrySelector industries={industries} loading={loadingInd} />
      <ClientSelector />

      <div className="w-px h-6 flex-shrink-0" style={{ background: BI.border }} />

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BI.textMuted }}>Métrica</span>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: BI.panelHi, border: `1px solid ${BI.border}` }}>
          {([
            { key: 'financeiro', label: 'Financeiro (R$)' },
            { key: 'volume',     label: 'Volume (Qtd)' },
            { key: 'skus',       label: 'Unidades (SKU)' },
          ] as { key: BIVisao; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setVisao(key)}
              className="text-[11px] font-bold px-3 py-1 rounded-md transition-all"
              style={{
                background: visao === key ? BI.teal : 'transparent',
                color: visao === key ? BI.pageBg : BI.textSec,
                border: 'none', cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Dropdown via portal (escapa overflow/stacking context) ──────────────────
function DropdownPortal({
  anchorRef, isOpen, width, children,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  width: number;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left });
  }, [isOpen]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      width,
      zIndex: 99999,
      borderRadius: 16,
      border: `1px solid ${BI.border}`,
      background: BI.panel,
      boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      padding: 4,
    }}>
      {children}
    </div>,
    document.body
  );
}

// ─── IndustrySelector ────────────────────────────────────────────────────────
const IndustrySelector = ({ industries }: { industries: any[]; loading: boolean }) => {
  const { filters, setFilters } = useBIStore();
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selected = industries.find(i => i.for_codigo === filters.for_codigo);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if ((e.target as Element)?.closest('[data-ind-drop]')) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  return (
    <div data-ind-drop style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:bg-white/5 min-w-[160px]"
        style={{
          borderColor: filters.for_codigo ? `${BI.teal}60` : BI.border,
          background: filters.for_codigo ? `${BI.teal}10` : BI.panelHi,
        }}>
        <Building2 size={13} style={{ color: BI.teal }} />
        <span className="text-[11px] font-bold truncate flex-1 text-left"
          style={{ color: selected ? BI.text : BI.textMuted }}>
          {selected ? selected.nome : 'Todas Indústrias'}
        </span>
        <ChevronDown size={12} style={{ color: BI.textMuted, flexShrink: 0 }}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <DropdownPortal anchorRef={btnRef as React.RefObject<HTMLElement>} isOpen={isOpen} width={260}>
        <div data-ind-drop className="max-h-64 overflow-y-auto bi-scrollbar" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setFilters({ for_codigo: null }); setIsOpen(false); }}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors">
            <span className="text-xs font-bold" style={{ color: !filters.for_codigo ? BI.teal : BI.text }}>
              Todas Indústrias
            </span>
            {!filters.for_codigo && <Check size={14} style={{ color: BI.teal }} />}
          </button>
          {industries.map(ind => (
            <button key={ind.for_codigo}
              onClick={() => { setFilters({ for_codigo: ind.for_codigo }); setIsOpen(false); }}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors">
              <div className="flex flex-col">
                <span className="text-xs font-bold"
                  style={{ color: filters.for_codigo === ind.for_codigo ? BI.teal : BI.text }}>
                  {ind.nome}
                </span>
                <span className="text-[10px] opacity-40">
                  {filters.for_codigo === ind.for_codigo ? 'Selecionado' : 'Filtrar por esta indústria'}
                </span>
              </div>
              {filters.for_codigo === ind.for_codigo && <Check size={14} style={{ color: BI.teal }} />}
            </button>
          ))}
        </div>
      </DropdownPortal>
    </div>
  );
};

// ─── ClientSelector ──────────────────────────────────────────────────────────
const ClientSelector = () => {
  const { filters, setFilters } = useBIStore();
  const [isOpen, setIsOpen]       = useState(false);
  const [search, setSearch]       = useState('');
  const [results, setResults]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!filters.cli_codigo) { setSelectedName(null); return; }
    api.get(`/clients/${filters.cli_codigo}`)
      .then(r => { const c = r.data.data; if (c) setSelectedName(c.cli_nomred || c.cli_nome); })
      .catch(() => setSelectedName(`#${filters.cli_codigo}`));
  }, [filters.cli_codigo]);

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      api.get(`/clients?search=${encodeURIComponent(search)}&limit=15`)
        .then(r => r.data.success && setResults(r.data.data || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node)
          && !(e.target as Element)?.closest('[data-cli-drop]')) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const selectClient = (c: any) => {
    setFilters({ cli_codigo: c.cli_codigo });
    setSelectedName(c.cli_nomred || c.cli_nome);
    setIsOpen(false);
    setSearch('');
  };

  const label = filters.cli_codigo ? (selectedName ?? `#${filters.cli_codigo}`) : 'Todos Clientes';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:bg-white/5 min-w-[160px]"
        style={{
          borderColor: filters.cli_codigo ? `${BI.success}60` : BI.border,
          background: filters.cli_codigo ? `${BI.success}10` : BI.panelHi,
        }}>
        <Users size={13} style={{ color: BI.success }} />
        <span className="text-[11px] font-bold truncate flex-1 text-left max-w-[140px]"
          style={{ color: filters.cli_codigo ? BI.text : BI.textMuted }}>
          {label}
        </span>
        <ChevronDown size={12} style={{ color: BI.textMuted, flexShrink: 0 }}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <DropdownPortal anchorRef={btnRef as React.RefObject<HTMLElement>} isOpen={isOpen} width={320}>
        <div data-cli-drop onClick={e => e.stopPropagation()}>
          <div className="relative mb-1 px-1 pt-1">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 mt-0.5" style={{ color: BI.textMuted }} />
            <input
              autoFocus
              className="w-full rounded-lg py-2 pl-9 pr-3 text-xs border outline-none"
              style={{
                background: 'rgba(0,0,0,0.3)', color: BI.text,
                borderColor: BI.border,
              }}
              placeholder="Pesquisar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto bi-scrollbar">
            <button
              onClick={() => { setFilters({ cli_codigo: null }); setSelectedName(null); setIsOpen(false); setSearch(''); }}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors">
              <span className="text-xs font-bold" style={{ color: !filters.cli_codigo ? BI.teal : BI.text }}>
                Todos Clientes
              </span>
              {!filters.cli_codigo && <Check size={14} style={{ color: BI.teal }} />}
            </button>

            {loading && (
              <div className="p-3 text-center text-[10px] animate-pulse uppercase tracking-widest"
                style={{ color: BI.textMuted }}>Buscando...</div>
            )}

            {!loading && search.length < 2 && (
              <div className="p-3 text-center text-[10px]" style={{ color: BI.textMuted }}>
                Digite ao menos 2 caracteres
              </div>
            )}

            {results.map(c => (
              <button key={c.cli_codigo} onClick={() => selectClient(c)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold truncate"
                    style={{ color: filters.cli_codigo === c.cli_codigo ? BI.teal : BI.text }}>
                    {c.cli_nomred || c.cli_nome}
                  </span>
                  <span className="text-[10px]" style={{ color: BI.textMuted }}>
                    {[c.cli_cidade, c.cli_uf].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {filters.cli_codigo === c.cli_codigo && <Check size={14} style={{ color: BI.teal, flexShrink: 0 }} />}
              </button>
            ))}

            {!loading && search.length >= 2 && results.length === 0 && (
              <div className="p-3 text-center text-xs" style={{ color: BI.textMuted }}>
                Nenhum cliente encontrado
              </div>
            )}
          </div>
        </div>
      </DropdownPortal>
    </div>
  );
};
