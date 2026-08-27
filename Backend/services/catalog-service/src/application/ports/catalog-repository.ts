import {
  ClaseDetalle,
  ClaseResumen,
  Capitulo,
  CursoAdmin,
  CursoCatalogo,
  EscuelaAdmin,
  MaterialAdjunto,
  Participante,
  SemestreAdmin,
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

export interface ActualizarClaseInput extends PublicarClaseInput {
  claseId: string;
}

export interface RegistrarCursoInput {
  codigo: string;
  nombre: string;
  escuela: string;
}

export interface RegistrarSemestreInput {
  nombre: string;
  anio: number;
}

export interface ActualizarSemestreInput {
  semestreId: string;
  nombre: string;
  anio: number;
}

export interface RegistrarEscuelaInput {
  nombre: string;
}

export interface ActualizarEscuelaInput {
  escuelaId: string;
  nombre: string;
}

export interface ActualizarCursoInput {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
}

export interface RegistrarMaterialInput {
  materialId?: string;
  claseId: string;
  nombreArchivo: string;
  mimeType: string;
  extension: string;
  tamanoBytes?: number;
  urlArchivo: string;
  subidoPor?: string;
}

export interface AgregarVersionMaterialInput {
  materialId: string;
  tamanoBytes?: number;
  urlArchivo: string;
}

export interface EliminarMaterialResult {
  eliminado: boolean;
  claseId: string | null;
}

export interface CrearCapituloInput {
  claseId: string;
  titulo: string;
  inicioSegundos: number;
  finSegundos: number;
  orden?: number;
}

export interface ActualizarCapituloInput extends CrearCapituloInput {
  capituloId: string;
}

export interface CatalogRepository {
  buscar(criteria: SearchCriteria): Promise<BuscarResult>;
  getClase(claseId: string): Promise<ClaseDetalle | null>;
  listarPorSemestre(semestre?: string): Promise<SemestreResumen[]>;
  buscarCursoPorCodigo(codigo: string): Promise<CursoCatalogo | null>;
  buscarCursoPorId(cursoId: string): Promise<CursoCatalogo | null>;
  publicarClase(
    input: PublicarClaseInput,
  ): Promise<{ claseId: string; fechaPublicacion: string }>;
  actualizarUrlVideo(claseId: string, urlVideo: string): Promise<ClaseDetalle | null>;
  actualizarUrlMaterial(claseId: string, urlMaterial: string): Promise<ClaseDetalle | null>;
  actualizarDuracion(claseId: string, duracion: number): Promise<ClaseDetalle | null>;
  actualizarClase(input: ActualizarClaseInput): Promise<ClaseDetalle | null>;
  eliminarClase(claseId: string): Promise<void>;
  registrarCurso(input: RegistrarCursoInput): Promise<CursoCatalogo>;
  cargarClasesCSV(clases: ClaseCSVInput[]): Promise<CargarClasesCSVResult>;

  listarSemestres(): Promise<SemestreAdmin[]>;
  registrarSemestre(input: RegistrarSemestreInput): Promise<{ semestreId: string }>;
  actualizarSemestre(input: ActualizarSemestreInput): Promise<void>;
  eliminarSemestre(semestreId: string): Promise<void>;

  listarEscuelas(): Promise<EscuelaAdmin[]>;
  registrarEscuela(input: RegistrarEscuelaInput): Promise<{ escuelaId: string }>;
  actualizarEscuela(input: ActualizarEscuelaInput): Promise<void>;
  eliminarEscuela(escuelaId: string): Promise<void>;

  listarCursos(): Promise<CursoAdmin[]>;
  actualizarCurso(input: ActualizarCursoInput): Promise<void>;
  eliminarCurso(cursoId: string): Promise<void>;

  registrarMaterial(input: RegistrarMaterialInput): Promise<MaterialAdjunto>;
  obtenerMaterial(materialId: string): Promise<MaterialAdjunto | null>;
  agregarVersionMaterial(input: AgregarVersionMaterialInput): Promise<MaterialAdjunto>;
  listarMateriales(claseId: string): Promise<MaterialAdjunto[]>;
  eliminarMaterial(materialId: string): Promise<EliminarMaterialResult>;
  registrarDescargaMaterial(materialId: string): Promise<number>;

  listarCapitulos(claseId: string): Promise<Capitulo[]>;
  crearCapitulo(input: CrearCapituloInput): Promise<Capitulo>;
  actualizarCapitulo(input: ActualizarCapituloInput): Promise<Capitulo | null>;
  eliminarCapitulo(capituloId: string): Promise<{ eliminado: boolean; claseId: string | null }>;
}
