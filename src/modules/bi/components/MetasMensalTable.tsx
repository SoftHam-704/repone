import { useMemo } from 'react';
import { BI, fmtBRL, fmtK } from './biTokens';

interface MetaRow {
  industria_codigo: number;
  industria_nome: string;
  mes: number;
  mes_nome: string;
  ano_anterior: string | null;
  meta_ano_corrente: string | null;
  vendas_ano_corrente: string | null;
  perc_atingimento: string | null;
  perc_relacao_ano_ant: string | null;
}

interface Props {
  data: MetaRow[];
  ano: number;
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const SUB_ROWS = [
  { key: 'ano_anterior',         label: 'Ano anterior',      type: 'currency'  as const },
  { key: 'meta_ano_corrente',    label: 'Meta ano corrente', type: 'currency'  as const },
  { key: 'vendas_ano_corrente',  label: 'Vendas ano corrente', type: 'currency' as const },
  { key: 'perc_atingimento',     label: '% Atingido da meta',  type: 'pct_meta'  as const },
  { key: 'perc_relacao_ano_ant', label: '% Em relação ao ano ant.', type: 'pct_delta' as const },
];

function fmtVal(raw: string | null, type: 'currency' | 'pct_meta' | 'pct_delta'): string {
  if (raw === null || raw === undefined) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return '—';
  if (type === 'currency') return fmtK(n);
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pctColor(raw: string | null, type: 'pct_meta' | 'pct_delta'): string {
  if (raw === null) return BI.textMuted;
  const n = parseFloat(raw);
  if (isNaN(n)) return BI.textMuted;
  if (type === 'pct_meta') return n >= 100 ? BI.success : n >= 80 ? BI.warning : BI.danger;
  return n >= 0 ? BI.success : BI.danger;
}

export const MetasMensalTable = ({ data, ano }: Props) => {
  const industries = useMemo(() => {
    const map = new Map<number, { nome: string; byMes: Map<number, MetaRow> }>();
    data.forEach(row => {
      if (!map.has(row.industria_codigo))
        map.set(row.industria_codigo, { nome: row.industria_nome, byMes: new Map() });
      map.get(row.industria_codigo)!.byMes.set(row.mes, row);
    });
    return Array.from(map.entries()).map(([codigo, val]) => ({ codigo, ...val }));
  }, [data]);

  if (!industries.length) return null;

  const labelW = 160;
  const colW   = 104;
  // Sem coluna de indústria — só label + 12 meses
  const totalCols = 1 + 12;

  const thStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: BI.textMuted, textAlign: 'right',
    padding: '10px 8px',
    background: BI.panel,
    borderBottom: `1px solid ${BI.border}`,
    position: 'sticky', top: 0, zIndex: 2,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      overflowX: 'auto', overflowY: 'auto',
      maxHeight: 480,
      borderRadius: 10,
      border: `1px solid ${BI.border}`,
    }}>
      <table style={{
        width: '100%',
        minWidth: labelW + colW * 12,
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: 10,
      }}>
        <colgroup>
          <col style={{ width: labelW }} />
          {MESES_ABREV.map((_, i) => <col key={i} style={{ width: colW }} />)}
        </colgroup>

        {/* ── Header ── */}
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 12,
              position: 'sticky', left: 0, zIndex: 3 }}>
              Indústria / Métrica
            </th>
            {MESES_ABREV.map(m => (
              <th key={m} style={thStyle}>{m}</th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {industries.map((ind) => (
            <>
              {/* ── Industry header row ── */}
              <tr key={`${ind.codigo}-header`}>
                <td colSpan={totalCols} style={{
                  padding: '7px 12px',
                  background: '#1E2D3D',
                  borderTop: `1px solid ${BI.border}`,
                  borderBottom: `1px solid ${BI.border}40`,
                  position: 'sticky', left: 0,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 900,
                    color: '#E8E1D4',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    {ind.nome}
                  </span>
                </td>
              </tr>

              {/* ── Sub-rows ── */}
              {SUB_ROWS.map((sub, subIdx) => {
                const isLast = subIdx === SUB_ROWS.length - 1;
                const isDelta = sub.type !== 'currency';

                return (
                  <tr key={`${ind.codigo}-${sub.key}`}
                    style={{ background: isDelta ? `${BI.panelHi}40` : 'transparent' }}>

                    {/* Label */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 1,
                      background: isDelta ? `color-mix(in srgb, ${BI.panelHi} 50%, ${BI.panel})` : BI.panel,
                      padding: '5px 8px 5px 14px',
                      fontSize: 12,
                      color: isDelta ? BI.textSec : BI.textMuted,
                      fontWeight: isDelta ? 700 : 500,
                      whiteSpace: 'nowrap',
                      borderBottom: isLast ? `1px solid ${BI.border}` : 'none',
                      borderRight: `1px solid ${BI.border}20`,
                    }}>
                      {sub.label}
                    </td>

                    {/* 12 month cells */}
                    {MESES_ABREV.map((_, mesIdx) => {
                      const mesNum  = mesIdx + 1;
                      const row     = ind.byMes.get(mesNum);
                      const raw     = row ? (row as any)[sub.key] as string | null : null;
                      const display = fmtVal(raw, sub.type);
                      const color   = sub.type !== 'currency'
                        ? pctColor(raw, sub.type)
                        : raw && parseFloat(raw) > 0 ? BI.textSec : BI.textMuted;

                      return (
                        <td key={mesIdx} style={{
                          padding: '5px 8px',
                          textAlign: 'right',
                          borderBottom: isLast ? `1px solid ${BI.border}` : 'none',
                          verticalAlign: 'middle',
                        }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: isDelta ? 800 : 500,
                            fontFamily: 'monospace',
                            color,
                          }}>
                            {display}
                            {isDelta && raw && parseFloat(raw) !== 0 && (
                              <span style={{ fontSize: 9, marginLeft: 3 }}>
                                {parseFloat(raw) >= 0 ? '↑' : '↓'}
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
};
