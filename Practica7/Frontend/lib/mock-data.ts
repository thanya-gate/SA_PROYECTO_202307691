import type { CredentialVerification, EventDetail, ReservationRecord } from './types';

export const EVENTS: EventDetail[] = [
  {
    eventId: 'evt-soa',
    title: 'Taller de Arquitectura SOA',
    course: 'Software Avanzado',
    speaker: 'Ing. Ana Hernández',
    date: '20/10/2026 · 18:00',
    modality: 'Híbrido',
    availableSeats: 12,
    totalSeats: 30,
    description: 'Sesión práctica sobre diseño de servicios, contratos y comunicación desacoplada.',
    prerequisites: ['Fundamentos de sistemas distribuidos'],
  },
  {
    eventId: 'evt-lab',
    title: 'Reserva de laboratorio distribuido',
    course: 'Software Avanzado',
    speaker: 'Ing. Ana Hernández',
    date: '22/10/2026 · 16:00',
    modality: 'Presencial',
    availableSeats: 5,
    totalSeats: 20,
    description: 'Laboratorio guiado para practicar integración entre servicios académicos.',
    prerequisites: ['Haber cursado Arquitectura de software'],
  },
  {
    eventId: 'evt-cert',
    title: 'Conferencia de certificados digitales',
    course: 'Software Avanzado',
    speaker: 'Ing. Ana Hernández',
    date: '25/10/2026 · 10:00',
    modality: 'Virtual',
    availableSeats: 0,
    totalSeats: 80,
    description: 'Conferencia sobre verificación pública y trazabilidad de credenciales académicas.',
    prerequisites: [],
  },
];

export const RESERVATIONS: ReservationRecord[] = [
  {
    reservationId: 'RSV-2026-000184',
    eventId: 'evt-soa',
    eventTitle: 'Taller de Arquitectura SOA',
    studentName: 'Estudiante de prueba',
    studentEmail: 'estudiante@ejemplo.com',
    status: 'PENDIENTE',
    message: 'La solicitud sigue en procesamiento. Puedes consultar nuevamente en unos momentos.',
  },
  {
    reservationId: 'RSV-2026-000185',
    eventId: 'evt-soa',
    eventTitle: 'Taller de Arquitectura SOA',
    studentName: 'Estudiante confirmado',
    studentEmail: 'confirmado@ejemplo.com',
    status: 'CONFIRMADA',
    message: 'La reserva fue confirmada y tiene un ticket asociado.',
    ticket: {
      ticketId: 'TKT-2026-000185',
      issuedAt: '20/10/2026',
      eventTitle: 'Taller de Arquitectura SOA',
    },
  },
  {
    reservationId: 'RSV-2026-000186',
    eventId: 'evt-lab',
    eventTitle: 'Reserva de laboratorio distribuido',
    studentName: 'Estudiante rechazado',
    studentEmail: 'rechazado@ejemplo.com',
    status: 'RECHAZADA',
    message: 'La reserva fue rechazada porque no se cumplió un prerrequisito.',
  },
  {
    reservationId: 'RSV-2026-000187',
    eventId: 'evt-cert',
    eventTitle: 'Conferencia de certificados digitales',
    studentName: 'Estudiante sin cupo',
    studentEmail: 'sincupo@ejemplo.com',
    status: 'SIN_CUPO',
    message: 'No fue posible confirmar la reserva porque el evento alcanzó su capacidad.',
  },
];

export const CREDENTIALS: CredentialVerification[] = [
  {
    identifier: 'CERT-2026-000742',
    status: 'VÁLIDA',
    title: 'Taller de Arquitectura SOA',
    holder: 'Estudiante de prueba',
    issuedAt: '20/10/2026',
    message: 'La credencial corresponde a una emisión válida.',
  },
  {
    identifier: 'CERT-INVALIDA-2026',
    status: 'INVÁLIDA',
    title: 'Credencial no vigente',
    message: 'La credencial existe, pero no cumple las condiciones de validez.',
  },
];
