import { Request, Response } from 'express';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── POST /api/admin/migrate ──────────────────────────────────────────────────
// Aplica migrations pendentes no schema do tenant atual.
// Seguro chamar múltiplas vezes — todas as migrations usam IF NOT EXISTS.
export async function runMigrationsHandler(req: Request, res: Response): Promise<void> {
  const db     = req.db!;
  const schema = req.schema!;

  try {
    // Resolve diretório de migrations (funciona em dev e em prod/dist)
    const candidates = [
      join(process.cwd(), 'migrations'),                           // prod: backend/migrations
      join(__dirname, '../../../../migrations'),                    // dev/dist: src/modules/admin → backend/migrations
      join(__dirname, '../../../../../migrations'),                 // fallback extra
    ];
    const migrationsDir = candidates.find(existsSync);
    if (!migrationsDir) {
      res.status(500).json({ success: false, message: 'Diretório de migrations não encontrado.' });
      return;
    }

    // Garante que _migrations existe antes de qualquer coisa
    await db.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lista arquivos .sql ordenados
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Já aplicadas
    const applied = await db.query(`SELECT name FROM _migrations ORDER BY name`);
    const appliedSet = new Set<string>(applied.rows.map((r: { name: string }) => r.name));

    const results: { file: string; status: 'applied' | 'skipped' | 'error'; error?: string }[] = [];

    for (const file of files) {
      if (appliedSet.has(file)) {
        results.push({ file, status: 'skipped' });
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      try {
        await db.query(sql);
        await db.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [file]);
        results.push({ file, status: 'applied' });
        console.log(`✅ [MIGRATE] ${schema} — ${file}`);
      } catch (err: any) {
        console.error(`❌ [MIGRATE] ${schema} — ${file}: ${err.message}`);
        results.push({ file, status: 'error', error: err.message });
      }
    }

    const applied_count = results.filter(r => r.status === 'applied').length;
    const error_count   = results.filter(r => r.status === 'error').length;

    res.json({
      success: error_count === 0,
      schema,
      applied: applied_count,
      errors:  error_count,
      results,
    });
  } catch (error: any) {
    console.error('❌ [MIGRATE] fatal:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GET /api/admin/migrate/status ───────────────────────────────────────────
// Mostra quais migrations foram aplicadas no schema do tenant atual.
export async function migrationStatusHandler(req: Request, res: Response): Promise<void> {
  const db     = req.db!;
  const schema = req.schema!;

  try {
    const candidates = [
      join(process.cwd(), 'migrations'),
      join(__dirname, '../../../../migrations'),
      join(__dirname, '../../../../../migrations'),
    ];
    const migrationsDir = candidates.find(existsSync);

    await db.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const applied = await db.query(`SELECT name, applied_at FROM _migrations ORDER BY name`);
    const appliedMap = new Map(applied.rows.map((r: any) => [r.name, r.applied_at]));

    const files = migrationsDir
      ? readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
      : [];

    const status = files.map(file => ({
      file,
      applied:    appliedMap.has(file),
      applied_at: appliedMap.get(file) ?? null,
    }));

    const pending = status.filter(s => !s.applied).length;

    res.json({ success: true, schema, pending, status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
