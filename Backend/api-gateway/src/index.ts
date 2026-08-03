import { createGateway, listenGateway } from './server';

const app = createGateway();
listenGateway(app);

process.on('SIGTERM', () => {
  console.log('[api-gateway] Cerrando ...');
  process.exit(0);
});
