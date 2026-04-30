import { pool } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const client = await pool.connect();
  const sql = readFileSync(join(__dirname, '..', 'migrations', '027_dedup_cad_prod_unique_index.sql'), 'utf-8');

  try {
    const { rows } = await client.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast','public')
        AND schema_name NOT LIKE 'pg_temp_%'
        AND schema_name NOT LIKE 'pg_toast_temp_%'
      ORDER BY schema_name
    `);

    const schemas = rows.map((r: any) => r.schema_name);
    console.log(`\n🚀 Aplicando migration 027 em ${schemas.length} schemas: ${schemas.join(', ')}\n`);

    for (const schema of schemas) {
      console.log(`📦 ${schema}...`);
      try {
        await client.query(`SET search_path TO ${schema}, public`);
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`
          CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await client.query(
          `INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          ['027_dedup_cad_prod_unique_index.sql']
        );
        await client.query('COMMIT');
        console.log(`   ✅ OK`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ ERRO: ${(err as Error).message}`);
      }
    }

    console.log('\n🎉 Concluído!\n');
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

main();
