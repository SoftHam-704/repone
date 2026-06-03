import { Pool } from 'pg';
import { TenantDB } from '../config/database';

type DB = TenantDB | Pool;

/**
 * Retorna o ven_codigo do vendedor vinculado ao userId.
 * Retorna null se o usuário for master ou não tiver vendedor vinculado.
 */
export async function getLinkedSellerId(db: DB, userId: number | undefined): Promise<number | null> {
  if (!userId) return null;

  try {
    const userCheck = await db.query(
      'SELECT master, gerencia FROM user_nomes WHERE codigo = $1',
      [userId]
    );

    if (!userCheck.rows.length) return null;
    if (userCheck.rows[0].master === true) return null;
    if (userCheck.rows[0].gerencia === true) return null;

    const sellerRes = await db.query(
      'SELECT ven_codigo FROM vendedores WHERE ven_codusu = $1',
      [userId]
    );

    if (!sellerRes.rows.length) return null;
    return sellerRes.rows[0].ven_codigo;
  } catch {
    return null;
  }
}

/**
 * Carteira por vendedor está ativa neste tenant? (config emp_carteira_por_vendedor)
 *   true  (default) → operador vê só a própria carteira.
 *   false            → "todos atendem todos" (ex.: damarep).
 * Tolerante a coluna/tabela ausente → assume true (comportamento legado).
 */
export async function getCarteiraAtiva(db: DB): Promise<boolean> {
  try {
    const r = await db.query(
      'SELECT emp_carteira_por_vendedor AS c FROM empresa_status WHERE emp_id = 1 LIMIT 1'
    );
    return r.rows[0]?.c !== false; // só false explícito desliga; null/ausente = true
  } catch {
    return true;
  }
}

/**
 * Retorna o ven_codigo para ESCOPO de listas (operador vê só a sua carteira).
 * Igual ao getLinkedSellerId, MAS retorna null quando a carteira está desligada
 * no tenant (todos atendem todos) → sem filtro por vendedor. Use este nos
 * filtros de listagem; use getLinkedSellerId para ATRIBUIÇÃO (quem é o usuário).
 */
export async function getScopeSellerId(db: DB, userId: number | undefined): Promise<number | null> {
  if (!(await getCarteiraAtiva(db))) return null;
  return getLinkedSellerId(db, userId);
}

/**
 * Retorna array de industry IDs permitidas para o usuário.
 * Retorna null se sem restrição (master ou sem vendedor vinculado).
 */
export async function getAllowedIndustries(db: DB, userId: number | undefined): Promise<number[] | null> {
  const sellerId = await getLinkedSellerId(db, userId);
  if (sellerId === null) return null;

  try {
    const result = await db.query(
      'SELECT vin_industria FROM vendedor_ind WHERE vin_codigo = $1',
      [sellerId]
    );

    if (result.rows.length > 0) {
      return result.rows.map((r: any) => parseInt(r.vin_industria));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gera cláusula SQL para filtrar por indústrias via subquery.
 */
export function buildIndustryFilterClause(
  sellerId: number | null,
  columnName: string,
  params: any[] = []
): { filterClause: string; params: any[] } {
  if (sellerId === null) return { filterClause: '', params };

  params.push(sellerId);
  return {
    filterClause: ` AND ${columnName} IN (SELECT vin_industria FROM vendedor_ind WHERE vin_codigo = $${params.length})`,
    params,
  };
}

/**
 * Aplica filtro de array de indústrias (ANY).
 */
export function applyIndustryFilter(
  allowedIndustries: number[] | null,
  columnName: string,
  params: any[]
): { filterClause: string } {
  if (!allowedIndustries?.length) return { filterClause: '' };

  params.push(allowedIndustries);
  return { filterClause: ` AND ${columnName} = ANY($${params.length})` };
}

// ─── Modo de atribuição de vendedor nos mapas estatísticos ───────────────────
export type ModoVendedor = '1x1' | '1xN';

/**
 * Lê o modo configurado pelo REP em empresa_status (tenant).
 *   '1x1' = 1 vendedor por cliente (cli_vendedor / titular da carteira) — default
 *   '1xN' = vários vendedores por cliente, 1 por indústria (via vendedor_ind)
 * Tolerante a falha/coluna ausente → assume '1x1' (comportamento legado).
 */
export async function getModoVendedor(db: DB): Promise<ModoVendedor> {
  try {
    const r = await db.query(
      `SELECT emp_mapas_modo_vendedor AS m FROM empresa_status WHERE emp_id = 1 LIMIT 1`
    );
    return r.rows[0]?.m === '1xN' ? '1xN' : '1x1';
  } catch {
    return '1x1';
  }
}

/**
 * Cláusula SQL pra filtrar por vendedor respeitando o modo do tenant.
 *   1x1 → `<cliAlias>.cli_vendedor = <venInt>` (titular da carteira)
 *   1xN → vendedor é dono das indústrias listadas no vendedor_ind dele:
 *     - query centrada em PEDIDO (default): `<pedAlias>.ped_industria IN (vendedor_ind)`
 *     - query centrada em CLIENTE (clienteScoped): EXISTS de pedido do cliente
 *       em alguma indústria do vendedor.
 * venInt deve ser inteiro já validado (parseInt) — é inlinado, NUNCA passar string crua.
 * Retorna '' se venInt for falsy (sem filtro de vendedor).
 */
export function vendedorFilterSQL(
  modo: ModoVendedor,
  venInt: number | null | undefined,
  opts: { cliAlias?: string; pedAlias?: string; clienteScoped?: boolean } = {}
): string {
  if (!venInt || !Number.isFinite(venInt)) return '';
  const cliAlias = opts.cliAlias ?? 'c';
  const pedAlias = opts.pedAlias ?? 'p';
  const v = Math.trunc(venInt);

  if (modo === '1xN') {
    const indSub = `SELECT vin_industria FROM vendedor_ind WHERE vin_codigo = ${v}`;
    if (opts.clienteScoped) {
      return `EXISTS (SELECT 1 FROM pedidos pv
                WHERE pv.ped_cliente = ${cliAlias}.cli_codigo
                  AND pv.ped_situacao IN ('P','F')
                  AND pv.ped_industria IN (${indSub}))`;
    }
    return `${pedAlias}.ped_industria IN (${indSub})`;
  }
  return `${cliAlias}.cli_vendedor = ${v}`;
}
