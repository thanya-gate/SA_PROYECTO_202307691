'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell, MockContractNote, PageIntro } from '@/components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/Feedback';
import { EventCard } from '@/components/EventCard';
import { listEvents } from '@/lib/mock-api';
import type { EventSummary } from '@/lib/types';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Intenta nuevamente en unos momentos.';
}

export function CatalogClient() {
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') ?? undefined;
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback((search: string) => {
    let active = true;
    setLoading(true);
    setError(null);
    void listEvents(search, scenario)
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setEvents([]);
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scenario]);

  useEffect(() => loadEvents(''), [loadEvents]);

  return (
    <AppShell>
      <section className="page-section page-section--catalog">
        <PageIntro
          caseId="CU-P7-01"
          title="Eventos académicos"
          description="Consulta actividades disponibles y revisa sus cupos antes de reservar."
        />

        <form
          className="catalog-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            loadEvents(query);
          }}
        >
          <div className="form-field catalog-search__field">
            <label htmlFor="event-search">Buscar evento</label>
            <input
              id="event-search"
              type="search"
              placeholder="Nombre, curso o ponente"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="button button--secondary catalog-search__button" type="submit">
            Filtrar
          </button>
          <span className="catalog-search__source">Datos de catálogo · mock</span>
        </form>

        {loading && <LoadingState label="Cargando eventos…" />}
        {!loading && error && <ErrorState message={error} onRetry={() => loadEvents(query)} />}
        {!loading && !error && events.length === 0 && (
          <EmptyState message="No hay eventos publicados que coincidan con la consulta." />
        )}
        {!loading && !error && events.length > 0 && (
          <div className="event-grid" aria-label="Eventos publicados">
            {events.map((event) => <EventCard key={event.eventId} event={event} />)}
          </div>
        )}

        <MockContractNote>Los eventos se muestran desde el contrato mock GET /mock/events.</MockContractNote>
      </section>
    </AppShell>
  );
}
