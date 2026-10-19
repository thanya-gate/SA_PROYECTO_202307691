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
  NOTIFICACIONES_GRPC_ADDR: z.string().default('localhost:50056'),

  MEDIA_DIR: z.string().default('/app/media'),

  // Almacenamiento de videos/materiales: 'local' guarda en MEDIA_DIR (disco,
  // servido por nginx) y 'gcs' sube los objetos a Cloud Storage y devuelve la
  // URL pública del bucket.
  STORAGE_BACKEND: z.enum(['local', 'gcs']).default('local'),
  GCS_BUCKET_VIDEOS: z.string().default('yousac-videos'),
  GCS_BUCKET_MATERIAL: z.string().default('yousac-material'),
  // Base pública opcional (ej. dominio CDN); vacío = https://storage.googleapis.com/<bucket>
  GCS_PUBLIC_BASE_URL: z.string().default(''),

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
  OAUTH_ISSUER_PUBLIC: z.string().default('https://yousac-thany.duckdns.org/mock-oauth'),
  OAUTH_REDIRECT_URI: z.string().default('https://yousac-thany.duckdns.org/oauth/callback'),
  OAUTH_CLIENT_ID: z.string().default('yousac-web'),
  // Google OAuth 2.0 (PKCE) — cuando OAUTH_PROVIDER=google se usa Google como IdP real
  OAUTH_PROVIDER: z.enum(['google', 'mock']).default('mock'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  // YouTube Data API v3 — opcional, para detectar la duración de videos de YouTube
  YOUTUBE_API_KEY: z.string().default(''),

  PUBLIC_PATHS: z.string().default('/health'),

  // Federación de catálogos (docs/federacion). Claves que entregamos a grupos aliados (CSV).
  FEDERATION_API_KEYS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((k) => k.trim()).filter(Boolean)),
  FEDERATION_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  FEDERATION_ORIGEN_GRUPO: z.string().default('YoUSAC G4'),
  FEDERATION_ORIGEN_INSTITUCION: z.string().default('Facultad de Ingeniería USAC'),
  // Base para volver absolutas las URLs de video relativas (/media/...) que salen hacia otros grupos.
  FEDERATION_PUBLIC_BASE_URL: z.string().default('https://yousac-thany.duckdns.org'),
  // Catálogo del grupo aliado que consumimos. Vacío = sin federación. Para probar
  // sin el aliado, apuntar a nuestro propio https://<dominio>/federation/v1.
  FEDERATION_REMOTE_URL: z.string().default(''),
  FEDERATION_REMOTE_KEY: z.string().default(''),
  FEDERATION_REMOTE_NOMBRE: z.string().default('Grupo aliado'),

  // Academix Pass & CertiHub (Prácticas 7–10). Vacío = integración deshabilitada (503).
  ACADEMIX_BASE_URL: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
