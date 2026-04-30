import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';

export interface ComboboxOption {
  id: number | string;
  nome: string;
}

interface Props {
  options: ComboboxOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  minWidth?: number;
  emptyMessage?: string;
}

export default function SearchCombobox({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  required,
  minWidth = 200,
  emptyMessage = 'Nenhum item encontrado',
}: Props) {
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const selected = options.find(o => String(o.id) === value);

  const filtered = query.trim()
    ? options.filter(o => o.nome.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: number | string) => {
    onChange(String(id));
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth }}>
      <div
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: `1.5px solid ${!value && required ? '#EF4444' : open ? G.mustard : G.border}`,
          background: G.cardHi, color: G.text, cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: selected ? G.text : G.textMuted,
        }}>
          {selected ? selected.nome : placeholder}
        </span>
        {value && <X size={12} onClick={handleClear} style={{ color: G.textMuted, cursor: 'pointer', flexShrink: 0 }} />}
        <ChevronDown size={12} style={{
          color: G.textMuted, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
          background: G.card, border: `1px solid ${G.border}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${G.border}` }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12,
                border: `1px solid ${G.border}`, background: G.bg, color: G.text,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 11, color: G.textMuted, textAlign: 'center' }}>
                {emptyMessage}
              </div>
            ) : filtered.slice(0, 100).map(o => (
              <div
                key={o.id}
                onClick={() => handleSelect(o.id)}
                style={{
                  padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                  background: String(o.id) === value ? `${G.mustard}20` : 'transparent',
                  fontWeight: String(o.id) === value ? 700 : 400,
                  borderBottom: `1px solid ${G.border}`,
                  transition: 'background 0.1s',
                  color: G.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `${G.mustard}15`)}
                onMouseLeave={e => (e.currentTarget.style.background = String(o.id) === value ? `${G.mustard}20` : 'transparent')}
              >
                {o.nome}
              </div>
            ))}
            {filtered.length > 100 && (
              <div style={{ padding: '8px 14px', fontSize: 10, color: G.textMuted, textAlign: 'center' }}>
                {filtered.length - 100} mais — refine a busca
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
