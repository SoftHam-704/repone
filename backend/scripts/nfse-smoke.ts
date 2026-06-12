import 'dotenv/config';
import assert from 'node:assert';
import { cidade } from '../src/shared/utils/acbr-nfse.service';

(async () => {
  const r: any = await cidade(3106200); // Belo Horizonte/MG
  console.log('cidade 3106200:', JSON.stringify(r).slice(0, 600));
  assert.ok(r && typeof r === 'object', 'resposta vazia');
  console.log('OK — auth + scope nfse funcionando, provedor BH retornado.');
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
