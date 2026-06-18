import { AliquotasNfse, regEspTribDoRegime } from './nfse-payload';

const onlyDigits = (s: any) => String(s ?? '').replace(/\D/g, '');

export interface EmpresaStatusFiscal {
  emp_cnpj?: string; emp_nome?: string; emp_im?: string;
  emp_regime?: string; emp_ibge?: string; emp_nfse_ambiente?: string;
  emp_nfse_proximo_numero?: number | string; emp_nfse_serie?: string;
  emp_ctribnac?: string; emp_cnbs?: string; emp_item_lc116?: string;
  emp_ctribmun?: string | null; emp_cnae?: string | null; emp_iss_pct?: number | string;
}

/** empresa_status → AliquotasNfse (o que buildNfsePayload espera). */
export function empresaToAliquotas(e: EmpresaStatusFiscal): AliquotasNfse {
  return {
    regime: e.emp_regime || 'PRESUMIDO',
    iss_pct: Number(e.emp_iss_pct) || 0,
    inscricao_municipal: e.emp_im || '',
    codigo_servico_padrao: e.emp_ctribnac || '',
    ctrib_mun: e.emp_ctribmun || undefined,
    cnbs: e.emp_cnbs || undefined,
    cnae: e.emp_cnae || undefined,
  };
}

/** empresa_status → EmpresaConfigNfse (PUT /empresas/{cnpj}/nfse). */
export function empresaToConfigNfse(e: EmpresaStatusFiscal) {
  const regime = (e.emp_regime || '').toUpperCase();
  const isSimples = regime.includes('SIMPLES');
  const isMEI = regime === 'SIMPLES_MEI';
  const opSimpNac = isMEI ? 2 : isSimples ? 3 : 1;
  const regTrib: any = { opSimpNac, regEspTrib: regEspTribDoRegime(e.emp_regime) };
  if (isSimples) regTrib.regApTribSN = 1;
  return {
    ambiente: e.emp_nfse_ambiente === 'PRODUCAO' ? 'producao' : 'homologacao',
    incentivo_fiscal: false,
    regTrib,
    rps: { numero: Number(e.emp_nfse_proximo_numero) || 1, serie: e.emp_nfse_serie || '1', lote: 1 },
  };
}

export const cnpjDigits = onlyDigits;
