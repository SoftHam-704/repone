// Fonte única do manual (markdown) para o app: leitor online (/api/manual), o
// Assistente de how-to (treinamento) e a IRIS Global. Busca o .md hospedado e
// cacheia em memória — atualizar o manual = subir só o .md (sem redeploy).

const MANUAL_MD_URL = process.env.MANUAL_MD_URL || 'https://softham.com.br/repone/manual-repone.md';
const TTL_MS = 5 * 60 * 1000;

let _cache: { text: string; at: number } = { text: '', at: 0 };

/** Markdown do manual, cacheado 5 min. Em erro, serve a última versão boa; se nunca
 *  carregou, retorna '' (consumidores degradam sem quebrar). */
export async function getManualMarkdown(): Promise<string> {
  const now = Date.now();
  if (_cache.text && now - _cache.at < TTL_MS) return _cache.text;
  try {
    const r = await fetch(MANUAL_MD_URL);
    if (!r.ok) throw new Error('upstream ' + r.status);
    const text = await r.text();
    _cache = { text, at: now };
    return text;
  } catch {
    return _cache.text; // stale-on-error (ou '' se nunca carregou)
  }
}
