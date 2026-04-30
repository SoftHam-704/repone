import { useState } from 'react';
import { ChevronDown, ChevronRight, PackageCheck } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';

interface SourceOC {
  ped_pedido: string;
  ped_oc: string | null;
  cli_nomred: string;
  ite_quant: number;
}

interface ItemConsolidationViewProps {
  itemName: string;
  totalQty: number;
  unit: string;
  sources: SourceOC[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0 });

/**
 * Exibe um item consolidado com quantidade total e, ao expandir,
 * lista as OCs originais que o compõem. Preserva a rastreabilidade
 * conforme Regra de Ouro #1 ("Nunca perder o número da OC original").
 */
export default function ItemConsolidationView({
  itemName,
  totalQty,
  unit,
  sources,
}: ItemConsolidationViewProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${G.border}`, overflow: 'hidden', marginBottom: 6 }}>
      {/* Linha principal — item consolidado */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', background: G.card, border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <PackageCheck size={14} style={{ color: G.mustard, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: G.text }}>{itemName}</span>
        <span style={{
          fontSize: 12, fontWeight: 900, color: G.text,
          background: G.mustard + '22', borderRadius: 6, padding: '2px 8px',
        }}>
          {fmt(totalQty)} {unit}
        </span>
        {sources.length > 0 && (
          <>
            <span style={{ fontSize: 10, color: G.textMuted, marginLeft: 4 }}>
              {sources.length} OC{sources.length !== 1 ? 's' : ''}
            </span>
            {open
              ? <ChevronDown size={13} style={{ color: G.textMuted, flexShrink: 0 }} />
              : <ChevronRight size={13} style={{ color: G.textMuted, flexShrink: 0 }} />
            }
          </>
        )}
      </button>

      {/* Detalhe por OC */}
      {open && sources.length > 0 && (
        <div style={{ background: '#fff', borderTop: `1px solid ${G.border}` }}>
          {sources.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px 6px 36px',
                borderBottom: i < sources.length - 1 ? `1px solid ${G.border}20` : 'none',
              }}
            >
              {/* OC badge */}
              <span style={{
                fontSize: 10, fontWeight: 900, color: G.mustard,
                background: G.mustard + '18', borderRadius: 5, padding: '1px 6px',
                fontFamily: 'monospace', flexShrink: 0,
              }}>
                {s.ped_oc || '—'}
              </span>
              <span style={{ flex: 1, fontSize: 11, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.cli_nomred} · #{s.ped_pedido}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: G.text, flexShrink: 0 }}>
                {fmt(s.ite_quant)} {unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
