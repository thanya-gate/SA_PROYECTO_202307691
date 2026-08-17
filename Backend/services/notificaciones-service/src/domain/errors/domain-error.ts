export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export type DomainErrorCode =
  | 'PLANTILLA_NO_ENCONTRADA'
  | 'NOTIFICACION_NO_ENCONTRADA'
  | 'USUARIO_NO_ENCONTRADO'
  | 'CURSO_NO_ENCONTRADO'
  | 'ENTRADA_INVALIDA'
  | 'CONFLICTO'
  | 'ERROR_INTERNO';

export const isDomainError = (err: unknown): err is DomainError =>
  err instanceof DomainError;
