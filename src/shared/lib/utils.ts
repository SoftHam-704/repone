import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Handler de teclado que faz Enter funcionar como Tab,
 * focando o próximo elemento focável do formulário.
 * Uso: <input onKeyDown={onEnterTab} ... />
 */
export function onEnterTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return;
  // Permite Enter normal em textarea e botões
  if (e.currentTarget.tagName === 'TEXTAREA') return;
  if ((e.currentTarget as HTMLElement).getAttribute('role') === 'button') return;

  e.preventDefault();

  const focusable = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';
  const all = Array.from(document.querySelectorAll<HTMLElement>(focusable));
  const idx = all.indexOf(e.currentTarget as HTMLElement);
  if (idx >= 0 && idx < all.length - 1) {
    all[idx + 1].focus();
  }
}
