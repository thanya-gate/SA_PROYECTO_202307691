import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  AUTH_GRPC_ADDR: z.string().default('localhost:50051'),
  CATALOG_GRPC_ADDR: z.string().default('localhost:50052'),
  REPRODUCTION_GRPC_ADDR: z.string().default('localhost:50053'),
  ANALITICA_GRPC_ADDR: z.string().default('localhost:50054'),
  INSCRIPCION_GRPC_ADDR: z.string().default('localhost:50055'),

  MEDIA_DIR: z.string().default('/app/media'),

  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .default('ingenieria.usac.edu.gt,ing.usac.edu.gt')
    .transform((v) => v.split(',').map((d) => d.trim()).filter(Boolean)),

  SESSION_COOKIE_NAME: z.string().default('yousac_session'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_PATH: z.string().default('/'),
  SESSION_TTL_MS: z.coerce.number().default(60 * 60 * 1000),

  // OAuth 2.0 (Authorization Code). El "IdP" simulado se aloja en el gateway
  // (OAUTH_ISSUER_PUBLIC es la URL visible desde el navegador) y redirige al
  // SPA (OAUTH_REDIRECT_URI) con el código. OAUTH_CLIENT_ID identifica al cliente web.
  OAUTH_ISSUER_PUBLIC: z.string().default('http://localhost:8080/mock-oauth'),
  OAUTH_REDIRECT_URI: z.string().default('http://localhost:8081/oauth/callback'),
  OAUTH_CLIENT_ID: z.string().default('yousac-web'),

  PUBLIC_PATHS: z.string().default('/health'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
