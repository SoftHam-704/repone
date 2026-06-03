import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { masterPool } from '../config/database';

export interface JwtPayload {
  userId: number;
  username: string;
  iniciais?: string;
  role?: string;          // operador(user) | manager | admin | superadmin — usado por requireLevel
  schema: string;
  name: string;
  empresaId?: number;
  cnpj?: string;
  iaAtiva?: boolean;      // plano_ia_nivel != INATIVA no master — toggle "Acesso à IRIS" (gateia IRIS Dev)
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

// ─── Cache de validação de sessão no master (5 segundos) ─────────────────────
// Evita um query no master a cada request. Quando outra máquina derruba a sessão
// via forceLogin, o usuário "antigo" percebe em até 5 segundos.
const sessionCache = new Map<string, { validUntil: number; ok: boolean }>();
const SESSION_CACHE_MS = 5_000;

function cleanCache() {
  const now = Date.now();
  for (const [k, v] of sessionCache.entries()) {
    if (v.validUntil < now) sessionCache.delete(k);
  }
}

async function isSessionActive(token: string): Promise<boolean> {
  const now = Date.now();
  const cached = sessionCache.get(token);
  if (cached && cached.validUntil > now) return cached.ok;

  if (sessionCache.size > 2000) cleanCache();

  try {
    // UPDATE + RETURNING numa só ida ao banco: marca atividade real e devolve
    // 1 linha se a sessão ainda está ativa. Quando o usuário fecha o navegador
    // sem logout, os requests param e ultima_atividade trava — após 15 min a
    // verificação no loginHandler ignora essa sessão (timeout natural).
    const r = await masterPool.query(
      `UPDATE sessoes_ativas SET ultima_atividade = NOW()
       WHERE token_sessao = $1 AND ativo = true
       RETURNING 1`,
      [token],
    );
    const ok = r.rows.length > 0;
    sessionCache.set(token, { validUntil: now + SESSION_CACHE_MS, ok });
    return ok;
  } catch (e: any) {
    // Se o master estiver indisponível, NÃO derruba o usuário —
    // melhor um cara logado em 2 PCs que todo mundo offline.
    console.warn(`⚠️ [AUTH] Session validation query failed: ${e.message}`);
    return true;
  }
}

/** Limpa cache de uma sessão específica — chamado pelo logout pra propagação imediata. */
export function invalidateSessionCache(token: string): void {
  sessionCache.delete(token);
}

/**
 * Middleware de autenticação JWT.
 * Extrai o schema do tenant do token e injeta em req.user / req.schema.
 * Também valida que a sessão continua ativa em sessoes_ativas (kick previous).
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token não fornecido',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Token inválido ou expirado',
    });
    return;
  }

  // Sessão ainda ativa? Se outra máquina derrubou via forceLogin, ativo=false.
  const active = await isSessionActive(token);
  if (!active) {
    res.status(401).json({
      success: false,
      error: 'SESSION_REVOKED',
      message: 'Sua sessão foi encerrada porque você entrou em outro dispositivo.',
    });
    return;
  }

  req.user = decoded;
  req.schema = decoded.schema;
  next();
}
