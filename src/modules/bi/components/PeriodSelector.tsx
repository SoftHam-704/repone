import { BI } from './biTokens';
import { useBIStore } from '../store/useBIStore';

const ANOS_DISP = [2023, 2024, 2025, 2026];
const MESES = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
  { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
];

export const PeriodSelector = () => {
  const { filters, toggleAno, toggleMes, setFilters } = useBIStore();
  const { anos, meses } = filters;
  const isModoComp = anos.length === 2;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Só exibe meses disponíveis — ano mais recente limita aos meses já transcorridos
  const maxAno = Math.max(...anos);
  const mesesDisp = maxAno < currentYear
    ? MESES
    : MESES.filter(m => m.v <= currentMonth);

  const anoBtn = (ativo: boolean) => ({
    padding: '4px 14px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: ativo ? `1px solid ${BI.teal}` : `1px solid ${BI.border}`,
    background: ativo ? BI.tealGlow : 'transparent',
    color: ativo ? BI.teal : BI.textMuted,
    transition: 'all .15s',
  } as React.CSSProperties);

  const mesBtn = (ativo: boolean) => ({
    padding: '3px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    background: ativo ? BI.teal : 'transparent',
    color: ativo ? '#0F1923' : BI.textMuted,
    transition: 'all .15s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties);

  return (
    <div className="flex items-center gap-4 flex-wrap">

      {/* Anos */}
      <div className="flex items-center gap-1.5">
        {ANOS_DISP.map(ano => (
          <button key={ano} style={anoBtn(anos.includes(ano))} onClick={() => toggleAno(ano)}>
            {ano}
            {ano === currentYear && !anos.includes(ano) && (
              <span style={{ color: BI.textMuted, fontSize: 9, marginLeft: 2 }}>★</span>
            )}
          </button>
        ))}
        {isModoComp && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ background: `${BI.purple}20`, color: BI.purple, border: `1px solid ${BI.purple}40` }}>
            YoY
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: BI.border }} />

      {/* Meses */}
      <div className="flex items-center gap-0.5">
        <button
          style={mesBtn(meses.length === 0)}
          onClick={() => setFilters({ meses: [] })}>
          Ano todo
        </button>
        {mesesDisp.map(m => (
          <button key={m.v} style={mesBtn(meses.includes(m.v))} onClick={() => toggleMes(m.v)}>
            {m.l}
          </button>
        ))}
      </div>

    </div>
  );
};
