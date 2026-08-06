import { InscripcionRepository } from './application/ports/inscripcion-repository';
import { PostgresInscripcionRepository } from './infrastructure/persistence/postgres/postgres-inscripcion-repository';
import { InscripcionService } from './application/services/inscripcion.service';

export class Container {
  readonly inscripcionRepository: InscripcionRepository;
  readonly inscripcionService: InscripcionService;

  constructor() {
    this.inscripcionRepository = new PostgresInscripcionRepository();
    this.inscripcionService = new InscripcionService(this.inscripcionRepository);
  }
}

export const container = new Container();
