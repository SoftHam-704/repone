/**
 * create-tenant.ts
 * Cria um novo schema de tenant com as tabelas de dados.
 *
 * Uso: npm run tenant:create -- <nome_schema>
 * Exemplo: npm run tenant:create -- repsoma
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../src/config/database';

async function createTenant(schemaName: string): Promise<void> {
  // Validação do nome
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(schemaName)) {
    console.error('❌ Nome de schema inválido. Use: letras minúsculas, números e _ (ex: repsoma)');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar se o schema já existe
    const existing = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );

    if (existing.rows.length > 0) {
      console.error(`❌ Schema "${schemaName}" já existe!`);
      process.exit(1);
    }

    // 2. Criar o schema
    console.log(`📦 Criando schema "${schemaName}"...`);
    await client.query(`CREATE SCHEMA ${schemaName}`);

    // 3. Setar search_path para o novo schema + public
    await client.query(`SET search_path TO ${schemaName}, public`);

    // 4. Rodar a migration base (tabelas de dados)
    const baseMigration = readFileSync(
      join(__dirname, '..', 'migrations', '001_create_base_tables.sql'),
      'utf-8'
    );
    console.log(`📋 Criando tabelas de dados...`);
    await client.query(baseMigration);

    // 5. Registrar a migration como aplicada
    await client.query(
      `INSERT INTO _migrations (name) VALUES ($1)`,
      ['001_create_base_tables.sql']
    );

    // 6. Registrar o tenant na tabela de controle (public)
    await client.query('SET search_path TO public');

    // Criar tabela de controle se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS _tenants (
        id          SERIAL PRIMARY KEY,
        schema_name VARCHAR(63) NOT NULL UNIQUE,
        display_name VARCHAR(200),
        active      BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(
      `INSERT INTO _tenants (schema_name, display_name) VALUES ($1, $2)`,
      [schemaName, schemaName]
    );

    await client.query('COMMIT');
    console.log(`\n✅ Tenant "${schemaName}" criado com sucesso!`);
    console.log(`   → Schema: ${schemaName}`);
    console.log(`   → Tabelas de dados: criadas`);
    console.log(`   → Functions/Views: acessíveis via public`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar tenant:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// CLI entry point
const schemaName = process.argv[2];
if (!schemaName) {
  console.error('Uso: npm run tenant:create -- <nome_schema>');
  console.error('Exemplo: npm run tenant:create -- repsoma');
  process.exit(1);
}

createTenant(schemaName);
