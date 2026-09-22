'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppShell, MockContractNote, PageIntro } from '@/components/AppShell';
import { ErrorState, LoadingState } from '@/components/Feedback';
import { StatusBadge } from '@/components/StatusBadge';
import { getEvent } from '@/lib/mock-api';
import type { EventDetail } from '@/lib/types';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Intenta nuevamente en unos momentos.';
}

export function EventDetailClient() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId') ?? '';
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState<string | null>(eventId ? null : 'No se indicó un evento válido.');

  const loadEvent = useCallback(() => {
    if (!eventId) {
      setLoading(false);
      setError('No se indicó un evento válido.');
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void getEvent(eventId)
      .then((result) => {
        if (active) setEvent(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setEvent(null);
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => loadEvent(), [loadEvent]);

  return (
    <AppShell>
      <section className="page-section">
        <Link className="back-link" href="/">← Volver a eventos</Link>
        <PageIntro
          caseId="CU-P7-02"
          title="Detalle del evento"
          description="Revisa la información completa, los prerrequisitos y la disponibilidad actual."
        />

        {loading && <LoadingState label="Consultando detalle del evento…" />}
        {!loading && error && (
          <div className="stack stack--small">
            <ErrorState message={error} onRetry={loadEvent} />
            <Link className="button button--secondary button--fit" href="/">Regresar al catálogo</Link>
          </div>
        )}
        {!loading && !error && event && (
          <div className="detail-layout">
            <article className="panel detail-card">
              <div className="event-card__visual">EVENTO ACADÉMICO</div>
              <h2>{event.title}</h2>
              <p className="detail-card__description">{event.description}</p>
              <dl className="detail-list">
                <div><dt>Curso</dt><dd>{event.course}</dd></div>
                <div><dt>Ponente</dt><dd>{event.speaker}</dd></div>
                <div><dt>Fecha y hora</dt><dd>{event.date}</dd></div>
                <div><dt>Modalidad</dt><dd>{event.modality}</dd></div>
                <div><dt>Cupo total</dt><dd>{event.totalSeats}</dd></div>
              </dl>
            </article>

            <aside className="panel availability-card" aria-labelledby="availability-title">
              <h2 id="availability-title">Disponibilidad</h2>
              <StatusBadge status={event.availableSeats > 0 ? 'DISPONIBLE' : 'SIN_CUPO'} />
              <p className="availability-card__number">{event.availableSeats}</p>
              <p>cupos disponibles</p>
              <div className="prerequisites">
                <h3>Prerrequisitos</h3>
                {event.prerequisites.length > 0 ? (
                  <ul>{event.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : (
                  <p>No hay prerrequisitos registrados.</p>
                )}
              </div>
              {event.availableSeats > 0 ? (
                <Link className="button button--primary button--full" href={`/reservar?eventId=${encodeURIComponent(event.eventId)}`}>
                  Iniciar reserva
                </Link>
              ) : (
                <button className="button button--primary button--full" type="button" disabled>
                  Reserva no disponible
                </button>
              )}
            </aside>
          </div>
        )}

        <MockContractNote>La vista utiliza GET /mock/events/{'{eventId}'} y no crea una reserva durante la consulta.</MockContractNote>
      </section>
    </AppShell>
  );
}
