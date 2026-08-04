import {
  ClaseDetalle,
  ClaseResumen,
  CursoCatalogo,
  Participante,
  SemestreResumen,
} from '../../domain/entities/clase';

export interface SearchCriteria {
  semestre?: string;
  escuela?: string;
  curso?: string;
  catedratico?: string;
  tema?: string;
}

export interface PublicarClaseInput {
  cursoId: string;
  unidad?: string;
  tema?: string;
  fechaImparticion?: string;
  semestre: string;
  anio: number;
  urlVideo: string;
  urlMaterial?: string;
  duracion: number; 
  etiquetas: string[];
  participantes: Participante[];
}

export interface RegistrarCursoInput {
  codigo: string;
  nombre: string;
  escuela: string;
}

export interface CatalogRepository {
  buscar(criteria: SearchCriteria): Promise<ClaseResumen[]>;
  getClase(claseId: string): Promise<ClaseDetalle | null>;
  listarPorSemestre(semestre?: string): Promise<SemestreResumen[]>;
  publicarClase(
    input: PublicarClaseInput,
  ): Promise<{ claseId: string; fechaPublicacion: string }>;
  registrarCurso(input: RegistrarCursoInput): Promise<CursoCatalogo>;
}
