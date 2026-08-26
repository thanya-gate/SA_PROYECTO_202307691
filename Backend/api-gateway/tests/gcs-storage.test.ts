const mockUpload = jest.fn().mockResolvedValue(undefined);
const mockMakePublic = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockDeleteFiles = jest.fn().mockResolvedValue(undefined);
const mockFile = jest.fn().mockReturnValue({ makePublic: mockMakePublic, delete: mockDelete });
const mockBucket = jest.fn().mockReturnValue({ upload: mockUpload, file: mockFile, deleteFiles: mockDeleteFiles });

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: mockBucket })),
}));

import { createStorageBackend } from '../src/storage/storage';
import fs from 'fs';

describe('StorageBackend GCS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(() => jest.restoreAllMocks());

  test('publica una versión con MIME, destino y limpieza temporal', async () => {
    const backend = createStorageBackend('gcs', ['.pdf']);
    await expect(backend.guardarMaterialVersion('clase-1', 'material-1', 'guia.pdf', '/tmp/file', 'application/pdf'))
      .resolves.toBe('https://storage.googleapis.com/yousac-material/materiales/clase-1/material-1/1700000000000-guia.pdf');
    expect(mockUpload).toHaveBeenCalledWith('/tmp/file', expect.objectContaining({
      destination: 'materiales/clase-1/material-1/1700000000000-guia.pdf',
      contentType: 'application/pdf',
      resumable: false,
    }));
    expect(mockMakePublic).toHaveBeenCalled();
    expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/file', { force: true });
  });

  test('elimina el prefijo completo de versiones', async () => {
    const backend = createStorageBackend('gcs', ['.pdf']);
    await backend.eliminarMaterial('clase-1', 'material-1');
    expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: 'materiales/clase-1/material-1/', force: true });
  });
});
