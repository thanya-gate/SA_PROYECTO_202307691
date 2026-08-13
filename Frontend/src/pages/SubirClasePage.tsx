import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { catalogApi, type ClaseResumen } from '../api/catalog';
import { inscripcionApi, type CursoCatedraticoItem } from '../api/inscripcion';
import { mediaApi } from '../api/media';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

const YT_URL_REGEX = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

interface ParticipanteFila {
  nombre: string;
  rol: 'CATEDRATICO' | 'AUXILIAR';
}

function semestreCorto(semestre: string): string {
  const partes = semestre.split('-');
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : semestre;
}

export default function SubirClasePage() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const tokenActual = token ?? '';
  const modo = searchParams.get('modo') === 'material' ? 'material' : 'clase';
  const returnTo = searchParams.get('returnTo') || '/mis-cursos';

  const [curso, setCurso] = useState<CursoCatedraticoItem | null>(null);
  const [catalogCursoId, setCatalogCursoId] = useState<string | null>(null);
  const [cargandoCurso, setCargandoCurso] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [exitoClaseId, setExitoClaseId] = useState<string | null>(null);

  const [unidad, setUnidad] = useState('');
  const [tema, setTema] = useState('');
  const [fechaImparticion, setFechaImparticion] = useState('');
  const [semestre, setSemestre] = useState('');
  const [anio, setAnio] = useState('');

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialUrl, setMaterialUrl] = useState('');

  const [etiquetaDraft, setEtiquetaDraft] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [participantes, setParticipantes] = useState<ParticipanteFila[]>([
    { nombre: '', rol: 'CATEDRATICO' },
  ]);

  const [clasesCurso, setClasesCurso] = useState<ClaseResumen[]>([]);
  const [claseSeleccionada, setClaseSeleccionada] = useState('');

  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await inscripcionApi.cursosCatedratico(tokenActual);
        let encontrado = res.items.find((c) => c.cursoId === cursoId) ?? null;
        if (!encontrado) {
          try {
            const todos = await inscripcionApi.listarCursos(tokenActual);
            const registrado = todos.cursos.find((c) => c.cursoId === cursoId) ?? null;
            if (registrado) {
              encontrado = {
                cursoId: registrado.cursoId,
                codigo: registrado.codigo,
                curso: registrado.nombre,
                semestre: registrado.semestre,
                anio: registrado.anio,
                auxiliares: [],
              };
            }
          } catch {
            encontrado = null;
          }
        }
        if (activo) {
          setCurso(encontrado);
          if (encontrado) {
            setSemestre(encontrado.semestre);
            setAnio(String(encontrado.anio));
            try {
              const catalogo = await catalogApi.getCursoPorCodigo(encontrado.codigo, tokenActual);
              if (activo) setCatalogCursoId(catalogo.curso.cursoId);
            } catch {
              if (activo) setCatalogCursoId(null);
            }
          }
        }
      } catch (err: unknown) {
        if (activo) setError(err instanceof Error ? err.message : 'No se pudo cargar el curso');
      } finally {
        if (activo) setCargandoCurso(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [tokenActual, cursoId]);

  useEffect(() => {
    if (modo !== 'material' || !curso) return;
    let activo = true;
    (async () => {
      try {
        const res = await catalogApi.search({ curso: curso.codigo }, tokenActual);
        if (activo) {
          setClasesCurso(res.resultados);
          setClaseSeleccionada(res.resultados[0]?.claseId ?? '');
        }
      } catch {
        if (activo) setClasesCurso([]);
      }
    })();
    return () => {
      activo = false;
    };
  }, [modo, curso, tokenActual]);

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

  async function publicarClase() {
    if (!curso) return;
    if (!catalogCursoId) {
      setError('No se pudo resolver el curso en el catálogo. Intenta de nuevo.');
      return;
    }
    const conArchivoVideo = !!videoFile;
    const conUrlVideo = videoUrl.trim().length > 0;
    if (!conArchivoVideo && !conUrlVideo) {
      setError('Debes indicar el video de la clase: sube un archivo MP4 o pega una URL de YouTube.');
      return;
    }
    if (conUrlVideo && !YT_URL_REGEX.test(videoUrl.trim())) {
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
    const participantesValidos = participantes
      .filter((p) => p.nombre.trim().length > 0)
      .map((p) => ({ nombre: p.nombre.trim(), rol: p.rol }));

    setSubiendo(true);
    setError(null);
    setExito(null);
    setExitoClaseId(null);
    try {
      const res = await catalogApi.publicarClase(
        {
          cursoId: catalogCursoId,
          unidad: unidad.trim() || undefined,
          tema: tema.trim() || undefined,
          fechaImparticion: fechaImparticion || undefined,
          semestre: semestre.trim(),
          anio: Number(anio),
          urlVideo: conArchivoVideo ? '' : videoUrl.trim(),
          urlMaterial: materialFile ? undefined : materialUrl.trim() || undefined,
          duracion: 0,
          etiquetas,
          participantes: participantesValidos,
        },
        tokenActual,
      );
      const claseId = res.claseId;
      if (videoFile) await mediaApi.subirVideo(claseId, videoFile, tokenActual);
      if (materialFile) await mediaApi.subirMaterial(claseId, materialFile, tokenActual);
      setExito('Clase publicada correctamente.');
      setExitoClaseId(claseId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar la clase');
    } finally {
      setSubiendo(false);
    }
  }

  async function subirMaterialExistente() {
    if (!materialFile || !claseSeleccionada) {
      setError('Selecciona una clase y un archivo de material.');
      return;
    }
    setSubiendo(true);
    setError(null);
    setExito(null);
    setExitoClaseId(null);
    try {
      await mediaApi.subirMaterial(claseSeleccionada, materialFile, tokenActual);
      setExito('Material subido a la clase seleccionada.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el material');
    } finally {
      setSubiendo(false);
    }
  }

  const titulo = modo === 'material' ? 'Subir material' : 'Subir clase';

  return (
    <AppLayout>
      <section className="subirclase">
        <div className="catalogo__hero subirclase__hero">
          <div>
            <h1 className="catalogo__title">{titulo}</h1>
            <p className="catalogo__subtitle">
              {curso
                ? `${curso.codigo} · ${curso.curso} — ${semestreCorto(curso.semestre)} ${curso.anio}`
                : 'Cargando curso…'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate(returnTo)}>
            {returnTo === '/mis-cursos' ? 'Volver a Mis cursos' : 'Volver'}
          </Button>
        </div>

        {cargandoCurso ? (
          <p className="catalogo__estado" role="status">
            Cargando…
          </p>
        ) : error && !exito ? (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        ) : null}

        {!cargandoCurso && !error && !exito && !curso && (
          <Alert tone="error">
            <strong>Error:</strong> No se encontró el curso asignado. Vuelve a Mis cursos.
          </Alert>
        )}

        {exito && (
          <Alert tone="success">
            <strong>¡Listo!</strong> {exito}{' '}
            {exitoClaseId ? (
              <button
                type="button"
                className="subirclase__enlace"
                onClick={() => navigate(`/catalogo/clase/${exitoClaseId}`)}
              >
                Ver la clase publicada
              </button>
            ) : (
              <button type="button" className="subirclase__enlace" onClick={() => navigate(returnTo)}>
                {returnTo === '/mis-cursos' ? 'Volver a Mis cursos' : 'Volver'}
              </button>
            )}
          </Alert>
        )}

        {!cargandoCurso && curso && !exito && (
          <div className="subirclase__form">
            {modo === 'material' ? (
              <section className="subirclase__seccion">
                <h2 className="subirclase__seccion-titulo">Material para una clase existente</h2>
                <p className="subirclase__seccion-desc">
                  El material se asocia a una clase ya publicada de este curso.
                </p>
                {clasesCurso.length === 0 ? (
                  <Alert tone="info">
                    Este curso aún no tiene clases publicadas. Publica primero una clase para poder
                    subirle material.
                  </Alert>
                ) : (
                  <div className="subirclase__grid">
                    <label className="subirclase__campo">
                      <span className="subirclase__campo-label">Clase</span>
                      <select
                        className="catalogo__select"
                        value={claseSeleccionada}
                        onChange={(e) => setClaseSeleccionada(e.target.value)}
                      >
                        {clasesCurso.map((clase) => (
                          <option key={clase.claseId} value={clase.claseId}>
                            {clase.tema || clase.unidad || 'Clase'} · {clase.semestre} {clase.anio}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="subirclase__campo">
                      <span className="subirclase__campo-label">Archivo (PDF, PPTX, DOCX…)</span>
                      <input
                        className="subirclase__input"
                        type="file"
                        accept=".pdf,.pptx,.ppt,.docx,.doc,.txt,image/png,image/jpeg"
                        onChange={(e) => setMaterialFile(e.target.files?.[0] ?? null)}
                      />
                      <p className="subirclase__ayuda">Máximo 50 MB.</p>
                    </label>
                  </div>
                )}
                {clasesCurso.length > 0 && (
                  <div className="subirclase__acciones">
                    <Button onClick={subirMaterialExistente} loading={subiendo}>
                      Subir material
                    </Button>
                  </div>
                )}
              </section>
            ) : (
              <>
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
                  <h2 className="subirclase__seccion-titulo">Video de la clase</h2>
                  <p className="subirclase__seccion-desc">
                    Sube la grabación (MP4, máx. 500 MB) o pega una URL de YouTube.
                  </p>
                  <div className="subirclase__grid">
                    <label className="subirclase__campo">
                      <span className="subirclase__campo-label">Archivo MP4</span>
                      <input
                        className="subirclase__input"
                        type="file"
                        accept="video/mp4, video/*"
                        onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                      />
                      <p className="subirclase__ayuda">
                        {videoFile ? `Seleccionado: ${videoFile.name}` : 'La duración se detectará automáticamente.'}
                      </p>
                    </label>
                    <label className="subirclase__campo">
                      <span className="subirclase__campo-label">URL de YouTube</span>
                      <input
                        className="subirclase__input"
                        value={videoUrl}
                        placeholder="https://www.youtube.com/watch?v=…"
                        onChange={(e) => setVideoUrl(e.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="subirclase__seccion">
                  <h2 className="subirclase__seccion-titulo">Material de apoyo</h2>
                  <p className="subirclase__seccion-desc">
                    Opcional: sube un archivo o pega un enlace (PDF, PPTX, DOCX…).
                  </p>
                  <div className="subirclase__grid">
                    <label className="subirclase__campo">
                      <span className="subirclase__campo-label">Archivo</span>
                      <input
                        className="subirclase__input"
                        type="file"
                        accept=".pdf,.pptx,.ppt,.docx,.doc,.txt,image/png,image/jpeg"
                        onChange={(e) => setMaterialFile(e.target.files?.[0] ?? null)}
                      />
                      <p className="subirclase__ayuda">
                        {materialFile ? `Seleccionado: ${materialFile.name}` : 'Máximo 50 MB.'}
                      </p>
                    </label>
                    <label className="subirclase__campo">
                      <span className="subirclase__campo-label">Enlace</span>
                      <input
                        className="subirclase__input"
                        value={materialUrl}
                        placeholder="https://drive.google.com/…"
                        onChange={(e) => setMaterialUrl(e.target.value)}
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
                            actualizarParticipante(
                              index,
                              'rol',
                              e.target.value as ParticipanteFila['rol'],
                            )
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
                  <Button onClick={publicarClase} loading={subiendo}>
                    Publicar clase
                  </Button>
                  <Button variant="secondary" onClick={() => navigate(returnTo)}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
