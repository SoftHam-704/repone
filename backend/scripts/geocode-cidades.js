/**
 * geocode-cidades.js — standalone, sem dependências do projeto
 * node scripts/geocode-cidades.js
 */
'use strict';

const { Pool } = require('pg');
const path = require('path');

// Carrega .env se existir (dev local); no servidor as vars já estão no ambiente
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch {}

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const DELAY_MS   = 1100;
const USER_AGENT = 'RepOne-SalesMasters/2.0 (softham2008@gmail.com)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(nome, uf) {
  const q   = encodeURIComponent(`${nome}, ${uf}, Brasil`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`;
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json();
    if (data?.length) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (e) {
    console.error(`  ✗ fetch error: ${e.message}`);
  }
  return null;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT cid_codigo, cid_nome, cid_uf
       FROM public.cidades
       WHERE cid_latitude IS NULL OR cid_longitude IS NULL
       ORDER BY cid_uf, cid_nome`
    );

    console.log(`\n🗺  ${rows.length} cidades sem coordenada. Iniciando geocodificação...\n`);
    let ok = 0, fail = 0;

    for (const row of rows) {
      process.stdout.write(`  [${ok + fail + 1}/${rows.length}] ${row.cid_nome}/${row.cid_uf} ... `);
      const coord = await geocode(row.cid_nome, row.cid_uf);
      if (coord) {
        await client.query(
          `UPDATE public.cidades SET cid_latitude=$1, cid_longitude=$2 WHERE cid_codigo=$3`,
          [coord.lat, coord.lon, row.cid_codigo]
        );
        console.log(`✓ (${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)})`);
        ok++;
      } else {
        console.log('✗ não encontrada');
        fail++;
      }
      await sleep(DELAY_MS);
    }

    console.log(`\n✅ Concluído: ${ok} atualizadas, ${fail} não encontradas.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
