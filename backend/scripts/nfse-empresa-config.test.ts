import assert from 'node:assert';
import { empresaToConfigNfse, empresaToAliquotas } from '../src/modules/nfse/nfse-empresa-config';

const empSimples = {
  emp_cnpj: '17.504.829/0001-24', emp_nome: 'HAMILTON LUIZ', emp_im: '00179657007',
  emp_regime: 'SIMPLES_MEEPP', emp_ibge: '5002704', emp_nfse_ambiente: 'HOMOLOGACAO',
  emp_nfse_proximo_numero: 442, emp_nfse_serie: '1',
  emp_ctribnac: '010701', emp_cnbs: '115013000', emp_item_lc116: '01.07.01',
  emp_ctribmun: null, emp_cnae: '620910000', emp_iss_pct: 5,
};

const cfg = empresaToConfigNfse(empSimples);
assert.equal(cfg.ambiente, 'homologacao');
assert.equal(cfg.regTrib.opSimpNac, 3, 'SIMPLES_MEEPP → opSimpNac 3');
assert.equal(cfg.regTrib.regApTribSN, 1, 'optante → regApTribSN 1');
assert.equal(cfg.rps.numero, 442, 'semente da numeração');

const aliq = empresaToAliquotas(empSimples);
assert.equal(aliq.regime, 'SIMPLES_MEEPP');
assert.equal(aliq.codigo_servico_padrao, '010701', 'cTribNac');
assert.equal(aliq.cnbs, '115013000');
assert.equal(aliq.inscricao_municipal, '00179657007');

const empPres = { ...empSimples, emp_regime: 'PRESUMIDO' };
const cfgP = empresaToConfigNfse(empPres);
assert.equal(cfgP.regTrib.opSimpNac, 1, 'não optante');
assert.equal(cfgP.regTrib.regApTribSN, undefined, 'não-optante não manda regApTribSN');

console.log('OK — empresa-config helpers');
