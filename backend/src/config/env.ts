import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),

  // PostgreSQL Principal (Operational)
  DB_HOST: z.string().min(1, 'DB_HOST é obrigatório'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().min(1, 'DB_NAME é obrigatório'),
  DB_USER: z.string().min(1, 'DB_USER é obrigatório'),
  DB_PASSWORD: z.string().default(''),

  // PostgreSQL Master (Gestão)
  MASTER_DB_HOST: z.string().min(1, 'MASTER_DB_HOST é obrigatório'),
  MASTER_DB_PORT: z.coerce.number().default(5432),
  MASTER_DB_NAME: z.string().min(1, 'MASTER_DB_NAME é obrigatório'),
  MASTER_DB_USER: z.string().min(1, 'MASTER_DB_USER é obrigatório'),
  MASTER_DB_PASSWORD: z.string().default(''),
  MASTER_DB_SSL: z.string().default('false'),

  // IA Providers
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER_ORDER: z.string().default('openai,gemini,claude'),

  // Evolution API
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(8, 'JWT_SECRET deve ter ao menos 8 caracteres'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Variáveis de ambiente inválidas:');
    for (const issue of result.error.issues) {
      console.error(`   → ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
