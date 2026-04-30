/**
 * migrate-all.ts
 * Aplica migrações pendentes em TODOS os schemas de tenant.
 *
 * Uso: npm run tenant:migrate
 *
 * - Lê arquivos de migrations/ em ordem numérica
 * - Pula migrations 002+ (functions) pois rodam apenas no public
 * - Aplica apenas migrations ainda não registradas em _migrations de cada schema
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../src/config/database';

async function migrateAll(): Promise<void> {
  const client = await pool.connect();

  try {
    // 1. Buscar todos os schemas de tenant via information_schema
    // Exclui schemas do sistema; considera tenant qualquer schema com tabela _migrations
    const tenants = await client.query(
      `SELECT s.schema_name
       FROM information_schema.schemata s
       WHERE s.schema_name NOT IN ('public','information_schema','pg_catalog','pg_toast','pg_temp')
         AND s.schema_name NOT LIKE 'pg_%'
         AND EXISTS (
           SELECT 1 FROM information_schema.tables t
           WHERE t.table_schema = s.schema_name AND t.table_name = '_migrations'
         )
       ORDER BY s.schema_name`
    );

    if (tenants.rows.length === 0) {
      console.log('⚠️  Nenhum schema de tenant encontrado (nenhum com tabela _migrations).');
      return;
    }

    // 2. Listar migrations disponíveis (apenas as de dados, não as de functions)
    const migrationsDir = join(__dirname, '..', 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.includes('_functions'))
      .sort();

    console.log(`📋 Migrations disponíveis: ${migrationFiles.length}`);
    console.log(`🏢 Tenants ativos: ${tenants.rows.length}\n`);

    // 3. Para cada tenant, aplicar migrations pendentes
    for (const tenant of tenants.rows) {
      const schema = tenant.schema_name;
      console.log(`\n📦 Migrando: ${schema}`);

      await client.query(`SET search_path TO ${schema}, public`);

      // Verificar quais migrations já foram aplicadas
      const applied = await client.query(
        `SELECT name FROM _migrations ORDER BY name`
      );
      const appliedSet = new Set(applied.rows.map((r: { name: string }) => r.name));

      let count = 0;
      for (const file of migrationFiles) {
        if (appliedSet.has(file)) {
          continue;
        }

        console.log(`   → Aplicando: ${file}`);
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            `INSERT INTO _migrations (name) VALUES ($1)`,
            [file]
          );
          await client.query('COMMIT');
          count++;
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`   ❌ Falhou: ${file}`, error);
        }
      }

      if (count === 0) {
        console.log(`   ✅ Nenhuma migration pendente`);
      } else {
        console.log(`   ✅ ${count} migration(s) aplicada(s)`);
      }
    }

    console.log('\n🎉 Migração concluída!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAll();
