import assert from 'node:assert';
import { buildNfsePayload, regEspTribDoRegime } from '../src/modules/nfse/nfse-payload';

// regEspTrib (Padrão Nacional): 6 Simples ME/EPP, 5 MEI, 1 demais (fallback ABRASF)
assert.equal(regEspTribDoRegime('SIMPLES'), 6, 'SIMPLES → 6');
assert.equal(regEspTribDoRegime('SIMPLES_MEI'), 5, 'MEI → 5');
assert.equal(regEspTribDoRegime('PRESUMIDO'), 1, 'PRESUMIDO → 1');
assert.equal(regEspTribDoRegime(''), 1, 'vazio → 1 (fallback)');

const lancamento = {
  id: 1, competencia: '2026-06', vr_bruto: 1000, iss: 25,
  representada_nome: 'INDÚSTRIA ALFA', for_cnpj: '11111111000111',
};
const aliquotas = { regime: 'PRESUMIDO', iss_pct: 2.5, inscricao_municipal: '123456', codigo_servico_padrao: '10.09' };
const prestador = { cnpj: '28427986000108', razao: 'HM BORCATO REPRESENTACAO COMERCIAL LTDA', ibge: '3106200' };

// CNAE (prestador) entra no DPS cServ.CNAE com 9 dígitos quando presente; some quando vazio
const dpsCnae = buildNfsePayload({ lancamento, prestador, provedor: 'nacional', ambiente: 'homologacao',
  aliquotas: { ...aliquotas, cnae: '6202-3/00' } }).payload as any;
assert.equal(dpsCnae.infDPS.serv.cServ.CNAE, '6202300', 'CNAE só dígitos no cServ');
const dpsSemCnae = buildNfsePayload({ lancamento, aliquotas, prestador, provedor: 'nacional', ambiente: 'homologacao' }).payload as any;
assert.equal(dpsSemCnae.infDPS.serv.cServ.CNAE, undefined, 'sem CNAE → campo omitido');

// Provedor municipal (RPS/ABRASF) — estrutura real (item_lista_servico + valores{})
const rps = buildNfsePayload({ lancamento, aliquotas, prestador, provedor: 'municipal', ambiente: 'homologacao' });
const rp = rps.payload as any;
assert.equal(rps.tipo, 'rps', 'municipal → rps');
assert.equal(rp.ambiente, 'homologacao');
assert.equal(rp.rps.servicos[0].valores.valor_servicos, 1000, 'valor em valores.valor_servicos');
assert.equal(rp.rps.servicos[0].item_lista_servico, '10.09', 'LC116 em item_lista_servico');
assert.equal(rp.rps.prestador.cpf_cnpj, '28427986000108', 'prestador só cpf_cnpj');
assert.equal(rp.rps.tomador.cpf_cnpj, '11111111000111');

// Provedor nacional (DPS) — estrutura Padrão Nacional aninhada
const dps = buildNfsePayload({ lancamento, aliquotas, prestador, provedor: 'nacional', ambiente: 'homologacao' });
const dp = dps.payload as any;
assert.equal(dps.tipo, 'dps', 'nacional → dps');
assert.equal(dp.provedor, 'nacional');
assert.equal(dp.infDPS.tpAmb, 2, 'homologacao → tpAmb 2');
assert.equal(dp.infDPS.prest.CNPJ, '28427986000108');
assert.equal(dp.infDPS.serv.cServ.cTribNac, '10.09', 'código nacional no cServ.cTribNac');
assert.equal(dp.infDPS.serv.locPrest.cLocPrestacao, '3106200');
assert.equal(dp.infDPS.valores.vServPrest.vServ, 1000, 'valor em valores.vServPrest.vServ');
assert.equal(dp.infDPS.valores.trib.tribMun.tribISSQN, 1);
assert.equal(dp.infDPS.valores.trib.tribMun.pAliq, 2.5);

console.log('OK — builder de payload');
