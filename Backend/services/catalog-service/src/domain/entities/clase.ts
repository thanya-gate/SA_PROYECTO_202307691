export interface CursoCatalogo {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
}

export interface ClaseResumen {
  claseId: string;
  codigo: string;
  curso: string;
  unidad: string | null;
  tema: string | null;
  semestre: string;
  anio: number;
  urlVideo: string;
}

export interface Participante {
  nombre: string;
  rol: string; 
}

export interface MaterialAdjunto {
  materialId: string;
  claseId: string;
  nombreArchivo: string;
  mimeType: string;
  extension: string;
  tamanoBytes: number;
  versionActual: number;
  totalDescargas: number;
  subidoPor: string | null;
  fechaSubida: string;
  urlArchivo: string | null;
}

export interface Capitulo {
  capituloId: string;
  claseId: string;
  titulo: string;
  inicioSegundos: number;
  finSegundos: number;
  orden: number;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface ClaseDetalle {
  claseId: string;
  cursoId: string;
  codigo: string;
  curso: string;
  escuela: string;
  unidad: string | null;
  tema: string | null;
  fechaImparticion: string | null; 
  semestre: string;
  anio: number;
  duracion: number; 
  urlVideo: string;
  urlMaterial: string | null;
  fechaPublicacion: string; 
  participantes: Participante[];
  etiquetas: string[];
  materiales: MaterialAdjunto[];
  capitulos: Capitulo[];
}

export interface SemestreResumen {
  semestre: string;
  anio: number;
  escuela: string;
  totalClases: number;
}

export interface SemestreAdmin {
  semestreId: string;
  nombre: string;
  anio: number;
  clases: number;
}

export interface EscuelaAdmin {
  escuelaId: string;
  nombre: string;
  cursos: number;
}

export interface CursoAdmin {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
}
