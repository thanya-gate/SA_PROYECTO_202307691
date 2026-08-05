import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { config } from './config/env';
import { authGrpc } from './grpc/auth-client';
import { catalogGrpc } from './grpc/catalog-client';
import { reproductionGrpc } from './grpc/reproduction-client';
import { analiticaGrpc } from './grpc/analitica-client';
import { DomainError } from './domain/domain-error';
import { setSessionCookie, clearSessionCookie } from './utils/cookies';
import { authenticate } from './middleware/authenticate';
import { requireRole, requireAnyRole } from './middleware/requireRole';
import { domainGuard } from './middleware/domain-guard';
import { errorHandler } from './middleware/error-handler';
import { createIdpRouter, buildIdpLoginUri } from './mock-idp';

const cookieMaxAge = config.SESSION_TTL_MS;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function publicUser(u: {
  userId: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
}) {
  return {
    userId: u.userId,
    email: u.email,
    emailVerified: u.emailVerified,
    roles: u.roles,
    carnet: u.carnet ?? null,
    dpi: u.dpi ?? null,
    fechaNacimiento: u.fechaNacimiento ?? null,
  };
}

function toProtoRole(role: string): string {
  const normalized = role.trim().toUpperCase();
  return normalized.startsWith('ROLE_') ? normalized : `ROLE_${normalized}`;
}

