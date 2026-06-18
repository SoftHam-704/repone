/**
 * Builder PURO de payload NFS-e. Sem I/O: recebe dados já carregados e devolve o
 * corpo pronto pra ACBr. Dois caminhos: RPS/ABRASF (municipal) e DPS (Nacional).
 * Política comercial fica fora daqui — só matemática/mapeamento.
 */
export type Provedor = 'municipal' | 'nacional';
export type Ambiente = 'homologacao' | 'producao';

export interface LancamentoNfse {
  id: number;
  competencia: string;          // 'YYYY-MM'
  vr_bruto: number;
  iss: number;                  // valor R$ do ISS (snapshot)
  representada_nome: string;
  for_cnpj: string;             // CNPJ da indústria (tomador)
  descricao?: string;           // discriminação do serviço (override do texto padrão)
  // Endereço do tomador (representada). IBGE resolvido por public.cidades no controller.
  tomador_ibge?: string;        // código IBGE (7 díg) do município do tomador
  tomador_cep?: string;
  tomador_logradouro?: string;
  tomador_bairro?: string;
  tomador_email?: string;
}
export interface AliquotasNfse {
  regime: string;               // 'PRESUMIDO' | 'SIMPLES' | ...
  iss_pct: number;
  inscricao_municipal: string;
  codigo_servico_padrao: string;  // cTribNac (nacional, ex.: 100900 = LC116 10.09)
  ctrib_mun?: string;             // cTribMun (código do município, ex.: 100901 = BH 10.09.01)
  cnbs?: string;                  // código NBS — exigido pelo schema do DPS Nacional
  cnae?: string;                  // CNAE do prestador (9 dígitos no XML) — exigido por alguns municípios
  // caminho RPS/ABRASF (municipal, ex.: ISSDSF Campo Grande):
  item_lista_servico?: string;          // LC116 (ex.: 1.07)
  codigo_tributacao_municipio?: string; // atividade do cadastro econômico (ex.: 620910000)
}
export interface Prestador { cnpj: string; razao: string; ibge: string }

export interface BuildArgs {
  lancamento: LancamentoNfse;
  aliquotas: AliquotasNfse;
  prestador: Prestador;
  provedor: Provedor;
  ambiente: Ambiente;
}
export interface BuiltPayload { tipo: 'rps' | 'dps'; payload: unknown }

const onlyDigits = (s: string) => String(s ?? '').replace(/\D/g, '');
const compToDate = (c: string) => `${c}-01`;                 // 'YYYY-MM' → 'YYYY-MM-01'

/** regEspTrib do Padrão Nacional: 6 = Simples ME/EPP, 5 = MEI, 1 = demais (fallback ABRASF). */
export function regEspTribDoRegime(regime: string | undefined): number {
  const r = (regime ?? '').toUpperCase();
  if (r === 'SIMPLES_MEI') return 5;
  if (r.includes('SIMPLES')) return 6;
  return 1;
}
const discriminacao = (l: LancamentoNfse) =>
  l.descricao ?? `Comissão sobre representação comercial — competência ${l.competencia}`;

export function buildNfsePayload(args: BuildArgs): BuiltPayload {
  const { lancamento: l, aliquotas: a, prestador: p, provedor, ambiente } = args;
  // Simples Nacional: ISS recolhido no DAS → NÃO se informa alíquota na DPS (E0625).
  const isSimples = !!a.regime?.toUpperCase().includes('SIMPLES');

  if (provedor === 'nacional') {
    // Padrão Nacional (DPS). Estrutura real do swagger ACBr v3.1.4:
    //   prest só leva CNPJ + regTrib (IM/nome vêm da empresa cadastrada no ACBr);
    //   serv.cServ é objeto { cTribNac, xDescServ }; valores tem vServPrest{vServ}
    //   e trib.tribMun{ tribISSQN, pAliq, cLocIncid, tpRetISSQN }.
    const tpAmb = ambiente === 'producao' ? 1 : 2;
    return {
      tipo: 'dps',
      payload: {
        provedor: 'nacional',
        ambiente,
        infDPS: {
          tpAmb,
          dhEmi: new Date().toISOString(),
          dCompet: compToDate(l.competencia),
          prest: { CNPJ: onlyDigits(p.cnpj), regTrib: { regEspTrib: regEspTribDoRegime(a.regime) } },
          toma:  {
            CNPJ: onlyDigits(l.for_cnpj),
            xNome: l.representada_nome,
            ...(l.tomador_email ? { email: l.tomador_email } : {}),
            // Padrão Nacional exige o município do tomador (endNac.cMun). Sem IBGE
            // resolvido, NÃO inventa endereço — o bloco end fica de fora.
            ...(l.tomador_ibge ? { end: {
              endNac: {
                cMun: l.tomador_ibge,
                ...(l.tomador_cep ? { CEP: onlyDigits(l.tomador_cep) } : {}),
              },
              ...(l.tomador_logradouro ? { xLgr: l.tomador_logradouro } : {}),
              ...(l.tomador_bairro ? { xBairro: l.tomador_bairro } : {}),
            } } : {}),
          },
          serv: {
            locPrest: { cLocPrestacao: p.ibge },
            cServ: { cTribNac: a.codigo_servico_padrao, cTribMun: a.ctrib_mun, cNBS: a.cnbs,
              ...(a.cnae ? { CNAE: onlyDigits(a.cnae) } : {}), xDescServ: discriminacao(l) },
          },
          valores: {
            vServPrest: { vServ: l.vr_bruto },
            trib: {
              tribMun: {
                tribISSQN: 1,          // 1 = operação tributável
                cLocIncid: p.ibge,
                tpRetISSQN: 1,         // 1 = ISSQN não retido
                ...(isSimples ? {} : { pAliq: a.iss_pct }), // Simples não informa alíquota (DAS)
              },
              // totTrib é obrigatório. Simples (ME/EPP) usa pTotTribSN (% aprox. dos
              // tributos do SN) — NÃO pode usar indTotTrib (E0712); demais usam indTotTrib.
              totTrib: isSimples ? { pTotTribSN: a.iss_pct } : { indTotTrib: 0 },
            },
          },
        },
      },
    };
  }

  // municipal (RPS/ABRASF) — ex.: ISSDSF (Campo Grande/MS). Estrutura real do
  // swagger: prestador só { cpf_cnpj } (IM vem da config da empresa no ACBr);
  // serviço usa item_lista_servico (LC116) + codigo_tributacao_municipio + valores{}.
  const valIss = Math.round(l.vr_bruto * a.iss_pct) / 100;
  return {
    tipo: 'rps',
    payload: {
      ambiente,
      rps: {
        referencia: String(l.id),
        data_emissao: new Date().toISOString().slice(0, 10),
        competencia: compToDate(l.competencia),
        natureza_tributacao: 1,  // 1 = tributação no município (ABRASF)
        prestador: { cpf_cnpj: onlyDigits(p.cnpj) },
        tomador: { cpf_cnpj: onlyDigits(l.for_cnpj), nome_razao_social: l.representada_nome },
        servicos: [{
          item_lista_servico: a.item_lista_servico ?? a.codigo_servico_padrao,
          codigo_tributacao_municipio: a.codigo_tributacao_municipio,
          discriminacao: discriminacao(l),
          iss_retido: false,
          valores: {
            valor_unitario: l.vr_bruto,
            valor_servicos: l.vr_bruto,
            aliquota_iss: a.iss_pct,
            valor_iss: valIss,
          },
        }],
      },
    },
  };
}
