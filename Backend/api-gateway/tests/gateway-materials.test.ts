import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import request from 'supertest';
import { config } from '../src/config/env';
import { createGateway, escribirTemporal } from '../src/server';

const claseId = '11111111-1111-4111-8111-111111111111';
const materialId = '22222222-2222-4222-8222-222222222222';

function makeHarness() {
  const auth = {
    validateSession: jest.fn(async (token: string) => ({
      session: {
        sessionId: `session-${token}`,
        userId: 'user-1',
        email: 'user@usac.edu.gt',
        roles: token === 'student' ? ['ROLE_ESTUDIANTE'] : [token],
      },
    })),
  };
  const catalog = {
    registrarMaterial: jest.fn().mockResolvedValue({
      material: {
        materialId,
        claseId,
        nombreArchivo: 'guia.pdf',
        mimeType: 'application/pdf',
        extension: '.pdf',
        tamanoBytes: 4,
        versionActual: 1,
        totalDescargas: 0,
        urlArchivo: '/media/materiales/guia.pdf',
      },
    }),
    obtenerMaterial: jest.fn().mockResolvedValue({ material: { materialId, claseId } }),
    agregarVersionMaterial: jest.fn().mockResolvedValue({ material: { materialId, versionActual: 2 } }),
    listarMateriales: jest.fn().mockResolvedValue({ materiales: [] }),
    eliminarMaterial: jest.fn().mockResolvedValue({}),
    registrarDescargaMaterial: jest.fn().mockResolvedValue({ totalDescargas: 1 }),
  };
  const storage = {
    guardarMaterialVersion: jest.fn(async (_clase: string, _material: string, _nombre: string, tempPath: string) => {
      await fs.promises.rm(tempPath, { force: true });
      return '/media/materiales/version.pdf';
    }),
    eliminarMaterial: jest.fn().mockResolvedValue(undefined),
  };
  const app = createGateway({ authGrpc: auth as any, catalogGrpc: catalog as any, storage: storage as any });
  return { app, auth, catalog, storage };
}

