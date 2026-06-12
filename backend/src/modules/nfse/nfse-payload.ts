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
}
export interface AliquotasNfse {
  regime: string;               // 'PRESUMIDO' | 'SIMPLES' | ...
  iss_pct: number;
  inscricao_municipal: string;
  codigo_servico_padrao: string;
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
const discriminacao = (l: LancamentoNfse) =>
  `Comissão sobre representação comercial — competência ${l.competencia}`;

export function buildNfsePayload(args: BuildArgs): BuiltPayload {
  const { lancamento: l, aliquotas: a, prestador: p, provedor, ambiente } = args;
  const naturezaTributacao = a.regime?.toUpperCase().includes('SIMPLES') ? 1 : 0;

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
          prest: { CNPJ: onlyDigits(p.cnpj), regTrib: { regEspTrib: 0 } },
          toma:  { CNPJ: onlyDigits(l.for_cnpj), xNome: l.representada_nome },
          serv: {
            locPrest: { cLocPrestacao: p.ibge },
            cServ: { cTribNac: a.codigo_servico_padrao, xDescServ: discriminacao(l) },
          },
          valores: {
            vServPrest: { vServ: l.vr_bruto },
            trib: {
              tribMun: {
                tribISSQN: 1,          // 1 = operação tributável
                pAliq: a.iss_pct,
                cLocIncid: p.ibge,
                tpRetISSQN: 1,         // 1 = ISSQN não retido
              },
            },
          },
        },
      },
    };
  }

  // municipal (RPS/ABRASF)
  return {
    tipo: 'rps',
    payload: {
      ambiente,
      rps: {
        referencia: String(l.id),
        data_emissao: new Date().toISOString().slice(0, 10),
        competencia: compToDate(l.competencia),
        natureza_tributacao: naturezaTributacao,
        prestador: { cnpj: onlyDigits(p.cnpj), inscricao_municipal: a.inscricao_municipal, razao_social: p.razao },
        tomador:   { cnpj: onlyDigits(l.for_cnpj), razao_social: l.representada_nome },
        servicos: [{
          codigo_servico: a.codigo_servico_padrao,
          discriminacao: discriminacao(l),
          valor_servico: l.vr_bruto,
          aliquota_iss: a.iss_pct,
          valor_iss: l.iss,
        }],
      },
    },
  };
}
