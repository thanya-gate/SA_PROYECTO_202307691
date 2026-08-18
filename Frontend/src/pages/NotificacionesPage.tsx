import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { listarNotificaciones, type Notificacion } from '../api/notificaciones';
import { formatFecha } from '../utils/video';

function estadoBadge(estado: string): string {
  switch (estado) {
    case 'ENVIADA':
      return 'notificaciones__badge notificaciones__badge--enviada';
    case 'PENDIENTE':
      return 'notificaciones__badge notificaciones__badge--pendiente';
    case 'FALLIDA':
      return 'notificaciones__badge notificaciones__badge--fallida';
    default:
      return 'notificaciones__badge';
  }
}

function tipoIcon(tipo: string): string {
  switch (tipo) {
    case 'REGISTRO':
      return '✓';
    case 'NUEVA_CLASE':
      return '▶';
    case 'AVISO':
      return '!';
    default:
      return '•';
  }
}

export default function NotificacionesPage() {
  const { token } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tokenActual = token ?? '';

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    listarNotificaciones(tokenActual)
      .then((res) => {
        if (active) setNotificaciones(res);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las notificaciones');
          setNotificaciones([]);
        }
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => {
      active = false;
    };
  }, [tokenActual]);

  return (
    <AppLayout>
      <section className="notificaciones">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Notificaciones</h1>
          <p className="catalogo__subtitle">Correos electronicos enviados por el sistema.</p>
        </div>

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando notificaciones...
          </p>
        ) : notificaciones.length === 0 ? (
          <div className="notificaciones__vacio">
            <p className="catalogo__estado">No tienes notificaciones aun.</p>
          </div>
        ) : (
          <ul className="notificaciones__lista" aria-label="Lista de notificaciones">
            {notificaciones.map((n) => (
              <li key={n.id} className="notificaciones__item">
                <div className="notificaciones__item-icono">{tipoIcon(n.tipo)}</div>
                <div className="notificaciones__item-contenido">
                  <div className="notificaciones__item-cabecera">
                    <h3 className="notificaciones__item-asunto">{n.asunto}</h3>
                    <span className={estadoBadge(n.estado)}>{n.estado}</span>
                  </div>
                  <p className="notificaciones__item-cuerpo">{n.cuerpo}</p>
                  <div className="notificaciones__item-meta">
                    <span>{formatFecha(n.fecha_creacion)}</span>
                    {n.fecha_envio && <span>Enviado: {formatFecha(n.fecha_envio)}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
