import { NotificacionRepository } from './application/ports/notificacion-repository';
import { EmailSender } from './application/ports/email-sender';
import { AuthGrpcClient } from './application/ports/auth-grpc-client';
import { InscripcionGrpcClient } from './application/ports/inscripcion-grpc-client';
import { PostgresNotificacionRepository } from './infrastructure/persistence/postgres/postgres-notificacion-repository';
import { NodemailerEmailSender } from './infrastructure/mail/nodemailer-email-sender';
import { AuthGrpcClientImpl } from './infrastructure/grpc/auth-client';
import { InscripcionGrpcClientImpl } from './infrastructure/grpc/inscripcion-client';
import { NotificacionService } from './application/services/notificacion.service';
import { EmailWorker } from './infrastructure/worker/email-worker';

export class Container {
  readonly notificacionRepository: NotificacionRepository;
  readonly emailSender: EmailSender;
  readonly authClient: AuthGrpcClient;
  readonly inscripcionClient: InscripcionGrpcClient;

  readonly notificacionService: NotificacionService;
  readonly emailWorker: EmailWorker;

  constructor() {
    this.notificacionRepository = new PostgresNotificacionRepository();
    this.emailSender = new NodemailerEmailSender();
    this.authClient = new AuthGrpcClientImpl();
    this.inscripcionClient = new InscripcionGrpcClientImpl();

    this.notificacionService = new NotificacionService(
      this.notificacionRepository,
      this.authClient,
      this.inscripcionClient,
    );
    this.emailWorker = new EmailWorker(this.notificacionService, this.emailSender);
  }
}

export const container = new Container();
