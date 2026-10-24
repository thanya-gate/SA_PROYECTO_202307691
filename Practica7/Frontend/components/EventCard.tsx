import Link from 'next/link';
import type { EventSummary } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function EventCard({ event }: { event: EventSummary }) {
  const available = event.availableSeats > 0;

  return (
    <article className="event-card">
      <div className="event-card__visual">EVENTO ACADÉMICO</div>
      <div className="event-card__content">
        <h2>{event.title}</h2>
        <p>Curso: {event.course}</p>
        <p>Ponente: {event.speaker}</p>
        <p>
          {event.date} · {event.modality}
        </p>
        <div className="event-card__footer">
          <StatusBadge status={available ? 'DISPONIBLE' : 'SIN_CUPO'} />
          <Link className="button button--primary" href={`/evento?eventId=${encodeURIComponent(event.eventId)}`}>
            Ver detalle
          </Link>
        </div>
      </div>
    </article>
  );
}
