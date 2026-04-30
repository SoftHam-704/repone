import { pool } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_FILE = '012_pedidos_campos_v1.sql';

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast')
        AND schema_name NOT LIKE 'pg_temp_%'
        AND schema_name NOT LIKE 'pg_toast_temp_%'
      ORDER BY schema_name
    `);
    const schemas = res.rows.map(r => r.schema_name);
    console.log(`\n🚀 Aplicando ${MIGRATION_FILE} em ${schemas.length} schemas\n`);

    const sql = readFileSync(join(__dirname, '..', 'migrations', MIGRATION_FILE), 'utf-8');

    let ok = 0, fail = 0;
    for (const schema of schemas) {
      try {
        await client.query(`SET search_path TO ${schema}, public`);
        await client.query(sql);
        console.log(`  ✅ ${schema}`);
        ok++;
      } catch (e: any) {
        console.error(`  ❌ ${schema}: ${e.message}`);
        fail++;
      }
    }
    console.log(`\n✔ Concluído: ${ok} OK, ${fail} falhas\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
