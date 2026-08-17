import { CatalogRepository } from './application/ports/catalog-repository';
import { PostgresCatalogRepository } from './infrastructure/persistence/postgres/postgres-catalog-repository';
import { CatalogService } from './application/services/catalog.service';
import { NotificacionesGrpcClient } from './infrastructure/grpc/notificaciones-client';


export class Container {
  readonly catalogRepository: CatalogRepository;
  readonly catalogService: CatalogService;
  readonly notificacionesClient: NotificacionesGrpcClient;

  constructor() {
    this.catalogRepository = new PostgresCatalogRepository();
    this.catalogService = new CatalogService(this.catalogRepository);
    this.notificacionesClient = new NotificacionesGrpcClient();
  }
}

export const container = new Container();
