export type ReservationStatus = 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA' | 'SIN_CUPO';

export type CredentialStatus = 'VÁLIDA' | 'INVÁLIDA' | 'NO_ENCONTRADA';

export type MockErrorCode = 'NOT_FOUND' | 'NETWORK' | 'VALIDATION' | 'INVALID_RESPONSE';

export interface EventSummary {
  eventId: string;
  title: string;
  course: string;
  speaker: string;
  date: string;
  modality: string;
  availableSeats: number;
  totalSeats: number;
}

export interface EventDetail extends EventSummary {
  description: string;
  prerequisites: string[];
}

export interface ReservationTicket {
  ticketId: string;
  issuedAt: string;
  eventTitle: string;
}

export interface ReservationRecord {
  reservationId: string;
  eventId: string;
  eventTitle: string;
  studentName: string;
  studentEmail: string;
  status: ReservationStatus;
  message: string;
  ticket?: ReservationTicket;
}

export interface CreateReservationInput {
  eventId: string;
  studentName: string;
  studentEmail: string;
}

export interface CredentialVerification {
  identifier: string;
  status: CredentialStatus;
  title: string;
  holder?: string;
  issuedAt?: string;
  message: string;
}

export class MockApiError extends Error {
  constructor(
    public readonly code: MockErrorCode,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = 'MockApiError';
  }
}
