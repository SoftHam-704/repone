
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Carregar .env da pasta backend
dotenv.config({ path: path.join(__dirname, '../.env') });

const masterPool = new Pool({
  host: process.env.MASTER_DB_HOST,
  port: parseInt(process.env.MASTER_DB_PORT || '5432'),
  database: process.env.MASTER_DB_NAME,
  user: process.env.MASTER_DB_USER,
  password: process.env.MASTER_DB_PASSWORD,
  ssl: process.env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function checkEmpresa() {
  const cnpj = '18976342000107'; // CNPJ from screenshot
  try {
    const result = await masterPool.query(`
      SELECT id, cnpj, razao_social, status, db_schema, db_host, db_nome, db_usuario, db_senha, db_porta, bloqueio_ativo, limite_sessoes
      FROM empresas
      WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1
    `, [cnpj]);

    if (result.rows.length === 0) {
      console.log('❌ Empresa não localizada no MASTER.');
      return;
    }

    const empresa = result.rows[0];
    console.log('✅ Empresa encontrada:', {
      id: empresa.id,
      cnpj: empresa.cnpj,
      razao_social: empresa.razao_social,
      status: empresa.status,
      db_schema: empresa.db_schema,
      bloqueio_ativo: empresa.bloqueio_ativo
    });

    // ─── SIMULAR LOGIN ───
    const dbConfig = {
      host: empresa.db_host,
      database: empresa.db_nome,
      schema: empresa.db_schema || 'public',
      user: empresa.db_usuario,
      password: empresa.db_senha || '',
      port: 13062, // FORÇANDO A PORTA CORRETA PARA TESTE
    };

    console.log('📡 [TEST] Conectando ao Tenant DB com config:', {
      host: dbConfig.host,
      database: dbConfig.database,
      user: dbConfig.user,
      port: dbConfig.port
    });

    const tenantPool = new Pool({
      host: dbConfig.host,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
      connectionTimeoutMillis: 5000,
    });
    
    try {
      const tenantClient = await tenantPool.connect();
      console.log('✅ Conexão com Tenant DB estabelecida.');

      const schema = dbConfig.schema.replace(/[^a-zA-Z0-9_]/g, '');
      await tenantClient.query(`SET search_path TO "${schema}", public`);
      console.log(`✅ Search path definido para: ${schema}`);

      // Simular busca de usuário (usando os dados da imagem: hamilton silva)
      const nome = 'hamilton';
      const sobrenome = 'silva';

      const userTableCheck = await tenantClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'user_nomes'
        )
      `, [schema]);

      if (!userTableCheck.rows[0].exists) {
        console.log(`❌ Tabela "user_nomes" NÃO existe no schema "${schema}".`);
      } else {
        console.log(`✅ Tabela "user_nomes" encontrada no schema "${schema}".`);
        
        const userResult = await tenantClient.query(`
          SELECT codigo as id, nome, sobrenome, usuario
          FROM user_nomes
          WHERE LOWER(nome) = LOWER($1)
            AND LOWER(sobrenome) = LOWER($2)
        `, [nome, sobrenome]);

        console.log(`✅ Busca de usuário concluída. Registros encontrados: ${userResult.rows.length}`);
        if (userResult.rows.length > 0) {
          console.log('👤 Usuário encontrado:', userResult.rows[0]);
        } else {
          console.log('❓ Usuário "hamilton silva" não encontrado no tenant.');
        }
      }

      tenantClient.release();
    } catch (tenantErr: any) {
      console.error('❌ [AUTH FAIL] Erro ao acessar dados do tenant:', tenantErr.message);
      // Se falhar no host específico, tentar via env.DB_HOST como fallback (como faz o controller)
      console.log('💡 Tentando via MASTER_DB_HOST (fallback para dev)...');
      
      const fallbackPool = new Pool({
        host: process.env.MASTER_DB_HOST,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: parseInt(process.env.MASTER_DB_PORT || '5432'),
        connectionTimeoutMillis: 5000,
      });

      try {
        const fbClient = await fallbackPool.connect();
        console.log('✅ Conexão via MASTER_DB_HOST estabelecida.');
        fbClient.release();
      } catch (fbErr: any) {
        console.error('❌ [FALLBACK FAIL]:', fbErr.message);
      } finally {
        await fallbackPool.end();
      }

    } finally {
      await tenantPool.end();
    }

  } catch (err: any) {
    console.error('❌ Erro durante diagnóstico:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await masterPool.end();
  }
}

checkEmpresa();
