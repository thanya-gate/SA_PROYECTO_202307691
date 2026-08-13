import { z } from 'zod';

export const semestreRegex = /^\d{4}-[12]$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

export const searchSchema = z.object({
  semestre: optionalText(10).refine(
    (v) => v === undefined || semestreRegex.test(v),
    'Semestre inválido (formato AAAA-1 o AAAA-2)',
  ),
  escuela: optionalText(100),
  curso: optionalText(200),
  catedratico: optionalText(200),
  tema: optionalText(200),
  page: z.number().int().min(1).max(10000).default(1),
  pageSize: z.number().int().min(1).max(10).default(10),
});
export type SearchInput = z.infer<typeof searchSchema>;

export const participanteSchema = z.object({
  nombre: z.string().trim().min(1, 'Participante sin nombre').max(200),
  rol: z.enum(['CATEDRATICO', 'AUXILIAR'], { errorMap: () => ({ message: 'Rol inválido (CATEDRATICO|AUXILIAR)' }) }),
});

export const publicarClaseSchema = z.object({
  cursoId: z.string().uuid('cursoId inválido'),
  unidad: optionalText(200),
  tema: optionalText(200),
  fechaImparticion: optionalText(10),
  semestre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
  anio: z.number().int().min(2000, 'año inválido').max(2100, 'año inválido'),
  urlVideo: optionalText(2000),
  urlMaterial: optionalText(500),
  duracion: z.number().int().min(0, 'duracion no puede ser negativa'),
  etiquetas: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  participantes: z.array(participanteSchema).max(50).default([]),
});
export type PublicarClaseInput = z.infer<typeof publicarClaseSchema>;

export const actualizarClaseSchema = z.object({
  claseId: z.string().uuid('claseId inválido'),
  cursoId: z.string().uuid('cursoId inválido'),
  unidad: optionalText(200),
  tema: optionalText(200),
  fechaImparticion: optionalText(10),
  semestre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
  anio: z.number().int().min(2000, 'año inválido').max(2100, 'año inválido'),
  urlVideo: optionalText(2000),
  urlMaterial: optionalText(500),
  duracion: z.number().int().min(0, 'duracion no puede ser negativa'),
  etiquetas: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  participantes: z.array(participanteSchema).max(50).default([]),
});
export type ActualizarClaseInput = z.infer<typeof actualizarClaseSchema>;

export const registrarCursoSchema = z.object({
  codigo: z.string().trim().min(1, 'codigo es obligatorio').max(20),
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(200),
  escuela: z.string().trim().min(1, 'escuela es obligatoria').max(100),
});
export type RegistrarCursoInput = z.infer<typeof registrarCursoSchema>;

export const registrarSemestreSchema = z.object({
  nombre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
  anio: z.number().int().min(2000, 'año inválido').max(2100, 'año inválido'),
});
export type RegistrarSemestreInput = z.infer<typeof registrarSemestreSchema>;

export const actualizarSemestreSchema = z.object({
  semestreId: z.string().uuid('semestreId inválido'),
  nombre: z.string().trim().regex(semestreRegex, 'Semestre inválido (formato AAAA-1 o AAAA-2)'),
  anio: z.number().int().min(2000, 'año inválido').max(2100, 'año inválido'),
});
export type ActualizarSemestreInput = z.infer<typeof actualizarSemestreSchema>;

export const registrarEscuelaSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(100),
});
export type RegistrarEscuelaInput = z.infer<typeof registrarEscuelaSchema>;

export const actualizarEscuelaSchema = z.object({
  escuelaId: z.string().uuid('escuelaId inválido'),
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(100),
});
export type ActualizarEscuelaInput = z.infer<typeof actualizarEscuelaSchema>;

export const actualizarCursoSchema = z.object({
  cursoId: z.string().uuid('cursoId inválido'),
  codigo: z.string().trim().min(1, 'codigo es obligatorio').max(20),
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(200),
  escuela: z.string().trim().min(1, 'escuela es obligatoria').max(100),
});
export type ActualizarCursoInput = z.infer<typeof actualizarCursoSchema>;

export const claseCSVSchema = z.object({
  codigoCurso: z.string().trim().optional(),
  nombreCurso: z.string().trim().optional(),
  escuela: z.string().trim().optional(),
  unidad: z.string().trim().optional(),
  tema: z.string().trim().optional(),
  fechaImparticion: z.string().trim().optional(),
  semestre: z.string().trim().optional(),
  anio: z.number().optional(),
  urlVideo: z.string().trim().optional(),
  urlMaterial: z.string().trim().optional(),
  duracion: z.number().optional(),
  etiquetas: z.array(z.string()).default([]),
  docentes: z.array(z.string()).default([]),
  auxiliares: z.array(z.string()).default([]),
});
export type ClaseCSVInput = z.infer<typeof claseCSVSchema>;
