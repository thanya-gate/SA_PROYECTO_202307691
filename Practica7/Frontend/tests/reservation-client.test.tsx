import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationClient } from '@/components/pages/ReservationClient';
import { createReservation, getEvent } from '@/lib/mock-api';

let mockSearchParams = new URLSearchParams('eventId=evt-soa');
const mockPush = jest.fn();
let mockPathname = '/reservar';

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/mock-api', () => ({
  createReservation: jest.fn(),
  getEvent: jest.fn(),
}));

const mockedGetEvent = jest.mocked(getEvent);
const mockedCreateReservation = jest.mocked(createReservation);

const event = {
  eventId: 'evt-soa',
  title: 'Taller de Arquitectura SOA',
  course: 'Software Avanzado',
  speaker: 'Ing. Ana Hernández',
  date: '20/10/2026 · 18:00',
  modality: 'Híbrido',
  availableSeats: 12,
  totalSeats: 30,
  description: 'Descripción',
  prerequisites: [],
};

describe('Solicitud de reserva', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('eventId=evt-soa');
    mockPush.mockReset();
    mockedGetEvent.mockReset().mockResolvedValue(event);
    mockedCreateReservation.mockReset();
  });

  it('valida los datos obligatorios', async () => {
    render(<ReservationClient />);
    expect(await screen.findByText('Datos del estudiante')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Nombre completo'));
    await user.clear(screen.getByLabelText('Correo electrónico'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(screen.getByText('Ingresa el nombre completo.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa un correo electrónico.')).toBeInTheDocument();
    expect(mockedCreateReservation).not.toHaveBeenCalled();
  });

  it('envía la solicitud y navega a la consulta de reserva', async () => {
    mockedCreateReservation.mockResolvedValue({
      reservationId: 'RSV-DEMO-1',
      eventId: 'evt-soa',
      eventTitle: event.title,
      studentName: 'Estudiante de prueba',
      studentEmail: 'estudiante@ejemplo.com',
      status: 'PENDIENTE',
      message: 'Solicitud registrada',
    });
    render(<ReservationClient />);
    expect(await screen.findByText('Datos del estudiante')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByText('Enviar solicitud')).toBeInTheDocument();
    expect(mockedCreateReservation).toHaveBeenCalledWith({
      eventId: 'evt-soa',
      studentName: 'Estudiante de prueba',
      studentEmail: 'estudiante@ejemplo.com',
    });
    expect(mockPush).toHaveBeenCalledWith('/reservas?reservationId=RSV-DEMO-1');
  });
});
