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

export interface ClaseDetalle {
  claseId: string;
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
}

export interface SemestreResumen {
  semestre: string;
  anio: number;
  escuela: string;
  totalClases: number;
}
