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

    // 4b. Financeiro + despesas (NÃO estão no 001; rodam sob o MESMO search_path
    //     do tenant, então todo SERIAL nasce com sequence LOCAL + DEFAULT
    //     qualificado + OWNED BY automáticos — nunca clonar com LIKE/CREATE SEQUENCE).
    console.log(`📋 Criando módulo financeiro + despesas...`);
    const financeiroSchema = readFileSync(
      join(__dirname, '..', 'src', 'modules', 'financeiro', 'financeiro_schema.sql'),
      'utf-8'
    );
    await client.query(financeiroSchema);

    // 4c. SEMEAR o modelo de referência do financeiro (plano de contas + centro de
    //     custo) que vive no schema public. Antes o tenant nascia VAZIO e o REP
    //     ficava sem plano de contas (não há fallback runtime). Como o schema é
    //     novo, a sequence do id é LOCAL — copiamos preservando ids/hierarquia
    //     (id_pai) e ressincronizamos a sequence local. Tudo na mesma transação.
    console.log(`📋 Semeando plano de contas + centro de custo (modelo public)...`);
    await client.query(`
      INSERT INTO fin_plano_contas (id, codigo, descricao, tipo, nivel, id_pai, ativo)
      SELECT id, codigo, descricao, tipo, nivel, id_pai, ativo
      FROM public.fin_plano_contas ORDER BY id
    `);
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${schemaName}.fin_plano_contas','id'),
              COALESCE((SELECT MAX(id) FROM fin_plano_contas), 1), true)`
    );
    await client.query(`
      INSERT INTO fin_centro_custo (id, codigo, descricao, ativo)
      SELECT id, codigo, descricao, ativo
      FROM public.fin_centro_custo ORDER BY id
    `);
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${schemaName}.fin_centro_custo','id'),
              COALESCE((SELECT MAX(id) FROM fin_centro_custo), 1), true)`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS despesas (
        desp_id          SERIAL PRIMARY KEY,
        desp_vendedor    INTEGER NOT NULL,
        desp_data        DATE NOT NULL,
        desp_categoria   VARCHAR(50) NOT NULL,  -- 50: cabe "Happy Hour com Cliente/Fornecedor" (ver migration 060)
        desp_valor       NUMERIC(12,2) NOT NULL,
        desp_descricao   TEXT,
        desp_km          INTEGER,
        desp_comprovante VARCHAR(255),
        desp_criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_despesas_vendedor ON despesas (desp_vendedor);
      CREATE INDEX IF NOT EXISTS idx_despesas_data     ON despesas (desp_data);
    `);

    // 5. Registrar migrations aplicadas
    await client.query(
      `INSERT INTO _migrations (name) VALUES ($1), ($2), ($3), ($4)
       ON CONFLICT (name) DO NOTHING`,
      ['001_create_base_tables.sql', 'financeiro_schema.sql',
       '059_create_despesas.sql', '060_widen_desp_categoria.sql']
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
