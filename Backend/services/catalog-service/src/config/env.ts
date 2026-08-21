import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GRPC_PORT: z.coerce.number().default(50052),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria (Database per Microservice)'),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().default(10000),

  NOTIFICACIONES_GRPC_ADDR: z.string().default('localhost:50056'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === 'production';
