import { Request, Response, NextFunction } from 'express';
import { createTenantDB, resolvePoolForEmpresa, TenantDB } from '../config/database';

declare global {
  namespace Express {
    interface Request {
      db?: TenantDB;
    }
  }
}

// Deduplicação: evita que N requests simultâneos disparem N queries ao master DB
// para a mesma empresa ao mesmo tempo (race condition pós-restart)
const resolvingEmpresa = new Map<string, Promise<any>>();

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const schema = req.schema;

  if (!schema) {
    res.status(400).json({ success: false, error: 'NO_TENANT', message: 'Schema do tenant não encontrado no token' });
    return;
  }

  try {
    const empresaId = req.user?.empresaId;
    const cnpj      = req.user?.cnpj;
    const cacheKey   = cnpj || String(empresaId || 'unknown');

    // Se já existe uma resolução em andamento para esta empresa, aguarda a mesma promise
    let resolvePromise = resolvingEmpresa.get(cacheKey);
    if (!resolvePromise) {
      resolvePromise = resolvePoolForEmpresa(empresaId, cnpj).finally(() => {
        resolvingEmpresa.delete(cacheKey);
      });
      resolvingEmpresa.set(cacheKey, resolvePromise);
    }

    const tenantPool = (await resolvePromise) ?? undefined;
    req.db = createTenantDB(schema, tenantPool);
    next();
  } catch (err) {
    next(err);
  }
}
