import { z } from 'zod';

const uuid = z.string().uuid('UUID inválido');

export const registrarNotificacionSchema = z.object({
  usuarioId: uuid,
  correoDestino: z.string().trim().min(3, 'correoDestino es obligatorio').max(320),
  plantilla: z.string().trim().min(1, 'plantilla es obligatoria').max(100),
  tipo: z.string().trim().min(1, 'tipo es obligatorio').max(30),
  datosContexto: z.record(z.string(), z.string()).default({}),
});
export type RegistrarNotificacionInput = z.infer<typeof registrarNotificacionSchema>;

export const notificarNuevaClaseSchema = z.object({
  cursoId: uuid,
  codigo: z.string().trim().min(1, 'codigo es obligatorio').max(20),
  curso: z.string().trim().min(1, 'curso es obligatorio').max(200),
  semestre: z.string().trim().min(1, 'semestre es obligatorio').max(10),
  anio: z.number().int().min(2000).max(2100),
  tema: z.string().trim().min(1, 'tema es obligatorio').max(200),
});
export type NotificarNuevaClaseInput = z.infer<typeof notificarNuevaClaseSchema>;

export const registrarAvisoGeneralSchema = z.object({
  mensaje: z.string().trim().min(1, 'mensaje es obligatorio').max(1000),
  destinatarioIds: z.array(uuid).default([]),
});
export type RegistrarAvisoGeneralInput = z.infer<typeof registrarAvisoGeneralSchema>;
