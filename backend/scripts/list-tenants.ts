/**
 * list-tenants.ts
 * Lista todos os tenants registrados no sistema.
 *
 * Uso: npm run tenant:list
 */

import { pool } from '../src/config/database';

async function listTenants(): Promise<void> {
  try {
    // Verificar se a tabela de controle existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_tenants'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('⚠️  Nenhum tenant criado ainda.');
      console.log('   Use: npm run tenant:create -- <nome_schema>');
      await pool.end();
      return;
    }

    const result = await pool.query(`
      SELECT 
        schema_name,
        display_name,
        active,
        created_at
      FROM public._tenants 
      ORDER BY schema_name
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhum tenant registrado.');
      await pool.end();
      return;
    }

    console.log('\n🏢 Tenants registrados:\n');
    console.log('  Schema            | Ativo | Criado em');
    console.log('  ' + '-'.repeat(60));

    for (const row of result.rows) {
      const status = row.active ? '  ✅ ' : '  ❌ ';
      const date = new Date(row.created_at).toLocaleDateString('pt-BR');
      console.log(`  ${row.schema_name.padEnd(18)} |${status}| ${date}`);
    }

    console.log(`\n  Total: ${result.rows.length} tenant(s)\n`);
  } catch (error) {
    console.error('❌ Erro ao listar tenants:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listTenants();
