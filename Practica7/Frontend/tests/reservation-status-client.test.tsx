import { render, screen } from '@testing-library/react';
import { ReservationStatusClient } from '@/components/pages/ReservationStatusClient';
import { getReservation } from '@/lib/mock-api';

let mockSearchParams = new URLSearchParams('reservationId=RSV-2026-000185');
let mockPathname = '/reservas';

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/mock-api', () => ({
  getReservation: jest.fn(),
}));

const mockedGetReservation = jest.mocked(getReservation);

const confirmedReservation = {
  reservationId: 'RSV-2026-000185',
  eventId: 'evt-soa',
  eventTitle: 'Taller de Arquitectura SOA',
  studentName: 'Estudiante confirmado',
  studentEmail: 'confirmado@ejemplo.com',
  status: 'CONFIRMADA' as const,
  message: 'La reserva fue confirmada.',
  ticket: {
    ticketId: 'TKT-2026-000185',
    issuedAt: '20/10/2026',
    eventTitle: 'Taller de Arquitectura SOA',
  },
};

describe('Consulta de reserva', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('reservationId=RSV-2026-000185');
    mockedGetReservation.mockReset();
  });

  it('muestra el ticket únicamente para una reserva confirmada', async () => {
    mockedGetReservation.mockResolvedValue(confirmedReservation);
    render(<ReservationStatusClient />);

    expect(await screen.findByText('Reserva confirmada')).toBeInTheDocument();
    expect(screen.getByText('TKT-2026-000185')).toBeInTheDocument();
  });

  it('muestra una reserva rechazada sin ticket', async () => {
    mockedGetReservation.mockResolvedValue({
      ...confirmedReservation,
      status: 'RECHAZADA',
      ticket: undefined,
      message: 'No cumple prerrequisitos.',
    });
    render(<ReservationStatusClient />);

    expect(await screen.findByText('Reserva rechazada')).toBeInTheDocument();
    expect(screen.queryByText('Ticket generado')).not.toBeInTheDocument();
  });

  it('muestra el error cuando la reserva no existe', async () => {
    mockedGetReservation.mockRejectedValue(new Error('No se encontró una reserva con ese identificador.'));
    render(<ReservationStatusClient />);

    expect(await screen.findByText('No se encontró una reserva con ese identificador.')).toBeInTheDocument();
  });
});
