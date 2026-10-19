import express from 'express';
import request from 'supertest';
import { createGateway } from '../src/server';
import { createFederationRouter } from '../src/federation/router';
import { aClaseFederada, urlAbsoluta } from '../src/federation/mapper';
import { errorHandler } from '../src/middleware/error-handler';

const opcionesOrigen = { grupo: 'YoUSAC G4', institucion: 'FIUSAC', baseUrl: 'https://yousac.test/' };

const resumen = {
  claseId: 'clase-1',
  codigo: '0770',
  curso: 'Redes 1',
  unidad: 'Unidad 2',
  tema: 'Subredes VLSM',
  semestre: 'Segundo Semestre',
  anio: 2026,
  urlVideo: '/media/clases/clase-1.mp4',
};

const detalle = {
  ...resumen,
  duracion: 3600,
  participantes: [
    { nombre: 'Aux. López', rol: 'AUXILIAR' },
    { nombre: 'Ing. Pérez', rol: 'CATEDRATICO' },
  ],
  capitulos: [
    { titulo: 'Cierre', inicioSegundos: 600, finSegundos: 900, orden: 2 },
    { titulo: 'Intro', inicioSegundos: 0, finSegundos: 600, orden: 1 },
  ],
};

function makeCatalog() {
  return {
    search: jest.fn().mockResolvedValue({ resultados: [resumen], total: 1, page: 1, pageSize: 10, totalPages: 1 }),
    getClase: jest.fn(async (id: string) => (id === 'clase-1' ? { clase: detalle } : { clase: null })),
  };
}

describe('mapper de federación', () => {
  it('vuelve absolutas las URLs relativas y respeta las absolutas', () => {
    expect(urlAbsoluta('/media/a.mp4', 'https://x.test/')).toBe('https://x.test/media/a.mp4');
    expect(urlAbsoluta('https://cdn.test/a.mp4', 'https://x.test')).toBe('https://cdn.test/a.mp4');
    expect(urlAbsoluta('', 'https://x.test')).toBe('');
  });

  it('mapea el detalle al contrato con catedrático y capítulos ordenados', () => {
    const clase = aClaseFederada(detalle, opcionesOrigen);
    expect(clase).toMatchObject({
      id: 'clase-1',
      titulo: 'Subredes VLSM',
      curso: 'Redes 1',
      catedratico: 'Ing. Pérez',
      duracionSeg: 3600,
      videoUrl: 'https://yousac.test/media/clases/clase-1.mp4',
      tipoVideo: 'archivo',
      origen: { grupo: 'YoUSAC G4', institucion: 'FIUSAC' },
    });
    expect(clase.capitulos.map((c) => c.titulo)).toEqual(['Intro', 'Cierre']);
  });

  it('detecta videos de YouTube', () => {
    expect(aClaseFederada({ ...resumen, urlVideo: 'https://youtu.be/abcdef123' }, opcionesOrigen).tipoVideo).toBe('youtube');
  });
});

describe('rutas /federation en el gateway', () => {
  const catalogGrpc = makeCatalog();
  const app = createGateway({ catalogGrpc: catalogGrpc as any, federationApiKeys: ['clave-aliado'] });

  it('salud y contrato no requieren API key', async () => {
    await request(app).get('/federation/v1/salud').expect(200, { status: 'ok' });
    const yaml = await request(app).get('/federation/v1/openapi.yaml').expect(200);
    expect(yaml.text).toContain('openapi: 3.1.0');
    const docs = await request(app).get('/federation/docs').expect(200);
    expect(docs.text).toContain('SwaggerUIBundle');
  });

  it('rechaza sin API key o con una inválida', async () => {
    const sin = await request(app).get('/federation/v1/clases').expect(401);
    expect(sin.body.error.code).toBe('API_KEY_INVALIDA');
    await request(app).get('/federation/v1/clases').set('X-API-Key', 'otra').expect(401);
  });

  it('busca clases mapeando q → tema y limitando pageSize', async () => {
    const res = await request(app)
      .get('/federation/v1/clases?q=vlsm&curso=Redes&pageSize=99')
      .set('X-API-Key', 'clave-aliado')
      .expect(200);
    expect(catalogGrpc.search).toHaveBeenCalledWith({ tema: 'vlsm', curso: 'Redes', page: 1, pageSize: 20 });
    expect(res.body.total).toBe(1);
    expect(res.body.resultados[0]).toMatchObject({ id: 'clase-1', capitulos: [] });
  });

  it('devuelve el detalle o 404', async () => {
    const ok = await request(app).get('/federation/v1/clases/clase-1').set('X-API-Key', 'clave-aliado').expect(200);
    expect(ok.body.capitulos).toHaveLength(2);
    await request(app).get('/federation/v1/clases/nope').set('X-API-Key', 'clave-aliado').expect(404);
  });
});

describe('límite de peticiones', () => {
  it('responde 429 al superar el límite y se reinicia al minuto', async () => {
    let t = 0;
    const app = express();
    app.use(
      '/federation',
      createFederationRouter({
        catalogGrpc: makeCatalog(),
        apiKeys: ['k'],
        limitePorMinuto: 2,
        ahora: () => t,
        ...opcionesOrigen,
      }),
    );
    app.use(errorHandler);

    await request(app).get('/federation/v1/clases').set('X-API-Key', 'k').expect(200);
    await request(app).get('/federation/v1/clases').set('X-API-Key', 'k').expect(200);
    const res = await request(app).get('/federation/v1/clases').set('X-API-Key', 'k').expect(429);
    expect(res.body.error.code).toBe('LIMITE_EXCEDIDO');
    t = 60_000;
    await request(app).get('/federation/v1/clases').set('X-API-Key', 'k').expect(200);
  });
});
