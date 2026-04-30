import { pool } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  const sql = readFileSync(join(__dirname, '..', 'migrations', '007_itinerario_paradas.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO public`);
    await client.query(sql);
    console.log('✅ Migration 007 — itinerario_paradas aplicada!');
  } catch(e: any) {
    console.error('❌', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
