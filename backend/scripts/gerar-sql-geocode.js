/**
 * gerar-sql-geocode.js
 * Baixa o CSV de municípios brasileiros (kelvins/municipios-brasileiros)
 * e gera update-cidades-coords.sql com um único UPDATE em massa.
 *
 * node scripts/gerar-sql-geocode.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const CSV_URL  = 'https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv';
const OUT_FILE = path.join(__dirname, 'update-cidades-coords.sql');

async function main() {
  console.log('⬇  Baixando CSV...');
  const res  = await fetch(CSV_URL);
  const text = await res.text();

  const lines = text.trim().split('\n');
  const header = lines[0].split(','); // codigo_ibge,nome,latitude,longitude,...
  const ibgeIdx = header.indexOf('codigo_ibge');
  const latIdx  = header.indexOf('latitude');
  const lonIdx  = header.indexOf('longitude');

  const values = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const ibge = cols[ibgeIdx]?.trim();
    const lat  = parseFloat(cols[latIdx]);
    const lon  = parseFloat(cols[lonIdx]);
    if (!ibge || isNaN(lat) || isNaN(lon)) continue;
    values.push(`  ('${ibge}', ${lat}, ${lon})`);
  }

  console.log(`✅ ${values.length} municípios processados.`);

  const sql = `-- Atualiza coordenadas em public.cidades via código IBGE
-- Gerado em ${new Date().toISOString()}
-- Execute no pgAdmin conectado ao banco basesales (schema public)

UPDATE public.cidades AS c
SET
  cid_latitude  = v.lat::numeric(10,7),
  cid_longitude = v.lon::numeric(10,7)
FROM (VALUES
${values.join(',\n')}
) AS v(ibge, lat, lon)
WHERE c.cid_ibge::text = v.ibge;
`;

  fs.writeFileSync(OUT_FILE, sql, 'utf8');
  console.log(`\n📄 Arquivo gerado: ${OUT_FILE}`);
  console.log('   Abra no pgAdmin e execute — atualiza todas as cidades em segundos.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
