import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, type ClaseDetalle, type ClaseResumen } from '../api/catalog';
import { reproduccionApi, type Checkpoint, type HistorialItem } from '../api/reproduccion';
import { mediaApi } from '../api/media';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { YT_STATE, YouTubePlayer } from '../components/YouTubePlayer';
import { LocalVideoPlayer } from '../components/LocalVideoPlayer';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { esVideoLocal, formatDuracion, formatFecha, formatSegundos, youtubeVideoId } from '../utils/video';

const CHECKPOINT_INTERVAL_SECONDS = 15;

export default function ClasePage() {
  const { claseId = '' } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [clase, setClase] = useState<ClaseDetalle | null>(null);
  const [relacionadas, setRelacionadas] = useState<ClaseResumen[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkpoint (CDU0005.2 / CDU0005.3)
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);
  const [reanudando, setReanudando] = useState(false);

  // Valoración (1..5)
  const [puntuacion, setPuntuacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [calificando, setCalificando] = useState(false);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);
  const [errorCalificacion, setErrorCalificacion] = useState<string | null>(null);

  // Video de la clase (solo CATEDRATICO/ADMIN)
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [videoSubido, setVideoSubido] = useState<string | null>(null);
  const [urlVideoInput, setUrlVideoInput] = useState('');
  const [guardandoUrl, setGuardandoUrl] = useState(false);

  // Edición / eliminación de la clase (CRUD)
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const ultimoSegundoRef = useRef(0);
  const ultimoGuardadoRef = useRef(0);

  const tokenActual = token ?? '';
  const videoId = clase ? youtubeVideoId(clase.urlVideo) : null;
  const videoLocal = clase ? esVideoLocal(clase.urlVideo) : false;
  const puedeSubirVideo = (user?.roles ?? []).some((rol) => rol === 'ROLE_CATEDRATICO' || rol === 'ROLE_ADMIN' || rol === 'ROLE_AUXILIAR');

  const guardarCheckpoint = useCallback(
    async (segundos: number) => {
      if (!clase || !tokenActual) return;
      const seg = Math.floor(Math.max(0, segundos));
      try {
        const res = await reproduccionApi.guardarCheckpoint(clase.claseId, seg, clase.duracion, tokenActual);
        ultimoGuardadoRef.current = seg;
        setHistorialId(res.historialId);
        setCheckpoint((prev) =>
          prev
            ? { ...prev, historialId: res.historialId, segundoActual: seg, porcentajeAvance: res.porcentajeAvance }
            : prev,
        );
      } catch {
        // Best-effort: no interrumpir la reproducción si el guardado falla.
      }
    },
    [clase, tokenActual],
  );

  const guardarCheckpointRef = useRef(guardarCheckpoint);
  guardarCheckpointRef.current = guardarCheckpoint;

  useEffect(() => {
    return () => {
      if (ultimoSegundoRef.current > 0) {
        void guardarCheckpointRef.current(ultimoSegundoRef.current);
      }
    };
  }, []);

  const handleTick = useCallback(
    (seconds: number) => {
      ultimoSegundoRef.current = seconds;
      if (seconds - ultimoGuardadoRef.current >= CHECKPOINT_INTERVAL_SECONDS) {
        void guardarCheckpoint(seconds);
      }
    },
    [guardarCheckpoint],
  );

  const handleStateChange = useCallback(
    (state: number) => {
      if (state === YT_STATE.PLAYING) {
        setReanudando(false);
      }
      if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) {
        void guardarCheckpoint(ultimoSegundoRef.current);
      }
    },
    [guardarCheckpoint],
  );

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    catalogApi
      .getClase(claseId, tokenActual)
      .then(async (res) => {
        if (!active) return;
        setClase(res.clase);
        void catalogApi
          .search({ curso: res.clase.codigo }, tokenActual)
          .then((rel) => {
            if (active) setRelacionadas(rel.resultados.filter((c) => c.claseId !== claseId));
          })
          .catch(() => {
          });

        const cp = await reproduccionApi.obtenerCheckpoint(claseId, tokenActual).catch(() => ({ checkpoint: null }));
        if (!active) return;
        if (cp.checkpoint) {
          setCheckpoint(cp.checkpoint);
          setHistorialId(cp.checkpoint.historialId);
          if (cp.checkpoint.segundoActual > 0) {
            setReanudando(true);
          }
        }

        const hist = await reproduccionApi.historial(tokenActual).catch(() => ({ items: [] }));
        if (active) setHistorial(hist.items);
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

  async function enviarCalificacion() {
    if (!historialId || puntuacion === 0) return;
    setCalificando(true);
    setErrorCalificacion(null);
    try {
      await reproduccionApi.registrarCalificacion(historialId, puntuacion, comentario.trim(), tokenActual);
      setCalificacionEnviada(true);
    } catch (err) {
      setErrorCalificacion(err instanceof Error ? err.message : 'No se pudo registrar la valoración');
    } finally {
      setCalificando(false);
    }
  }

  async function manejarSubidaVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !clase || !tokenActual) return;
    setSubiendoVideo(true);
    setErrorSubida(null);
    setVideoSubido(null);
    try {
      const res = await mediaApi.subirVideo(clase.claseId, file, tokenActual);
      setClase((prev) => (prev ? { ...prev, urlVideo: res.urlVideo } : prev));
      setVideoSubido(res.urlVideo);
    } catch (err) {
      setErrorSubida(err instanceof Error ? err.message : 'No se pudo subir el video');
    } finally {
      setSubiendoVideo(false);
    }
  }

  async function manejarUrlVideo() {
    const url = urlVideoInput.trim();
    if (!url || !clase || !tokenActual) return;
    setGuardandoUrl(true);
    setErrorSubida(null);
    setVideoSubido(null);
    try {
      await mediaApi.establecerUrlVideo(clase.claseId, url, tokenActual);
      setClase((prev) => (prev ? { ...prev, urlVideo: url } : prev));
      setVideoSubido(url);
    } catch (err) {
      setErrorSubida(err instanceof Error ? err.message : 'No se pudo guardar la URL del video');
    } finally {
      setGuardandoUrl(false);
    }
  }

  async function eliminarClase() {
    if (!clase || !tokenActual) return;
    const confirmacion = window.confirm(
      `¿Eliminar la clase "${clase.tema || clase.curso}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmacion) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await catalogApi.eliminarClase(clase.claseId, tokenActual);
      navigate('/catalogo');
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : 'No se pudo eliminar la clase');
    } finally {
      setEliminando(false);
    }
  }

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

  const catedraticos = clase.participantes.filter((p) => p.rol === 'CATEDRATICO');
  const auxiliares = clase.participantes.filter((p) => p.rol === 'AUXILIAR');
  const continuarViendo = historial.filter((item) => item.claseId !== claseId).slice(0, 5);

  return (
    <AppLayout>
      <section className="clase">
        <Link to="/catalogo" className="catalogo__volver">
          ← Volver al catálogo
        </Link>

        {reanudando && (
          <Alert tone="info">
            Reanudando desde <strong>{formatSegundos(checkpoint?.segundoActual ?? 0)}</strong> — tu último checkpoint
            guardado.
          </Alert>
        )}

        {puedeSubirVideo && (
          <div className="clase__admin-acciones">
            <Button variant="secondary" onClick={() => navigate(`/catalogo/clase/${clase.claseId}/editar`)}>
              Editar clase
            </Button>
            <Button variant="danger" onClick={() => void eliminarClase()} disabled={eliminando} loading={eliminando}>
              {eliminando ? 'Eliminando…' : 'Eliminar clase'}
            </Button>
            {errorEliminar && <Alert tone="error">{errorEliminar}</Alert>}
          </div>
        )}

        <div className="clase__grid">
          <div className="clase__principal">
            <div className="clase__player">
              {videoId ? (
                <YouTubePlayer
                  videoId={videoId}
                  startSeconds={checkpoint?.segundoActual ?? 0}
                  onTick={handleTick}
                  onStateChange={handleStateChange}
                />
              ) : videoLocal ? (
                <LocalVideoPlayer
                  src={clase.urlVideo}
                  startSeconds={checkpoint?.segundoActual ?? 0}
                  onTick={handleTick}
                  onStateChange={handleStateChange}
                />
              ) : (
                <p className="clase__sin-video">No hay video disponible para esta clase.</p>
              )}
            </div>

            {puedeSubirVideo && (
              <div className="clase__subida">
                <h2 className="clase__ficha-titulo">Video de esta clase</h2>

                <p className="clase__subida-desc">
                  Sube un archivo MP4 para alojarlo en la plataforma (volumen Docker) o usa una URL de YouTube.
                </p>
                <label className="clase__subida-input">
                  <input type="file" accept="video/mp4,video/*" onChange={manejarSubidaVideo} disabled={subiendoVideo} />
                  <span>{subiendoVideo ? 'Subiendo…' : 'Seleccionar archivo MP4'}</span>
                </label>

                <div className="clase__subida-url">
                  <input
                    type="url"
                    value={urlVideoInput}
                    onChange={(e) => setUrlVideoInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    disabled={guardandoUrl}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void manejarUrlVideo()}
                    disabled={guardandoUrl || urlVideoInput.trim().length === 0}
                  >
                    {guardandoUrl ? 'Guardando…' : 'Usar URL'}
                  </Button>
                </div>

                {videoSubido && <Alert tone="info">Video actualizado. El reproductor usará la nueva fuente.</Alert>}
                {errorSubida && <Alert tone="error">{errorSubida}</Alert>}
              </div>
            )}

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

            {historialId && (
              <form
                className="clase__valoracion"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviarCalificacion();
                }}
              >
                <h2 className="clase__ficha-titulo">Valorar esta clase</h2>
                <div className="clase__valoracion-estrellas" role="radiogroup" aria-label="Puntuación de 1 a 5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`clase__estrella${puntuacion >= n ? ' clase__estrella--activa' : ''}`}
                      aria-label={`${n} de 5`}
                      onClick={() => setPuntuacion(n)}
                      disabled={calificando}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  className="clase__valoracion-comentario"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Deja un comentario (opcional)"
                  rows={3}
                  disabled={calificando}
                />
                <div className="clase__valoracion-acciones">
                  <Button type="submit" disabled={puntuacion === 0 || calificando}>
                    {calificando ? 'Enviando…' : 'Enviar valoración'}
                  </Button>
                  {calificacionEnviada && <span className="clase__valoracion-ok">¡Gracias por tu valoración!</span>}
                </div>
                {errorCalificacion && <Alert tone="error">{errorCalificacion}</Alert>}
              </form>
            )}

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

            <h2 className="clase__ficha-titulo">Continuar viendo</h2>
            {continuarViendo.length === 0 ? (
              <p className="clase__estado">Aún no tienes reproducciones recientes.</p>
            ) : (
              <ul className="clase__lateral-lista">
                {continuarViendo.map((item) => (
                  <li key={item.claseId}>
                    <Link to={`/catalogo/clase/${item.claseId}`} className="clase__lateral-item">
                      <span className="clase__lateral-titulo">{item.tema || item.curso || 'Clase'}</span>
                      <span className="clase__lateral-meta">
                        {item.semestre}
                        {item.anio ? ` · ${item.anio}` : ''}
                      </span>
                      <div className="clase__historial-progreso" aria-hidden="true">
                        <div
                          className="clase__historial-progreso-llenado"
                          style={{ width: `${Math.min(100, Math.max(0, item.porcentajeAvance))}%` }}
                        />
                      </div>
                      <span className="clase__historial-reanudar">
                        {item.tieneCheckpoint && item.segundoActual > 0
                          ? `Reanudar en ${formatSegundos(item.segundoActual)}`
                          : 'Ver clase'}
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
