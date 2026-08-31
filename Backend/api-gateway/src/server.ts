import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { config } from './config/env';
import { authGrpc as defaultAuthGrpc } from './grpc/auth-client';
import { catalogGrpc as defaultCatalogGrpc } from './grpc/catalog-client';
import { reproductionGrpc as defaultReproductionGrpc } from './grpc/reproduction-client';
import { analiticaGrpc as defaultAnaliticaGrpc } from './grpc/analitica-client';
import { inscripcionGrpc as defaultInscripcionGrpc } from './grpc/inscripcion-client';
import { notificacionesGrpc as defaultNotificacionesGrpc } from './grpc/notificaciones-client';
import { GrpcError } from './grpc/auth-client';
import { DomainError } from './domain/domain-error';
import { setSessionCookie, clearSessionCookie } from './utils/cookies';
import { parseClasesCsv, CsvParseError } from './utils/csv';
import { createAuthenticate } from './middleware/authenticate';
import { requireRole, requireAnyRole } from './middleware/requireRole';
import { domainGuard } from './middleware/domain-guard';
import { errorHandler } from './middleware/error-handler';
import { createIdpRouter, buildIdpLoginUri } from './mock-idp';
import { createStorageBackend, StorageBackend } from './storage/storage';
import {
  MATERIAL_EXTENSIONS,
  MAX_MATERIAL_BYTES,
  resolverExtensionMaterial,
  resolverNombreArchivo,
  normalizarContentType,
  validarTamanoMaterial,
} from './validation/material';

const cookieMaxAge = config.SESSION_TTL_MS;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 24 * 60 * 60;
// Backend de almacenamiento multimedia según STORAGE_BACKEND: 'local' guarda
// en disco (MEDIA_DIR) y 'gcs' sube a Cloud Storage y devuelve la URL del bucket.
const defaultStorage = createStorageBackend(config.STORAGE_BACKEND, Object.values(MATERIAL_EXTENSIONS));
const execFileAsync = promisify(execFile);

// Normaliza un MaterialAdjunto que llega por gRPC

function normalizarMaterial(raw: any): Record<string, unknown> {
  if (!raw) return {};
  return {
    ...raw,
    tamanoBytes: Number(raw.tamanoBytes ?? 0),
    totalDescargas: Number(raw.totalDescargas ?? 0),
  };
}

class LimiterBytes extends Transform {
  bytes = 0;

  constructor(private readonly limite: number) {
    super();
  }

  override _transform(chunk: Buffer | string, _encoding: BufferEncoding, callback: Function): void {
    const bytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    this.bytes += bytes;
    if (this.bytes > this.limite) {
      callback(new DomainError('ENTRADA_INVALIDA', 'El cuerpo real supera el límite de 50 MB', 400));
      return;
    }
    callback(null, chunk);
  }
}

export async function escribirTemporal(
  rutaTemp: string,
  req: express.Request,
  tamanoDeclarado: number,
  limite = MAX_MATERIAL_BYTES,
): Promise<number> {
  await fs.promises.mkdir(path.dirname(rutaTemp), { recursive: true });
  const contador = new LimiterBytes(limite);
  try {
    await pipeline(req, contador, fs.createWriteStream(rutaTemp));
  } catch (err) {
    await fs.promises.rm(rutaTemp, { force: true }).catch(() => {});
    throw err;
  }
  if (contador.bytes !== tamanoDeclarado) {
    await fs.promises.rm(rutaTemp, { force: true }).catch(() => {});
    throw new DomainError('ENTRADA_INVALIDA', 'El tamaño real del archivo no coincide con Content-Length', 400);
  }
  return contador.bytes;
}

/**
 * Detecta la duración real de un archivo de video (segundos) leyendo sus
 * metadatos con ffprobe. Se consultan la duración del contenedor (format) y la
 * de cada stream: en algunos archivos (p. ej. WebM grabados en navegador o MP4
 * fragmentados) el formato reporta N/A pero los streams sí tienen duración.
 */
async function detectVideoDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-show_entries', 'stream=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
    for (const line of stdout.split(/\r?\n/)) {
      const seconds = Number.parseFloat(line.trim());
      if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Genera una miniatura (JPEG) del video extrayendo un fotograma con ffmpeg.
 * El fotograma se toma aproximadamente al 10% de la duración (mínimo 1s,
 * máximo 60s) para mostrar contenido representativo y evitar la pantalla
 * negra inicial. Es mejor esfuerzo: si ffmpeg falla devuelve false y la
 * subida del video continúa sin miniatura.
 */
async function generarThumbnail(videoPath: string, thumbPath: string, duracionSegundos: number): Promise<boolean> {
  const segundo = Math.min(60, Math.max(1, Math.floor(duracionSegundos / 10)));
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-ss', String(segundo),
        '-i', videoPath,
        '-frames:v', '1',
        '-vf', 'scale=640:-2',
        '-q:v', '4',
        thumbPath,
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    return true;
  } catch {
    // Limpieza ante fallo parcial: no debe quedar un JPEG corrupto.
    await fs.promises.rm(thumbPath, { force: true }).catch(() => {});
    return false;
  }
}

/**
 * Extrae el ID de video de una URL de YouTube y usa la YouTube Data API v3
 * para obtener la duración en segundos. Devuelve null si no se puede
 * determinar (por ejemplo, si YOUTUBE_API_KEY no está configurada).
 */
async function detectYoutubeDuration(urlVideo: string): Promise<number | null> {
  if (!config.YOUTUBE_API_KEY) return null;

  // Extrae el video ID de YouTube de varias formas de URL conocidas
  let videoId: string | null = null;
  try {
    const parsed = new URL(urlVideo);
    if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1) || null;
    } else if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v');
      if (!videoId && parsed.pathname.includes('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1]?.split(/[?#]/)[0] ?? null;
      }
    }
  } catch {
    return null;
  }
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${config.YOUTUBE_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(apiUrl, { signal: controller.signal });
      if (!res.ok) return null;
      const data = await res.json() as { items?: Array<{ contentDetails?: { duration?: string } }> };
      const isoDuration = data.items?.[0]?.contentDetails?.duration;
      if (!isoDuration) return null;
      // ISO 8601 duration format: PT#M#S or PT#S or PT#H#M#S
      const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
      if (!match) return null;
      const hours = parseInt(match[1] ?? '0', 10);
      const minutes = parseInt(match[2] ?? '0', 10);
      const seconds = parseInt(match[3] ?? '0', 10);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      if (totalSeconds <= 0) return null;
      return totalSeconds;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }
}

