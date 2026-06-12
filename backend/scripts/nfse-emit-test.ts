import 'dotenv/config';
import { Pool } from 'pg';
import * as acbr from '../src/shared/utils/acbr-nfse.service';
import { buildNfsePayload } from '../src/modules/nfse/nfse-payload';

const CTRIB = process.argv[2] || '100900';   // cTribNac (nacional, LC116 10.09)
const CMUN  = process.argv[4] || '';         // cTribMun (3 dígitos; vazio = omite)
const CNBS  = process.argv[3] || '102010000'; // código NBS

function pool(database: string, user: string, password: string) {
  return new Pool({ host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database, user, password, ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
}

(async () => {
  const m = pool(process.env.MASTER_DB_NAME!, process.env.MASTER_DB_USER!, process.env.MASTER_DB_PASSWORD!);
  const emp = (await m.query(`SELECT db_nome, db_schema, db_usuario, db_senha, razao_social, cnpj FROM empresas WHERE db_schema='borcatorep'`)).rows[0];
  await m.end();
  const t = pool(emp.db_nome, emp.db_usuario, emp.db_senha);
  await t.query(`SET search_path TO "borcatorep", public`);

  await t.query(`UPDATE fin_nfse_aliquotas SET inscricao_municipal='10422620014', codigo_servico_padrao=$1 WHERE id=1`, [CTRIB]);
  await t.query(`DELETE FROM fin_nfse WHERE obs = 'TESTE NFS-e homologação'`); // limpa testes anteriores

  const ind = (await t.query(`SELECT for_codigo, for_nome, for_cgc FROM fornecedores WHERE for_tipo2='A' AND COALESCE(for_cgc,'')<>'' ORDER BY for_codigo LIMIT 1`)).rows[0];
  if (!ind) { console.error('Sem indústria com CNPJ'); process.exit(1); }

  const lancId = (await t.query(`
    INSERT INTO fin_nfse (emissao, competencia, for_codigo, representada_nome, vr_bruto, iss, status, obs)
    VALUES (CURRENT_DATE, '2026-06', $1, $2, 100.00, 2.50, 'CONTROLE', 'TESTE NFS-e homologação') RETURNING id
  `, [ind.for_codigo, ind.for_nome])).rows[0].id;
  console.log('Tomador:', ind.for_nome, ind.for_cgc, '| lançamento id', lancId);

  const lanc = (await t.query(`SELECT n.*, f.for_cgc AS for_cnpj FROM fin_nfse n LEFT JOIN fornecedores f ON f.for_codigo=n.for_codigo WHERE n.id=$1`, [lancId])).rows[0];
  const aliq = (await t.query(`SELECT * FROM fin_nfse_aliquotas WHERE id=1`)).rows[0];
  const { payload } = buildNfsePayload({
    lancamento: { id: lanc.id, competencia: lanc.competencia, vr_bruto: Number(lanc.vr_bruto), iss: Number(lanc.iss), representada_nome: lanc.representada_nome, for_cnpj: String(lanc.for_cnpj) },
    aliquotas: { regime: aliq.regime, iss_pct: Number(aliq.iss_pct), inscricao_municipal: String(aliq.inscricao_municipal), codigo_servico_padrao: String(aliq.codigo_servico_padrao), ctrib_mun: CMUN || undefined, cnbs: CNBS },
    prestador: { cnpj: String(emp.cnpj), razao: emp.razao_social, ibge: '3106200' },
    provedor: 'nacional', ambiente: 'homologacao',
  });

  console.log('→ emitindo (cTribNac', CTRIB, '| cNBS', CNBS, ')...');
  const emit: any = await acbr.emitirDps(payload);
  console.log('RESPOSTA:', JSON.stringify(emit).slice(0, 1200));
  const acbrId = emit?.id ?? emit?.data?.id;
  if (acbrId) {
    await new Promise(r => setTimeout(r, 3000));
    const info: any = await acbr.consultar(acbrId);
    console.log('\nCONSULTA:', JSON.stringify(info).slice(0, 1200));
  }
  await t.end();
})().catch(e => { console.error('\nFALHOU:', e.message, e?.body ? '\nbody: ' + String(e.body).slice(0, 1200) : ''); process.exit(1); });
