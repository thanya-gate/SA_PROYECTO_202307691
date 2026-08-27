import { EmailQueueService, EmailWorker } from '../src/infrastructure/worker/email-worker';
import { EmailSender } from '../src/application/ports/email-sender';
import { PendienteEnvio } from '../src/domain/entities/notificacion';

function makeService(): jest.Mocked<EmailQueueService> {
  return {
    obtenerPendientes: jest.fn().mockResolvedValue([]),
    marcarEnviada: jest.fn().mockResolvedValue(undefined),
    registrarIntentoFallido: jest.fn().mockResolvedValue(undefined),
    marcarFallidaDefinitiva: jest.fn().mockResolvedValue(undefined),
  };
}

function item(overrides: Partial<PendienteEnvio> = {}): PendienteEnvio {
  return {
    notificacionId: 'not-1',
    correoDestino: 'persona@ing.usac.edu.gt',
    tipo: 'AVISO',
    datosContexto: {},
    colaId: 7,
    intentos: 0,
    contenido: 'Asunto del correo\nCuerpo del correo',
    ...overrides,
  };
}

describe('EmailWorker', () => {
  test('envía el correo, separa asunto/cuerpo y marca la notificación enviada', async () => {
    const service = makeService();
    const sender: jest.Mocked<EmailSender> = { enviar: jest.fn().mockResolvedValue(undefined) };
    service.obtenerPendientes.mockResolvedValue([item()]);
    const worker = new EmailWorker(service, sender);

    await worker.ejecutarCiclo();

    expect(service.obtenerPendientes).toHaveBeenCalledWith(50, 5);
    expect(sender.enviar).toHaveBeenCalledWith({
      to: 'persona@ing.usac.edu.gt', subject: 'Asunto del correo', body: 'Cuerpo del correo',
    });
    expect(service.marcarEnviada).toHaveBeenCalledWith('not-1');
    expect(service.registrarIntentoFallido).not.toHaveBeenCalled();
  });

  test('registra el fallo y marca definitivamente el último intento', async () => {
    const service = makeService();
    const sender: jest.Mocked<EmailSender> = {
      enviar: jest.fn().mockRejectedValue(new Error('SMTP timeout')),
    };
    service.obtenerPendientes.mockResolvedValue([item({ intentos: 4, contenido: 'Solo asunto' })]);
    const worker = new EmailWorker(service, sender);

    await worker.ejecutarCiclo();

    expect(service.marcarEnviada).not.toHaveBeenCalled();
    expect(service.registrarIntentoFallido).toHaveBeenCalledWith(7, 'SMTP timeout');
    expect(service.marcarFallidaDefinitiva).toHaveBeenCalledWith(7);
  });

  test('reintenta fallos que aún no alcanzan el máximo y captura errores del ciclo', async () => {
    const service = makeService();
    const sender: jest.Mocked<EmailSender> = {
      enviar: jest.fn().mockRejectedValue(new Error('temporal')),
    };
    service.obtenerPendientes.mockResolvedValueOnce([item({ intentos: 0 })]);
    const worker = new EmailWorker(service, sender);

    await worker.ejecutarCiclo();

    expect(service.registrarIntentoFallido).toHaveBeenCalledWith(7, 'temporal');
    expect(service.marcarFallidaDefinitiva).not.toHaveBeenCalled();

    const error = new Error('cola no disponible');
    service.obtenerPendientes.mockRejectedValueOnce(error);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await worker.ejecutarCiclo();
      expect(log).toHaveBeenCalledWith(
        '[notificaciones-service] error en el ciclo del worker:',
        error,
      );
    } finally {
      log.mockRestore();
    }
  });

  test('no ejecuta dos ciclos simultáneos y puede iniciar/detener su intervalo', async () => {
    jest.useFakeTimers();
    try {
      const service = makeService();
      let liberar: (() => void) | undefined;
      service.obtenerPendientes.mockImplementationOnce(() => new Promise((resolve) => {
        liberar = () => resolve([]);
      }));
      const sender: jest.Mocked<EmailSender> = { enviar: jest.fn().mockResolvedValue(undefined) };
      const worker = new EmailWorker(service, sender);

      const first = worker.ejecutarCiclo();
      const second = worker.ejecutarCiclo();
      expect(service.obtenerPendientes).toHaveBeenCalledTimes(1);
      liberar?.();
      await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

      worker.start();
      worker.stop();
      worker.stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
