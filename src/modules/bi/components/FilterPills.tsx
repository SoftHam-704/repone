import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { BI } from './biTokens';
import { useBIStore } from '../store/useBIStore';

const MESES_NOME = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const FilterPills = () => {
  const { filters, setFilters, toggleMes } = useBIStore();
  const { meses, for_codigo, ven_codigo, cli_codigo } = filters;

  const [indNome, setIndNome] = useState<string | null>(null);
  const [cliNome, setCliNome] = useState<string | null>(null);

  useEffect(() => {
    if (!for_codigo) { setIndNome(null); return; }
    api.get(`/suppliers/${for_codigo}`)
      .then(r => {
        const s = r.data.data;
        if (s) setIndNome(s.for_nomered || s.for_nome);
      })
      .catch(() => setIndNome(`#${for_codigo}`));
  }, [for_codigo]);

  useEffect(() => {
    if (!cli_codigo) { setCliNome(null); return; }
    api.get(`/clients/${cli_codigo}`)
      .then(r => {
        const c = r.data.data;
        if (c) setCliNome(c.cli_nomred || c.cli_nome);
      })
      .catch(() => setCliNome(`#${cli_codigo}`));
  }, [cli_codigo]);

  const pills: { label: string; onRemove: () => void }[] = [];

  meses.forEach(m =>
    pills.push({ label: MESES_NOME[m], onRemove: () => toggleMes(m) })
  );

  if (for_codigo) pills.push({
    label: indNome ?? `Ind. #${for_codigo}`,
    onRemove: () => setFilters({ for_codigo: null }),
  });

  if (cli_codigo) pills.push({
    label: cliNome ?? `Cli. #${cli_codigo}`,
    onRemove: () => setFilters({ cli_codigo: null }),
  });

  if (ven_codigo) pills.push({
    label: `Vendedor #${ven_codigo}`,
    onRemove: () => setFilters({ ven_codigo: null }),
  });

  if (!pills.length) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map((p, i) => (
        <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
          style={{ background: `${BI.teal}15`, border: `1px solid ${BI.teal}40`, color: BI.teal }}>
          <span className="text-xs font-bold">{p.label}</span>
          <button onClick={p.onRemove} className="ml-0.5 hover:opacity-70 transition-opacity">
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
};
