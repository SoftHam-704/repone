import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: number;
  username: string;
  schema: string;
  name: string;
  empresaId?: number;
  cnpj?: string;
}

// Estende o Request do Express para incluir user e schema
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      schema?: string;
    }
  }
}

/**
 * Middleware de autenticação JWT.
 * Extrai o schema do tenant do token e injeta em req.user / req.schema.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token não fornecido',
    });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    req.user = decoded;
    req.schema = decoded.schema;

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Token inválido ou expirado',
    });
  }
}
