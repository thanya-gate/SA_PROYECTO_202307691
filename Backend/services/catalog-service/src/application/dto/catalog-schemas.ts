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

export const registrarCursoSchema = z.object({
  codigo: z.string().trim().min(1, 'codigo es obligatorio').max(20),
  nombre: z.string().trim().min(1, 'nombre es obligatorio').max(200),
  escuela: z.string().trim().min(1, 'escuela es obligatoria').max(100),
});
export type RegistrarCursoInput = z.infer<typeof registrarCursoSchema>;

export const claseCSVSchema = z.object({
  codigoCurso: z.string().trim().optional(),
  nombreCurso: z.string().trim().max(200).optional(),
  escuela: z.string().trim().max(100).optional(),
  unidad: z.string().trim().max(200).optional(),
  tema: z.string().trim().max(200).optional(),
  fechaImparticion: z.string().trim().max(10).optional(),
  semestre: z.string().trim().max(10).optional(),
  anio: z.number().int().optional(),
  urlVideo: z.string().trim().max(2000).optional(),
  urlMaterial: z.string().trim().max(500).optional(),
  duracion: z.number().int().min(0).optional(),
  etiquetas: z.array(z.string().trim().max(100)).max(20).default([]),
  docentes: z.array(z.string().trim().max(200)).max(20).default([]),
  auxiliares: z.array(z.string().trim().max(200)).max(20).default([]),
});
export type ClaseCSVInput = z.infer<typeof claseCSVSchema>;
