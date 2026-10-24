import {
  createReservation,
  getEvent,
  getReservation,
  listEvents,
  verifyCredential,
} from '@/lib/mock-api';
import { MockApiError } from '@/lib/types';

async function settle<T>(promise: Promise<T>): Promise<T> {
  return await promise;
}

describe('adaptadores de contratos mock', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('lista, filtra y expone el evento sin cupo', async () => {
    await expect(settle(listEvents())).resolves.toHaveLength(3);
    await expect(settle(listEvents('laboratorio'))).resolves.toEqual([
      expect.objectContaining({ eventId: 'evt-lab' }),
    ]);
    await expect(settle(getEvent('evt-cert'))).resolves.toEqual(
      expect.objectContaining({ availableSeats: 0 }),
    );
  });

  it('representa catálogo vacío y errores de comunicación', async () => {
    await expect(settle(listEvents('', 'empty'))).resolves.toEqual([]);
    await expect(settle(listEvents('', 'error'))).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('crea una reserva pendiente y permite consultarla posteriormente', async () => {
    const created = await settle(createReservation({
      eventId: 'evt-soa',
      studentName: 'Persona de prueba',
      studentEmail: 'persona@ejemplo.com',
    }));

    expect(created.status).toBe('PENDIENTE');
    await expect(settle(getReservation(created.reservationId))).resolves.toMatchObject({
      status: 'PENDIENTE',
      eventId: 'evt-soa',
    });
  });

  it.each([
    ['RSV-2026-000184', 'PENDIENTE'],
    ['RSV-2026-000185', 'CONFIRMADA'],
    ['RSV-2026-000186', 'RECHAZADA'],
    ['RSV-2026-000187', 'SIN_CUPO'],
  ] as const)('devuelve el estado de reserva %s', async (reservationId, status) => {
    await expect(settle(getReservation(reservationId))).resolves.toMatchObject({ status });
  });

  it('devuelve estados de credencial y errores esperados', async () => {
    await expect(settle(verifyCredential('CERT-2026-000742'))).resolves.toMatchObject({ status: 'VÁLIDA' });
    await expect(settle(verifyCredential('CERT-INVALIDA-2026'))).resolves.toMatchObject({ status: 'INVÁLIDA' });
    await expect(settle(verifyCredential('CERT-NO-ENCONTRADA'))).resolves.toMatchObject({ status: 'NO_ENCONTRADA' });
    await expect(settle(verifyCredential('CERT-ERROR'))).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('identifica eventos y reservas inexistentes', async () => {
    await expect(settle(getEvent('evento-no-existe'))).rejects.toBeInstanceOf(MockApiError);
    await expect(settle(getReservation('RSV-NO-ENCONTRADA'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
