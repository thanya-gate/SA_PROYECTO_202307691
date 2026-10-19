import request from 'supertest';
import { createGateway } from '../src/server';
import { HttpCatalogoExterno, crearCatalogoExterno, CatalogoExterno } from '../src/federation/catalogo-externo';

const externa = {
  id: 'ext-1',
  titulo: 'Árboles B',
  curso: 'Estructuras de Datos',
  videoUrl: 'https://aliado.test/v.mp4',
  tipoVideo: 'archivo',
  capitulos: [{ titulo: 'Intro', inicioSeg: 0, finSeg: 60 }],
  origen: { grupo: 'YoUSAC G7', institucion: 'CUNOC' },
};

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('HttpCatalogoExterno', () => {
  it('envía la API key y devuelve resultados válidos', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, { resultados: [externa], total: 1 }));
    const cat = new HttpCatalogoExterno({ baseUrl: 'https://aliado.test/federation/v1/', apiKey: 'k', nombre: 'G7', fetchFn });
    expect(await cat.buscar('árboles', 2)).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://aliado.test/federation/v1/clases?q=%C3%A1rboles&page=2');
    expect(init.headers['X-API-Key']).toBe('k');
  });

  it('degrada a vacío ante error de red, HTTP 500 o respuesta fuera del contrato', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const casos = [
      jest.fn().mockRejectedValue(new Error('timeout')),
      jest.fn().mockResolvedValue(respuesta(500, {})),
      jest.fn().mockResolvedValue(respuesta(200, { resultados: [{ id: 1 }] })),
    ];
    for (const fetchFn of casos) {
      const cat = new HttpCatalogoExterno({ baseUrl: 'https://a.test', apiKey: 'k', nombre: 'G7', fetchFn });
      expect(await cat.buscar('', 1)).toEqual([]);
    }
    warn.mockRestore();
  });

  it('obtener devuelve la clase o null en 404', async () => {
    const ok = new HttpCatalogoExterno({ baseUrl: 'https://a.test', apiKey: 'k', nombre: 'G7', fetchFn: jest.fn().mockResolvedValue(respuesta(200, externa)) });
    expect((await ok.obtener('ext-1'))?.titulo).toBe('Árboles B');
    const nf = new HttpCatalogoExterno({ baseUrl: 'https://a.test', apiKey: 'k', nombre: 'G7', fetchFn: jest.fn().mockResolvedValue(respuesta(404, {})) });
    expect(await nf.obtener('x')).toBeNull();
  });

  it('sin URL configurada no hay catálogo externo', () => {
    expect(crearCatalogoExterno('', 'k', 'G7')).toBeNull();
  });
});

describe('rutas /catalog/externos y /catalog/externo/:id', () => {
  const auth = {
    validateSession: jest.fn(async () => ({
      session: { sessionId: 's', userId: 'u', email: 'e@ingenieria.usac.edu.gt', roles: ['ROLE_ESTUDIANTE'] },
    })),
  };
  const externo: CatalogoExterno = {
    nombre: 'YoUSAC G7',
    buscar: jest.fn().mockResolvedValue([externa]),
    obtener: jest.fn(async (id: string) => (id === 'ext-1' ? (externa as any) : null)),
  };
  const app = createGateway({ authGrpc: auth as any, catalogoExterno: externo });

  it('requiere sesión', async () => {
    await request(app).get('/catalog/externos').expect(401);
  });

  it('lista las clases del aliado con su nombre', async () => {
    const res = await request(app).get('/catalog/externos?q=arboles&page=2').set('Authorization', 'Bearer t').expect(200);
    expect(res.body).toEqual({ aliado: 'YoUSAC G7', resultados: [externa] });
    expect(externo.buscar).toHaveBeenCalledWith('arboles', 2);
  });

  it('detalle externo o 404', async () => {
    await request(app).get('/catalog/externo/ext-1').set('Authorization', 'Bearer t').expect(200);
    await request(app).get('/catalog/externo/nope').set('Authorization', 'Bearer t').expect(404);
  });

  it('sin aliado configurado devuelve lista vacía', async () => {
    const solo = createGateway({ authGrpc: auth as any, catalogoExterno: null });
    const res = await request(solo).get('/catalog/externos').set('Authorization', 'Bearer t').expect(200);
    expect(res.body).toEqual({ aliado: null, resultados: [] });
  });
});
