import 'dotenv/config';
import * as acbr from '../src/shared/utils/acbr-nfse.service';
import { buildNfsePayload } from '../src/modules/nfse/nfse-payload';

const CTRIB = process.argv[2] || '010700';      // cTribNac (LC116 1.07 suporte técnico TI)
const CNBS  = process.argv[3] || '';            // NBS (vazio = omite)
const CMUN  = process.argv[5] || '';            // cTribMun (vazio = omite)
const ISS   = Number(process.argv[4] || '5');   // alíquota ISS %

const SOFTHAM = { cnpj: '17504829000124', razao: 'HAMILTON LUIZ RODRIGUES DA SILVA', ibge: '5002704' };
const IM = '00179657007';

(async () => {
  try {
    await acbr.configurarNfseEmpresa(SOFTHAM.cnpj, {
      ambiente: 'homologacao', incentivo_fiscal: false,
      regTrib: { opSimpNac: 1, regEspTrib: 0 }, rps: { numero: 1, serie: '1', lote: 1 },
    });
    console.log('config NFS-e OK');
  } catch (e: any) { console.log('config aviso:', e.message); }

  const { payload } = buildNfsePayload({
    lancamento: { id: 1, competencia: '2026-06', vr_bruto: 100, iss: Math.round(100 * ISS) / 100,
      representada_nome: 'HM BORCATO REPRESENTACAO COMERCIAL LTDA', for_cnpj: '28427986000108' },
    aliquotas: { regime: 'PRESUMIDO', iss_pct: ISS, inscricao_municipal: IM,
      codigo_servico_padrao: CTRIB, cnbs: CNBS || undefined, ctrib_mun: CMUN || undefined },
    prestador: SOFTHAM, provedor: 'nacional', ambiente: 'homologacao',  // v2: tudo via /nfse/dps
  });
  console.log('PAYLOAD:\n' + JSON.stringify(payload, null, 1).slice(0, 1100));

  console.log('\n→ emitindo DPS (cTribNac', CTRIB, '| cNBS', CNBS || '-', '| ISS', ISS, '%)...');
  const emit: any = await acbr.emitirDps(payload);
  console.log('RESPOSTA:', JSON.stringify(emit).slice(0, 900));
  const id = emit?.id ?? emit?.data?.id;
  if (id) { await new Promise(r => setTimeout(r, 4000)); console.log('\nCONSULTA:', JSON.stringify(await acbr.consultar(id)).slice(0, 1400)); }
})().catch(e => { console.error('\nFALHOU:', e.message, e?.body ? '\nbody: ' + String(e.body).slice(0, 1400) : ''); process.exit(1); });
