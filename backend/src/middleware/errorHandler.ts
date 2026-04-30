import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  status?: number;
  code?: string;
}

/**
 * Handler global de erros do Express.
 * Sempre registrar como ÚLTIMO middleware em app.ts.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Erro interno do servidor';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({ success: false, error: code, message });
}
