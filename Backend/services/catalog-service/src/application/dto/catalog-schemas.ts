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
