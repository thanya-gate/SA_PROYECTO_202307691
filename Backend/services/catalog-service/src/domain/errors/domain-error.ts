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
  | 'SEMESTRE_NO_ENCONTRADO'
  | 'SEMESTRE_EN_USO'
  | 'ESCUELA_NO_ENCONTRADA'
  | 'ESCUELA_EN_USO'
  | 'CURSO_EN_USO'
  | 'CURSO_CODIGO_DUPLICADO'
  | 'MATERIAL_NO_ENCONTRADO'
  | 'CAPITULO_NO_ENCONTRADO'
  | 'DUDA_NO_ENCONTRADA'
  | 'RESPUESTA_NO_ENCONTRADA'
  | 'SIN_AUTORIZACION'
  | 'ENTRADA_INVALIDA'
  | 'CONFLICTO'
  | 'ERROR_INTERNO';

export const isDomainError = (err: unknown): err is DomainError =>
  err instanceof DomainError;
