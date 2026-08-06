import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

/** Asigna un id de correlación a cada petición (observabilidad). */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = (req.headers['x-request-id'] as string) ?? randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
