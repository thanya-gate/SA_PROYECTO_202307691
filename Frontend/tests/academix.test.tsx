jest.mock('../src/api/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: '/api', allowedDomains: [] } }));
const saveMock = jest.fn();
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 800 } },
    setFontSize: jest.fn(),
    text: jest.fn(),
    save: saveMock,
  })),
}));

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '../src/api/http';
import { academixApi, reservaTerminada } from '../src/api/academix';
import { TalleresPanel } from '../src/components/TalleresPanel';
import { BilleteraCertificados } from '../src/components/BilleteraCertificados';

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

const taller = {
  eventoId: 'EVT-1',
  titulo: 'Microservicios con eventos',
  curso: 'Software Avanzado',
  ponente: 'Ing. Vargas',
  fecha: '2026-10-20T15:00:00.000Z',
  modalidad: 'Presencial',
  cuposDisponibles: 3,
  cuposTotales: 40,
};

beforeEach(() => apiFetchMock.mockReset());

test('academixApi arma las rutas del gateway', async () => {
  apiFetchMock.mockResolvedValue({} as never);
  await academixApi.talleres('Software Avanzado', 't');
  await academixApi.reservar('EVT-1', 't');
  await academixApi.estadoReserva('trk/1', 't');
  await academixApi.certificados('t');
  await academixApi.verificar('CERT 1', 't');
  expect(apiFetchMock.mock.calls.map((c) => c[0])).toEqual([
    '/academix/talleres?curso=Software+Avanzado',
    '/academix/reservas',
    '/academix/reservas/trk%2F1',
    '/academix/certificados',
    '/academix/certificados/CERT%201/verificar',
  ]);
  expect(apiFetchMock.mock.calls[1][1]).toEqual({ method: 'POST', body: { eventoId: 'EVT-1' }, token: 't' });
});

test('reservaTerminada solo sigue consultando mientras está PENDIENTE', () => {
  expect(reservaTerminada('PENDIENTE')).toBe(false);
  expect(reservaTerminada('CONFIRMADA')).toBe(true);
  expect(reservaTerminada('sin_cupo')).toBe(true);
});

test('TalleresPanel reserva y muestra la confirmación con su código', async () => {
  jest.useFakeTimers();
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/academix/talleres')) return { eventos: [taller], total: 1 } as never;
    if (path === '/academix/reservas') return { trackingId: 'trk-1', estado: 'PENDIENTE', mensaje: 'En cola' } as never;
    return { trackingId: 'trk-1', estado: 'CONFIRMADA', mensaje: '', encontrado: true, ticket: { codigoValidacion: 'CERT-9', eventoTitulo: '', emitidoEn: '' } } as never;
  });

  render(<TalleresPanel curso="Software Avanzado" token="t" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reservar' }));
  expect(await screen.findByText('En cola…')).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(await screen.findByText('Reserva confirmada · Código CERT-9')).toBeInTheDocument();
  jest.useRealTimers();
});

test('TalleresPanel deshabilita talleres sin cupo y muestra el error de Academix', async () => {
  apiFetchMock.mockResolvedValueOnce({ eventos: [{ ...taller, cuposDisponibles: 0 }], total: 1 } as never);
  const { unmount } = render(<TalleresPanel curso="SA" token="t" />);
  expect(await screen.findByRole('button', { name: 'Sin cupo' })).toBeDisabled();
  unmount();

  apiFetchMock.mockRejectedValueOnce(new Error('Academix Pass no responde en este momento'));
  render(<TalleresPanel curso="SA" token="t" />);
  expect(await screen.findByText('Academix Pass no responde en este momento')).toBeInTheDocument();
});

test('BilleteraCertificados lista, marca verificados y descarga el PDF', async () => {
  apiFetchMock.mockResolvedValueOnce({
    credenciales: [
      { codigo: 'CERT-2026-000001', titulo: 'Taller A', titular: 'Ana', emitidoEn: '2026-10-01T00:00:00.000Z', estadoTexto: 'VALIDA', mensaje: '' },
      { codigo: 'CERT-2026-000002', titulo: 'Taller B', titular: 'Ana', emitidoEn: '2026-10-02T00:00:00.000Z', estadoTexto: 'INVALIDA', mensaje: '' },
    ],
  } as never);
  render(<BilleteraCertificados token="t" />);
  expect(await screen.findByText('Verificado')).toBeInTheDocument();
  expect(screen.getByText('No válido')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Descargar' })[0]);
  expect(saveMock).toHaveBeenCalledWith('certificado-CERT-2026-000001.pdf');
});

test('BilleteraCertificados sin certificados invita a reservar', async () => {
  apiFetchMock.mockResolvedValueOnce({ credenciales: [] } as never);
  render(<BilleteraCertificados token="t" />);
  expect(await screen.findByText(/Aún no tienes certificados/)).toBeInTheDocument();
});
