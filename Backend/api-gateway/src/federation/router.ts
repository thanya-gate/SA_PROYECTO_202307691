import fs from 'fs';
import path from 'path';
import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { DomainError } from '../domain/domain-error';
import { aClaseFederada, OpcionesMapeo } from './mapper';

// Contrato público: se sirve tal cual para personas (Swagger) y agentes (YAML crudo).
const CONTRATO_PATH = path.resolve(__dirname, '../../openapi/federacion.yaml');
const PAGE_SIZE_MAX = 20;

interface CatalogoLectura {
  search(req: Record<string, unknown>): Promise<any>;
  getClase(claseId: string): Promise<any>;
}

export interface OpcionesFederacion extends OpcionesMapeo {
  catalogGrpc: CatalogoLectura;
  apiKeys: string[];
  limitePorMinuto: number;
  ahora?: () => number;
}

function claveValida(recibida: string, claves: string[]): string | null {
  const b = Buffer.from(recibida);
  for (const clave of claves) {
    const a = Buffer.from(clave);
    if (a.length === b.length && timingSafeEqual(a, b)) return clave;
  }
  return null;
}

function entero(valor: unknown, porDefecto: number, max: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : porDefecto;
}

export function createFederationRouter(opciones: OpcionesFederacion): Router {
  const router = Router();
  const ahora = opciones.ahora ?? Date.now;
  // shortcut: contador en memoria por pod; si el gateway escala a varias réplicas el límite real es N×, mover a Redis entonces.
  const ventanas = new Map<string, { inicio: number; cuenta: number }>();

  const requiereApiKey = (req: Request, _res: Response, next: NextFunction) => {
    const clave = claveValida(String(req.header('x-api-key') ?? ''), opciones.apiKeys);
    if (!clave) return next(new DomainError('API_KEY_INVALIDA', 'X-API-Key ausente o inválida', 401));

    const t = ahora();
    const ventana = ventanas.get(clave);
    if (!ventana || t - ventana.inicio >= 60_000) {
      ventanas.set(clave, { inicio: t, cuenta: 1 });
    } else if (++ventana.cuenta > opciones.limitePorMinuto) {
      return next(new DomainError('LIMITE_EXCEDIDO', `Máximo ${opciones.limitePorMinuto} peticiones por minuto`, 429));
    }
    console.log(JSON.stringify({ nivel: 'INFO', evento: 'federacion_peticion', ruta: req.path }));
    next();
  };

  router.get('/v1/salud', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/v1/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(fs.readFileSync(CONTRATO_PATH, 'utf8'));
  });

  router.get('/docs', (_req, res) => {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>YoUSAC Federación</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: 'v1/openapi.yaml', dom_id: '#ui' });</script></body></html>`);
  });

  router.get('/v1/clases', requiereApiKey, async (req, res, next) => {
    try {
      const pageSize = entero(req.query.pageSize, 10, PAGE_SIZE_MAX);
      const result = await opciones.catalogGrpc.search({
        tema: String(req.query.q ?? ''),
        curso: String(req.query.curso ?? ''),
        page: entero(req.query.page, 1, Number.MAX_SAFE_INTEGER),
        pageSize,
      });
      res.json({
        resultados: (result.resultados ?? []).map((c: any) => aClaseFederada(c, opciones)),
        total: result.total ?? 0,
        page: result.page ?? 1,
        pageSize: result.pageSize ?? pageSize,
        totalPages: result.totalPages ?? 0,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/v1/clases/:id', requiereApiKey, async (req, res, next) => {
    try {
      const result = await opciones.catalogGrpc.getClase(req.params.id);
      if (!result?.clase?.claseId) throw new DomainError('NO_ENCONTRADO', 'Clase no encontrada', 404);
      res.json(aClaseFederada(result.clase, opciones));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
