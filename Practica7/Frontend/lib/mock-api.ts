import { CREDENTIALS, EVENTS, RESERVATIONS } from './mock-data';
import {
  type CreateReservationInput,
  type CredentialVerification,
  type EventDetail,
  type EventSummary,
  MockApiError,
  type ReservationRecord,
} from './types';

const STORAGE_KEY = 'academix-pass-p7-reservations';
const MOCK_DELAY_MS = 220;

function wait(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
}

function readStoredReservations(): ReservationRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReservationRecord[]) : [];
  } catch {
    return [];
  }
}

function saveReservation(reservation: ReservationRecord): void {
  try {
    const existing = readStoredReservations().filter(
      (item) => item.reservationId !== reservation.reservationId,
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, reservation]));
  } catch {
    // La experiencia continúa aunque el navegador no permita almacenamiento local.
  }
}

function getEventRecord(eventId: string): EventDetail {
  if (eventId === 'evt-error') {
    throw new MockApiError('NETWORK', 'El Servicio de Talleres no está disponible temporalmente.', 503);
  }
  const event = EVENTS.find((item) => item.eventId === eventId);
  if (!event) {
    throw new MockApiError('NOT_FOUND', 'No se encontró el evento solicitado.', 404);
  }
  return event;
}

export async function listEvents(query = '', scenario?: string): Promise<EventSummary[]> {
  await wait();
  if (scenario === 'error' || query.trim().toUpperCase() === '__ERROR__') {
    throw new MockApiError('NETWORK', 'No se pudo consultar el catálogo de eventos.', 503);
  }
  if (scenario === 'empty' || query.trim().toUpperCase() === '__EMPTY__') return [];

  const normalized = query.trim().toLocaleLowerCase('es');
  return EVENTS.filter((event) => {
    if (!normalized) return true;
    return [event.title, event.course, event.speaker].some((field) =>
      field.toLocaleLowerCase('es').includes(normalized),
    );
  }).map(({ description: _description, prerequisites: _prerequisites, ...summary }) => summary);
}

export async function getEvent(eventId: string): Promise<EventDetail> {
  await wait();
  return getEventRecord(eventId);
}

function makeReservationId(): string {
  return `RSV-DEMO-${Date.now()}`;
}

export async function createReservation(input: CreateReservationInput): Promise<ReservationRecord> {
  await wait();
  const event = getEventRecord(input.eventId);
  const email = input.studentEmail.trim().toLocaleLowerCase('es');

  if (email === 'error@demo.test') {
    throw new MockApiError('NETWORK', 'El Servicio de Reservas/Ticketing no está disponible.', 503);
  }

  if (email === 'duplicado@demo.test') {
    const existing = RESERVATIONS[0];
    return { ...existing, message: 'Ya existe una solicitud del estudiante para este evento.' };
  }

  if (email === 'prerrequisito@demo.test') {
    const rejected: ReservationRecord = {
      reservationId: 'RSV-DEMO-RECHAZADA',
      eventId: event.eventId,
      eventTitle: event.title,
      studentName: input.studentName,
      studentEmail: input.studentEmail,
      status: 'RECHAZADA',
      message: 'La solicitud no cumple los prerrequisitos del evento.',
    };
    saveReservation(rejected);
    return rejected;
  }

  if (event.availableSeats === 0) {
    const withoutSeat: ReservationRecord = {
      reservationId: 'RSV-DEMO-SIN-CUPO',
      eventId: event.eventId,
      eventTitle: event.title,
      studentName: input.studentName,
      studentEmail: input.studentEmail,
      status: 'SIN_CUPO',
      message: 'No fue posible confirmar la reserva porque el evento no tiene cupos.',
    };
    saveReservation(withoutSeat);
    return withoutSeat;
  }

  const pending: ReservationRecord = {
    reservationId: makeReservationId(),
    eventId: event.eventId,
    eventTitle: event.title,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    status: 'PENDIENTE',
    message: 'La solicitud fue registrada y quedó pendiente de procesamiento.',
  };
  saveReservation(pending);
  return pending;
}

export async function getReservation(reservationId: string): Promise<ReservationRecord> {
  await wait();
  if (reservationId.trim().toUpperCase() === 'RSV-ERROR') {
    throw new MockApiError('NETWORK', 'No se pudo consultar el estado de la reserva.', 503);
  }
  const reservation = [...readStoredReservations(), ...RESERVATIONS].find(
    (item) => item.reservationId.toLocaleLowerCase('es') === reservationId.trim().toLocaleLowerCase('es'),
  );
  if (!reservation) {
    throw new MockApiError('NOT_FOUND', 'No se encontró una reserva con ese identificador.', 404);
  }
  return reservation;
}

export async function verifyCredential(identifier: string): Promise<CredentialVerification> {
  await wait();
  const normalized = identifier.trim().toUpperCase();
  if (normalized === 'CERT-ERROR') {
    throw new MockApiError('NETWORK', 'El Servicio de Certificados no está disponible.', 503);
  }
  const credential = CREDENTIALS.find((item) => item.identifier === normalized);
  if (credential) return credential;
  return {
    identifier: normalized,
    status: 'NO_ENCONTRADA',
    title: 'Credencial no encontrada',
    message: 'No existe una credencial asociada con el identificador consultado.',
  };
}

export const mockScenarioIds = {
  catalogError: '?scenario=error',
  catalogEmpty: '?scenario=empty',
  eventWithoutSeats: 'evt-cert',
  eventNotFound: 'evento-no-existe',
  eventError: 'evt-error',
  reservationPending: 'RSV-2026-000184',
  reservationConfirmed: 'RSV-2026-000185',
  reservationRejected: 'RSV-2026-000186',
  reservationWithoutSeats: 'RSV-2026-000187',
  reservationNotFound: 'RSV-NO-ENCONTRADA',
  reservationError: 'RSV-ERROR',
  credentialValid: 'CERT-2026-000742',
  credentialInvalid: 'CERT-INVALIDA-2026',
  credentialNotFound: 'CERT-NO-ENCONTRADA',
  credentialError: 'CERT-ERROR',
};
