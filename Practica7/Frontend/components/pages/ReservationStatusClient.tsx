'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell, MockContractNote, PageIntro } from '@/components/AppShell';
import { ErrorState, LoadingState } from '@/components/Feedback';
import { FormField } from '@/components/FormField';
import { StatusBadge } from '@/components/StatusBadge';
import { getReservation } from '@/lib/mock-api';
import type { ReservationRecord } from '@/lib/types';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Intenta nuevamente en unos momentos.';
}

function resultTitle(status: ReservationRecord['status']): string {
  switch (status) {
    case 'PENDIENTE': return 'Solicitud recibida';
    case 'CONFIRMADA': return 'Reserva confirmada';
    case 'RECHAZADA': return 'Reserva rechazada';
    case 'SIN_CUPO': return 'Sin cupo disponible';
  }
}

export function ReservationStatusClient() {
  const searchParams = useSearchParams();
  const queryReservationId = searchParams.get('reservationId') ?? '';
  const [reservationId, setReservationId] = useState(queryReservationId);
  const [reservation, setReservation] = useState<ReservationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReservation = useCallback(async (id: string) => {
    const normalized = id.trim();
    if (!normalized) {
      setError('Ingresa un identificador de reserva.');
      setReservation(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReservation(await getReservation(normalized));
    } catch (reason: unknown) {
      setReservation(null);
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (queryReservationId) void loadReservation(queryReservationId);
  }, [loadReservation, queryReservationId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReservation(reservationId);
  }

  return (
    <AppShell>
      <section className="page-section">
        <PageIntro
          caseId="CU-P7-04"
          title="Consultar reserva"
          description="Ingresa el identificador para conocer el resultado del procesamiento."
        />
        <form className="inline-query" onSubmit={submit}>
          <FormField
            id="reservation-id"
            label="Identificador de reserva"
            placeholder="RSV-2026-000184"
            value={reservationId}
            onChange={(input) => setReservationId(input.target.value)}
          />
          <button className="button button--primary" type="submit" disabled={loading}>
            {loading ? 'Consultando…' : 'Consultar'}
          </button>
        </form>

        {loading && <LoadingState label="Consultando el estado de la reserva…" />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && reservation && (
          <section className="panel result-card" aria-live="polite" aria-labelledby="reservation-result-title">
            <StatusBadge status={reservation.status} />
            <h2 id="reservation-result-title">{resultTitle(reservation.status)}</h2>
            <p>{reservation.message}</p>
            <hr />
            <dl className="result-details">
              <div><dt>Evento</dt><dd>{reservation.eventTitle}</dd></div>
              <div><dt>Reserva</dt><dd>{reservation.reservationId}</dd></div>
            </dl>
            {reservation.ticket && (
              <div className="ticket-card">
                <h3>Ticket generado</h3>
                <p><strong>Identificador:</strong> {reservation.ticket.ticketId}</p>
                <p><strong>Emisión:</strong> {reservation.ticket.issuedAt}</p>
                <p><strong>Actividad:</strong> {reservation.ticket.eventTitle}</p>
              </div>
            )}
            {reservation.status === 'PENDIENTE' && (
              <button className="button button--secondary button--full" type="button" onClick={() => void loadReservation(reservation.reservationId)}>
                Actualizar estado
              </button>
            )}
          </section>
        )}

        <MockContractNote>La consulta utiliza GET /mock/reservations/{'{reservationId}'}; no publica mensajes nuevos.</MockContractNote>
      </section>
    </AppShell>
  );
}
