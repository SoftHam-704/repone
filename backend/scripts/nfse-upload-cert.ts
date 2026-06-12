import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { uploadCertificado } from '../src/shared/utils/acbr-nfse.service';

// uso: npx tsx scripts/nfse-upload-cert.ts <cnpj> <caminho.pfx> <senha>
const [cnpj, pfxPath, senha] = process.argv.slice(2);

(async () => {
  if (!cnpj || !pfxPath || !senha) {
    console.error('uso: npx tsx scripts/nfse-upload-cert.ts <cnpj> <caminho.pfx> <senha>');
    process.exit(1);
  }
  const b64 = readFileSync(pfxPath).toString('base64');
  const r = await uploadCertificado(cnpj.replace(/\D/g, ''), b64, senha);
  console.log('upload cert OK:', JSON.stringify(r).slice(0, 600));
})().catch(e => { console.error('FALHOU:', e.message, e?.body ? '| body: ' + String(e.body).slice(0, 600) : ''); process.exit(1); });