export function createGateway(): Express {
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
    res.json({
      status: 'ok',
      service: 'api-gateway',
      version: '1.0.0',
      authService: authStatus,
      catalogService: catalogStatus,
      reproductionService: reproductionStatus,
      analiticaService: analiticaStatus,
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
      const result = await authGrpc.register({
        email: String(email),
        password,
        confirmPassword: String(confirmPassword),
        carnet: String(carnet ?? ''),
        dpi: String(dpi ?? ''),
        fechaNacimiento: String(fechaNacimiento ?? ''),
        rol: normalizedRol,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, result.accessToken, cookieMaxAge);
      res.status(201).json({
        message: 'Cuenta creada. Revisa tu correo para confirmar el registro.',
        user: publicUser(result.user),
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
      res.json({
        message: 'Sesión iniciada',
        user: publicUser(result.user),
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
      res.json({ user: publicUser(result.user), sessionId: result.sessionId });
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
      const { email, state, roles } = req.body as { email?: string; state?: string; roles?: string[] };
      if (!email) {
        throw new DomainError('ENTRADA_INVALIDA', 'Correo requerido', 400);
      }
      const protoRoles = (roles ?? []).map(toProtoRole);
      const loginUri = buildIdpLoginUri({
        email: String(email).trim().toLowerCase(),
        state: typeof state === 'string' ? state : '',
        roles: protoRoles,
      });
      res.json({ login_uri: loginUri });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/oauth/callback', async (req, res, next) => {
    try {
      const { code } = req.body as Record<string, unknown>;
      if (typeof code !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Código OAuth requerido', 400);
      }
      const result = await authGrpc.oauthCallback(code, req.ip, req.headers['user-agent']);
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
      const result = await catalogGrpc.search({
        semestre: semestre ?? '',
        escuela: escuela ?? '',
        curso: curso ?? '',
        catedratico: catedratico ?? '',
        tema: tema ?? '',
      });
      res.json({ resultados: result.resultados });
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

  app.get('/catalog/semestres', authenticate, async (req, res, next) => {
    try {
      const semestre = (req.query.semestre as string | undefined) ?? '';
      const result = await catalogGrpc.listarPorSemestre(semestre);
      res.json({ semestres: result.semestres });
    } catch (err) {
      next(err);
    }
  });

  app.post('/catalog/classes', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (typeof body.cursoId !== 'string' || typeof body.semestre !== 'string' || typeof body.urlVideo !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'cursoId, semestre y urlVideo son obligatorios', 400);
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
        urlVideo: body.urlVideo,
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

  app.post('/catalog/classes/:claseId/video', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN'), async (req, res, next) => {
    const claseId = req.params.claseId;
    const targetPath = path.join(config.MEDIA_DIR, 'clases', `${claseId}.mp4`);
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (!contentLength || contentLength > MAX_VIDEO_BYTES) {
      return next(new DomainError('ENTRADA_INVALIDA', 'El archivo debe pesar entre 1 byte y 500 MB', 400));
    }
    try {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(targetPath);
        out.on('error', reject);
        out.on('close', resolve);
        req.on('error', reject);
        req.pipe(out);
      });
      const urlVideo = `/media/clases/${claseId}.mp4`;
      const result = await catalogGrpc.actualizarUrlVideo(claseId, urlVideo);
      res.status(201).json({ message: 'Video subido a la plataforma', urlVideo, clase: result.clase });
    } catch (err) {
      await fs.promises.rm(targetPath, { force: true }).catch(() => {});
      next(err);
    }
  });

  app.post('/catalog/classes/:claseId/video-url', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { urlVideo } = req.body as Record<string, unknown>;
      if (typeof urlVideo !== 'string' || !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(urlVideo)) {
        throw new DomainError('ENTRADA_INVALIDA', 'urlVideo debe ser una URL de YouTube válida (http/https)', 400);
      }
      const result = await catalogGrpc.actualizarUrlVideo(req.params.claseId, urlVideo);
      res.json({ message: 'URL de video actualizada', clase: result.clase });
    } catch (err) {
      next(err);
    }
  });

//reproduccion
  app.post('/reproduccion/checkpoint', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { claseId, segundoActual, duracion } = req.body as Record<string, unknown>;
      if (typeof claseId !== 'string' || typeof segundoActual !== 'number' || typeof duracion !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'claseId, segundoActual y duracion son obligatorios', 400);
      }
      const result = await reproductionGrpc.guardarCheckpoint({
        estudianteId: req.context!.userId,
        claseId,
        segundoActual,
        duracion,
      });
      res.json({
        message: 'Checkpoint guardado',
        historialId: result.historialId,
        porcentajeAvance: result.porcentajeAvance,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/reproduccion/checkpoint/:claseId', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
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

  app.get('/reproduccion/historial', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
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

  app.post('/reproduccion/calificaciones', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { historialId, puntuacion, comentario } = req.body as Record<string, unknown>;
      if (typeof historialId !== 'string' || typeof puntuacion !== 'number') {
        throw new DomainError('ENTRADA_INVALIDA', 'historialId y puntuacion son obligatorios', 400);
      }
      const result = await reproductionGrpc.registrarCalificacion({
        historialId,
        puntuacion,
        comentario: typeof comentario === 'string' ? comentario : '',
      });
      res.status(201).json({ message: 'Calificación registrada', registrada: result.registrada });
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
      const result = await analiticaGrpc.tendenciasExamenes({
        limite: Number.isFinite(limite) && limite > 0 ? limite : 0,
      });
      res.json({ items: result.items });
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

  app.get('/analitica/recomendaciones/me', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const limite = Number(req.query.limite ?? 0);
      const result = await analiticaGrpc.recomendacionesEstudiante({
        estudianteId: req.context!.userId,
        limite: Number.isFinite(limite) && limite > 0 ? limite : 0,
      });
      res.json({ items: result.items });
    } catch (err) {
      next(err);
    }
  });

  app.post('/analitica/sincronizar/vista', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
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

  app.post('/analitica/sincronizar/calificacion', authenticate, requireAnyRole('ROLE_ESTUDIANTE', 'ROLE_ADMIN'), async (req, res, next) => {
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

  app.post('/analitica/csv', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const { contenido, reemplazar } = req.body as Record<string, unknown>;
      if (typeof contenido !== 'string' || contenido.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'contenido CSV es obligatorio', 400);
      }
      const result = await analiticaGrpc.cargarEventosCSV({
        contenido,
        reemplazar: Boolean(reemplazar),
      });
      res.status(201).json({
        message: 'Carga masiva CSV procesada',
        registrosCargados: result.registrosCargados,
        registrosOmitidos: result.registrosOmitidos,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/analitica/tendencias/recalcular', authenticate, requireAnyRole('ROLE_CATEDRATICO', 'ROLE_ADMIN'), async (req, res, next) => {
    try {
      const semana = (req.body as Record<string, unknown>).semana as string | undefined;
      const result = await analiticaGrpc.recalcularTendencias({ semana: semana ?? '' });
      res.json({ message: 'Tendencias recalculadas', recalculada: result.recalculada });
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

export function listenGateway(app: Express): ReturnType<typeof app.listen> {
  return app.listen(config.PORT, () => {
    console.log(`[api-gateway] HTTP escuchando en http://localhost:${config.PORT}`);
    console.log(`[api-gateway] gRPC -> auth-service en ${config.AUTH_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> catalog-service en ${config.CATALOG_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> reproduccion-service en ${config.REPRODUCTION_GRPC_ADDR}`);
    console.log(`[api-gateway] gRPC -> analitica-service en ${config.ANALITICA_GRPC_ADDR}`);
  });
}
