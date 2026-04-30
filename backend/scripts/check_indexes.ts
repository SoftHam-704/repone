import { pool } from '../src/config/database';

async function run() {
  const client = await pool.connect();
  const schema = 'ndsrep';

  try {
    await client.query(`SET search_path TO ${schema}, public`);

    const res = await client.query(`
      SELECT
        t.relname  AS tabela,
        i.relname  AS indice,
        a.attname  AS coluna,
        ix.indisunique AS unico
      FROM pg_class t
      JOIN pg_index ix ON ix.indrelid = t.oid
      JOIN pg_class i  ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname IN ('clientes','itinerarios','itinerario_paradas','vendedores','regioes','setores')
        AND t.relkind = 'r'
      ORDER BY t.relname, i.relname
    `);

    const grouped: Record<string, string[]> = {};
    for (const row of res.rows) {
      if (!grouped[row.tabela]) grouped[row.tabela] = [];
      grouped[row.tabela].push(`  ${row.indice} (${row.coluna})${row.unico ? ' UNIQUE' : ''}`);
    }

    for (const [tab, idxs] of Object.entries(grouped)) {
      console.log(`\n📋 ${tab}:`);
      idxs.forEach(i => console.log(i));
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run();
