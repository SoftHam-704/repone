import fs from 'fs';
import path from 'path';

// Os .md de domínio que entram no prompt da IRIS (comerciais + financeiro administrativo).
// _tecnico/ (briefing de DBA) NUNCA entra aqui — é referência de quem constrói tools.
const FILES = ['negocio-autopecas.md', 'glossario-kpis.md', 'modelo-comercial.md', 'mapa-modulos.md', 'mapa-navegacao.md', 'financeiro.md'];

let cached: string | null = null;

/**
 * Lê e concatena a base de conhecimento comercial da IRIS.
 * Memoizado (arquivos estáticos, versionados em git).
 * Em produção os .md são copiados para dist/ no build (scripts/copy-iris-knowledge.mjs).
 */
export function loadIrisKnowledge(): string {
  if (cached !== null) return cached;
  const parts: string[] = [];
  for (const f of FILES) {
    try {
      const txt = fs.readFileSync(path.join(__dirname, f), 'utf8').trim();
      if (txt) parts.push(txt);
    } catch {
      // arquivo ausente (ex: .md não copiado): ignora silenciosamente, não derruba a IRIS
    }
  }
  cached = parts.join('\n\n');
  return cached;
}
