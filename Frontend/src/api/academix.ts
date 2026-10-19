import { apiFetch } from './http';

// Academix Pass & CertiHub vía el gateway (/academix/*). Los estados llegan con
// los nombres que usan los servicios de Academix.

export interface TallerAcademix {
  eventoId: string;
  titulo: string;
  curso: string;
  ponente: string;
  fecha: string;
  modalidad: string;
  cuposDisponibles: number;
  cuposTotales: number;
}

export interface ReservaAceptada {
  trackingId: string;
  estado: string;
  mensaje: string;
}

export interface EstadoReserva {
  trackingId: string;
  estado: string;
  mensaje: string;
  encontrado: boolean;
  ticket?: { codigoValidacion: string; eventoTitulo: string; emitidoEn: string };
}

export interface CertificadoAcademix {
  codigo: string;
  titulo: string;
  titular: string;
  emitidoEn: string;
  estadoTexto: 'VALIDA' | 'INVALIDA' | 'NO_ENCONTRADA';
  mensaje: string;
}

export const academixApi = {
  talleres: (curso: string, token: string) =>
    apiFetch<{ eventos: TallerAcademix[]; total: number }>(`/academix/talleres?${new URLSearchParams({ curso })}`, { token }),

  reservar: (eventoId: string, token: string) =>
    apiFetch<ReservaAceptada>('/academix/reservas', { method: 'POST', body: { eventoId }, token }),

  estadoReserva: (trackingId: string, token: string) =>
    apiFetch<EstadoReserva>(`/academix/reservas/${encodeURIComponent(trackingId)}`, { token }),

  certificados: (token: string) => apiFetch<{ credenciales: CertificadoAcademix[] }>('/academix/certificados', { token }),

  verificar: (codigo: string, token: string) =>
    apiFetch<CertificadoAcademix>(`/academix/certificados/${encodeURIComponent(codigo)}/verificar`, { token }),
};

/** Academix solo tiene un estado intermedio (PENDIENTE); los demás son finales. */
export function reservaTerminada(estado: string): boolean {
  return estado.toUpperCase() !== 'PENDIENTE';
}
