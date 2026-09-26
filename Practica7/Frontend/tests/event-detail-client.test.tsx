import { render, screen } from '@testing-library/react';
import { EventDetailClient } from '@/components/pages/EventDetailClient';
import { getEvent } from '@/lib/mock-api';

let mockSearchParams = new URLSearchParams('eventId=evt-soa');
let mockPathname = '/evento';

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/mock-api', () => ({
  getEvent: jest.fn(),
}));

const mockedGetEvent = jest.mocked(getEvent);

const availableEvent = {
  eventId: 'evt-soa',
  title: 'Taller de Arquitectura SOA',
  course: 'Software Avanzado',
  speaker: 'Ing. Ana Hernández',
  date: '20/10/2026 · 18:00',
  modality: 'Híbrido',
  availableSeats: 12,
  totalSeats: 30,
  description: 'Descripción del evento',
  prerequisites: ['Fundamentos'],
};

describe('Detalle del evento', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('eventId=evt-soa');
    mockedGetEvent.mockReset();
  });

  it('habilita la reserva cuando hay cupos', async () => {
    mockedGetEvent.mockResolvedValue(availableEvent);
    render(<EventDetailClient />);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar reserva' })).toHaveAttribute(
      'href',
      '/reservar?eventId=evt-soa',
    );
  });

  it('bloquea la reserva cuando el evento no tiene cupo', async () => {
    mockedGetEvent.mockResolvedValue({ ...availableEvent, eventId: 'evt-cert', availableSeats: 0 });
    render(<EventDetailClient />);

    expect(await screen.findByText('SIN_CUPO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserva no disponible' })).toBeDisabled();
  });

  it('muestra el evento inexistente como error', async () => {
    mockedGetEvent.mockRejectedValue(new Error('No se encontró el evento solicitado.'));
    render(<EventDetailClient />);

    expect(await screen.findByText('No se encontró el evento solicitado.')).toBeInTheDocument();
  });
});
