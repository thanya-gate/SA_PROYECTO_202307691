import { z } from 'zod';

export const semestreRegex = /^\d{4}-[12]$/;

const uuid = z.string().uuid('UUID inválido');

export const registrarCursoSchema = z.object({
  codigo: z.string().trim().min(1, 'codigo es obligatorio').max(20),
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(200),
  escuela: z.string().trim().min(1, 'escuela es obligatoria').max(100),
  semestre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
  anio: z.number().int().min(2000, 'año inválido').max(2100, 'año inválido'),
});
export type RegistrarCursoInput = z.infer<typeof registrarCursoSchema>;

export const registrarDocenteSchema = z.object({
  usuarioId: uuid,
});
export type RegistrarDocenteInput = z.infer<typeof registrarDocenteSchema>;

export const registrarAuxiliarSchema = z.object({
  usuarioId: uuid,
});
export type RegistrarAuxiliarInput = z.infer<typeof registrarAuxiliarSchema>;

export const inscribirEstudianteSchema = z.object({
  estudianteId: uuid,
  cursoId: uuid,
  semestre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
});
export type InscribirEstudianteInput = z.infer<typeof inscribirEstudianteSchema>;

export const asignarCatedraticoCursoSchema = z.object({
  docenteId: uuid,
  cursoId: uuid,
  semestre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
});
export type AsignarCatedraticoCursoInput = z.infer<typeof asignarCatedraticoCursoSchema>;

export const asignarAuxiliarCatedraticoSchema = z.object({
  auxiliarId: uuid,
  asignacionDocenteId: uuid,
});
export type AsignarAuxiliarCatedraticoInput = z.infer<typeof asignarAuxiliarCatedraticoSchema>;