describe('gateway: carga y versionado seguro de materiales', () => {
  let mediaDir: string;

  beforeEach(() => {
    mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yousac-material-test-'));
    (config as any).MEDIA_DIR = mediaDir;
  });

  afterEach(() => {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  });

  test('rechaza ausencia de sesión y rol de estudiante sin tocar gRPC de catálogo ni storage', async () => {
    const noSession = makeHarness();
    await request(noSession.app)
      .post(`/catalog/classes/${claseId}/materials`)
      .set('Content-Type', 'application/pdf')
      .set('x-filename', 'guia.pdf')
      .send(Buffer.from('data'))
      .expect(401);
    expect(noSession.catalog.registrarMaterial).not.toHaveBeenCalled();
    expect(noSession.storage.guardarMaterialVersion).not.toHaveBeenCalled();

    const student = makeHarness();
    await request(student.app)
      .post(`/catalog/classes/${claseId}/materials`)
      .set('Authorization', 'Bearer student')
      .set('Content-Type', 'application/pdf')
      .set('x-filename', 'guia.pdf')
      .send(Buffer.from('data'))
      .expect(403);
    expect(student.catalog.registrarMaterial).not.toHaveBeenCalled();
    expect(student.storage.guardarMaterialVersion).not.toHaveBeenCalled();
  });

  test.each(['ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR'])('permite subir con %s y persiste metadata coherente', async (role) => {
    const harness = makeHarness();
    await request(harness.app)
      .post(`/catalog/classes/${claseId}/materials`)
      .set('Authorization', `Bearer ${role}`)
      .set('Content-Type', 'application/pdf')
      .set('x-filename', '../../Guía.pdf')
      .set('Content-Length', '4')
      .send(Buffer.from('data'))
      .expect(201);

    expect(harness.storage.guardarMaterialVersion).toHaveBeenCalledWith(
      claseId,
      expect.any(String),
      'Guia.pdf',
      expect.stringContaining('.uploading'),
      'application/pdf',
    );
    expect(harness.catalog.registrarMaterial).toHaveBeenCalledWith(expect.objectContaining({
      claseId,
      nombreArchivo: 'Guia.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      tamanoBytes: 4,
    }));
  });

  test('rechaza MIME desconocido, extensión inconsistente y Content-Length inválido antes de escribir', async () => {
    const harness = makeHarness();
    await request(harness.app)
      .post(`/catalog/classes/${claseId}/materials`)
      .set('Authorization', 'Bearer ROLE_CATEDRATICO')
      .set('Content-Type', 'application/x-msdownload')
      .set('x-filename', 'virus.exe')
      .set('Content-Length', '4')
      .send(Buffer.from('data'))
      .expect(415);
    await request(harness.app)
      .post(`/catalog/classes/${claseId}/materials`)
      .set('Authorization', 'Bearer ROLE_CATEDRATICO')
      .set('Content-Type', 'application/pdf')
      .set('x-filename', 'script.sql')
      .set('Content-Length', '4')
      .send(Buffer.from('data'))
      .expect(415);
    await request(harness.app)
      .post(`/catalog/classes/${claseId}/materials`)
      .set('Authorization', 'Bearer ROLE_CATEDRATICO')
      .set('Content-Type', 'application/pdf')
      .set('x-filename', 'guia.pdf')
      .set('Content-Length', '0')
      .send(Buffer.from('data'))
      .expect(400);
    expect(harness.storage.guardarMaterialVersion).not.toHaveBeenCalled();
    expect(harness.catalog.registrarMaterial).not.toHaveBeenCalled();
  });

  test('limpia el archivo físico si falla el registro gRPC', async () => {
    const harness = makeHarness();
    harness.catalog.registrarMaterial.mockRejectedValueOnce(new Error('gRPC unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await request(harness.app)
        .post(`/catalog/classes/${claseId}/materials`)
        .set('Authorization', 'Bearer ROLE_ADMIN')
        .set('Content-Type', 'application/pdf')
        .set('x-filename', 'guia.pdf')
        .set('Content-Length', '4')
        .send(Buffer.from('data'))
        .expect(500);
      expect(errorSpy).toHaveBeenCalledWith(
        '[api-gateway] error no controlado:',
        expect.any(Error),
      );
    } finally {
      errorSpy.mockRestore();
    }
    expect(harness.storage.eliminarMaterial).toHaveBeenCalledWith(claseId, expect.any(String));
  });

  test('versiona y elimina material consultando primero su clase', async () => {
    const harness = makeHarness();
    await request(harness.app)
      .post(`/catalog/materials/${materialId}/versiones`)
      .set('Authorization', 'Bearer ROLE_CATEDRATICO')
      .set('Content-Type', 'application/octet-stream')
      .set('x-filename', 'script.py')
      .set('Content-Length', '4')
      .send(Buffer.from('data'))
      .expect(201);
    expect(harness.catalog.obtenerMaterial).toHaveBeenCalledWith(materialId);
    expect(harness.catalog.agregarVersionMaterial).toHaveBeenCalledWith(expect.objectContaining({
      materialId,
      tamanoBytes: 4,
    }));

    await request(harness.app)
      .delete(`/catalog/materials/${materialId}`)
      .set('Authorization', 'Bearer ROLE_AUXILIAR')
      .expect(200);
    expect(harness.catalog.eliminarMaterial).toHaveBeenCalledWith(materialId);
    expect(harness.storage.eliminarMaterial).toHaveBeenCalledWith(claseId, materialId);
  });

  test('registra la métrica de descarga solo con sesión autenticada', async () => {
    const harness = makeHarness();
    await request(harness.app)
      .post(`/catalog/materials/${materialId}/descarga`)
      .set('Authorization', 'Bearer student')
      .expect(200, { message: 'Descarga registrada', totalDescargas: 1 });
    expect(harness.catalog.registrarDescargaMaterial).toHaveBeenCalledWith(materialId);
  });
});

describe('escritura temporal', () => {
  test('rechaza el tamaño real aunque el declarado sea menor y no deja temporal', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yousac-stream-test-'));
    const temp = path.join(dir, 'file.uploading');
    await expect(escribirTemporal(
      temp,
      Readable.from([Buffer.from('1234')]) as any,
      1,
      3,
    )).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(fs.existsSync(temp)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
