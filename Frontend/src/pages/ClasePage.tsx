import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogApi, type ClaseDetalle, type ClaseResumen } from '../api/catalog';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { formatDuracion, formatFecha, youtubeEmbedUrl } from '../utils/video';

export default function ClasePage() {
  const { claseId = '' } = useParams();
  const { token } = useAuth();
  const [clase, setClase] = useState<ClaseDetalle | null>(null);
  const [relacionadas, setRelacionadas] = useState<ClaseResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tokenActual = token ?? '';

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    catalogApi
      .getClase(claseId, tokenActual)
      .then((res) => {
        if (active) {
          setClase(res.clase);
          void catalogApi
            .search({ curso: res.clase.codigo }, tokenActual)
            .then((rel) => {
              if (active) setRelacionadas(rel.resultados.filter((c) => c.claseId !== claseId));
            })
            .catch(() => {
            });
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la clase');
          setClase(null);
        }
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => {
      active = false;
    };
  }, [claseId, tokenActual]);

  if (cargando) {
    return (
      <AppLayout>
        <p className="catalogo__estado" role="status">
          Cargando clase…
        </p>
      </AppLayout>
    );
  }

  if (error || !clase) {
    return (
      <AppLayout>
        <div className="clase__error">
          <Alert tone="error">
            <strong>Error:</strong> {error ?? 'Clase no encontrada'}
          </Alert>
          <Link to="/catalogo" className="catalogo__volver">
            ← Volver al catálogo
          </Link>
        </div>
      </AppLayout>
    );
  }

  const embedUrl = youtubeEmbedUrl(clase.urlVideo);
  const catedraticos = clase.participantes.filter((p) => p.rol === 'CATEDRATICO');
  const auxiliares = clase.participantes.filter((p) => p.rol === 'AUXILIAR');

  return (
    <AppLayout>
      <section className="clase">
        <Link to="/catalogo" className="catalogo__volver">
          ← Volver al catálogo
        </Link>

        <div className="clase__grid">
          <div className="clase__principal">
            <div className="clase__player">
              {embedUrl ? (
                <iframe
                  className="clase__iframe"
                  src={embedUrl}
                  title={`Reproductor: ${clase.curso} — ${clase.tema}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <p className="clase__sin-video">No hay video disponible para esta clase.</p>
              )}
            </div>

            <h1 className="clase__titulo">{clase.curso}</h1>
            <p className="clase__subtitulo">
              {clase.codigo} · {clase.tema}
            </p>

            <div className="clase__etiquetas">
              {clase.etiquetas.map((etiqueta) => (
                <span key={etiqueta} className="clase__etiqueta">
                  #{etiqueta}
                </span>
              ))}
            </div>

            <div className="clase__ficha" aria-label="Ficha técnica de la clase">
              <h2 className="clase__ficha-titulo">Ficha técnica</h2>
              <dl className="clase__ficha-lista">
                <div>
                  <dt>Unidad del programa</dt>
                  <dd>{clase.unidad || '—'}</dd>
                </div>
                <div>
                  <dt>Fecha de impartición</dt>
                  <dd>{formatFecha(clase.fechaImparticion)}</dd>
                </div>
                <div>
                  <dt>Semestre / Año</dt>
                  <dd>
                    {clase.semestre} · {clase.anio}
                  </dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{formatDuracion(clase.duracion)}</dd>
                </div>
                <div>
                  <dt>Escuela</dt>
                  <dd>{clase.escuela || '—'}</dd>
                </div>
                <div>
                  <dt>Publicado</dt>
                  <dd>{formatFecha(clase.fechaPublicacion)}</dd>
                </div>
              </dl>
            </div>

            {clase.urlMaterial && (
              <div className="clase__material">
                <h2 className="clase__ficha-titulo">Material adjunto</h2>
                <a
                  className="clase__material-link"
                  href={clase.urlMaterial}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir sílabo / material de la clase ↗
                </a>
              </div>
            )}

            <div className="clase__participantes">
              <h2 className="clase__ficha-titulo">Docentes y auxiliares</h2>
              {catedraticos.length === 0 && auxiliares.length === 0 ? (
                <p className="clase__estado">Sin participantes registrados.</p>
              ) : (
                <ul className="clase__participantes-lista">
                  {catedraticos.map((p) => (
                    <li key={`${p.nombre}-${p.rol}`} className="clase__participante">
                      <span className="clase__participante-nombre">{p.nombre}</span>
                      <span className="clase__rol clase__rol--catedratico">Catedrático</span>
                    </li>
                  ))}
                  {auxiliares.map((p) => (
                    <li key={`${p.nombre}-${p.rol}`} className="clase__participante">
                      <span className="clase__participante-nombre">{p.nombre}</span>
                      <span className="clase__rol clase__rol--auxiliar">Auxiliar</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <aside className="clase__lateral" aria-label="Clases del curso">
            <h2 className="clase__ficha-titulo">Clases de {clase.codigo}</h2>
            {relacionadas.length === 0 ? (
              <p className="clase__estado">No hay más clases publicadas de este curso.</p>
            ) : (
              <ul className="clase__lateral-lista">
                {relacionadas.map((c) => (
                  <li key={c.claseId}>
                    <Link to={`/catalogo/clase/${c.claseId}`} className="clase__lateral-item">
                      <span className="clase__lateral-titulo">{c.tema || c.curso}</span>
                      <span className="clase__lateral-meta">
                        {c.semestre} · {c.anio}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}
