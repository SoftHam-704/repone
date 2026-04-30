import { pool } from '../src/config/database';

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO public`);
    await client.query(`ALTER TABLE itinerarios ADD COLUMN IF NOT EXISTS iti_vendedor INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL`);
    console.log('✅ Coluna iti_vendedor adicionada!');
  } catch(e: any) {
    console.error('❌', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
