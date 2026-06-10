// ─── Consulta de CNPJ via BrasilAPI (gratuita, pública, sem chave) ──────────────
// Dados da Receita Federal. Reutilizável por qualquer fluxo (IRIS, cadastro manual…).
import axios from 'axios';

export interface CnpjData {
  cnpj: string;             // 14 dígitos
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;              // 8 dígitos
  municipio: string;
  uf: string;
  telefone: string;         // só dígitos
  email: string;
  situacao: string;         // ex.: "ATIVA", "BAIXADA"
}

export interface CnpjResult { ok: boolean; data?: CnpjData; erro?: string }

export async function consultarCnpj(cnpjRaw: string): Promise<CnpjResult> {
  const cnpj = String(cnpjRaw || '').replace(/\D/g, '');
  if (cnpj.length !== 14) return { ok: false, erro: 'CNPJ inválido — precisa ter 14 dígitos.' };
  try {
    const r = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 9000 });
    const d = r.data || {};
    return {
      ok: true,
      data: {
        cnpj,
        razao_social: (d.razao_social || '').trim(),
        nome_fantasia: (d.nome_fantasia || d.razao_social || '').trim(),
        logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ').trim(),
        numero: String(d.numero || '').trim(),
        complemento: (d.complemento || '').trim(),
        bairro: (d.bairro || '').trim(),
        cep: String(d.cep || '').replace(/\D/g, ''),
        municipio: (d.municipio || '').trim(),
        uf: (d.uf || '').trim().toUpperCase(),
        telefone: String(d.ddd_telefone_1 || '').replace(/\D/g, ''),
        email: (d.email || '').trim().toLowerCase(),
        situacao: (d.descricao_situacao_cadastral || '').trim().toUpperCase(),
      },
    };
  } catch (e: any) {
    if (e?.response?.status === 404) return { ok: false, erro: 'CNPJ não encontrado na base da Receita.' };
    return { ok: false, erro: 'Não consegui consultar o CNPJ agora (serviço indisponível). Tente de novo em instantes.' };
  }
}

/** "12345678000199" → "12.345.678/0001-99" */
export function formatCnpj(cnpjDigits: string): string {
  const d = String(cnpjDigits || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpjDigits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
