import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { catalogApi, type Capitulo, type ClaseExterna } from '../api/catalog';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { ChapterTimeline } from '../components/ChapterTimeline';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { Alert } from '../components/ui/Alert';
import { formatSegundos, youtubeVideoId } from '../utils/video';

// Los marcadores del contrato federado se adaptan al formato de capítulos local
// para reutilizar el reproductor y la línea de tiempo existentes.
export function aCapitulos(clase: ClaseExterna): Capitulo[] {
  return clase.capitulos.map((c, i) => ({
    capituloId: `${clase.id}-${i}`,
    claseId: clase.id,
    titulo: c.titulo,
    inicioSegundos: c.inicioSeg,
    finSegundos: c.finSeg,
    orden: i,
    fechaCreacion: '',
    fechaActualizacion: '',
  }));
}

export default function ClaseExternaPage() {
  const { id = '' } = useParams();
  const { token } = useAuth();
  const [clase, setClase] = useState<ClaseExterna | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [segundos, setSegundos] = useState(0);
  const seekRef = useRef<(s: number) => void>(() => {});

  useEffect(() => {
    let active = true;
    setCargando(true);
    catalogApi
      .getExterna(id, token ?? '')
      .then((res) => active && setClase(res.clase))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Clase externa no disponible'))
      .finally(() => active && setCargando(false));
    return () => {
      active = false;
    };
  }, [id, token]);

  const capitulos = useMemo(() => (clase ? aCapitulos(clase) : []), [clase]);

  if (cargando) {
    return (
      <AppLayout>
        <p className="catalogo__estado" role="status">
          Cargando clase externa…
        </p>
      </AppLayout>
    );
  }

  if (error || !clase) {
    return (
      <AppLayout>
        <div className="clase__error">
          <Alert tone="error">
            <strong>Error:</strong> {error ?? 'Clase externa no disponible'}
          </Alert>
          <Link to="/catalogo" className="catalogo__volver">
            ← Volver al catálogo
          </Link>
        </div>
      </AppLayout>
    );
  }

  const videoId = clase.tipoVideo === 'youtube' ? youtubeVideoId(clase.videoUrl) : null;
  const duracion = clase.duracionSeg ?? capitulos[capitulos.length - 1]?.finSegundos ?? 0;

  return (
    <AppLayout>
      <section className="clase">
        <Link to="/catalogo" className="catalogo__volver">
          ← Volver al catálogo
        </Link>

        <div className="clase__grid">
          <div className="clase__principal">
            <div className="clase__player">
              {videoId ? (
                <YouTubePlayer
                  videoId={videoId}
                  startSeconds={0}
                  onReady={(player) => {
                    seekRef.current = (s) => player.seekTo(s, true);
                  }}
                  onTick={setSegundos}
                  capitulos={capitulos}
                />
              ) : clase.videoUrl ? (
                <LocalVideoPlayer
                  src={clase.videoUrl}
                  startSeconds={0}
                  onReady={(player) => {
                    seekRef.current = (s) => player.seekTo(s);
                  }}
                  onTick={setSegundos}
                  capitulos={capitulos}
                />
              ) : (
                <p className="clase__sin-video">No hay video disponible para esta clase.</p>
              )}
            </div>

            <ChapterTimeline
              capitulos={capitulos}
              duracion={duracion}
              currentSeconds={segundos}
              onSeek={(s) => seekRef.current(s)}
            />
          </div>

          <div>
            <span className="clase-card__origen clase-card__origen--externa">
              Grabación Externa – {clase.origen.grupo}
            </span>
            <h1 className="clase__titulo">{clase.curso}</h1>
            <p className="clase__subtitulo">
              {clase.codigoCurso ? `${clase.codigoCurso} · ` : ''}
              {clase.titulo}
            </p>

            <div className="clase__ficha" aria-label="Ficha técnica de la clase externa">
              <h2 className="clase__ficha-titulo">Ficha técnica</h2>
              <dl className="clase__ficha-lista">
                <div>
                  <dt>Institución</dt>
                  <dd>{clase.origen.institucion}</dd>
                </div>
                <div>
                  <dt>Catedrático</dt>
                  <dd>{clase.catedratico || '—'}</dd>
                </div>
                <div>
                  <dt>Unidad</dt>
                  <dd>{clase.unidad || '—'}</dd>
                </div>
                <div>
                  <dt>Semestre / Año</dt>
                  <dd>
                    {clase.semestre || '—'} · {clase.anio ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{duracion > 0 ? formatSegundos(duracion) : '—'}</dd>
                </div>
              </dl>
            </div>

            {clase.notasMd && (
              <div className="clase__ficha" aria-label="Notas de la clase">
                <h2 className="clase__ficha-titulo">Notas de la clase</h2>
                <Markdown>{clase.notasMd}</Markdown>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
