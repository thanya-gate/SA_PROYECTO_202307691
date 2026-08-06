import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .default('ingenieria.usac.edu.gt,ing.usac.edu.gt')
    .transform((v) => v.split(',').map((d) => d.trim()).filter(Boolean)),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('10m'),
  JWT_ISSUER: z.string().default('yousac-auth'),
  JWT_AUDIENCE: z.string().default('yousac-gateway'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_PATH: z.string().default('/'),
  SESSION_COOKIE_NAME: z.string().default('yousac_session'),
  SESSION_TTL_MS: z.coerce.number().default(60 * 60 * 1000),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_ATTEMPTS_WINDOW_MIN: z.coerce.number().default(15),
  OAUTH_MOCK_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  OAUTH_MOCK_ISSUER: z.string().default('http://localhost:3000/mock-oauth'),
  OAUTH_REDIRECT_URI: z.string().default('http://localhost:3000/auth/oauth/callback'),
  GRPC_PORT: z.coerce.number().default(50051),

  // ===== Persistencia (Database per Microservice - PostgreSQL) =====
  // Si DATABASE_URL está vacío, el servicio usa los repositorios en memoria
  // (útil para pruebas sin infraestructura).
  DATABASE_URL: z.string().default(''),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().default(10000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === 'production';
