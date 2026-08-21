import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GRPC_PORT: z.coerce.number().default(50056),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria (Database per Microservice)'),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().default(10000),

  AUTH_GRPC_ADDR: z.string().default('localhost:50051'),
  INSCRIPCION_GRPC_ADDR: z.string().default('localhost:50055'),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('no-responder@yousac.edu.gt'),
  MAIL_DEBUG: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  WORKER_INTERVAL_MS: z.coerce.number().default(15_000),
  MAX_INTENTOS: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === 'production';