function publicUser(u: {
  userId: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  telefonoCelular?: string | null;
  carrera?: string | null;
  activo?: boolean;
}) {
  return {
    userId: u.userId,
    email: u.email,
    emailVerified: u.emailVerified,
    roles: u.roles,
    carnet: u.carnet ?? null,
    dpi: u.dpi ?? null,
    fechaNacimiento: u.fechaNacimiento ?? null,
    nombres: u.nombres ?? null,
    apellidos: u.apellidos ?? null,
    telefonoCelular: u.telefonoCelular ?? null,
    carrera: u.carrera ?? null,
    activo: u.activo ?? true,
  };
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Indica si el usuario tiene una solicitud de CATEDRATICO pendiente de
 * autorización (registro público de docentes). El gateway lo expone como
 * `docentePendiente` para que la UI muestre el aviso al docente.
 */
async function tieneDocentePendiente(userId: string, client = defaultAuthGrpc): Promise<boolean> {
  try {
    const res = await client.listarSolicitudesRol('SOLICITUD_ESTADO_PENDIENTE', userId);
    return (res.solicitudes ?? []).some(
      (s: { usuarioId: string; rolSolicitado: string }) =>
        s.usuarioId === userId && s.rolSolicitado === 'ROLE_CATEDRATICO',
    );
  } catch {
    return false;
  }
}

function toProtoRole(role: string): string {
  const normalized = role.trim().toUpperCase();
  return normalized.startsWith('ROLE_') ? normalized : `ROLE_${normalized}`;
}

function toPositiveInt(value: unknown, defaultValue: number): number {
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return defaultValue;
}

export interface GatewayDependencies {
  authGrpc?: typeof defaultAuthGrpc;
  catalogGrpc?: typeof defaultCatalogGrpc;
  reproductionGrpc?: typeof defaultReproductionGrpc;
  analiticaGrpc?: typeof defaultAnaliticaGrpc;
  inscripcionGrpc?: typeof defaultInscripcionGrpc;
  notificacionesGrpc?: typeof defaultNotificacionesGrpc;
  storage?: StorageBackend;
}

export function createGateway(dependencies: GatewayDependencies = {}): Express {
  const authGrpc = dependencies.authGrpc ?? defaultAuthGrpc;
  const catalogGrpc = dependencies.catalogGrpc ?? defaultCatalogGrpc;
  const reproductionGrpc = dependencies.reproductionGrpc ?? defaultReproductionGrpc;
  const analiticaGrpc = dependencies.analiticaGrpc ?? defaultAnaliticaGrpc;
  const inscripcionGrpc = dependencies.inscripcionGrpc ?? defaultInscripcionGrpc;
  const notificacionesGrpc = dependencies.notificacionesGrpc ?? defaultNotificacionesGrpc;
  const storage = dependencies.storage ?? defaultStorage;
  const authenticate = createAuthenticate(authGrpc);
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // IdP institucional simulado (OAuth 2.0 Authorization Code).
  app.use('/mock-oauth', createIdpRouter());

  app.get('/health', async (_req, res) => {
    let authStatus = 'unknown';
    try {
      const health = await authGrpc.health();
      authStatus = health.status;
    } catch {
      authStatus = 'unavailable';
    }
    let catalogStatus = 'unknown';
    try {
      const health = await catalogGrpc.health();
      catalogStatus = health.status;
    } catch {
      catalogStatus = 'unavailable';
    }
    let reproductionStatus = 'unknown';
    try {
      const health = await reproductionGrpc.health();
      reproductionStatus = health.status;
    } catch {
      reproductionStatus = 'unavailable';
    }
    let analiticaStatus = 'unknown';
    try {
      const health = await analiticaGrpc.health();
      analiticaStatus = health.status;
    } catch {
      analiticaStatus = 'unavailable';
    }
    let inscripcionStatus = 'unknown';
    try {
      const health = await inscripcionGrpc.health();
      inscripcionStatus = health.status;
    } catch {
      inscripcionStatus = 'unavailable';
    }
    let notificacionesStatus = 'unknown';
    try {
      const health = await notificacionesGrpc.health();
      notificacionesStatus = health.status;
    } catch {
      notificacionesStatus = 'unavailable';
    }
    res.json({
      status: 'ok',
      service: 'api-gateway',
      version: '1.0.0',
      authService: authStatus,
      catalogService: catalogStatus,
      reproductionService: reproductionStatus,
      analiticaService: analiticaStatus,
      inscripcionService: inscripcionStatus,
      notificacionesService: notificacionesStatus,
    });
  });

  // ===== Autenticación =====
  app.post('/auth/register', domainGuard, async (req, res, next) => {
    try {
      const { email, password, confirmPassword, carnet, dpi, fechaNacimiento, rol } = req.body as Record<string, unknown>;
      if (typeof password !== 'string' || password.length < 8 || password !== confirmPassword) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseña inválida o no coincide', 400);
      }
      const normalizedRol = rol === 'CATEDRATICO' ? 'CATEDRATICO' : 'ESTUDIANTE';
      // El registro público como docente queda pendiente de autorización del admin.
      const requiereAutorizacion = normalizedRol === 'CATEDRATICO';
      const result = await authGrpc.register({
        email: String(email),
        password,
        confirmPassword: String(confirmPassword),
        carnet: String(carnet ?? ''),
        dpi: String(dpi ?? ''),
        fechaNacimiento: String(fechaNacimiento ?? ''),
        rol: normalizedRol,
        requiereAutorizacion,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, result.accessToken, cookieMaxAge);
      res.status(201).json({
        message: requiereAutorizacion
          ? 'Cuenta creada. Un administrador debe autorizar tu cuenta como docente antes de que puedas publicar clases.'
          : 'Cuenta creada. Revisa tu correo para confirmar el registro.',
        user: { ...publicUser(result.user), docentePendiente: requiereAutorizacion },
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/login', domainGuard, async (req, res, next) => {
    try {
      const { email, password } = req.body as Record<string, unknown>;
      if (typeof password !== 'string' || password.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseña requerida', 400);
      }
      const result = await authGrpc.login({
        email: String(email),
        password,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, result.accessToken, cookieMaxAge);
      const user = { ...publicUser(result.user), docentePendiente: await tieneDocentePendiente(result.user.userId, authGrpc) };
      res.json({
        message: 'Sesión iniciada',
        user,
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/logout', authenticate, async (req, res, next) => {
    try {
      await authGrpc.logout(req.context!.sessionId);
      clearSessionCookie(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.get('/auth/me', authenticate, async (req, res, next) => {
    try {
      const result = await authGrpc.getCurrentUser(req.context!.sessionId);
      const user = { ...publicUser(result.user), docentePendiente: await tieneDocentePendiente(result.user.userId, authGrpc) };
      res.json({ user, sessionId: result.sessionId });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/auth/me', authenticate, async (req, res, next) => {
    try {
      const { nombres, apellidos, carnet, dpi, fechaNacimiento, telefonoCelular, carrera } =
        req.body as Record<string, unknown>;
      const result = await authGrpc.updateProfile({
        userId: req.context!.userId,
        nombres: toOptionalString(nombres),
        apellidos: toOptionalString(apellidos),
        carnet: toOptionalString(carnet),
        dpi: toOptionalString(dpi),
        fechaNacimiento: toOptionalString(fechaNacimiento),
        telefonoCelular: toOptionalString(telefonoCelular),
        carrera: toOptionalString(carrera),
      });
      res.json({ user: publicUser(result.user) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/auth/usuarios', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const raw = req.query.rol;
      const roles = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
        (r): r is string => typeof r === 'string' && r.startsWith('ROLE_'),
      );
      if (roles.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'Indica al menos un rol (?rol=ROLE_CATEDRATICO)', 400);
      }
      const incluirInactivos = req.query.incluirInactivos === 'true';
      const result = await authGrpc.listUsersByRole(roles, incluirInactivos);
      res.json({ usuarios: result.users });
    } catch (err) {
      next(err);
    }
  });

  // Admin crea un usuario (sin iniciar sesión). El rol debe ser uno de los
  // permitidos por el contrato de registro (ESTUDIANTE/CATEDRATICO) o se
  // asigna después vía PATCH de roles.
  app.post('/auth/usuarios', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { email, password, confirmPassword, carnet, dpi, fechaNacimiento, rol } = req.body as Record<string, unknown>;
      if (typeof password !== 'string' || password.length < 8 || password !== confirmPassword) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseña inválida o no coincide', 400);
      }
      const normalizedRol = rol === 'CATEDRATICO' ? 'CATEDRATICO' : 'ESTUDIANTE';
      const result = await authGrpc.register({
        email: String(email),
        password,
        confirmPassword: String(confirmPassword),
        carnet: String(carnet ?? ''),
        dpi: String(dpi ?? ''),
        fechaNacimiento: String(fechaNacimiento ?? ''),
        rol: normalizedRol,
        // El admin crea el usuario directamente: no requiere autorización posterior.
        requiereAutorizacion: false,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ message: 'Usuario creado', user: publicUser(result.user) });
    } catch (err) {
      next(err);
    }
  });

  // Admin edita el perfil de cualquier usuario (reutiliza UpdateProfile).
  app.patch('/auth/usuarios/:userId', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { nombres, apellidos, carnet, dpi, fechaNacimiento, telefonoCelular, carrera } =
        req.body as Record<string, unknown>;
      const result = await authGrpc.updateProfile({
        userId: req.params.userId,
        nombres: toOptionalString(nombres),
        apellidos: toOptionalString(apellidos),
        carnet: toOptionalString(carnet),
        dpi: toOptionalString(dpi),
        fechaNacimiento: toOptionalString(fechaNacimiento),
        telefonoCelular: toOptionalString(telefonoCelular),
        carrera: toOptionalString(carrera),
      });
      res.json({ user: publicUser(result.user) });
    } catch (err) {
      next(err);
    }
  });

  // Admin desactiva (borrado lógico) una cuenta.
  app.delete('/auth/usuarios/:userId', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      await authGrpc.desactivarUsuario(req.params.userId);
      res.json({ message: 'Usuario desactivado' });
    } catch (err) {
      next(err);
    }
  });

  // Admin reactiva una cuenta desactivada.
  app.post('/auth/usuarios/:userId/reactivar', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      await authGrpc.reactivarUsuario(req.params.userId);
      res.json({ message: 'Usuario reactivado' });
    } catch (err) {
      next(err);
    }
  });

  // ===== Solicitudes de rol =====
  app.post('/auth/solicitudes', authenticate, async (req, res, next) => {
    try {
      const { rolSolicitado } = req.body as Record<string, unknown>;
      const role = toProtoRole(String(rolSolicitado ?? ''));
      if (role !== 'ROLE_CATEDRATICO' && role !== 'ROLE_AUXILIAR') {
        throw new DomainError(
          'ENTRADA_INVALIDA',
          'Solo se puede solicitar el rol CATEDRATICO o AUXILIAR',
          400,
        );
      }
      const result = await authGrpc.crearSolicitudRol(req.context!.userId, role);
      res.status(201).json({ message: 'Solicitud enviada', solicitud: result.solicitud });
    } catch (err) {
      next(err);
    }
  });

  app.get('/auth/solicitudes', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const raw = req.query.estado;
      const estado =
        typeof raw === 'string' && raw.trim().length > 0
          ? `SOLICITUD_ESTADO_${raw.trim().toUpperCase()}`
          : undefined;
      const result = await authGrpc.listarSolicitudesRol(estado);
      res.json({ solicitudes: result.solicitudes });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/solicitudes/:solicitudId/resolver', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { aprobado } = req.body as Record<string, unknown>;
      if (typeof aprobado !== 'boolean') {
        throw new DomainError('ENTRADA_INVALIDA', 'aprobado (booleano) es obligatorio', 400);
      }
      const result = await authGrpc.resolverSolicitudRol(
        req.params.solicitudId,
        aprobado,
        req.context!.userId,
      );
      const solicitud = result.solicitud;
      if (aprobado) {
        if (solicitud.rolSolicitado === 'ROLE_CATEDRATICO') {
          await inscripcionGrpc.registrarDocente(solicitud.usuarioId);
        } else if (solicitud.rolSolicitado === 'ROLE_AUXILIAR') {
          await inscripcionGrpc.registrarAuxiliar(solicitud.usuarioId);
        }
      }
      res.json({
        message: aprobado ? 'Solicitud aprobada' : 'Solicitud rechazada',
        solicitud,
      });
    } catch (err) {
      next(err);
    }
  });

  // ===== Perfiles / RBAC =====
  app.get('/profiles/me', authenticate, async (req, res, next) => {
    try {
      const view = await authGrpc.getProfiles(req.context!.userId);
      res.json(view);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/profiles/:userId/roles', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const role = toProtoRole(String((req.body as Record<string, unknown>).role ?? ''));
      if (role === 'ROLE_') {
        throw new DomainError('ENTRADA_INVALIDA', 'Rol requerido', 400);
      }
      const view = await authGrpc.assignRole(req.params.userId, role);
      res.json(view.profiles);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/profiles/:userId/roles/:role', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const role = toProtoRole(req.params.role);
      const view = await authGrpc.removeRole(req.params.userId, role);
      res.json(view.profiles);
    } catch (err) {
      next(err);
    }
  });

  app.post('/profiles/switch', authenticate, async (req, res, next) => {
    try {
      const role = toProtoRole(String((req.body as Record<string, unknown>).role ?? ''));
      if (role === 'ROLE_') {
        throw new DomainError('ENTRADA_INVALIDA', 'Rol requerido', 400);
      }
      await authGrpc.switchProfile(req.context!.userId, role, req.context!.sessionId);
      res.json({
        message: 'Perfil cambiado. Inicia sesión de nuevo para obtener el nuevo token.',
        pendingRole: role,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/profiles/permission', authenticate, async (req, res, next) => {
    try {
      const { resource, action } = req.body as Record<string, unknown>;
      if (typeof resource !== 'string' || typeof action !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'resource y action requeridos', 400);
      }
      const allowed = await authGrpc.checkPermission(req.context!.userId, resource, action);
      res.json({ allowed });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/verify-email', authenticate, async (req, res, next) => {
    try {
      const { token } = await authGrpc.requestEmailVerification(req.context!.email);
      res.json({ message: 'Token de verificación generado', token });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/verify-email/confirm', async (req, res, next) => {
    try {
      const { token } = req.body as Record<string, unknown>;
      if (typeof token !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Token requerido', 400);
      }
      await authGrpc.confirmEmailVerification(token);
      res.json({ message: 'Correo verificado correctamente' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/reset-password', async (req, res, next) => {
    try {
      const { email } = req.body as Record<string, unknown>;
      if (typeof email !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Correo requerido', 400);
      }
      const { token } = await authGrpc.requestPasswordReset(email);
      res.json({ message: 'Si el correo existe, recibirás un enlace para restablecer', token });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/reset-password/confirm', async (req, res, next) => {
    try {
      const { token, newPassword } = req.body as Record<string, unknown>;
      if (typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
        throw new DomainError('ENTRADA_INVALIDA', 'Token y nueva contraseña requeridos', 400);
      }
      await authGrpc.confirmPasswordReset(token, newPassword);
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/change-password', authenticate, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as Record<string, unknown>;
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseñas inválidas', 400);
      }
      await authGrpc.changePassword(req.context!.userId, currentPassword, newPassword);
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/oauth/authorize', domainGuard, async (req, res, next) => {
    try {
      const { email, state, codeChallenge } = req.body as { email?: string; state?: string; codeChallenge?: string };

      if (config.OAUTH_PROVIDER === 'google') {
        // Google OAuth 2.0 + PKCE: construir la URL de autorización de Google
        if (!config.GOOGLE_CLIENT_ID) {
          throw new DomainError('CONFIG_INVALIDA', 'GOOGLE_CLIENT_ID no está configurado', 500);
        }
        if (!state || !codeChallenge) {
          throw new DomainError('ENTRADA_INVALIDA', 'state y codeChallenge son requeridos', 400);
        }
        const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        googleAuthUrl.searchParams.set('client_id', config.GOOGLE_CLIENT_ID);
        googleAuthUrl.searchParams.set('redirect_uri', config.OAUTH_REDIRECT_URI);
        googleAuthUrl.searchParams.set('response_type', 'code');
        googleAuthUrl.searchParams.set('scope', 'openid email profile');
        googleAuthUrl.searchParams.set('state', state);
        googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
        googleAuthUrl.searchParams.set('code_challenge_method', 'S256');
        res.json({ login_uri: googleAuthUrl.toString() });
      } else {
        // Mock IdP: flujo original con email
        if (!email) {
          throw new DomainError('ENTRADA_INVALIDA', 'Correo requerido', 400);
        }
        const loginUri = buildIdpLoginUri({
          email: String(email).trim().toLowerCase(),
          state: typeof state === 'string' ? state : '',
        });
        res.json({ login_uri: loginUri });
      }
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/oauth/callback', async (req, res, next) => {
    try {
      const { code, codeVerifier } = req.body as Record<string, unknown>;
      if (typeof code !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Código OAuth requerido', 400);
      }
      const result = await authGrpc.oauthCallback(
        code,
        req.ip,
        req.headers['user-agent'],
        typeof codeVerifier === 'string' ? codeVerifier : undefined,
      );
      setSessionCookie(res, result.accessToken, cookieMaxAge);
      res.json({
        message: 'Sesión iniciada con identidad institucional',
        user: publicUser(result.user),
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        provider: result.provider,
      });
    } catch (err) {
      next(err);
    }
  });

//catalogo
  app.get('/catalog/classes', authenticate, async (req, res, next) => {
    try {
      const { semestre, escuela, curso, catedratico, tema } = req.query as Record<
        string,
        string | undefined
      >;
      const pageSize = Math.min(
        toPositiveInt(req.query.pageSize ?? req.query.page_size, 10),
        10,
      );
      const result = await catalogGrpc.search({
        semestre: semestre ?? '',
        escuela: escuela ?? '',
        curso: curso ?? '',
        catedratico: catedratico ?? '',
        tema: tema ?? '',
        page: toPositiveInt(req.query.page, 1),
        pageSize,
      });
      res.json({
        resultados: result.resultados,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/catalog/classes/:claseId', authenticate, async (req, res, next) => {
    try {
      const result = await catalogGrpc.getClase(req.params.claseId);
      res.json({ clase: result.clase });
    } catch (err) {
      next(err);
    }
  });

  // Edición completa de una clase (CRUD: UPDATE). Admin, docente y auxiliar
  // pueden modificar los datos de la clase y reasignar etiquetas/participantes.
  // Segmentación de la grabación en capítulos/temas. La lectura está
  // disponible para cualquier usuario autenticado; la escritura conserva
  // las mismas reglas de contenido que el resto del catálogo.
  app.get('/catalog/classes/:claseId/chapters', authenticate, async (req, res, next) => {
    try {
      const result = await catalogGrpc.listarCapitulos(req.params.claseId);
      res.json({ capitulos: result.capitulos ?? [] });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/catalog/classes/:claseId/chapters',
    authenticate,
    requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'),
    async (req, res, next) => {
      try {
        const body = req.body as Record<string, unknown>;
        const inicioSegundos = Number(body.inicioSegundos);
        const finSegundos = Number(body.finSegundos);
        const orden = body.orden === undefined || body.orden === null ? 0 : Number(body.orden);
        if (
          typeof body.titulo !== 'string' ||
          !Number.isInteger(inicioSegundos) ||
          !Number.isInteger(finSegundos) ||
          !Number.isInteger(orden)
        ) {
          throw new DomainError(
            'ENTRADA_INVALIDA',
            'titulo, inicioSegundos y finSegundos deben ser válidos',
            400,
          );
        }
        const result = await catalogGrpc.crearCapitulo({
          claseId: req.params.claseId,
          titulo: body.titulo,
          inicioSegundos,
          finSegundos,
          orden,
        });
        res.status(201).json({ message: 'Capítulo creado', capitulo: result.capitulo });
      } catch (err) {
        next(err);
      }
    },
  );

  app.patch(
    '/catalog/chapters/:capituloId',
    authenticate,
    requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'),
    async (req, res, next) => {
      try {
        const body = req.body as Record<string, unknown>;
        const inicioSegundos = Number(body.inicioSegundos);
        const finSegundos = Number(body.finSegundos);
        const orden = body.orden === undefined || body.orden === null ? 0 : Number(body.orden);
        if (
          typeof body.claseId !== 'string' ||
          typeof body.titulo !== 'string' ||
          !Number.isInteger(inicioSegundos) ||
          !Number.isInteger(finSegundos) ||
          !Number.isInteger(orden)
        ) {
          throw new DomainError(
            'ENTRADA_INVALIDA',
            'claseId, titulo, inicioSegundos y finSegundos deben ser válidos',
            400,
          );
        }
        const result = await catalogGrpc.actualizarCapitulo({
          capituloId: req.params.capituloId,
          claseId: body.claseId,
          titulo: body.titulo,
          inicioSegundos,
          finSegundos,
          orden,
        });
        res.json({ message: 'Capítulo actualizado', capitulo: result.capitulo });
      } catch (err) {
        next(err);
      }
    },
  );

  app.delete(
    '/catalog/chapters/:capituloId',
    authenticate,
    requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'),
    async (req, res, next) => {
      try {
        const result = await catalogGrpc.eliminarCapitulo(req.params.capituloId);
        res.json({ message: 'Capítulo eliminado', claseId: result.claseId ?? '' });
      } catch (err) {
        next(err);
      }
    },
  );

  app.patch('/catalog/classes/:claseId', authenticate, requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (typeof body.cursoId !== 'string' || typeof body.semestre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'cursoId y semestre son obligatorios', 400);
      }
      const participantes = Array.isArray(body.participantes)
        ? (body.participantes as Array<{ nombre?: unknown; rol?: unknown }>)
            .filter((p) => typeof p.nombre === 'string' && typeof p.rol === 'string')
            .map((p) => ({ nombre: p.nombre as string, rol: p.rol as string }))
        : [];
      const result = await catalogGrpc.editarClase({
        claseId: req.params.claseId,
        cursoId: body.cursoId,
        unidad: typeof body.unidad === 'string' ? body.unidad : '',
        tema: typeof body.tema === 'string' ? body.tema : '',
        fechaImparticion: typeof body.fechaImparticion === 'string' ? body.fechaImparticion : '',
        semestre: body.semestre,
        anio: Number(body.anio ?? 0),
        urlVideo: typeof body.urlVideo === 'string' ? body.urlVideo : '',
        urlMaterial: typeof body.urlMaterial === 'string' ? body.urlMaterial : '',
        duracion: Number(body.duracion ?? 0),
        etiquetas: Array.isArray(body.etiquetas)
          ? (body.etiquetas as unknown[]).filter((e): e is string => typeof e === 'string')
          : [],
        participantes,
      });
      res.json({ message: 'Clase actualizada', clase: result.clase });
    } catch (err) {
      next(err);
    }
  });

  // Eliminación de una clase (CRUD: DELETE). Admin, docente y auxiliar pueden
  // borrar la clase; además se intenta limpiar sus archivos multimedia.
  app.delete('/catalog/classes/:claseId', authenticate, requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'), async (req, res, next) => {
    const claseId = req.params.claseId;
    try {
      await catalogGrpc.eliminarClase(claseId);
      // Limpieza best-effort de los archivos multimedia (disco o bucket).
      await storage.eliminarArchivosClase(claseId).catch(() => {});
      res.json({ message: 'Clase eliminada' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/catalog/semestres', authenticate, async (req, res, next) => {
    try {
      const semestre = (req.query.semestre as string | undefined) ?? '';
      const result = await catalogGrpc.listarPorSemestre(semestre);
      res.json({ semestres: result.semestres });
    } catch (err) {
      next(err);
    }
  });

  app.post('/catalog/classes', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (typeof body.cursoId !== 'string' || typeof body.semestre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'cursoId y semestre son obligatorios', 400);
      }
      const participantes = Array.isArray(body.participantes)
        ? (body.participantes as Array<{ nombre?: unknown; rol?: unknown }>)
            .filter((p) => typeof p.nombre === 'string' && typeof p.rol === 'string')
            .map((p) => ({ nombre: p.nombre as string, rol: p.rol as string }))
        : [];
      const result = await catalogGrpc.publicarClase({
        cursoId: body.cursoId,
        unidad: typeof body.unidad === 'string' ? body.unidad : '',
        tema: typeof body.tema === 'string' ? body.tema : '',
        fechaImparticion: typeof body.fechaImparticion === 'string' ? body.fechaImparticion : '',
        semestre: body.semestre,
        anio: Number(body.anio ?? 0),
        urlVideo: typeof body.urlVideo === 'string' ? body.urlVideo : '',
        urlMaterial: typeof body.urlMaterial === 'string' ? body.urlMaterial : '',
        duracion: Number(body.duracion ?? 0),
        etiquetas: Array.isArray(body.etiquetas)
          ? (body.etiquetas as unknown[]).filter((e): e is string => typeof e === 'string')
          : [],
        participantes,
      });
      res.status(201).json({
        message: 'Clase publicada',
        claseId: result.claseId,
        fechaPublicacion: result.fechaPublicacion,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/catalog/courses', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { codigo, nombre, escuela } = req.body as Record<string, unknown>;
      if (typeof codigo !== 'string' || typeof nombre !== 'string' || typeof escuela !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'codigo, nombre y escuela son obligatorios', 400);
      }
      const result = await catalogGrpc.registrarCurso({ codigo, nombre, escuela });
      res.status(201).json({ message: 'Curso registrado en el catálogo', curso: result.curso });
    } catch (err) {
      next(err);
    }
  });

  app.get('/catalog/courses/:codigo', authenticate, async (req, res, next) => {
    try {
      const result = await catalogGrpc.obtenerCursoPorCodigo(req.params.codigo);
      res.json({ curso: result.curso });
    } catch (err) {
      next(err);
    }
  });

  // Ingesta masiva de catálogo vía CSV (Práctica 3). Solo roles admin/docentes.
  // El cuerpo puede ser el archivo .csv en crudo (text/csv) o JSON { csv: "..." }.
  app.post(
    '/admin/catalogo/csv',
    authenticate,
    requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'),
    express.text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '2mb' }),
    async (req, res, next) => {
      try {
        const csvText =
          typeof req.body === 'string' ? req.body : (req.body as { csv?: unknown })?.csv;
        if (typeof csvText !== 'string' || csvText.trim().length === 0) {
          throw new DomainError(
            'ENTRADA_INVALIDA',
            'El archivo CSV está vacío o no se recibió ningún archivo',
            400,
          );
        }
        const filas = parseClasesCsv(csvText);
        if (filas.length === 0) {
          throw new DomainError('ENTRADA_INVALIDA', 'El archivo CSV no contiene filas de clases', 400);
        }
        const result = await catalogGrpc.cargarClasesCSV(filas);

        const cursosUnicos = new Map<string, { codigo: string; nombre: string; escuela: string; semestre: string; anio: number }>();
        for (const f of filas) {
          if (f.codigoCurso && f.nombreCurso && f.escuela && f.semestre && f.anio) {
            const key = `${f.codigoCurso}|${f.semestre}|${f.anio}`;
            if (!cursosUnicos.has(key)) {
              cursosUnicos.set(key, {
                codigo: f.codigoCurso,
                nombre: f.nombreCurso,
                escuela: f.escuela,
                semestre: f.semestre,
                anio: f.anio,
              });
            }
          }
        }
        for (const curso of cursosUnicos.values()) {
          try {
            await inscripcionGrpc.registrarCurso(curso);
          } catch { /* curso ya existente o error no crítico */ }
        }

        res.status(201).json({
          message: 'Carga masiva procesada mediante sp_cargar_clases_csv',
          registradas: result.registradas,
          omitidas: result.omitidas,
          totalProcesadas: filas.length,
          cursosSincronizados: cursosUnicos.size,
        });
      } catch (err) {
        if (err instanceof CsvParseError) {
          return next(new DomainError('ENTRADA_INVALIDA', err.message, 400));
        }
        next(err);
      }
    },
  );

  // =====================================================================
  // Panel Web Admin (Práctica 3): CRUD de Semestres, Escuelas/Áreas,
  // Cursos y Docentes. Protegido por RBAC para Admin/Catedrático/Auxiliar.
  // Todos los cambios en el catálogo se ejecutan vía SPs en la BD.
  // =====================================================================
  const adminRoles = ['ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'] as const;
  const adminGuard = requireAnyRole(...adminRoles);

  app.get('/admin/semestres', authenticate, adminGuard, async (_req, res, next) => {
    try {
      const result = await catalogGrpc.listarSemestres();
      res.json({ semestres: result.semestres });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/semestres', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { nombre, anio } = req.body as Record<string, unknown>;
      if (typeof nombre !== 'string' || typeof anio !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'nombre y anio son obligatorios', 400);
      }
      const result = await catalogGrpc.registrarSemestre({ nombre, anio });
      res.status(201).json({ message: 'Semestre registrado', semestreId: result.semestreId });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/admin/semestres/:semestreId', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { nombre, anio } = req.body as Record<string, unknown>;
      if (typeof nombre !== 'string' || typeof anio !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'nombre y anio son obligatorios', 400);
      }
      await catalogGrpc.actualizarSemestre({ semestreId: req.params.semestreId, nombre, anio });
      res.json({ message: 'Semestre actualizado' });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/admin/semestres/:semestreId', authenticate, adminGuard, async (req, res, next) => {
    try {
      await catalogGrpc.eliminarSemestre(req.params.semestreId);
      res.json({ message: 'Semestre eliminado' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin/escuelas', authenticate, adminGuard, async (_req, res, next) => {
    try {
      const result = await catalogGrpc.listarEscuelas();
      res.json({ escuelas: result.escuelas });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/escuelas', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { nombre } = req.body as Record<string, unknown>;
      if (typeof nombre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'nombre es obligatorio', 400);
      }
      const result = await catalogGrpc.registrarEscuela({ nombre });
      res.status(201).json({ message: 'Escuela registrada', escuelaId: result.escuelaId });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/admin/escuelas/:escuelaId', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { nombre } = req.body as Record<string, unknown>;
      if (typeof nombre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'nombre es obligatorio', 400);
      }
      await catalogGrpc.actualizarEscuela({ escuelaId: req.params.escuelaId, nombre });
      res.json({ message: 'Escuela actualizada' });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/admin/escuelas/:escuelaId', authenticate, adminGuard, async (req, res, next) => {
    try {
      await catalogGrpc.eliminarEscuela(req.params.escuelaId);
      res.json({ message: 'Escuela eliminada' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin/cursos', authenticate, adminGuard, async (_req, res, next) => {
    try {
      const result = await catalogGrpc.listarCursos();
      res.json({ cursos: result.cursos });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/cursos', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { codigo, nombre, escuela } = req.body as Record<string, unknown>;
      if (typeof codigo !== 'string' || typeof nombre !== 'string' || typeof escuela !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'codigo, nombre y escuela son obligatorios', 400);
      }
      const result = await catalogGrpc.registrarCurso({ codigo, nombre, escuela });
      res.status(201).json({ message: 'Curso registrado en el catálogo', curso: result.curso });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/admin/cursos/:cursoId', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { codigo, nombre, escuela } = req.body as Record<string, unknown>;
      if (typeof codigo !== 'string' || typeof nombre !== 'string' || typeof escuela !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'codigo, nombre y escuela son obligatorios', 400);
      }
      await catalogGrpc.actualizarCurso({ cursoId: req.params.cursoId, codigo, nombre, escuela });
      res.json({ message: 'Curso actualizado' });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/admin/cursos/:cursoId', authenticate, adminGuard, async (req, res, next) => {
    try {
      await catalogGrpc.eliminarCurso(req.params.cursoId);
      res.json({ message: 'Curso eliminado' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin/docentes', authenticate, adminGuard, async (_req, res, next) => {
    try {
      const result = await inscripcionGrpc.listarDocentes();
      res.json({ docentes: result.docentes });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/docentes', authenticate, adminGuard, async (req, res, next) => {
    try {
      const { usuarioId } = req.body as Record<string, unknown>;
      if (typeof usuarioId !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'usuarioId es obligatorio', 400);
      }
      const result = await inscripcionGrpc.registrarDocente(usuarioId);
      res.status(201).json({ message: 'Docente registrado', docenteId: result.docenteId });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/admin/docentes/:docenteId', authenticate, adminGuard, async (req, res, next) => {
    try {
      await inscripcionGrpc.eliminarDocente(req.params.docenteId);
      res.json({ message: 'Docente eliminado' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/catalog/classes/:claseId/video', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    const claseId = req.params.claseId;
    const targetPath = path.join(config.MEDIA_DIR, 'clases', `${claseId}.mp4`);
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (!contentLength || contentLength > MAX_VIDEO_BYTES) {
      return next(new DomainError('ENTRADA_INVALIDA', 'El archivo debe pesar entre 1 byte y 500 MB', 400));
    }
    try {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

      // Se escribe primero a un archivo temporal: si el video es inválido se
      // descarta y el video anterior queda intacto.
      const tempPath = `${targetPath}.uploading`;
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(tempPath);
        out.on('error', reject);
        out.on('close', resolve);
        req.on('error', reject);
        req.pipe(out);
      });

      // Se detecta la duración real del video a partir de sus metadatos
      // (ffprobe) y se actualiza la clase, ignorando la duración manual.
      // Si ffprobe no puede leerla (códec exótico), se respeta la duración
      // que detectó el navegador (header x-video-duracion-segundos).
      let duracion = await detectVideoDuration(tempPath);
      if (duracion === null || duracion <= 0) {
        const cliente = Number.parseInt(String(req.headers['x-video-duracion-segundos'] ?? ''), 10);
        if (Number.isFinite(cliente) && cliente > 0 && cliente <= MAX_VIDEO_DURATION_SECONDS) {
          duracion = cliente;
        }
      }
      if (duracion === null || duracion === 0) {
        await fs.promises.rm(tempPath, { force: true }).catch(() => {});
        return next(
          new DomainError(
            'ENTRADA_INVALIDA',
            'No se pudo leer el archivo como video o detectar su duración',
            400,
          ),
        );
      }

      // Miniatura del video: se extrae un fotograma con ffmpeg mientras el
      // archivo aún está en el temporal. Es mejor esfuerzo: si falla, la clase
      // simplemente no tendrá miniatura y las tarjetas mostrarán el marcador.
      const thumbTempPath = `${tempPath}.thumb.jpg`;
      const thumbnailGenerada = await generarThumbnail(tempPath, thumbTempPath, duracion);

      // El backend decide dónde vive el archivo final (disco o bucket) y
      // devuelve la URL pública que se persiste en el catálogo.
      const urlVideo = await storage.guardarVideo(claseId, tempPath, req.headers['content-type'] ?? 'video/mp4');
      if (thumbnailGenerada) {
        await storage.guardarThumbnail(claseId, thumbTempPath).catch(() => {});
      }
      await catalogGrpc.actualizarUrlVideo(claseId, urlVideo);
      const result = await catalogGrpc.actualizarDuracion(claseId, duracion);
      const clase = result.clase;
      if (clase?.cursoId) {
        notificacionesGrpc.notificarVideoSubido({
          cursoId: clase.cursoId,
          codigo: clase.codigo,
          curso: clase.curso,
          semestre: clase.semestre,
          anio: clase.anio,
          tema: clase.tema,
        }).catch((err: any) => console.error('[api-gateway] notificarVideoSubido error:', err?.message ?? err));
      }
      res.status(201).json({
        message: 'Video subido a la plataforma',
        urlVideo,
        duracion: clase?.duracion ?? duracion,
        clase,
      });
    } catch (err) {
      await fs.promises.rm(`${targetPath}.uploading`, { force: true }).catch(() => {});
      await fs.promises.rm(`${targetPath}.uploading.thumb.jpg`, { force: true }).catch(() => {});
      await fs.promises.rm(targetPath, { force: true }).catch(() => {});
      next(err);
    }
  });

  app.post('/catalog/classes/:claseId/video-url', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { urlVideo } = req.body as Record<string, unknown>;
      if (typeof urlVideo !== 'string' || !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(urlVideo)) {
        throw new DomainError('ENTRADA_INVALIDA', 'urlVideo debe ser una URL de YouTube válida (http/https)', 400);
      }
      const result = await catalogGrpc.actualizarUrlVideo(req.params.claseId, urlVideo);
      // Detecta la duración del video de YouTube usando la YouTube Data API v3.
      // Si no está configurada la API key, la duración se deja como está (0 o manual).
      const duracion = await detectYoutubeDuration(urlVideo);
      let clase = result.clase;
      if (duracion !== null && duracion > 0) {
        const duracionResult = await catalogGrpc.actualizarDuracion(req.params.claseId, duracion);
        clase = duracionResult.clase;
      }
      res.json({ message: 'URL de video actualizada', urlVideo, duracion: clase.duracion, clase });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/catalog/classes/:claseId/duracion', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { duracion } = req.body as Record<string, unknown>;
      if (typeof duracion !== 'number' || duracion < 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'duracion debe ser un número no negativo', 400);
      }
      const result = await catalogGrpc.actualizarDuracion(req.params.claseId, duracion);
      res.json({ message: 'Duración actualizada', clase: result.clase });
    } catch (err) {
      next(err);
    }
  });

  app.post('/catalog/classes/:claseId/material', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    const claseId = req.params.claseId;
    let targetPath = '';
    try {
      const tamano = validarTamanoMaterial(req.headers['content-length']);
      const mime = normalizarContentType(req.headers['content-type']);
      const ext = resolverExtensionMaterial(mime, req.headers['x-filename']);
      targetPath = path.join(config.MEDIA_DIR, 'materiales', `${claseId}${ext}`);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

      const tempPath = `${targetPath}.uploading`;
      await escribirTemporal(tempPath, req, tamano);

      // El backend se encarga de limpiar el material previo con otra
      // extensión, hacer el commit del archivo y devolver la URL pública.
      const urlMaterial = await storage.guardarMaterial(claseId, tempPath, ext, mime);
      const result = await catalogGrpc.actualizarUrlMaterial(claseId, urlMaterial);
      res.status(201).json({
        message: 'Material subido a la plataforma',
        urlMaterial,
        clase: result.clase,
      });
    } catch (err) {
      if (targetPath) await fs.promises.rm(`${targetPath}.uploading`, { force: true }).catch(() => {});
      next(err);
    }
  });

//Rerpositorio de material
  app.get('/catalog/classes/:claseId/materials', authenticate, async (req, res, next) => {
    try {
      const result = await catalogGrpc.listarMateriales(req.params.claseId);
      res.json({ materiales: (result.materiales ?? []).map(normalizarMaterial) });
    } catch (err) {
      next(err);
    }
  });

  // Sube un nuevo material a la clase (catedrático / auxiliar / admin).
  app.post('/catalog/classes/:claseId/materials', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    const materialId = randomUUID();
    let rutaTemp = '';
    try {
      const tamanoDeclarado = validarTamanoMaterial(req.headers['content-length']);
      const mime = normalizarContentType(req.headers['content-type']);
      const ext = resolverExtensionMaterial(mime, req.headers['x-filename']);
      const nombreArchivo = resolverNombreArchivo(req.headers['x-filename'], ext);

      rutaTemp = path.join(config.MEDIA_DIR, 'materiales', '.tmp', `${materialId}.uploading`);
      const tamano = await escribirTemporal(rutaTemp, req, tamanoDeclarado);

      // El binario se persiste primero (mismo flujo que los videos) y luego
      // se registra la metadata en el catálogo vía gRPC.
      const urlArchivo = await storage.guardarMaterialVersion(req.params.claseId, materialId, nombreArchivo, rutaTemp, mime);
      rutaTemp = '';
      try {
        const result = await catalogGrpc.registrarMaterial({
          materialId,
          claseId: req.params.claseId,
          nombreArchivo,
          mimeType: mime,
          extension: ext,
          tamanoBytes: tamano,
          urlArchivo,
        });
        res.status(201).json({
          message: 'Material publicado',
          material: normalizarMaterial(result.material),
        });
      } catch (grpcErr) {
        await storage.eliminarMaterial(req.params.claseId, materialId).catch(() => {});
        throw grpcErr;
      }
    } catch (err) {
      if (rutaTemp) await fs.promises.rm(rutaTemp, { force: true }).catch(() => {});
      next(err);
    }
  });

  // Publica una nueva versión de un material existente.
  app.post('/catalog/materials/:materialId/versiones', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    let rutaTemp = '';
    try {
      const tamanoDeclarado = validarTamanoMaterial(req.headers['content-length']);
      const mime = normalizarContentType(req.headers['content-type']);
      const ext = resolverExtensionMaterial(mime, req.headers['x-filename']);
      const nombreArchivo = resolverNombreArchivo(req.headers['x-filename'], ext);

      const actual = await catalogGrpc.obtenerMaterial(req.params.materialId);
      const claseId = String(actual?.material?.claseId ?? '');
      if (!claseId) {
        throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
      }

      rutaTemp = path.join(config.MEDIA_DIR, 'materiales', '.tmp', `${req.params.materialId}.uploading`);
      const tamano = await escribirTemporal(rutaTemp, req, tamanoDeclarado);

      const urlArchivo = await storage.guardarMaterialVersion(claseId, req.params.materialId, nombreArchivo, rutaTemp, mime);
      rutaTemp = '';
      try {
        const result = await catalogGrpc.agregarVersionMaterial({
          materialId: req.params.materialId,
          tamanoBytes: tamano,
          urlArchivo,
        });
        res.status(201).json({
          message: `Versión ${result.material?.versionActual ?? '?'} publicada`,
          material: normalizarMaterial(result.material),
        });
      } catch (grpcErr) {
        await storage.eliminarMaterial(claseId, req.params.materialId).catch(() => {});
        throw grpcErr;
      }
    } catch (err) {
      if (rutaTemp) await fs.promises.rm(rutaTemp, { force: true }).catch(() => {});
      next(err);
    }
  });

  // Detalle de un material.
  app.get('/catalog/materials/:materialId', authenticate, async (req, res, next) => {
    try {
      const result = await catalogGrpc.obtenerMaterial(req.params.materialId);
      res.json({ material: normalizarMaterial(result.material) });
    } catch (err) {
      next(err);
    }
  });

  // Elimina un material (metadata + todas sus versiones físicas).
  app.delete('/catalog/materials/:materialId', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const detalle = await catalogGrpc.obtenerMaterial(req.params.materialId);
      await catalogGrpc.eliminarMaterial(req.params.materialId);
      const claseId = String(detalle?.material?.claseId ?? '');
      if (claseId) {
        await storage.eliminarMaterial(claseId, req.params.materialId).catch(() => {});
      }
      res.json({ message: 'Material eliminado' });
    } catch (err) {
      next(err);
    }
  });

  // Métricas: registra una descarga y devuelve el total acumulado del archivo.
  app.post('/catalog/materials/:materialId/descarga', authenticate, async (req, res, next) => {
    try {
      const result = await catalogGrpc.registrarDescargaMaterial(req.params.materialId);
      res.json({ message: 'Descarga registrada', totalDescargas: Number(result.totalDescargas ?? 0) });
    } catch (err) {
      next(err);
    }
  });

//reproduccion
  app.post('/reproduccion/checkpoint', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { claseId, segundoActual, duracion, evento } = req.body as Record<string, unknown>;
      if (typeof claseId !== 'string' || typeof segundoActual !== 'number' || typeof duracion !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'claseId, segundoActual y duracion son obligatorios', 400);
      }
      const result = await reproductionGrpc.guardarCheckpoint({
        estudianteId: req.context!.userId,
        claseId,
        segundoActual,
        duracion,
      });
      if (evento === 'inicio' || evento === 'fin') {
        analiticaGrpc.sincronizarVista({
          claseId,
          estudianteId: req.context!.userId,
          duracionVista: segundoActual,
        }).catch(() => {});
      }
      res.json({
        message: 'Checkpoint guardado',
        historialId: result.historialId,
        porcentajeAvance: result.porcentajeAvance,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/reproduccion/checkpoint/:claseId', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const result = await reproductionGrpc.obtenerCheckpoint({
        estudianteId: req.context!.userId,
        claseId: req.params.claseId,
      });
      res.json({ checkpoint: result.checkpoint ?? null });
    } catch (err) {
      next(err);
    }
  });

  app.get('/reproduccion/historial', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const result = await reproductionGrpc.historialReciente({ estudianteId: req.context!.userId });
      const items = await Promise.all(
        (result.items ?? []).map(async (item: Record<string, unknown>) => {
          let contexto: Record<string, unknown> = {};
          try {
            const clase = await catalogGrpc.getClase(String(item.claseId));
            contexto = {
              codigo: clase.clase?.codigo ?? '',
              curso: clase.clase?.curso ?? '',
              escuela: clase.clase?.escuela ?? '',
              unidad: clase.clase?.unidad ?? '',
              tema: clase.clase?.tema ?? '',
              semestre: clase.clase?.semestre ?? '',
              anio: clase.clase?.anio ?? 0,
              urlVideo: clase.clase?.urlVideo ?? '',
            };
          } catch {
          }
          return { ...item, ...contexto };
        }),
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  app.post('/reproduccion/calificaciones', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { historialId, puntuacion, comentario, claseId } = req.body as Record<string, unknown>;
      if (typeof historialId !== 'string' || typeof puntuacion !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'historialId y puntuacion son obligatorios', 400);
      }
      const result = await reproductionGrpc.registrarCalificacion({
        historialId,
        puntuacion,
        comentario: typeof comentario === 'string' ? comentario : '',
      });
      if (typeof claseId === 'string') {
        analiticaGrpc.sincronizarCalificacion({
          claseId,
          estudianteId: req.context!.userId,
          puntuacion,
        }).catch(() => {});
      }
      res.status(201).json({ message: 'Calificación registrada', registrada: result.registrada });
    } catch (err) {
      next(err);
    }
  });

// ===== Cuaderno de apuntes Markdown con marcadores de tiempo =====
  app.get('/reproduccion/apuntes', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const result = await reproductionGrpc.listarApuntes({ estudianteId: req.context!.userId });
      res.json({ apuntes: result.apuntes ?? [] });
    } catch (err) {
      next(err);
    }
  });

  app.get('/reproduccion/apuntes/:claseId', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const result = await reproductionGrpc.obtenerApunte({
        estudianteId: req.context!.userId,
        claseId: req.params.claseId,
      });
      res.json({ apunte: result.apunte ?? null });
    } catch (err) {
      next(err);
    }
  });

  app.post('/reproduccion/apuntes', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { claseId, titulo, contenidoMarkdown } = req.body as Record<string, unknown>;
      if (typeof claseId !== 'string' || typeof titulo !== 'string' || typeof contenidoMarkdown !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'claseId, titulo y contenidoMarkdown son obligatorios', 400);
      }
      // Los marcadores de tiempo embebidos en el Markdown deben respetar el
      // formato [MM:SS] con minutos y segundos de dos dígitos (segundos <= 59).
      const marcadorRe = /\[(\d{2}):(\d{2})\]/g;
      let match: RegExpExecArray | null;
      while ((match = marcadorRe.exec(contenidoMarkdown)) !== null) {
        if (Number(match[2]) > 59) {
          throw new DomainError('ENTRADA_INVALIDA', 'El marcador de tiempo debe tener el formato [MM:SS]', 400);
        }
      }
      const result = await reproductionGrpc.guardarApunte({
        estudianteId: req.context!.userId,
        claseId,
        titulo,
        contenidoMarkdown,
      });
      res.status(201).json({ message: 'Apunte guardado', apunte: result.apunte });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/reproduccion/apuntes/:claseId', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const result = await reproductionGrpc.eliminarApunte({
        estudianteId: req.context!.userId,
        claseId: req.params.claseId,
      });
      res.json({ message: 'Apunte eliminado', eliminado: result.eliminado });
    } catch (err) {
      next(err);
    }
  });

  // Exportación del cuaderno de apuntes a un archivo Markdown (.md). Solo el
  // backend genera el .md; la conversión a PDF con rendering enriquecido
  // (fórmulas, resaltado de sintaxis) se realiza en el frontend.
  app.get('/reproduccion/apuntes/:claseId/exportar', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const result = await reproductionGrpc.exportarApunteMd({
        estudianteId: req.context!.userId,
        claseId: req.params.claseId,
      });
      res.setHeader('Content-Type', result.mimeType ?? 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.nombreArchivo}"`);
      res.status(200).send(result.contenidoMd);
    } catch (err) {
      next(err);
    }
  });

