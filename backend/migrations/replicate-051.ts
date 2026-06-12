import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Replica a migration 051 em todos os schemas de tenant do DB basesales.
// Usa as credenciais do tenant (webadmin/basesales) obtidas do master.
async function main() {
  const master = new Pool({
    host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database: process.env.MASTER_DB_NAME, user: process.env.MASTER_DB_USER,
    password: process.env.MASTER_DB_PASSWORD,
    ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  const cred = (await master.query(
    `SELECT db_nome, db_usuario, db_senha FROM public.empresas WHERE status='ATIVO' AND db_nome IS NOT NULL LIMIT 1`
  )).rows[0];
  await master.end();
  if (!cred) throw new Error('Sem tenant ativo para obter credenciais do basesales.');

  const pool = new Pool({
    host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database: cred.db_nome, user: cred.db_usuario, password: cred.db_senha,
    ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const sql = fs.readFileSync(path.join(__dirname, '051_empresa_nfse_config.sql'), 'utf8');

  const schemas = (await pool.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public','pg_catalog','information_schema','pg_toast','basesales')
      AND schema_name NOT LIKE 'pg_%'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = schema_name AND t.table_name = 'empresa_status'
      )
    ORDER BY schema_name
  `)).rows.map(r => r.schema_name);

  console.log(`Migration 051 → ${schemas.length} schemas com empresa_status...`);
  let ok = 0, fail = 0;
  for (const schema of schemas) {
    const c = await pool.connect();
    try {
      await c.query(`SET search_path TO "${schema}", public`);
      await c.query(sql);
      console.log(`  ✅ ${schema}`); ok++;
    } catch (err: any) {
      console.error(`  ❌ ${schema}: ${err.message}`); fail++;
    } finally {
      await c.query('RESET search_path').catch(() => {});
      c.release();
    }
  }
  await pool.end();
  console.log(`\nDone. OK=${ok} FAIL=${fail}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
