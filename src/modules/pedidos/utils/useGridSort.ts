// ─── Ordenação de grid por clique no cabeçalho (porta o padrão do SalesSpot DataGrid) ───
// Exibição-só: ordena uma CÓPIA das linhas; nunca muta a fonte (ite_seq, etc.).
// Ciclo de 3 estados: asc → desc → sem ordem. Comparador pt-BR (numérico quando
// ambos os valores parecem número "1.234,56"; senão texto; nulos por último).
import { useState, useCallback, useMemo, useEffect } from 'react';
import type React from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }

/** Comparador genérico: nulos por último; numérico quando ambos forem número, senão texto pt-BR. */
export function compareVals(a: any, b: any): number {
  const an = a == null || a === '', bn = b == null || b === '';
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  const na = typeof a === 'number' ? a : Number(String(a).replace(/\./g, '').replace(',', '.'));
  const nb = typeof b === 'number' ? b : Number(String(b).replace(/\./g, '').replace(',', '.'));
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base', numeric: true });
}

/** Hook de estado de ordenação. `cycle(key)` alterna asc → desc → sem ordem. */
export function useGridSort(initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const cycle = useCallback((key: string) => {
    setSort(prev =>
      !prev || prev.key !== key ? { key, dir: 'asc' as SortDir }
      : prev.dir === 'asc' ? { key, dir: 'desc' as SortDir }
      : null);
  }, []);
  return { sort, cycle, setSort };
}

/** Ordena (cópia) `rows` conforme `sort`, usando `accessors[key]` (default: row[key]). */
export function useSortedRows<T>(
  rows: T[],
  sort: SortState | null,
  accessors: Record<string, (row: T) => any>,
): T[] {
  return useMemo(() => {
    if (!sort) return rows;
    const acc = accessors[sort.key] ?? ((r: any) => r[sort.key]);
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compareVals(acc(a), acc(b)) * sign);
  }, [rows, sort, accessors]);
}

/** Seta indicadora pro cabeçalho. '↕' quando a coluna não é a ativa. */
export function sortArrow(sort: SortState | null, key: string): string {
  if (!sort || sort.key !== key) return ' ↕';
  return sort.dir === 'asc' ? ' ▲' : ' ▼';
}

// ─── Redimensionamento de colunas (arrastar a borda) — porta o resize do SalesSpot ───
export interface ColW { key: string; width?: number; minWidth?: number }

/**
 * Larguras de coluna ajustáveis + persistidas em localStorage (por `storageKey`).
 * `widths` é um mapa key→px; `startResize(key, e)` é o onMouseDown da alça.
 * Serve tanto pra <table> (via <colgroup>) quanto pra css-grid (via gridTemplateColumns).
 */
export function useColumnWidths(storageKey: string | undefined, cols: ColW[]) {
  const defaults = useMemo(() => {
    const d: Record<string, number> = {};
    for (const c of cols) if (c.width != null) d[c.key] = c.width;
    return d;
  }, [cols]);

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    let saved: Record<string, number> = {};
    if (storageKey) { try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* ignore */ } }
    return { ...defaults, ...saved };
  });

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* ignore */ }
  }, [storageKey, widths]);

  const startResize = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const col = cols.find(c => c.key === key);
    const min = col?.minWidth ?? 40;
    const startW = widths[key] ?? col?.width ?? 100;
    const move = (ev: MouseEvent) =>
      setWidths(w => ({ ...w, [key]: Math.max(min, Math.round(startW + (ev.clientX - startX))) }));
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [widths, cols]);

  return { widths, startResize, setWidths };
}
