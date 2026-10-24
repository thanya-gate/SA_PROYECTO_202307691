import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogClient } from '@/components/pages/CatalogClient';
import { listEvents } from '@/lib/mock-api';

let mockSearchParams = new URLSearchParams();
let mockPathname = '/';

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/mock-api', () => ({
  listEvents: jest.fn(),
}));

const mockedListEvents = jest.mocked(listEvents);

describe('Catálogo de eventos', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPathname = '/';
    mockedListEvents.mockReset();
  });

  it('muestra eventos cargados y permite filtrar', async () => {
    mockedListEvents
      .mockResolvedValueOnce([
        {
          eventId: 'evt-soa',
          title: 'Taller de Arquitectura SOA',
          course: 'Software Avanzado',
          speaker: 'Ing. Ana Hernández',
          date: '20/10/2026 · 18:00',
          modality: 'Híbrido',
          availableSeats: 12,
          totalSeats: 30,
        },
      ])
      .mockResolvedValueOnce([]);

    render(<CatalogClient />);
    expect(await screen.findByText('Taller de Arquitectura SOA')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscar evento'), 'inexistente');
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));

    await waitFor(() => expect(screen.getByText('No hay resultados')).toBeInTheDocument());
    expect(mockedListEvents).toHaveBeenLastCalledWith('inexistente', undefined);
  });

  it('muestra el estado de error y permite reintentar', async () => {
    mockedListEvents.mockRejectedValueOnce(new Error('Servicio no disponible')).mockResolvedValueOnce([]);
    render(<CatalogClient />);

    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay resultados')).toBeInTheDocument();
  });
});
