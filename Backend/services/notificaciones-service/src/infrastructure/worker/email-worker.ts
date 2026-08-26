import { config } from '../../config/env';
import { NotificacionService } from '../../application/services/notificacion.service';
import { EmailSender } from '../../application/ports/email-sender';

export type EmailQueueService = Pick<
  NotificacionService,
  'obtenerPendientes' | 'marcarEnviada' | 'registrarIntentoFallido' | 'marcarFallidaDefinitiva'
>;

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

/**
 * Procesa vw_notificaciones_pendientes: por cada fila envía el correo con
 * nodemailer, marca la notificación como ENVIADA o registra el intento
 * fallido (el trigger fn_trg_reintento_fallido re-encola con backoff).
 * Si se supera MAX_INTENTOS la cola pasa a FALLIDA_DEFINITIVA.
 */
export class EmailWorker {
  private timer: NodeJS.Timeout | null = null;
  private procesando = false;

  constructor(
    private readonly notificacionService: EmailQueueService,
    private readonly emailSender: EmailSender,
  ) {}

  start(): void {
    console.log(
      `[notificaciones-service] worker de cola iniciado (intervalo=${config.WORKER_INTERVAL_MS}ms, max_intentos=${config.MAX_INTENTOS})`,
    );
    this.timer = setInterval(() => void this.ejecutarCiclo(), config.WORKER_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ejecutarCiclo(): Promise<void> {
    if (this.procesando) return;
    this.procesando = true;
    try {
      const pendientes = await this.notificacionService.obtenerPendientes(
        50,
        config.MAX_INTENTOS,
      );
      for (const item of pendientes) {
        await this.procesarItem(item);
      }
    } catch (err) {
      console.error('[notificaciones-service] error en el ciclo del worker:', err);
    } finally {
      this.procesando = false;
    }
  }

  private async procesarItem(item: {
    notificacionId: string;
    correoDestino: string;
    colaId: number;
    intentos: number;
    contenido: string;
  }): Promise<void> {
    const { asunto, cuerpo } = separarContenido(item.contenido);
    try {
      await this.emailSender.enviar({
        to: item.correoDestino,
        subject: asunto,
        body: cuerpo,
      });
      await this.notificacionService.marcarEnviada(item.notificacionId);
    } catch (err: any) {
      const mensaje = err?.message ?? 'Error de envío';
      console.error(
        `[notificaciones-service] envío fallido para ${item.correoDestino} (cola=${item.colaId}): ${mensaje}`,
      );
      await this.notificacionService.registrarIntentoFallido(item.colaId, mensaje.slice(0, 500));
      if (item.intentos + 1 >= config.MAX_INTENTOS) {
        await this.notificacionService.marcarFallidaDefinitiva(item.colaId);
      }
    }
  }
}