//analitica
  app.get('/analitica/clases-mas-vistas', authenticate, async (req, res, next) => {
    try {
      const semana = (req.query.semana as string | undefined) ?? '';
      const limite = Number(req.query.limite ?? 0);
      const result = await analiticaGrpc.clasesMasVistas({
        semana,
        limite: Number.isFinite(limite) && limite > 0 ? limite : 0,
      });
      res.json({ semana: result.semana, items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.get('/analitica/tendencias-examenes', authenticate, async (req, res, next) => {
    try {
      const limite = Number(req.query.limite ?? 0);
      const desde = req.query.desde ? String(req.query.desde) : undefined;
      const hasta = req.query.hasta ? String(req.query.hasta) : undefined;
      const result = await analiticaGrpc.tendenciasExamenes({
        limite: Number.isFinite(limite) && limite > 0 ? limite : 0,
        desde,
        hasta,
      });
      res.json({ semana: result.semana || '', items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.get('/analitica/ranking-mejor-valoradas', authenticate, async (req, res, next) => {
    try {
      const limite = Number(req.query.limite ?? 0);
      const result = await analiticaGrpc.rankingMejorValoradas({
        limite: Number.isFinite(limite) && limite > 0 ? limite : 0,
      });
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.get('/analitica/recomendaciones/me', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const limite = Number(req.query.limite ?? 0);
      const userId = req.context!.userId;
      const result = await analiticaGrpc.recomendacionesEstudiante({
        estudianteId: userId,
        limite: Number.isFinite(limite) && limite > 0 ? limite : 0,
      });

      const items = result.items ?? [];
      if (items.length === 0) { res.json({ items: [] }); return; }

      const etiquetasPreferidas = await _obtenerEtiquetasPreferidas(userId, {
        reproductionGrpc,
        catalogGrpc,
      });
      if (etiquetasPreferidas.size === 0) {
        res.json({ items }); return;
      }

      const etiquetasPorClase = await _obtenerEtiquetasClases(
        items.map((i: any) => String(i.claseId)),
        catalogGrpc,
      );

      const boostMax = 30;
      const itemsEnriquecidos = items.map((item: any) => {
        const claseId = String(item.claseId);
        const etiquetas = etiquetasPorClase[claseId] ?? [];
        let overlap = 0;
        for (const et of etiquetas) {
          if (etiquetasPreferidas.has(et)) overlap++;
        }
        const affinity = etiquetas.length > 0 ? overlap / etiquetas.length : 0;
        const porcentajeOriginal = Number(item.porcentajeRecomendacion) || 0;
        const porcentajeEnriquecido = Math.min(100, Math.round(porcentajeOriginal + affinity * boostMax));
        return {
          claseId,
          porcentajeRecomendacion: porcentajeEnriquecido,
          porcentajeOriginal,
          etiquetas,
          etiquetasPreferidas: etiquetas.filter((e: string) => etiquetasPreferidas.has(e)),
          totalVistas: item.totalVistas,
          promedioCalificacion: item.promedioCalificacion,
          fechaCalculo: item.fechaCalculo,
        };
      });

      itemsEnriquecidos.sort((a: any, b: any) => b.porcentajeRecomendacion - a.porcentajeRecomendacion);

      res.json({ items: itemsEnriquecidos });
    } catch (err) {
      next(err);
    }
  });

  app.post('/analitica/sincronizar/vista', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { claseId, duracionVista } = req.body as Record<string, unknown>;
      if (typeof claseId !== 'string' || typeof duracionVista !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'claseId y duracionVista son obligatorios', 400);
      }
      const result = await analiticaGrpc.sincronizarVista({
        claseId,
        estudianteId: req.context!.userId,
        duracionVista,
      });
      res.status(201).json({ message: 'Vista registrada en analítica', registrada: result.registrada });
    } catch (err) {
      next(err);
    }
  });

  app.post('/analitica/sincronizar/calificacion', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const { claseId, puntuacion } = req.body as Record<string, unknown>;
      if (typeof claseId !== 'string' || typeof puntuacion !== 'number' || puntuacion < 1 || puntuacion > 5) {
        throw new DomainError('ENTRADA_INVALIDA', 'claseId y puntuacion (1-5) son obligatorios', 400);
      }
      const result = await analiticaGrpc.sincronizarCalificacion({
        claseId,
        estudianteId: req.context!.userId,
        puntuacion,
      });
      res.status(201).json({ message: 'Calificación sincronizada con analítica', registrada: result.registrada });
    } catch (err) {
      next(err);
    }
  });

  // [INGESTA DESACTIVADA] carga masiva CSV
  // app.post('/analitica/csv', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
  //   try {
  //     const { contenido, reemplazar } = req.body as Record<string, unknown>;
  //     if (typeof contenido !== 'string' || contenido.length === 0) {
  //       throw new DomainError('ENTRADA_INVALIDA', 'contenido CSV es obligatorio', 400);
  //     }
  //     const result = await analiticaGrpc.cargarEventosCSV({
  //       contenido,
  //       reemplazar: Boolean(reemplazar),
  //     });
  //     res.status(201).json({
  //       message: 'Carga masiva CSV procesada',
  //       registrosCargados: result.registrosCargados,
  //       registrosOmitidos: result.registrosOmitidos,
  //     });
  //   } catch (err) {
  //     next(err);
  //   }
  // });

  app.post('/analitica/tendencias/recalcular', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const semana = (req.body as Record<string, unknown>).semana as string | undefined;
      const result = await analiticaGrpc.recalcularTendencias({ semana: semana ?? '' });
      res.json({ message: 'Tendencias recalculadas', recalculada: result.recalculada });
    } catch (err) {
      next(err);
    }
  });

//inscripcion
  app.get('/inscripcion/panel/me', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const estudianteId = req.context!.roles?.includes('ROLE_ADMIN')
        ? (req.query.estudianteId as string | undefined) ?? req.context!.userId
        : req.context!.userId;
      const result = await inscripcionGrpc.consultarPanelEstudiante(estudianteId);
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.get('/inscripcion/cursos-catedratico', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN', 'ROLE_AUXILIAR'), async (req, res, next) => {
    try {
      const catedraticoId = req.context!.roles?.includes('ROLE_ADMIN')
        ? (req.query.catedraticoId as string | undefined) ?? req.context!.userId
        : req.context!.userId;
      const result = await inscripcionGrpc.consultarCursosCatedratico(catedraticoId);
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.get('/inscripcion/estado-matricula/:cursoId', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const result = await inscripcionGrpc.consultarEstadoMatricula(
        req.context!.userId,
        req.params.cursoId,
      );
      res.json({ estado: result.estado });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/cursos', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { codigo, nombre, escuela, semestre, anio } = req.body as Record<string, unknown>;
      if (typeof codigo !== 'string' || typeof nombre !== 'string' || typeof escuela !== 'string' || typeof semestre !== 'string' || typeof anio !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'codigo, nombre, escuela, semestre y anio son obligatorios', 400);
      }
      const result = await inscripcionGrpc.registrarCurso({ codigo, nombre, escuela, semestre, anio });
      res.status(201).json({ message: 'Curso registrado', curso: result.curso });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/docentes', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { usuarioId } = req.body as Record<string, unknown>;
      if (typeof usuarioId !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'usuarioId es obligatorio', 400);
      }
      const result = await inscripcionGrpc.registrarDocente(usuarioId);
      res.status(201).json({ message: 'Docente registrado', docenteId: result.docenteId });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/auxiliares', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { usuarioId } = req.body as Record<string, unknown>;
      if (typeof usuarioId !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'usuarioId es obligatorio', 400);
      }
      const result = await inscripcionGrpc.registrarAuxiliar(usuarioId);
      res.status(201).json({ message: 'Auxiliar registrado', auxiliarId: result.auxiliarId });
    } catch (err) {
      next(err);
    }
  });

  app.get('/inscripcion/cursos', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_CATEDRATICO', 'ROLE_ADMIN'), async (_req, res, next) => {
    try {
      const result = await inscripcionGrpc.listarCursos();
      res.json({ cursos: result.cursos });
    } catch (err) {
      next(err);
    }
  });

  app.get('/inscripcion/docentes', authenticate, requireRole('ROLE_ADMIN'), async (_req, res, next) => {
    try {
      const result = await inscripcionGrpc.listarDocentes();
      res.json({ docentes: result.docentes });
    } catch (err) {
      next(err);
    }
  });

  app.get('/inscripcion/auxiliares', authenticate, requireRole('ROLE_ADMIN'), async (_req, res, next) => {
    try {
      const result = await inscripcionGrpc.listarAuxiliares();
      res.json({ auxiliares: result.auxiliares });
    } catch (err) {
      next(err);
    }
  });

  app.get('/inscripcion/asignaciones', authenticate, requireRole('ROLE_ADMIN'), async (_req, res, next) => {
    try {
      const result = await inscripcionGrpc.listarAsignaciones();
      res.json({ asignaciones: result.asignaciones });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/inscripciones/auto', authenticate, requireRole('ROLE_ESTUDIANTE'), async (req, res, next) => {
    try {
      const { cursoId, semestre } = req.body as Record<string, unknown>;
      if (typeof cursoId !== 'string' || typeof semestre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'cursoId y semestre son obligatorios', 400);
      }
      const result = await inscripcionGrpc.inscribirEstudiante({
        estudianteId: req.context!.userId,
        cursoId,
        semestre,
      });
      res.status(201).json({
        message: 'Inscripción registrada',
        inscripcionId: result.inscripcionId,
        estadoMatricula: result.estadoMatricula,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/estudiantes/:estudianteId/cursos/:cursoId', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { semestre } = req.body as Record<string, unknown>;
      if (typeof semestre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'semestre es obligatorio', 400);
      }
      const result = await inscripcionGrpc.inscribirEstudiante({
        estudianteId: req.params.estudianteId,
        cursoId: req.params.cursoId,
        semestre,
      });
      res.status(201).json({
        message: 'Estudiante inscrito',
        inscripcionId: result.inscripcionId,
        estadoMatricula: result.estadoMatricula,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/catedraticos/:docenteId/cursos/:cursoId', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { semestre } = req.body as Record<string, unknown>;
      if (typeof semestre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'semestre es obligatorio', 400);
      }
      const result = await inscripcionGrpc.asignarCatedraticoCurso({
        docenteId: req.params.docenteId,
        cursoId: req.params.cursoId,
        semestre,
      });
      res.status(201).json({ message: 'Catedrático asignado al curso', asignacionId: result.asignacionId });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/cursos/:cursoId/docente', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { usuarioId, semestre } = req.body as Record<string, unknown>;
      if (typeof usuarioId !== 'string' || typeof semestre !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'usuarioId y semestre son obligatorios', 400);
      }
      const { docenteId } = await inscripcionGrpc.registrarDocente(usuarioId);
      const { asignacionId } = await inscripcionGrpc.asignarCatedraticoCurso({
        docenteId,
        cursoId: req.params.cursoId,
        semestre,
      });

      // Asegura que el curso exista también en el catálogo para que el docente
      // pueda publicar clases; si no está registrado ahí, se crea automáticamente.
      const cursos = await inscripcionGrpc.listarCursos();
      const curso = cursos.cursos.find((c: { cursoId: string }) => c.cursoId === req.params.cursoId);
      if (curso) {
        try {
          await catalogGrpc.obtenerCursoPorCodigo(curso.codigo);
        } catch (err) {
          if (err instanceof GrpcError && err.grpcCode === 5) {
            await catalogGrpc.registrarCurso({
              codigo: curso.codigo,
              nombre: curso.nombre,
              escuela: curso.escuela,
            });
          } else {
            throw err;
          }
        }
      }

      res.status(201).json({
        message: 'Docente registrado y asignado al curso',
        docenteId,
        asignacionId,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/inscripcion/auxiliares/:auxiliarId/asignaciones/:asignacionDocenteId', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const result = await inscripcionGrpc.asignarAuxiliarCatedratico({
        auxiliarId: req.params.auxiliarId,
        asignacionDocenteId: req.params.asignacionDocenteId,
      });
      res.status(201).json({ message: 'Auxiliar vinculado al catedrático', asignacionAuxiliarId: result.asignacionAuxiliarId });
    } catch (err) {
      next(err);
    }
  });

  // ===== Notificaciones por correo (módulo 6) =====

  // CDU0006.3 - Aviso general del sistema: el administrador envía un correo a
  // todos los estudiantes (o a una lista concreta de destinatarios).
  app.post('/notificaciones/avisos', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { mensaje, destinatarioIds } = req.body as { mensaje?: unknown; destinatarioIds?: unknown };
      if (typeof mensaje !== 'string' || mensaje.trim().length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'mensaje es obligatorio', 400);
      }
      const ids = Array.isArray(destinatarioIds) ? destinatarioIds.filter((d): d is string => typeof d === 'string') : [];
      const result = await notificacionesGrpc.registrarAvisoGeneral({ mensaje, destinatarioIds: ids });
      res.status(201).json({
        message: 'Aviso encolado para envío por correo',
        destinatarioIds: result.destinatarioIds,
        notificacionesEncoladas: result.notificacionesEncoladas,
      });
    } catch (err) {
      next(err);
    }
  });

  // Bandeja de notificaciones del usuario autenticado.
  app.get('/notificaciones/me', authenticate, async (req, res, next) => {
    try {
      const result = await notificacionesGrpc.listarNotificaciones(req.context!.userId);
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.get('/notificaciones/plantillas', authenticate, requireRole('ROLE_ADMIN'), async (_req, res, next) => {
    try {
      const result = await notificacionesGrpc.listarPlantillas();
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  // Estado de la cola de envío (operaciones / diagnóstico).
  app.get('/notificaciones/cola', authenticate, requireRole('ROLE_ADMIN'), async (_req, res, next) => {
    try {
      const result = await notificacionesGrpc.consultarCola();
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'RUTA_NO_ENCONTRADA', message: `${req.method} ${req.path}` } });
  });

  app.use(errorHandler);

  return app;
}

async function _obtenerEtiquetasPreferidas(
  userId: string,
  clients: {
    reproductionGrpc: typeof defaultReproductionGrpc;
    catalogGrpc: typeof defaultCatalogGrpc;
  } = { reproductionGrpc: defaultReproductionGrpc, catalogGrpc: defaultCatalogGrpc },
): Promise<Set<string>> {
  const preferidas = new Set<string>();
  try {
    const historial = await clients.reproductionGrpc.historialReciente({ estudianteId: userId });
    const items = historial.items ?? [];
    const clasesIds = [...new Set<string>(items.map((i: any) => String(i.claseId)))];
    const consultas = clasesIds.map(async (claseId: string) => {
      try {
        const clase = await clients.catalogGrpc.getClase(claseId);
        const etiquetas: string[] = clase.clase?.etiquetas ?? [];
        for (const e of etiquetas) preferidas.add(e.toLowerCase());
      } catch {}
    });
    await Promise.all(consultas);
  } catch {}
  return preferidas;
}

async function _obtenerEtiquetasClases(
  claseIds: string[],
  client: typeof defaultCatalogGrpc = defaultCatalogGrpc,
): Promise<Record<string, string[]>> {
  const resultado: Record<string, string[]> = {};
  const consultas = claseIds.map(async (claseId) => {
    try {
      const clase = await client.getClase(claseId);
      resultado[claseId] = (clase.clase?.etiquetas ?? []).map((e: string) => e.toLowerCase());
    } catch {
      resultado[claseId] = [];
    }
  });
  await Promise.all(consultas);
  return resultado;
}

export function listenGateway(app: Express): ReturnType<typeof app.listen> {
  return app.listen(config.PORT, () => {
    console.log(`[api-gateway] HTTP escuchando en http://localhost:${config.PORT}`);
    console.log(`[api-gateway] gRPC -> auth-service en ${config.AUTH_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> catalog-service en ${config.CATALOG_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> reproduccion-service en ${config.REPRODUCTION_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> analitica-service en ${config.ANALITICA_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> inscripcion-service en ${config.INSCRIPCION_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> notificaciones-service en ${config.NOTIFICACIONES_GRPC_ADDR}`);
  });
}
