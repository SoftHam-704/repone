import { Pool } from 'pg';
import { env } from './env';

const IS_DEV = process.env.NODE_ENV !== 'production';
const INTERNAL_IP_RE = /^10\.|^172\.(1[6-9]|2[0-9]|3[12])\.|^192\.168\./;

/**
 * 1. POOL PRINCIPAL (Operational - basesales)
 */
export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * 2. POOL MASTER (Gestão)
 */
export const masterPool = new Pool({
  host: env.MASTER_DB_HOST,
  port: env.MASTER_DB_PORT,
  database: env.MASTER_DB_NAME,
  user: env.MASTER_DB_USER,
  password: env.MASTER_DB_PASSWORD,
  ssl: env.MASTER_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

pool.query('SELECT 1')
  .then(() => console.log('✅ Operational DB (basesales) Conectado'))
  .catch((err) => {
    console.error('❌ Erro Operational DB:', err.message);
  });

masterPool.query('SELECT 1')
  .then(() => console.log('✅ Master DB (salesmasters_master) Conectado'))
  .catch((err) => {
    console.error('❌ Erro Master DB:', err.message);
    process.exit(1);
  });

/**
 * 2. GERENCIADOR DE POOLS DE TENANTS
 * Cacheia pools pela string de conexão para evitar memory leaks.
 * Também indexa por empresaId para o tenantMiddleware usar o pool correto.
 */
const tenantPools = new Map<string, Pool>();
const tenantPoolByEmpresa = new Map<number, Pool>();

export function getTenantPool(dbConfig: any): Pool {
  const cacheKey = `${dbConfig.host}:${dbConfig.port}:${dbConfig.database}:${dbConfig.user}`;

  if (tenantPools.has(cacheKey)) {
    return tenantPools.get(cacheKey)!;
  }

  const newPool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port || 5432,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  tenantPools.set(cacheKey, newPool);
  return newPool;
}

/** Registra o pool do tenant pelo empresaId após o login. */
export function registerTenantPool(empresaId: number, tenantPool: Pool): void {
  tenantPoolByEmpresa.set(empresaId, tenantPool);
}

/** Retorna o pool correto do tenant pelo empresaId (ou null se ainda não registrado). */
export function getPoolForEmpresa(empresaId: number | undefined): Pool | null {
  if (!empresaId) return null;
  return tenantPoolByEmpresa.get(empresaId) ?? null;
}

/**
 * Resolve o pool do tenant de forma definitiva:
 * 1. Verifica cache por empresaId
 * 2. Se não encontrar, busca config no master DB pelo CNPJ
 * 3. Aplica redirect de IP interno (igual ao auth controller)
 * 4. Cria/cacheia o pool e retorna
 * Retorna null apenas se a empresa não existir no master.
 */
export async function resolvePoolForEmpresa(
  empresaId: number | undefined,
  cnpj: string | undefined
): Promise<Pool | null> {
  // 1. Cache hit
  if (empresaId) {
    const cached = tenantPoolByEmpresa.get(empresaId);
    if (cached) return cached;
  }

  if (!cnpj) return null;

  // 2. Lookup no master DB
  try {
    const result = await masterPool.query(
      `SELECT id, db_host, db_nome, db_usuario, db_senha, db_porta
       FROM empresas
       WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1 AND status = 'ATIVO'
       LIMIT 1`,
      [cnpj.replace(/\D/g, '')]
    );
    if (!result.rows.length) return null;

    const e = result.rows[0];
    let host: string = e.db_host;
    let port: number = e.db_porta || 5432;

    // 3. Redirect de IP interno em dev (igual ao auth controller)
    if (IS_DEV && (INTERNAL_IP_RE.test(host) || host === env.MASTER_DB_HOST)) {
      host = env.MASTER_DB_HOST;
      port = env.MASTER_DB_PORT;
    }

    const dbConfig = {
      host,
      port,
      database: e.db_nome,
      user: e.db_usuario,
      password: e.db_senha || '',
    };

    // 4. Cria/recupera pool e registra no cache
    const resolvedPool = getTenantPool(dbConfig);
    const id = empresaId ?? e.id;
    if (id) registerTenantPool(id, resolvedPool);

    console.log(`✅ [TENANT] Pool resolvido via master para empresaId=${id} schema=${cnpj}`);
    return resolvedPool;
  } catch (err: any) {
    console.error(`❌ [TENANT] Falha ao resolver pool: ${err.message}`);
    return null;
  }
}

/**
 * 3. INTERFACE DE QUERIES DO TENANT
 */
export interface TenantDB {
  query: (text: string, params?: any[]) => Promise<any>;
  transaction: <T>(fn: (client: import('pg').PoolClient) => Promise<T>) => Promise<T>;
}

/**
 * 4. FÁBRICA DE CLIENTES DE TENANT (SET SEARCH_PATH)
 * Retorna um objeto proxy para o Pool que garante que todas as queries
 * rodem no schema do tenant corrente.
 * IMPORTANTE: O RESET search_path no finally garante que conexões devolvidas
 * ao pool não vazem o search_path de um tenant para outro.
 */
export function createTenantDB(schema: string, tenantPool?: Pool): TenantDB {
  const targetPool = tenantPool ?? pool; // usa pool do tenant se disponível, senão global
  return {
    query: async (text: string, params: any[] = []) => {
      const client = await targetPool.connect();
      try {
        await client.query(`SET search_path TO "${schema}", public`);
        return await client.query(text, params);
      } finally {
        await client.query('RESET search_path').catch(() => {});
        client.release();
      }
    },
    transaction: async <T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> => {
      const client = await targetPool.connect();
      try {
        await client.query(`SET search_path TO "${schema}", public`);
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        await client.query('RESET search_path').catch(() => {});
        client.release();
      }
    },
  };
}

