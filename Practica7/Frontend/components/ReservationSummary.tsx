import type { EventDetail } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function ReservationSummary({ event }: { event: EventDetail }) {
  return (
    <section className="panel reservation-summary" aria-labelledby="event-summary-title">
      <h2 id="event-summary-title">Resumen del evento</h2>
      <h3>{event.title}</h3>
      <p>{event.date} · {event.modality}</p>
      <p>{event.speaker}</p>
      <StatusBadge status={event.availableSeats > 0 ? 'DISPONIBLE' : 'SIN_CUPO'} />
      <p className="panel-note">
        {event.availableSeats > 0
          ? 'La solicitud iniciará en estado PENDIENTE.'
          : 'Este evento no permite iniciar nuevas reservas.'}
      </p>
    </section>
  );
}
