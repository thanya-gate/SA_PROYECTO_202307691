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
  | 'CLASE_NO_ENCONTRADA'
  | 'CURSO_NO_ENCONTRADO'
  | 'ENTRADA_INVALIDA'
  | 'CONFLICTO'
  | 'ERROR_INTERNO';

export const isDomainError = (err: unknown): err is DomainError =>
  err instanceof DomainError;
