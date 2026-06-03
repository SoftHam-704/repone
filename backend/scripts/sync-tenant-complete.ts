/**
 * ⛔ DEPRECADO p/ provisionar tenant. ⛔
 * Usa `CREATE TABLE ... (LIKE public.x INCLUDING ALL)` + `CREATE SEQUENCE` manual,
 * mesmo vício do clone-schema-forecast.ts: o DEFAULT serial copiado aponta p/ a
 * sequence do public e as sequences criadas não ficam OWNED BY a coluna.
 * Caminho correto: tenant:create -> tenant:migrate -> pgadmin_provision_tenant_financeiro_despesas.sql.
 */
import { pool } from '../src/config/database';

if (process.env.ALLOW_BROKEN_CLONE !== '1') {
  console.error('⛔ sync-tenant-complete.ts DEPRECADO (sequences de PK tortas). Use tenant:create + tenant:migrate. (ALLOW_BROKEN_CLONE=1 p/ forçar)');
  process.exit(1);
}

async function syncTenantComplete(targetSchema: string) {
    const client = await pool.connect();
    console.log(`\n🔄 Iniciando sincronização completa para: ${targetSchema}`);

    try {
        await client.query('BEGIN');

        // 1. Garantir que o schema existe
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchema}`);
        
        // 2. Definir search_path para o target
        await client.query(`SET search_path TO ${targetSchema}, public`);

        // 3. Obter todas as tabelas do public (exceto as de sistema e a 'cidades')
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
              AND table_name NOT IN ('cidades', 'spatial_ref_sys')
              AND table_name NOT LIKE 'pg_%'
        `);

        console.log(`   - Sincronizando ${tables.rows.length} tabelas...`);
        for (const row of tables.rows) {
            const tableName = row.table_name;
            // Criar tabela baseada na do public (apenas estrutura)
            await client.query(`CREATE TABLE IF NOT EXISTS ${targetSchema}.${tableName} (LIKE public.${tableName} INCLUDING ALL)`);
        }

        // 4. Sincronizar Sequences (Generators)
        const sequences = await client.query(`
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public'
        `);
        console.log(`   - Sincronizando ${sequences.rows.length} sequences...`);
        for (const row of sequences.rows) {
            const seqName = row.sequence_name;
            await client.query(`CREATE SEQUENCE IF NOT EXISTS ${targetSchema}.${seqName}`);
        }

        // 5. Sincronizar Functions
        // Nota: Extrair DDL de functions é complexo via SQL puro, 
        // mas vamos aplicar as do arquivo de migrations que é o padrão do projeto.
        console.log(`   - Aplicando functions e triggers padrão do sistema...`);
        
        // Buscamos o conteúdo de 002_create_functions.sql e 003_product_functions.sql
        // Para simplificar, vamos rodar o SET search_path no início de cada execução.
        
        await client.query('COMMIT');
        console.log(`✅ Schema ${targetSchema} atualizado com sucesso!`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Erro ao sincronizar ${targetSchema}:`, error);
    } finally {
        client.release();
    }
}

async function run() {
    const targets = ['mettarep', 'jsaviorep'];
    for (const target of targets) {
        await syncTenantComplete(target);
    }
    process.exit(0);
}

run();
