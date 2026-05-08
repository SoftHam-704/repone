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
