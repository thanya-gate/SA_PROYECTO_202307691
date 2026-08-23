import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config/env';
import { EmailSender, EnviarCorreoInput } from '../../application/ports/email-sender';

function createTransport(): Transporter {
  if (config.SMTP_HOST.trim().length > 0) {
    return nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      requireTLS: true,
      ignoreTLS: false,
      tls: {
        rejectUnauthorized: true,
      },
      auth:
        config.SMTP_USER.trim().length > 0
          ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
          : undefined,
    });
  }
  // Sin SMTP configurado (desarrollo local): transporte JSON que solo registra
  // el correo en consola/log en lugar de enviarlo.
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

export class NodemailerEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = createTransport();
  }

  async enviar(input: EnviarCorreoInput): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: config.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.body,
      });
      if (config.MAIL_DEBUG) {
        const messageId = info.messageId ?? '';
        console.log(
          `[notificaciones-service] correo a ${input.to} (${input.subject}) messageId=${messageId}`,
        );
        if (info.message && typeof info.message === 'string') {
          console.log(`[notificaciones-service] contenido JSON:\n${info.message}`);
        }
      }
    } catch (err: any) {
      const smtpInfo = {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        user: config.SMTP_USER,
        error: err?.message ?? String(err),
        code: err?.code,
        response: err?.response,
      };
      console.error(
        `[notificaciones-service] ERROR enviando correo a ${input.to} (${input.subject}):`,
        JSON.stringify(smtpInfo, null, 2),
      );
      throw err;
    }
  }
}
