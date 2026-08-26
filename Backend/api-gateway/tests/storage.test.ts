import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env';
import { createStorageBackend, sanitizarNombreArchivo } from '../src/storage/storage';

describe('StorageBackend local', () => {
  beforeEach(() => {
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('sanitiza traversal, controles, puntos iniciales y limita nombres', () => {
    expect(sanitizarNombreArchivo('../../Guía final.pdf')).toBe('Guia_final.pdf');
    expect(sanitizarNombreArchivo('..')).toBe('');
    expect(sanitizarNombreArchivo('\u0000\u0001')).toBe('');
    expect(sanitizarNombreArchivo('x'.repeat(300)).length).toBe(120);
  });

  test('guarda una versión en una ruta por clase/material y devuelve URL relativa', async () => {
    const backend = createStorageBackend('local', ['.pdf', '.zip']);
    const result = await backend.guardarMaterialVersion(
      'clase-1',
      'material-1',
      'guia.pdf',
      '/tmp/uploading',
      'application/pdf',
    );
    expect(result).toMatch(/^\/media\/materiales\/clase-1\/material-1\/\d+-guia\.pdf$/);
    expect(fs.promises.mkdir).toHaveBeenCalledWith(
      path.join(config.MEDIA_DIR, 'materiales', 'clase-1', 'material-1'),
      { recursive: true },
    );
    expect(fs.promises.rename).toHaveBeenCalledWith('/tmp/uploading', expect.stringContaining('guia.pdf'));
  });

  test('elimina todas las rutas legacy y las versiones físicas', async () => {
    const backend = createStorageBackend('local', ['.pdf', '.zip']);
    await backend.eliminarArchivosClase('clase-1');
    expect(fs.promises.rm).toHaveBeenCalledWith(
      path.join(config.MEDIA_DIR, 'materiales', 'clase-1'),
      { recursive: true, force: true },
    );
  });
});
