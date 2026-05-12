import { useState, useEffect } from 'react';
import { api } from '@/shared/lib/api';

type NarrativeType = 'info' | 'success' | 'alert';

interface NarrativeResult {
  lines: string[];
  type: NarrativeType;
  loading: boolean;
}

/**
 * Chama Claude Haiku para gerar narrativa em linguagem natural sobre os dados do BI.
 * `trigger` deve ser uma string estável (ex: query params `p`) que muda quando os
 * filtros mudam — isso controla quando re-buscar a narrativa.
 */
export function useInsightNarrative(
  tab: string,
  data: Record<string, any> | null,
  trigger: string,
): NarrativeResult {
  const [lines,   setLines]   = useState<string[]>([]);
  const [type,    setType]    = useState<NarrativeType>('info');
  const [loading, setLoading] = useState(false);

  // readyKey muda quando: (a) trigger muda OU (b) data passa de null → não-null
  const readyKey = `${trigger}|${data !== null ? 'ready' : 'empty'}`;

  useEffect(() => {
    if (!data) {
      setLines([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLines([]);

    api.post('/bi/narrative', { tab, data })
      .then(r => {
        if (!cancelled && r.data.success && r.data.lines?.length) {
          setLines(r.data.lines);
          setType(r.data.type ?? 'info');
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [readyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lines, type, loading };
}
