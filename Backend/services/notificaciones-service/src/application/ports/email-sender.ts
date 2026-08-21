export interface EnviarCorreoInput {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  enviar(input: EnviarCorreoInput): Promise<void>;
}
