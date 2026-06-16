import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';

// Pull-to-refresh universal (iOS PWA standalone + Android). No modo "app na tela
// inicial" o iOS não tem o gesto nativo — este componente o implementa via touch
// events: puxar pra baixo COM o conteúdo no topo → dispara onRefresh.
const THRESHOLD = 70;   // px de puxada pra disparar
const MAX_PULL  = 110;  // px máximo do indicador
const RESIST    = 0.5;  // resistência (puxa "pesado")

// Acha o ancestral rolável a partir do elemento tocado (cada página rola dentro
// do seu próprio container). Se não houver, usa o scroll do documento.
function scrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pull, setPullState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const setPull = useCallback((v: number) => { pullRef.current = v; setPullState(v); }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let startY = 0, active = false, sc: HTMLElement | null = null;

    const atTopNow = () => sc
      ? sc.scrollTop <= 0
      : (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;

    const start = (e: TouchEvent) => {
      if (disabled || refreshingRef.current) { active = false; return; }
      startY = e.touches[0].clientY;
      sc = scrollableAncestor(e.target as HTMLElement);
      active = true;
    };
    const move = (e: TouchEvent) => {
      if (!active || disabled || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && atTopNow()) {
        e.preventDefault();              // bloqueia o bounce/scroll nativo durante a puxada
        if (!dragging) setDragging(true);
        setPull(Math.min(dy * RESIST, MAX_PULL));
      } else if (pullRef.current !== 0) {
        setPull(0);                      // virou scroll normal → solta
        active = false;
      }
    };
    const end = async () => {
      setDragging(false);
      if (!active) return;
      active = false;
      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        try { await onRefresh(); } catch { /* noop */ }
        refreshingRef.current = false;
        setRefreshing(false);
        setPull(0);
      } else {
        setPull(0);
      }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [disabled, onRefresh, setPull, dragging]);

  const dist = refreshing ? THRESHOLD : pull;
  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <div ref={wrapRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      {/* Indicador */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60,
        height: dist, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        paddingBottom: 8, pointerEvents: 'none', opacity: dist > 1 ? 1 : 0,
        transition: dragging ? 'none' : 'height .25s ease, opacity .2s',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: '#fff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transform: refreshing ? 'none' : `rotate(${progress * 270}deg)`,
        }}>
          <RotateCw size={18} color="var(--navy, #28374A)"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </div>
      </div>

      {/* Conteúdo (desloca junto da puxada) */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
        transform: `translateY(${dist}px)`,
        transition: dragging ? 'none' : 'transform .25s ease',
      }}>
        {children}
      </div>
    </div>
  );
}
