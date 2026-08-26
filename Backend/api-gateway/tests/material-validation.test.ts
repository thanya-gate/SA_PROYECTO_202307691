import {
  EXTENSIONES_CODIGO_FUENTE,
  MATERIAL_EXTENSIONS,
  MAX_MATERIAL_BYTES,
  extensionDesdeNombre,
  normalizarContentType,
  resolverExtensionMaterial,
  resolverNombreArchivo,
  validarTamanoMaterial,
} from '../src/validation/material';

describe('validación cerrada de materiales', () => {
  test('acepta todos los MIME y extensiones declarados', () => {
    for (const [mime, extension] of Object.entries(MATERIAL_EXTENSIONS)) {
      expect(resolverExtensionMaterial(mime, `archivo${extension}`)).toBe(extension);
    }
    for (const extension of EXTENSIONES_CODIGO_FUENTE) {
      expect(resolverExtensionMaterial('application/octet-stream', `programa${extension}`)).toBe(extension);
    }
  });

  test('rechaza MIME vacío, MIME desconocido y octet-stream sin extensión de código', () => {
    for (const [mime, nombre] of [
      ['', 'guia.pdf'],
      ['application/x-msdownload', 'virus.exe'],
      ['application/octet-stream', 'guia.pdf'],
      ['application/octet-stream', 'sin-extension'],
    ]) {
      expect(() => resolverExtensionMaterial(mime, nombre)).toThrow(expect.objectContaining({ httpStatus: 415 }));
    }
  });

  test('normaliza rutas, Unicode, controles, nombres vacíos y alias JPEG', () => {
    expect(resolverNombreArchivo('../../Guía final.pdf', '.pdf')).toBe('Guia_final.pdf');
    expect(resolverNombreArchivo('..', '.pdf')).toBe('material.pdf');
    expect(resolverNombreArchivo(`a\u0000b.pdf`, '.pdf')).toBe('ab.pdf');
    expect(resolverNombreArchivo('foto.jpeg', '.jpg')).toBe('foto.jpg');
    expect(resolverNombreArchivo('nombre sin extensión', '.txt')).toBe('nombre_sin_extension.txt');
    expect(resolverNombreArchivo('x'.repeat(500), '.zip').length).toBeLessThanOrEqual(124);
  });

  test('rechaza extensiones no permitidas o inconsistentes con el MIME', () => {
    expect(() => resolverNombreArchivo('script.exe', '.pdf')).toThrow(expect.objectContaining({ httpStatus: 415 }));
    expect(() => resolverNombreArchivo('script.sql', '.pdf')).toThrow(expect.objectContaining({ httpStatus: 415 }));
  });

  test('valida Content-Length ausente, inválido, negativo, cero y el límite exacto', () => {
    for (const value of [undefined, '', 'NaN', '-1', '0', String(MAX_MATERIAL_BYTES + 1), '1.5']) {
      expect(() => validarTamanoMaterial(value)).toThrow(expect.objectContaining({ httpStatus: 400 }));
    }
    expect(validarTamanoMaterial(String(MAX_MATERIAL_BYTES))).toBe(MAX_MATERIAL_BYTES);
    expect(validarTamanoMaterial('1')).toBe(1);
  });

  test('canoniza MIME con parámetros antes de persistir metadata', () => {
    expect(normalizarContentType(' application/pdf; charset=binary ')).toBe('application/pdf');
    expect(normalizarContentType(undefined)).toBe('');
  });

  test('obtiene la extensión solo después de quitar rutas y normalizar', () => {
    expect(extensionDesdeNombre('C:\\tmp\\ARCHIVO.PY')).toBe('.py');
    expect(extensionDesdeNombre('../../archivo')).toBeUndefined();
  });
});
