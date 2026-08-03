import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { config } from '../../config/env';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import accountRoutes from './routes/account.routes';
import oauthRoutes from './routes/oauth.routes';

export function createHttpServer(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'auth-service', version: '1.0.0' });
  });
//aqui se enruta el api gateway
  app.use('/auth', authRoutes);
  app.use('/profiles', profileRoutes);
  app.use('/account', accountRoutes);
  app.use('/auth/oauth', oauthRoutes);

  app.use(errorHandler);

  return app;
}

export function listenHttp(app: Express): ReturnType<typeof app.listen> {
  return app.listen(config.PORT, () => {
    console.log(`[auth-service] HTTP escuchando en http://localhost:${config.PORT}`);
  });
}
