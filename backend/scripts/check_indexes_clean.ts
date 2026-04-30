import { pool } from '../src/config/database';

async function run() {
  const client = await pool.connect();
  const schema = 'ndsrep';

  try {
    await client.query(`SET search_path TO ${schema}, public`);

    const res = await client.query(`
      SELECT
        t.relname   AS tabela,
        i.relname   AS indice,
        ix.indkey   AS indkey,
        ix.indisunique AS unico,
        string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey::int[], a.attnum)) AS colunas
      FROM pg_class t
      JOIN pg_index ix ON ix.indrelid = t.oid
      JOIN pg_class i  ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname IN ('clientes','itinerarios','itinerario_paradas','vendedores','regioes')
        AND t.relkind = 'r' AND a.attnum > 0
      GROUP BY t.relname, i.relname, ix.indkey, ix.indisunique
      ORDER BY t.relname, i.relname
    `);

    const grouped: Record<string, string[]> = {};
    for (const row of res.rows) {
      if (!grouped[row.tabela]) grouped[row.tabela] = [];
      grouped[row.tabela].push(`  ${row.indice} → (${row.colunas})${row.unico ? ' UNIQUE' : ''}`);
    }
    for (const [tab, idxs] of Object.entries(grouped)) {
      console.log(`\n📋 ${tab} — ${idxs.length} índices:`);
      idxs.forEach(i => console.log(i));
    }

    // Colunas de itinerarios
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'itinerarios'
      ORDER BY ordinal_position
    `, [schema]);
    console.log('\n📋 Colunas itinerarios:');
    cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // Duplicatas
    const dups = await client.query(`
      SELECT t.relname AS tabela,
             string_agg(i.relname, ' + ') AS indices_duplicados,
             string_agg(a.attname, ', ') AS colunas
      FROM pg_class t
      JOIN pg_index ix ON ix.indrelid = t.oid
      JOIN pg_class i  ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname IN ('clientes','itinerarios','vendedores','regioes')
        AND t.relkind = 'r' AND a.attnum > 0
      GROUP BY t.relname, ix.indkey::text
      HAVING count(DISTINCT i.relname) > 1
      ORDER BY t.relname
    `);
    if (dups.rows.length > 0) {
      console.log('\n⚠️  DUPLICATAS:');
      dups.rows.forEach(r => console.log(`  ${r.tabela}(${r.colunas}) → ${r.indices_duplicados}`));
    } else {
      console.log('\n✅ Sem duplicatas.');
    }

  } finally {
    client.release();
    await pool.end();
  }
}
run();
