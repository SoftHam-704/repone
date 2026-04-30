import { pool } from '../src/config/database';

async function updateAllTenants() {
  const client = await pool.connect();
  try {
    // Buscar todos os schemas não do sistema
    const res = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'public')
      AND schema_name NOT LIKE 'pg_%'
    `);
    
    const schemas = res.rows.map(r => r.schema_name);
    console.log(`Encontrados ${schemas.length} schemas para atualizar.`);

    for (const schema of schemas) {
      console.log(`[${schema}] Iniciando...`);
      try {
        // Define o schema atual
        await client.query(`SET search_path TO "${schema}"`);
        
        // Verifica se as tabelas relacionadas existem antes de criar as chaves estrangeiras
        const tableCheck = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = '${schema}' 
          AND table_name IN ('vendedores', 'clientes', 'fornecedores')
        `);
        
        const tablesExist = tableCheck.rows.map(r => r.table_name);
        if (!tablesExist.includes('clientes')) {
           console.log(`[${schema}] Ignorado: tabela clientes não existe neste schema.`);
           continue;
        }

        const query = `
          CREATE TABLE IF NOT EXISTS crm_visitas (
              id SERIAL PRIMARY KEY,
              ven_codigo INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL,
              cli_codigo INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
              for_codigo INTEGER REFERENCES fornecedores(for_codigo) ON DELETE SET NULL,
              data_visita DATE NOT NULL DEFAULT CURRENT_DATE,
              resultado VARCHAR(20) NOT NULL DEFAULT 'sem_pedido',
              ped_numero VARCHAR(20),
              obs TEXT,
              duracao_min INTEGER,
              criado_em TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_crm_visitas_cli ON crm_visitas(cli_codigo);
          CREATE INDEX IF NOT EXISTS idx_crm_visitas_ven ON crm_visitas(ven_codigo);
          CREATE INDEX IF NOT EXISTS idx_crm_visitas_data ON crm_visitas(data_visita);
          CREATE INDEX IF NOT EXISTS idx_crm_visitas_for ON crm_visitas(for_codigo);
        `;
        
        await client.query(query);
        console.log(`[${schema}] ✅ Tabela e índices criados com sucesso.`);
      } catch (err: any) {
        console.error(`[${schema}] ❌ Erro:`, err.message);
      }
    }
    
    console.log('\\nProcesso finalizado para todos os tenants.');
  } catch (err: any) {
    console.error('Erro fatal:', err);
  } finally {
    client.release();
    // Encerra a pool globalmente (útil em scripts)
    await pool.end();
  }
}

updateAllTenants();
