import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';
import { authGrpc } from '../grpc/auth-client';
import { DomainError } from '../domain/domain-error';


export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const token = bearer || (req.cookies?.[config.SESSION_COOKIE_NAME] as string | undefined) || '';

    if (!token) {
      return next(new DomainError('SESION_INVALIDA', 'No se proporcionó un token de sesión', 401));
    }

    const { session } = await authGrpc.validateSession(token);
    req.context = {
      sessionId: session.sessionId,
      userId: session.userId,
      email: session.email,
      roles: session.roles,
    };
    next();
  } catch (err) {
    next(err);
  }
}
