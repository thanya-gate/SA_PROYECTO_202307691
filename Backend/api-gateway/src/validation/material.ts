import { DomainError } from '../domain/domain-error';
import { sanitizarNombreArchivo } from '../storage/storage';

export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

export const MATERIAL_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'text/x-python': '.py',
  'text/x-go': '.go',
  'application/sql': '.sql',
};

export const EXTENSIONES_CODIGO_FUENTE = new Set(['.py', '.go', '.sql']);
export const EXTENSIONES_PERMITIDAS_MATERIAL = new Set<string>([
  ...Object.values(MATERIAL_EXTENSIONS),
  ...EXTENSIONES_CODIGO_FUENTE,
]);

export function extensionDesdeNombre(nombre: string): string | undefined {
  const base = sanitizarNombreArchivo(nombre);
  const match = /\.([A-Za-z0-9]{1,9})$/.exec(base);
  return match ? `.${match[1].toLowerCase()}` : undefined;
}

export function normalizarContentType(contentType: unknown): string {
  if (typeof contentType !== 'string') return '';
  return contentType.split(';', 1)[0].trim().toLowerCase();
}

export function resolverExtensionMaterial(contentType: unknown, nombreHeader: unknown): string {
  const mime = normalizarContentType(contentType);
  const extensionMIME = MATERIAL_EXTENSIONS[mime];
  if (extensionMIME) return extensionMIME;

  const extensionNombre =
    typeof nombreHeader === 'string' ? extensionDesdeNombre(nombreHeader) : undefined;
  if (mime === 'application/octet-stream' && extensionNombre && EXTENSIONES_CODIGO_FUENTE.has(extensionNombre)) {
    return extensionNombre;
  }

  throw new DomainError(
    'TIPO_NO_PERMITIDO',
    'Tipo de archivo no permitido. Aceptados: PDF, Word, PowerPoint, TXT, imágenes y código fuente (.zip, .py, .go, .sql)',
    415,
  );
}

export function resolverNombreArchivo(headerValor: unknown, extension: string): string {
  const crudo = typeof headerValor === 'string' && headerValor.trim().length > 0
    ? headerValor.trim()
    : `material${extension}`;
  let nombre = sanitizarNombreArchivo(crudo);
  if (!nombre) nombre = `material${extension}`;

  const extensionActual = extensionDesdeNombre(nombre);
  if (!extensionActual) return `${nombre}${extension}`;
  if (!EXTENSIONES_PERMITIDAS_MATERIAL.has(extensionActual) && extensionActual !== '.jpeg') {
    throw new DomainError(
      'TIPO_NO_PERMITIDO',
      'La extensión del nombre no coincide con un tipo de material permitido',
      415,
    );
  }

  // `.jpeg` es un alias aceptado por el navegador, pero se persiste como
  // `.jpg` para que nombre, MIME y extensión de metadata sean consistentes.
  if (extensionActual !== extension) {
    if (extensionActual === '.jpeg' && extension === '.jpg') {
      return `${nombre.slice(0, -extensionActual.length)}${extension}`;
    }
    throw new DomainError(
      'TIPO_NO_PERMITIDO',
      'La extensión del nombre no coincide con el tipo MIME enviado',
      415,
    );
  }
  return `${nombre.slice(0, -extensionActual.length)}${extension}`;
}

export function validarTamanoMaterial(contentLength: unknown): number {
  if (typeof contentLength !== 'string' || !/^\d+$/.test(contentLength.trim())) {
    throw new DomainError('ENTRADA_INVALIDA', 'El archivo debe pesar entre 1 byte y 50 MB', 400);
  }
  const bytes = Number(contentLength);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_MATERIAL_BYTES) {
    throw new DomainError('ENTRADA_INVALIDA', 'El archivo debe pesar entre 1 byte y 50 MB', 400);
  }
  return bytes;
}
