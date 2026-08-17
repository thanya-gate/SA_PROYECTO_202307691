import { query } from './db';
import { DomainError } from '../../../domain/errors/domain-error';
import {
  NotificacionRepository,
  RegistrarNotificacionInput,
} from '../../../application/ports/notificacion-repository';
import {
  ColaItem,
  NotificacionItem,
  NotificacionRegistrada,
  PendienteEnvio,
  PlantillaItem,
} from '../../../domain/entities/notificacion';

interface NotificacionRow {
  id: string;
  tipo: string;
  contenido: string;
  estado: string;
  fecha_creacion: Date;
  fecha_envio: Date | null;
}

interface PlantillaRow {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  tipo: string;
}

interface ColaRow {
  cola_id: number;
  notificacion_id: string;
  correo_destino: string;
  intentos: number;
  estado: string;
  ultimo_error: string | null;
  fecha_proximo_intento: Date | null;
  contenido: string;
}

interface PendienteRow {
  notificacion_id: string;
  correo_destino: string;
  tipo: string;
  datos_contexto: Record<string, unknown>;
  cola_id: number;
  intentos: number;
  contenido: string;
}

function separarContenido(contenido: string): { asunto: string; cuerpo: string } {
  const salto = contenido.indexOf('\n');
  if (salto === -1) {
    return { asunto: contenido, cuerpo: '' };
  }
  return {
    asunto: contenido.slice(0, salto),
    cuerpo: contenido.slice(salto + 1),
  };
}

export class PostgresNotificacionRepository implements NotificacionRepository {
  async registrarNotificacion(
    input: RegistrarNotificacionInput,
  ): Promise<NotificacionRegistrada> {
    const plantilla = await query<{ id: string }>(
      'SELECT id FROM plantilla_correo WHERE nombre = $1',
      [input.plantilla],
    );
    if (plantilla.rows.length === 0) {
      throw new DomainError('PLANTILLA_NO_ENCONTRADA', `Plantilla ${input.plantilla} no encontrada`, 404);
    }
    const res = await query<{ p_notificacion_id: string }>(
      'CALL sp_registrar_notificacion(NULL, $1, $2, $3, $4, $5)',
      [
        input.usuarioId,
        input.correoDestino,
        plantilla.rows[0].id,
        input.tipo,
        JSON.stringify(input.datosContexto),
      ],
    );
    return { notificacionId: res.rows[0]?.p_notificacion_id ?? '' };
  }

  async listarNotificaciones(usuarioId: string, limite: number): Promise<NotificacionItem[]> {
    const res = await query<NotificacionRow>(
      `SELECT
         n.id,
         n.tipo,
         fn_renderizar_plantilla(n.plantilla_id, n.datos_contexto) AS contenido,
         n.estado,
         n.fecha_creacion,
         n.fecha_envio
       FROM notificacion n
       WHERE n.usuario_id = $1
       ORDER BY n.fecha_creacion DESC
       LIMIT $2`,
      [usuarioId, limite],
    );
    return res.rows.map((r) => {
      const { asunto, cuerpo } = separarContenido(r.contenido);
      return {
        id: r.id,
        tipo: r.tipo,
        asunto,
        cuerpo,
        estado: r.estado,
        fechaCreacion: r.fecha_creacion.toISOString(),
        fechaEnvio: r.fecha_envio ? r.fecha_envio.toISOString() : null,
      };
    });
  }

  async listarPlantillas(): Promise<PlantillaItem[]> {
    const res = await query<PlantillaRow>(
      'SELECT id, nombre, asunto, cuerpo, tipo FROM plantilla_correo ORDER BY nombre ASC',
    );
    return res.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      asunto: r.asunto,
      cuerpo: r.cuerpo,
      tipo: r.tipo,
    }));
  }

  async consultarCola(limite: number): Promise<ColaItem[]> {
    const res = await query<ColaRow>(
      `SELECT
         ce.id AS cola_id,
         ce.notificacion_id,
         n.correo_destino,
         ce.intentos,
         ce.estado,
         ce.ultimo_error,
         ce.fecha_proximo_intento,
         fn_renderizar_plantilla(n.plantilla_id, n.datos_contexto) AS contenido
       FROM cola_envio ce
       JOIN notificacion n ON n.id = ce.notificacion_id
       ORDER BY ce.id DESC
       LIMIT $1`,
      [limite],
    );
    return res.rows.map((r) => ({
      colaId: r.cola_id,
      notificacionId: r.notificacion_id,
      correoDestino: r.correo_destino,
      intentos: r.intentos,
      estado: r.estado,
      ultimoError: r.ultimo_error,
      fechaProximoIntento: r.fecha_proximo_intento
        ? r.fecha_proximo_intento.toISOString()
        : null,
      contenido: r.contenido,
    }));
  }

  async obtenerPendientes(limite: number, maxIntentos: number): Promise<PendienteEnvio[]> {
    const res = await query<PendienteRow>(
      `SELECT
         notificacion_id,
         correo_destino,
         tipo,
         datos_contexto,
         cola_id,
         intentos,
         contenido
       FROM vw_notificaciones_pendientes
       WHERE intentos < $2
       LIMIT $1`,
      [limite, maxIntentos],
    );
    return res.rows.map((r) => ({
      notificacionId: r.notificacion_id,
      correoDestino: r.correo_destino,
      tipo: r.tipo,
      datosContexto: r.datos_contexto,
      colaId: r.cola_id,
      intentos: r.intentos,
      contenido: r.contenido,
    }));
  }

  async marcarEnviada(notificacionId: string): Promise<void> {
    await query('CALL sp_marcar_enviada($1)', [notificacionId]);
  }

  async registrarIntentoFallido(colaId: number, error: string): Promise<void> {
    await query('CALL sp_registrar_intento_fallido($1, $2)', [colaId, error]);
  }

  async marcarFallidaDefinitiva(colaId: number): Promise<void> {
    await query('CALL sp_marcar_fallida_definitiva($1)', [colaId]);
  }
}
