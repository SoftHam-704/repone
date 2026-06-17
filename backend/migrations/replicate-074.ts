import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Replica a migration 074 (padronização cidades em clientes) nos 31 tenants RepOne
// do DB basesales. NÃO é destrutiva: só preenche cli_idcidade NULL com match único
// (nome+UF) contra public.cidades e alinha texto que diverge só por acento/caixa.
// Cada tenant roda na própria transação (commit por tenant); um falho não derruba os
// outros, mas loga FAIL no relatório final.
async function main() {
  const master = new Pool({
    host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database: process.env.MASTER_DB_NAME, user: process.env.MASTER_DB_USER,
    password: process.env.MASTER_DB_PASSWORD,
    ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  const cred = (await master.query(
    `SELECT db_usuario, db_senha FROM public.empresas
      WHERE status='ATIVO' AND db_nome='basesales' AND db_usuario IS NOT NULL LIMIT 1`
  )).rows[0];
  const schemas = (await master.query(
    `SELECT db_schema FROM public.empresas
      WHERE status='ATIVO' AND db_nome='basesales' AND db_schema IS NOT NULL
      ORDER BY db_schema`
  )).rows.map(r => r.db_schema);
  await master.end();
  if (!cred) throw new Error('Sem credenciais de tenant basesales no master.');

  const pool = new Pool({
    host: process.env.MASTER_DB_HOST, port: Number(process.env.MASTER_DB_PORT),
    database: 'basesales', user: cred.db_usuario, password: cred.db_senha,
    ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const sql = fs.readFileSync(
    path.join(__dirname, 'pgadmin_074_padronizar_cidades_clientes.sql'), 'utf8'
  );

  console.log(`Migration 074 → ${schemas.length} tenants RepOne...`);
  let ok = 0, fail = 0;
  for (const schema of schemas) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SET LOCAL search_path TO "${schema}", public`);
      // captura RAISE NOTICE
      c.on('notice', (n: any) => { if (n.message) console.log(`     ${n.message}`); });
      await c.query(sql);
      await c.query('COMMIT');
      console.log(`  OK ${schema}`); ok++;
    } catch (err: any) {
      await c.query('ROLLBACK').catch(() => {});
      console.error(`  FAIL ${schema}: ${err.message}`); fail++;
    } finally {
      c.release();
    }
  }
  await pool.end();
  console.log(`\nDone. OK=${ok} FAIL=${fail}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
