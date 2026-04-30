import { pool } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_FILE = '006_setores_itinerarios.sql';

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
    let ok = 0, skip = 0, fail = 0;

    for (const schema of schemas) {
      try {
        await client.query(`SET search_path TO ${schema}, public`);
        await client.query(`CREATE TABLE IF NOT EXISTS _migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

        const already = await client.query(`SELECT 1 FROM _migrations WHERE name = $1`, [MIGRATION_FILE]);
        if (already.rows.length > 0) { console.log(`   ⏭  ${schema}`); skip++; continue; }

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [MIGRATION_FILE]);
        await client.query('COMMIT');
        console.log(`   ✅ ${schema}`);
        ok++;
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`   ❌ ${schema} — ${err.message}`);
        fail++;
      }
    }
    console.log(`\n📊 ${ok} aplicadas | ${skip} puladas | ${fail} erros\n`);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
