import { z, ZodError } from 'zod';
import { DomainError } from '../../domain/errors/domain-error';
import {
  ColaItem,
  NotificacionItem,
  NotificacionRegistrada,
  PendienteEnvio,
  PlantillaItem,
} from '../../domain/entities/notificacion';
import {
  NotificacionRepository,
  RegistrarNotificacionInput,
} from '../ports/notificacion-repository';
import { AuthGrpcClient, UsuarioInfo } from '../ports/auth-grpc-client';
import { InscripcionGrpcClient } from '../ports/inscripcion-grpc-client';
import { registrarNotificacionSchema, notificarNuevaClaseSchema, registrarAvisoGeneralSchema } from '../dto/notificacion-schemas';

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new DomainError('ENTRADA_INVALIDA', 'Datos de entrada inválidos', 400, err.flatten().fieldErrors);
    }
    throw err;
  }
}

export interface NotificarNuevaClaseResult {
  destinatarioIds: string[];
  notificacionesEncoladas: number;
}

export interface RegistrarAvisoGeneralResult {
  destinatarioIds: string[];
  notificacionesEncoladas: number;
}

export class NotificacionService {
  constructor(
    private readonly repository: NotificacionRepository,
    private readonly authClient: AuthGrpcClient,
    private readonly inscripcionClient: InscripcionGrpcClient,
  ) {}

  async registrarNotificacion(raw: RegistrarNotificacionInput): Promise<NotificacionRegistrada> {
    const input = parse(registrarNotificacionSchema, raw);
    return this.repository.registrarNotificacion(input);
  }

  async notificarNuevaClase(raw: {
    cursoId: string;
    codigo: string;
    curso: string;
    semestre: string;
    anio: number;
    tema: string;
  }): Promise<NotificarNuevaClaseResult> {
    const input = parse(notificarNuevaClaseSchema, raw);

    const cursoIdInscripcion = await this.resolverCursoIdInscripcion(input.codigo, input.cursoId);
    const estudianteIds = await this.inscripcionClient.listarEstudiantesDeCurso(
      cursoIdInscripcion,
      input.semestre,
    );
    const destinatarios = await this.obtenerUsuarios(estudianteIds);
    const destinatarioIds = destinatarios.map((u) => u.usuarioId);

    return { destinatarioIds, notificacionesEncoladas: 0 };
  }

  async notificarVideoSubido(raw: {
    cursoId: string;
    codigo: string;
    curso: string;
    semestre: string;
    anio: number;
    tema: string;
  }): Promise<NotificarNuevaClaseResult> {
    const input = parse(notificarNuevaClaseSchema, raw);

    const cursoIdInscripcion = await this.resolverCursoIdInscripcion(input.codigo, input.cursoId);
    const estudianteIds = await this.inscripcionClient.listarEstudiantesDeCurso(
      cursoIdInscripcion,
      input.semestre,
    );
    const destinatarios = await this.obtenerUsuarios(estudianteIds);
    const destinatarioIds = destinatarios.map((u) => u.usuarioId);

    let encoladas = 0;
    for (const usuario of destinatarios) {
      await this.repository.registrarNotificacion({
        usuarioId: usuario.usuarioId,
        correoDestino: usuario.email,
        plantilla: 'video_subido',
        tipo: 'VIDEO_SUBIDO',
        datosContexto: {
          codigo: input.codigo,
          curso: input.curso,
          tema: input.tema,
          semestre: input.semestre,
        },
      });
      encoladas += 1;
    }

    return { destinatarioIds, notificacionesEncoladas: encoladas };
  }

  async registrarAvisoGeneral(raw: {
    mensaje: string;
    destinatarioIds?: string[];
  }): Promise<RegistrarAvisoGeneralResult> {
    const input = parse(registrarAvisoGeneralSchema, raw);

    const destinatarios =
      input.destinatarioIds.length > 0
        ? await this.obtenerUsuarios(input.destinatarioIds)
        : await this.authClient.listarEstudiantes();
    const destinatarioIds = destinatarios.map((u) => u.usuarioId);

    let encoladas = 0;
    for (const usuario of destinatarios) {
      await this.repository.registrarNotificacion({
        usuarioId: usuario.usuarioId,
        correoDestino: usuario.email,
        plantilla: 'aviso_general',
        tipo: 'AVISO',
        datosContexto: {
          nombre: `${usuario.nombres} ${usuario.apellidos}`.trim(),
          mensaje: input.mensaje,
        },
      });
      encoladas += 1;
    }

    return { destinatarioIds, notificacionesEncoladas: encoladas };
  }

  async listarNotificaciones(usuarioId: string, limite = 50): Promise<NotificacionItem[]> {
    if (!usuarioId) {
      throw new DomainError('ENTRADA_INVALIDA', 'usuarioId es obligatorio', 400);
    }
    return this.repository.listarNotificaciones(usuarioId, limite);
  }

  async listarPlantillas(): Promise<PlantillaItem[]> {
    return this.repository.listarPlantillas();
  }

  async consultarCola(limite = 100): Promise<ColaItem[]> {
    return this.repository.consultarCola(limite);
  }

  async obtenerPendientes(limite: number, maxIntentos: number): Promise<PendienteEnvio[]> {
    return this.repository.obtenerPendientes(limite, maxIntentos);
  }

  async marcarEnviada(notificacionId: string): Promise<void> {
    return this.repository.marcarEnviada(notificacionId);
  }

  async registrarIntentoFallido(colaId: number, error: string): Promise<void> {
    return this.repository.registrarIntentoFallido(colaId, error);
  }

  async marcarFallidaDefinitiva(colaId: number): Promise<void> {
    return this.repository.marcarFallidaDefinitiva(colaId);
  }

  private async obtenerUsuarios(usuarioIds: string[]): Promise<UsuarioInfo[]> {
    const unicos = [...new Set(usuarioIds)];
    const resultados = await Promise.all(
      unicos.map(async (id) => {
        try {
          return await this.authClient.obtenerUsuario(id);
        } catch {
          return null;
        }
      }),
    );
    return resultados.filter((u): u is UsuarioInfo => u !== null);
  }

  private async resolverCursoIdInscripcion(codigo: string, cursoIdCatalogo: string): Promise<string> {
    try {
      const cursos = await this.inscripcionClient.listarCursos();
      const encontrado = cursos.find((c) => c.codigo === codigo);
      if (encontrado) return encontrado.cursoId;
    } catch {
      // fallback to original id
    }
    return cursoIdCatalogo;
  }
}
