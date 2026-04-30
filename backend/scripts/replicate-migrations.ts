import { pool } from '../src/config/database';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function migrateAllSchemas() {
  const client = await pool.connect();
  
  try {
    // 1. Obter todos os schemas de negócio e public
    const res = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') 
        AND schema_name NOT LIKE 'pg_temp_%'
        AND schema_name NOT LIKE 'pg_toast_temp_%'
      ORDER BY schema_name
    `);
    
    const schemas = res.rows.map(r => r.schema_name);
    console.log(`🚀 Iniciando migração em ${schemas.length} schemas:`, schemas.join(', '));

    // 2. Localizar o arquivo de migração
    const migrationFile = '005_pedidos_v2_consolidacao.sql';
    const filePath = join(__dirname, '..', 'migrations', migrationFile);
    const sql = readFileSync(filePath, 'utf-8');

    // 3. Aplicar em cada schema
    for (const schema of schemas) {
      console.log(`📦 Aplicando em: ${schema}...`);
      try {
        await client.query(`SET search_path TO ${schema}, public;`);
        
        // Inicia transação por schema
        await client.query('BEGIN');
        await client.query(sql);

        // Garantir que a tabela _migrations existe (exige em cada schema conforme migration 001)
        await client.query(`
          CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Registrar a migração
        await client.query(`
          INSERT INTO _migrations (name) 
          VALUES ($1) 
          ON CONFLICT (name) DO NOTHING;
        `, [migrationFile]);

        await client.query('COMMIT');
        console.log(`   ✅ SUCESSO: ${schema}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ ERRO no schema ${schema}:`, (err as Error).message);
      }
    }

    console.log('\n🎉 Replicação concluída para todos os schemas!');

  } catch (err) {
    console.error('❌ Falha crítica no script de migração:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

migrateAllSchemas();
