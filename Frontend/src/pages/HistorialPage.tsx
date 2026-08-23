import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reproduccionApi, type HistorialItem } from '../api/reproduccion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { CardThumbnail } from '../components/CardThumbnail';
import { Alert } from '../components/ui/Alert';
import { formatDuracion, formatFecha, formatSegundos, thumbnailDeClase } from '../utils/video';

export default function HistorialPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tokenActual = token ?? '';

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    reproduccionApi
      .historial(tokenActual)
      .then((res) => {
        if (active) setItems(res.items);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
          setItems([]);
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
      <section className="historial">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Historial de reproducción</h1>
          <p className="catalogo__subtitle">Las últimas clases que has reproducido, con tu punto de reanudación.</p>
        </div>

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando historial…
          </p>
        ) : items.length === 0 ? (
          <div className="historial__vacio">
            <p className="catalogo__estado">Aún no tienes reproducciones recientes.</p>
            <Link to="/catalogo" className="catalogo__volver">
              Explorar el catálogo →
            </Link>
          </div>
        ) : (
          <ul className="historial__lista" aria-label="Clases reproducidas recientemente">
            {items.map((item) => {
              const titulo = item.tema || item.curso || 'Clase sin título';
              const reanudable = item.tieneCheckpoint && item.segundoActual > 0;
              const porcentaje = Math.min(100, Math.max(0, item.porcentajeAvance));
              return (
                <li key={item.claseId}>
                  <Link to={`/catalogo/clase/${item.claseId}`} className="historial__item">
                    <CardThumbnail src={thumbnailDeClase(item.urlVideo, item.claseId)} alt={titulo} />
                    <div className="historial__item-contenido">
                      <div className="historial__item-cabecera">
                        <div>
                          <h3 className="historial__item-titulo">{titulo}</h3>
                          <p className="historial__item-meta">
                            {[item.codigo, item.curso, item.unidad, item.semestre]
                              .filter(Boolean)
                              .join(' · ')}
                            {item.anio ? ` · ${item.anio}` : ''}
                          </p>
                        </div>
                        <span className="historial__item-fecha">
                          {formatFecha(item.fechaUltimaVisualizacion)}
                        </span>
                      </div>

                      <div className="historial__item-progreso" aria-hidden="true">
                        <div
                          className="historial__item-progreso-llenado"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>

                      <div className="historial__item-pie">
                        <span className="historial__item-posicion">
                          {reanudable
                            ? `Reanudar en ${formatSegundos(item.segundoActual)} de ${formatDuracion(item.duracion)}`
                            : `Duración ${formatDuracion(item.duracion)}`}
                        </span>
                        <span className="historial__item-avance">{porcentaje.toFixed(1)}%</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
