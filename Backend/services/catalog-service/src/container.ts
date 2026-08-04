import { CatalogRepository } from './application/ports/catalog-repository';
import { PostgresCatalogRepository } from './infrastructure/persistence/postgres/postgres-catalog-repository';
import { CatalogService } from './application/services/catalog.service';


export class Container {
  readonly catalogRepository: CatalogRepository;
  readonly catalogService: CatalogService;

  constructor() {
    this.catalogRepository = new PostgresCatalogRepository();
    this.catalogService = new CatalogService(this.catalogRepository);
  }
}

export const container = new Container();
