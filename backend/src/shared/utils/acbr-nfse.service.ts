/**
 * ACBr API — NFS-e (cliente RepOne).
 * OAuth2 client_credentials + cache de token, tratamento de 402/429.
 * Padrão copiado de SoftHam-emissor/src/services/acbr.service.ts (scope = 'nfse').
 *
 * Credenciais PROD (token aud=prod) → BASE_URL sempre prod.acbr.api.br.
 * A HOMOLOGAÇÃO é selecionada no payload (campo `ambiente`), não no host.
 */
interface Token { access_token: string; expires_at: number }
export interface AcbrResponse<T = unknown> { id?: string; status?: string; data?: T; error?: string; [k: string]: unknown }

const AMBIENTE = process.env.ACBR_AMBIENTE === 'producao' ? 'prod' : 'hom';
const BASE_URL = `https://${AMBIENTE}.acbr.api.br`;
const AUTH_URL = 'https://auth.acbr.api.br/realms/ACBrAPI/protocol/openid-connect/token';
const SCOPES   = 'empresa cnpj nfse';
const DEBUG    = process.env.NODE_ENV !== 'production' || process.env.ACBR_DEBUG === '1';

export class AcbrError extends Error {
  status: number; body: string; rawJson: unknown; method: string; path: string;
  constructor(o: { status: number; body: string; rawJson: unknown; method: string; path: string; message: string }) {
    super(o.message);
    this.name = 'AcbrError';
    this.status = o.status; this.body = o.body; this.rawJson = o.rawJson; this.method = o.method; this.path = o.path;
  }
}

function extractErrorMessage(rawJson: unknown, fallback: string): string {
  if (!rawJson || typeof rawJson !== 'object') return fallback.slice(0, 500);
  const obj = rawJson as Record<string, unknown>;
  const partes: string[] = [];
  const err = obj.error;
  if (typeof err === 'string') partes.push(err);
  else if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') partes.push(e.code ? `${e.code}: ${e.message}` : e.message);
    if (Array.isArray(e.errors)) for (const s of e.errors) {
      if (typeof s === 'string') partes.push(s);
      else if (s && typeof s === 'object') { const x = s as any; if (x.message) partes.push(x.campo ? `${x.campo}: ${x.message}` : x.message); }
    }
  }
  for (const k of ['message', 'mensagem', 'motivo', 'descricao']) if (typeof obj[k] === 'string') partes.push(obj[k] as string);
  if (Array.isArray(obj.errors)) for (const s of obj.errors) {
    if (typeof s === 'string') partes.push(s);
    else if (s && typeof s === 'object') { const x = s as any; if (x.message) partes.push(x.campo ? `${x.campo}: ${x.message}` : x.message); }
  }
  const seen = new Set<string>();
  const uniq = partes.filter(p => (seen.has(p) ? false : (seen.add(p), true)));
  return uniq.length ? uniq.join(' · ') : fallback.slice(0, 500);
}

let _token: Token | null = null;
async function getToken(): Promise<string> {
  if (_token && Date.now() < _token.expires_at - 30_000) return _token.access_token;
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ACBR_CLIENT_ID ?? '',
      client_secret: process.env.ACBR_CLIENT_SECRET ?? '',
      scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`[ACBr Auth] ${res.status} ${await res.text()}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  _token = { access_token: json.access_token, expires_at: Date.now() + json.expires_in * 1000 };
  return _token.access_token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<AcbrResponse<T>> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  let rawJson: unknown = null;
  try { rawJson = rawText ? JSON.parse(rawText) : null; } catch { /* não-JSON */ }
  if (DEBUG) console.log(`[ACBr ${method} ${path}] → ${res.status}`);
  if (res.status === 429) throw new AcbrError({ status: 429, body: rawText, rawJson, method, path, message: '[ACBr] Rate limit. Tente novamente.' });
  if (res.status === 402) throw new AcbrError({ status: 402, body: rawText, rawJson, method, path, message: '[ACBr] Sem créditos. Recarregue a conta ACBr API.' });
  if (!res.ok) throw new AcbrError({ status: res.status, body: rawText, rawJson, method, path, message: `[ACBr ${res.status}] ${extractErrorMessage(rawJson, rawText)}` });
  return (rawJson ?? {}) as AcbrResponse<T>;
}

async function requestBinary(method: string, path: string): Promise<{ data: Buffer; contentType: string }> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream, application/pdf, application/xml, */*' },
  });
  if (!res.ok) {
    const rawText = await res.text();
    let rawJson: unknown = null; try { rawJson = rawText ? JSON.parse(rawText) : null; } catch { /* */ }
    throw new AcbrError({ status: res.status, body: rawText, rawJson, method, path, message: `[ACBr ${res.status}] ${extractErrorMessage(rawJson, rawText)}` });
  }
  return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? '' };
}

// ── Empresa / config ───────────────────────────────────────────────
export function uploadCertificado(cnpj: string, pfxBase64: string, senha: string) {
  // DTO EmpresaPedidoCadastroCertificado = { certificado, password } (não "senha")
  return request('PUT', `/empresas/${cnpj}/certificado`, { certificado: pfxBase64, password: senha });
}
export function configurarNfseEmpresa(cnpj: string, dados: unknown) {
  return request('PUT', `/empresas/${cnpj}/nfse`, dados);
}
export function cidade(ibge: string | number) { return request('GET', `/nfse/cidades/${ibge}`); }

// ── Emissão ────────────────────────────────────────────────────────
export function emitirRps(payload: unknown) { return request('POST', '/nfse',     payload); }
export function emitirDps(payload: unknown) { return request('POST', '/nfse/dps', payload); }
export function consultar(id: string)       { return request('GET',  `/nfse/${id}`); }
export function sincronizar(id: string)     { return request('POST', `/nfse/${id}/sincronizar`); }
export function cancelar(id: string, motivo: string) { return request('POST', `/nfse/${id}/cancelamento`, { motivo }); }
export function baixarPdf(id: string) { return requestBinary('GET', `/nfse/${id}/pdf`); }
export function baixarXml(id: string) { return requestBinary('GET', `/nfse/${id}/xml`); }
