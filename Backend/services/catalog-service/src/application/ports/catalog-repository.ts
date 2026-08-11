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
  page?: number;
  pageSize?: number;
}

export interface BuscarResult {
  resultados: ClaseResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ClaseCSVInput {
  codigoCurso?: string;
  nombreCurso?: string;
  escuela?: string;
  unidad?: string;
  tema?: string;
  fechaImparticion?: string;
  semestre?: string;
  anio?: number;
  urlVideo?: string;
  urlMaterial?: string;
  duracion?: number;
  etiquetas: string[];
  docentes: string[];
  auxiliares: string[];
}

export interface CargarClasesCSVResult {
  registradas: number;
  omitidas: number;
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
  buscar(criteria: SearchCriteria): Promise<BuscarResult>;
  getClase(claseId: string): Promise<ClaseDetalle | null>;
  listarPorSemestre(semestre?: string): Promise<SemestreResumen[]>;
  buscarCursoPorCodigo(codigo: string): Promise<CursoCatalogo | null>;
  publicarClase(
    input: PublicarClaseInput,
  ): Promise<{ claseId: string; fechaPublicacion: string }>;
  actualizarUrlVideo(claseId: string, urlVideo: string): Promise<ClaseDetalle | null>;
  actualizarUrlMaterial(claseId: string, urlMaterial: string): Promise<ClaseDetalle | null>;
  actualizarDuracion(claseId: string, duracion: number): Promise<ClaseDetalle | null>;
  registrarCurso(input: RegistrarCursoInput): Promise<CursoCatalogo>;
  cargarClasesCSV(clases: ClaseCSVInput[]): Promise<CargarClasesCSVResult>;
}
