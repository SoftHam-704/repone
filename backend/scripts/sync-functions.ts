/**
 * sync-functions.ts
 * Sincroniza functions e views do schema public.
 * Roda os arquivos de migration que contêm "_functions" no nome.
 *
 * Uso: npm run tenant:sync-functions
 *
 * Estas functions ficam APENAS no public e são compartilhadas
 * por todos os tenants via search_path.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../src/config/database';

async function syncFunctions(): Promise<void> {
  const client = await pool.connect();

  try {
    // Setar search_path para public
    await client.query('SET search_path TO public');

    // Listar arquivos de functions
    const migrationsDir = join(__dirname, '..', 'migrations');
    const functionFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && f.includes('_functions'))
      .sort();

    // Incluir também o 002 se existir (legacy naming)
    const allFunctionFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && (f.includes('_functions') || f.startsWith('002')))
      .sort();

    if (allFunctionFiles.length === 0) {
      console.log('⚠️  Nenhum arquivo de functions encontrado em migrations/');
      return;
    }

    console.log(`🔄 Sincronizando ${allFunctionFiles.length} arquivo(s) de functions no public...\n`);

    for (const file of allFunctionFiles) {
      console.log(`   → ${file}`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');

      try {
        await client.query(sql);
        console.log(`     ✅ OK`);
      } catch (error) {
        console.error(`     ❌ Erro:`, error);
      }
    }

    console.log('\n🎉 Functions sincronizadas no schema public!');
  } catch (error) {
    console.error('❌ Erro ao sincronizar functions:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

syncFunctions();
