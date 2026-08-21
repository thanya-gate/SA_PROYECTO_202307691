import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, type ClaseDetalle, type ParticipanteInput } from '../api/catalog';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

const YT_URL_REGEX = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

interface ParticipanteFila {
  nombre: string;
  rol: 'CATEDRATICO' | 'AUXILIAR';
}

function fechaParaInput(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function esVideoLocal(url: string): boolean {
  return typeof url === 'string' && url.startsWith('/media/');
}

export default function EditarClasePage() {
  const { claseId = '' } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const tokenActual = token ?? '';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [clase, setClase] = useState<ClaseDetalle | null>(null);
  const [catalogCursoId, setCatalogCursoId] = useState<string | null>(null);

  const [unidad, setUnidad] = useState('');
  const [tema, setTema] = useState('');
  const [fechaImparticion, setFechaImparticion] = useState('');
  const [semestre, setSemestre] = useState('');
  const [anio, setAnio] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [duracion, setDuracion] = useState('');

  const [etiquetaDraft, setEtiquetaDraft] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [participantes, setParticipantes] = useState<ParticipanteFila[]>([]);

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await catalogApi.getClase(claseId, tokenActual);
        if (!activo) return;
        setClase(res.clase);
        setUnidad(res.clase.unidad ?? '');
        setTema(res.clase.tema ?? '');
        setFechaImparticion(fechaParaInput(res.clase.fechaImparticion));
        setSemestre(res.clase.semestre ?? '');
        setAnio(res.clase.anio ? String(res.clase.anio) : '');
        setVideoUrl(res.clase.urlVideo ?? '');
        setMaterialUrl(res.clase.urlMaterial ?? '');
        setDuracion(res.clase.duracion > 0 ? String(Math.floor(res.clase.duracion / 60)) : '');
        setEtiquetas(res.clase.etiquetas ?? []);
        setParticipantes(
          (res.clase.participantes ?? []).map((p) => ({
            nombre: p.nombre,
            rol: p.rol === 'AUXILIAR' ? 'AUXILIAR' : 'CATEDRATICO',
          })),
        );
        try {
          const catalogo = await catalogApi.getCursoPorCodigo(res.clase.codigo, tokenActual);
          if (activo) setCatalogCursoId(catalogo.curso.cursoId);
        } catch {
          if (activo) setCatalogCursoId(null);
        }
      } catch (err: unknown) {
        if (activo) setError(err instanceof Error ? err.message : 'No se pudo cargar la clase');
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [claseId, tokenActual]);

  const agregarEtiqueta = useCallback(() => {
    const valor = etiquetaDraft.trim();
    if (!valor) return;
    setEtiquetas((prev) => (prev.includes(valor) ? prev : [...prev, valor]));
    setEtiquetaDraft('');
  }, [etiquetaDraft]);

  function quitarEtiqueta(etiqueta: string) {
    setEtiquetas((prev) => prev.filter((e) => e !== etiqueta));
  }

  function actualizarParticipante(index: number, campo: keyof ParticipanteFila, valor: string) {
    setParticipantes((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [campo]: valor } : p)),
    );
  }

  function agregarParticipante() {
    setParticipantes((prev) => [...prev, { nombre: '', rol: 'AUXILIAR' }]);
  }

  function quitarParticipante(index: number) {
    setParticipantes((prev) => prev.filter((_, i) => i !== index));
  }

  const anioValido = useMemo(() => {
    const num = Number(anio);
    return Number.isInteger(num) && num >= 2000 && num <= 2100;
  }, [anio]);

  async function guardarCambios() {
    if (!clase || !catalogCursoId) {
      setError('No se pudo resolver el curso de la clase. Intenta de nuevo.');
      return;
    }
    const videoActual = videoUrl.trim();
    const materialActual = materialUrl.trim();
    if (videoActual && !esVideoLocal(videoActual) && !YT_URL_REGEX.test(videoActual)) {
      setError('La URL del video debe ser una URL válida de YouTube (http/https).');
      return;
    }
    if (!semestre.trim()) {
      setError('El semestre es obligatorio.');
      return;
    }
    if (!anioValido) {
      setError('El año es inválido.');
      return;
    }
    const participantesValidos: ParticipanteInput[] = participantes
      .filter((p) => p.nombre.trim().length > 0)
      .map((p) => ({ nombre: p.nombre.trim(), rol: p.rol }));

    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      await catalogApi.editarClase(
        clase.claseId,
        {
          cursoId: catalogCursoId,
          unidad: unidad.trim(),
          tema: tema.trim(),
          fechaImparticion: fechaImparticion || '',
          semestre: semestre.trim(),
          anio: Number(anio),
          urlVideo: videoActual,
          urlMaterial: materialActual,
          duracion: Math.floor((Number(duracion) || 0) * 60),
          etiquetas,
          participantes: participantesValidos,
        },
        tokenActual,
      );
      setExito('Clase actualizada correctamente.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la clase');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppLayout>
      <section className="subirclase">
        <div className="catalogo__hero subirclase__hero">
          <div>
            <h1 className="catalogo__title">Editar clase</h1>
            <p className="catalogo__subtitle">
              {clase ? `${clase.codigo} · ${clase.curso} — ${clase.semestre} ${clase.anio}` : 'Cargando clase…'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/catalogo/clase/${claseId}`)}>
            Volver a la clase
          </Button>
        </div>

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando…
          </p>
        ) : error && !exito ? (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        ) : null}

        {!cargando && !error && !exito && !clase && (
          <Alert tone="error">
            <strong>Error:</strong> No se encontró la clase. <Link to="/catalogo">Volver al catálogo</Link>.
          </Alert>
        )}

        {exito && (
          <Alert tone="success">
            <strong>¡Listo!</strong> {exito}{' '}
            <button type="button" className="subirclase__enlace" onClick={() => navigate(`/catalogo/clase/${claseId}`)}>
              Ver la clase actualizada
            </button>
          </Alert>
        )}

        {!cargando && clase && !exito && (
          <div className="subirclase__form">
            <section className="subirclase__seccion">
              <h2 className="subirclase__seccion-titulo">Ficha técnica</h2>
              <p className="subirclase__seccion-desc">
                Datos que identifican la clase en el catálogo.
              </p>
              <div className="subirclase__grid">
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Unidad</span>
                  <input
                    className="subirclase__input"
                    value={unidad}
                    placeholder="Ej. Unidad 3: Capa de red"
                    onChange={(e) => setUnidad(e.target.value)}
                  />
                </label>
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Tema</span>
                  <input
                    className="subirclase__input"
                    value={tema}
                    placeholder="Ej. Direccionamiento IPv4"
                    onChange={(e) => setTema(e.target.value)}
                  />
                </label>
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Fecha de impartición</span>
                  <input
                    className="subirclase__input"
                    type="date"
                    value={fechaImparticion}
                    onChange={(e) => setFechaImparticion(e.target.value)}
                  />
                </label>
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Semestre</span>
                  <input
                    className="subirclase__input"
                    value={semestre}
                    placeholder="Ej. 2026-1"
                    onChange={(e) => setSemestre(e.target.value)}
                  />
                </label>
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Año</span>
                  <input
                    className="subirclase__input"
                    type="number"
                    min={2000}
                    max={2100}
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="subirclase__seccion">
              <h2 className="subirclase__seccion-titulo">Video y material</h2>
              <p className="subirclase__seccion-desc">
                Las grabaciones ya publicadas se conservan; puedes cambiar su enlace.
              </p>
              <div className="subirclase__grid">
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">URL del video (YouTube)</span>
                  <input
                    className="subirclase__input"
                    value={videoUrl}
                    placeholder="https://www.youtube.com/watch?v=…"
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                  {esVideoLocal(videoUrl) && (
                    <p className="subirclase__ayuda">Video alojado en la plataforma (archivo MP4).</p>
                  )}
                </label>
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Enlace de material</span>
                  <input
                    className="subirclase__input"
                    value={materialUrl}
                    placeholder="https://drive.google.com/…"
                    onChange={(e) => setMaterialUrl(e.target.value)}
                  />
                </label>
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Duración (minutos)</span>
                  <input
                    className="subirclase__input"
                    type="number"
                    min={0}
                    step={1}
                    value={duracion}
                    placeholder="Ej. 90"
                    onChange={(e) => setDuracion(e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="subirclase__seccion">
              <h2 className="subirclase__seccion-titulo">Etiquetas</h2>
              <p className="subirclase__seccion-desc">
                Facilita la búsqueda de la clase en el catálogo.
              </p>
              <div className="subirclase__grid">
                <label className="subirclase__campo">
                  <span className="subirclase__campo-label">Nueva etiqueta</span>
                  <input
                    className="subirclase__input"
                    value={etiquetaDraft}
                    placeholder="Ej. redes, capa_3"
                    onChange={(e) => setEtiquetaDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarEtiqueta();
                      }
                    }}
                  />
                </label>
              </div>
              {etiquetas.length > 0 && (
                <div className="subirclase__chips">
                  {etiquetas.map((etiqueta) => (
                    <span key={etiqueta} className="subirclase__chip">
                      {etiqueta}
                      <button
                        type="button"
                        className="subirclase__chip-eliminar"
                        aria-label={`Quitar etiqueta ${etiqueta}`}
                        onClick={() => quitarEtiqueta(etiqueta)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="subirclase__seccion">
              <div className="subirclase__seccion-cabecera">
                <div>
                  <h2 className="subirclase__seccion-titulo">Participantes</h2>
                  <p className="subirclase__seccion-desc">
                    Quiénes participan en la clase grabada.
                  </p>
                </div>
                <Button variant="secondary" onClick={agregarParticipante}>
                  Agregar participante
                </Button>
              </div>
              <div className="subirclase__participantes">
                {participantes.map((participante, index) => (
                  <div key={index} className="subirclase__participante">
                    <input
                      className="subirclase__input"
                      value={participante.nombre}
                      placeholder="Nombre completo"
                      onChange={(e) => actualizarParticipante(index, 'nombre', e.target.value)}
                    />
                    <select
                      className="catalogo__select"
                      value={participante.rol}
                      onChange={(e) =>
                        actualizarParticipante(index, 'rol', e.target.value as ParticipanteFila['rol'])
                      }
                    >
                      <option value="CATEDRATICO">Catedrático</option>
                      <option value="AUXILIAR">Auxiliar</option>
                    </select>
                    <button
                      type="button"
                      className="subirclase__quitar"
                      aria-label="Quitar participante"
                      onClick={() => quitarParticipante(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="subirclase__acciones">
              <Button onClick={guardarCambios} loading={guardando}>
                Guardar cambios
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/catalogo/clase/${claseId}`)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
