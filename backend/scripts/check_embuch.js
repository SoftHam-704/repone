const { Pool } = require('pg');
const p = new Pool({
  host: 'node254557-salesmaster.sp1.br.saveincloud.net.br',
  port: 13062,
  database: 'basesales',
  user: 'webadmin',
  password: 'ytAyO0u043'
});

async function test() {
  const client = await p.connect();
  try {
    await client.query('SET search_path TO "rmrep", public');
    
    // Verificar tamanho do ite_pedido e ite_idproduto
    const cols = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'rmrep' AND table_name = 'itens_ped'
      ORDER BY ordinal_position
    `);
    
    console.log('=== Todas as colunas de itens_ped (rmrep) ===');
    cols.rows.forEach(r => {
      const maxLen = r.character_maximum_length ? `(${r.character_maximum_length})` : '';
      const nullable = r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = r.column_default ? ` DEFAULT ${r.column_default}` : '';
      console.log(`  ${r.column_name.padEnd(20)} ${(r.data_type + maxLen).padEnd(25)} ${nullable.padEnd(10)}${def}`);
    });

  } finally {
    client.release();
    p.end();
  }
}

test().catch(e => { console.error('Fatal:', e.message); p.end(); });
