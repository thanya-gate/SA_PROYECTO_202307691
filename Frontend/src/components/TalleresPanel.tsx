import { useEffect, useRef, useState } from 'react';
import { academixApi, reservaTerminada, type EstadoReserva, type TallerAcademix } from '../api/academix';
import { Button } from './ui/Button';

const INTERVALO_MS = 2000;
const INTENTOS_MAX = 15;

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'En cola…',
  CONFIRMADA: 'Reserva confirmada',
  RECHAZADA: 'Reserva rechazada',
  SIN_CUPO: 'Sin cupo disponible',
};

// Talleres y conferencias de Academix Pass asociados al curso de la clase.
// La reserva se encola en RabbitMQ de Academix; aquí se consulta su estado.
export function TalleresPanel({ curso, token }: { curso: string; token: string }) {
  const [talleres, setTalleres] = useState<TallerAcademix[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reservas, setReservas] = useState<Record<string, EstadoReserva | { estado: string; mensaje: string }>>({});
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let active = true;
    academixApi
      .talleres(curso, token)
      .then((res) => active && setTalleres(res.eventos ?? []))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Academix no disponible'));
    return () => {
      active = false;
      timers.current.forEach(clearTimeout);
    };
  }, [curso, token]);

  function seguir(eventoId: string, trackingId: string, intento = 0) {
    const id = window.setTimeout(async () => {
      try {
        const estado = await academixApi.estadoReserva(trackingId, token);
        setReservas((prev) => ({ ...prev, [eventoId]: estado }));
        if (!reservaTerminada(estado.estado) && intento + 1 < INTENTOS_MAX) seguir(eventoId, trackingId, intento + 1);
      } catch {
        if (intento + 1 < INTENTOS_MAX) seguir(eventoId, trackingId, intento + 1);
      }
    }, INTERVALO_MS);
    timers.current.push(id);
  }

  async function reservar(eventoId: string) {
    setReservas((prev) => ({ ...prev, [eventoId]: { estado: 'PENDIENTE', mensaje: 'Enviando solicitud…' } }));
    try {
      const aceptada = await academixApi.reservar(eventoId, token);
      setReservas((prev) => ({ ...prev, [eventoId]: { estado: aceptada.estado || 'PENDIENTE', mensaje: aceptada.mensaje } }));
      seguir(eventoId, aceptada.trackingId);
    } catch (err) {
      setReservas((prev) => ({
        ...prev,
        [eventoId]: { estado: 'RECHAZADA', mensaje: err instanceof Error ? err.message : 'No se pudo reservar' },
      }));
    }
  }

  return (
    <div className="clase__ficha" aria-label="Talleres y conferencias de Academix Pass">
      <h2 className="clase__ficha-titulo">Talleres y conferencias</h2>
      {error ? (
        <p className="catalogo__estado">{error}</p>
      ) : talleres.length === 0 ? (
        <p className="catalogo__estado">No hay talleres de Academix Pass para este curso.</p>
      ) : (
        <ul className="talleres">
          {talleres.map((t) => {
            const reserva = reservas[t.eventoId];
            const ticket = reserva && 'ticket' in reserva ? reserva.ticket : undefined;
            return (
              <li key={t.eventoId} className="talleres__item">
                <strong>{t.titulo}</strong>
                <span className="talleres__meta">
                  {t.ponente} · {new Date(t.fecha).toLocaleDateString('es-GT')} · {t.modalidad} · {t.cuposDisponibles}/
                  {t.cuposTotales} cupos
                </span>
                {reserva ? (
                  <span className="talleres__estado" role="status">
                    {ETIQUETA_ESTADO[reserva.estado] ?? reserva.estado}
                    {ticket ? ` · Código ${ticket.codigoValidacion}` : ''}
                  </span>
                ) : (
                  <Button type="button" variant="secondary" disabled={t.cuposDisponibles <= 0} onClick={() => reservar(t.eventoId)}>
                    {t.cuposDisponibles > 0 ? 'Reservar' : 'Sin cupo'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
