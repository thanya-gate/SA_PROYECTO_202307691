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
  | 'CURSO_NO_ENCONTRADO'
  | 'DOCENTE_NO_ENCONTRADO'
  | 'AUXILIAR_NO_ENCONTRADO'
  | 'INSCRIPCION_DUPLICADA'
  | 'DOCENTE_EN_USO'
  | 'ENTRADA_INVALIDA'
  | 'CONFLICTO'
  | 'ERROR_INTERNO';

export const isDomainError = (err: unknown): err is DomainError =>
  err instanceof DomainError;
