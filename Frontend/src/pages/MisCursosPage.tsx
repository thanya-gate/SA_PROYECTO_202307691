import { useCallback, useEffect, useMemo, useState } from 'react';
import { catalogApi, type ClaseResumen } from '../api/catalog';
import { inscripcionApi, type CursoRegistrado, type PanelEstudianteItem } from '../api/inscripcion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { ClaseCard } from '../components/ClaseCard';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

interface CursoConVideos {
  cursoId: string;
  codigo: string;
  curso: string;
  escuela: string;
  semestre: string;
  anio: number;
  estadoMatricula: string;
  videos: ClaseResumen[];
}

function semestreCorto(semestre: string): string {
  const partes = semestre.split('-');
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : semestre;
}

export default function MisCursosPage() {
  const { user, token } = useAuth();
  const tokenActual = token ?? '';
  const esEstudiante = user?.roles.includes('ROLE_ESTUDIANTE') ?? false;

  const [panel, setPanel] = useState<PanelEstudianteItem[]>([]);
  const [cursosConVideos, setCursosConVideos] = useState<CursoConVideos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [cursosDisponibles, setCursosDisponibles] = useState<CursoRegistrado[]>([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState('');
  const [semestreSeleccionado, setSemestreSeleccionado] = useState('');
  const [inscribiendo, setInscribiendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const items = (await inscripcionApi.panelEstudiante(tokenActual)).items;
      const conVideos: CursoConVideos[] = await Promise.all(
        items.map(async (item) => {
          const res = await catalogApi.search({ curso: item.codigo }, tokenActual);
          return {
            cursoId: item.cursoId,
            codigo: item.codigo,
            curso: item.curso,
            escuela: item.escuela,
            semestre: item.semestre,
            anio: item.anio,
            estadoMatricula: item.estadoMatricula,
            videos: res.resultados,
          };
        }),
      );
      conVideos.sort((a, b) => (a.semestre < b.semestre ? 1 : -1));
      setPanel(items);
      setCursosConVideos(conVideos);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar tus cursos');
      setPanel([]);
      setCursosConVideos([]);
    } finally {
      setCargando(false);
    }
  }, [tokenActual]);

  useEffect(() => {
    if (esEstudiante) void cargar();
  }, [cargar, esEstudiante]);

  async function abrirModal() {
    setModalAbierto(true);
    setMensaje(null);
    setErrorModal(null);
    setCursoSeleccionado('');
    setSemestreSeleccionado('');
    try {
      const res = await inscripcionApi.listarCursos(tokenActual);
      const inscritos = new Set(panel.map((item) => item.cursoId));
      const disponibles = res.cursos.filter((curso) => !inscritos.has(curso.cursoId));
      setCursosDisponibles(disponibles);
      if (disponibles.length > 0) {
        const semestres = [...new Set(disponibles.map((c) => c.semestre))].sort((a, b) => (a < b ? 1 : -1));
        setSemestreSeleccionado(semestres[0] ?? '');
        setCursoSeleccionado(disponibles[0].cursoId);
      }
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudieron cargar los cursos disponibles');
    }
  }

  async function inscribirse() {
    if (!cursoSeleccionado || !semestreSeleccionado) return;
    setInscribiendo(true);
    setErrorModal(null);
    setMensaje(null);
    try {
      const res = await inscripcionApi.autoInscribirse(tokenActual, cursoSeleccionado, semestreSeleccionado);
      setMensaje(res.message);
      setModalAbierto(false);
      await cargar();
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : 'No se pudo completar la inscripción');
    } finally {
      setInscribiendo(false);
    }
  }

  const totalVideos = useMemo(
    () => cursosConVideos.reduce((acc, curso) => acc + curso.videos.length, 0),
    [cursosConVideos],
  );

  return (
    <AppLayout>
      <section className="mcursos">
        <div className="catalogo__hero mcursos__hero">
          <div>
            <h1 className="catalogo__title">Mis cursos</h1>
            <p className="catalogo__subtitle">
              Videos y grabaciones de los cursos a los que estás inscrito este semestre.
            </p>
          </div>
          {esEstudiante && (
            <Button variant="primary" onClick={abrirModal}>
              Agregar curso
            </Button>
          )}
        </div>

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}
        {mensaje && (
          <Alert tone="success">
            <strong>¡Listo!</strong> {mensaje}
          </Alert>
        )}

        {!esEstudiante ? (
          <div className="asig__vacio">
            <p className="asig__vacio-titulo">Mis cursos es para estudiantes</p>
            <p className="asig__vacio-texto">
              Los catedráticos y auxiliares pueden consultar sus asignaciones desde el módulo de
              Asignaciones o el catálogo de clases grabadas.
            </p>
          </div>
        ) : cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando tus cursos…
          </p>
        ) : cursosConVideos.length === 0 ? (
          <div className="asig__vacio">
            <p className="asig__vacio-titulo">Aún no tienes cursos</p>
            <p className="asig__vacio-texto">
              Usa el botón “Agregar curso” para inscribirte a los cursos que llevas este semestre.
            </p>
            <Button variant="primary" onClick={abrirModal}>
              Agregar curso
            </Button>
          </div>
        ) : (
          <div className="mcursos__lista">
            {cursosConVideos.map((curso) => (
              <section key={curso.cursoId} className="mcursos__curso">
                <header className="mcursos__curso-header">
                  <div>
                    <h2 className="mcursos__curso-titulo">
                      {curso.codigo} · {curso.curso}
                    </h2>
                    <p className="mcursos__curso-meta">
                      {curso.escuela} · {semestreCorto(curso.semestre)} {curso.anio}
                    </p>
                  </div>
                  <span
                    className={`mcursos__badge mcursos__badge--${curso.estadoMatricula.toLowerCase()}`}
                  >
                    {curso.estadoMatricula}
                  </span>
                </header>
                {curso.videos.length === 0 ? (
                  <p className="catalogo__estado">
                    Este curso aún no tiene videos publicados.
                  </p>
                ) : (
                  <div className="catalogo__grid">
                    {curso.videos.map((video) => (
                      <ClaseCard key={video.claseId} clase={video} />
                    ))}
                  </div>
                )}
              </section>
            ))}
            {totalVideos === 0 && (
              <p className="catalogo__estado">
                Los videos aparecerán aquí cuando los catedráticos publiquen clases de tus cursos.
              </p>
            )}
          </div>
        )}
      </section>

      {modalAbierto && (
        <div className="mcursos__modal-overlay" onClick={() => setModalAbierto(false)}>
          <div
            className="mcursos__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcursos-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mcursos__modal-header">
              <h2 id="mcursos-modal-titulo" className="mcursos__modal-titulo">
                Agregar curso
              </h2>
              <button
                type="button"
                className="mcursos__modal-cerrar"
                aria-label="Cerrar"
                onClick={() => setModalAbierto(false)}
              >
                ×
              </button>
            </header>

            {errorModal && (
              <Alert tone="error">
                <strong>Error:</strong> {errorModal}
              </Alert>
            )}

            {cursosDisponibles.length === 0 ? (
              <p className="catalogo__estado">
                No hay cursos disponibles para agregar. Todos tus cursos ya están inscritos o el
                administrador aún no registra nuevos cursos.
              </p>
            ) : (
              <div className="mcursos__modal-cuerpo">
                <label className="mcursos__campo">
                  <span className="mcursos__campo-label">Curso</span>
                  <select
                    className="catalogo__select"
                    value={cursoSeleccionado}
                    onChange={(e) => setCursoSeleccionado(e.target.value)}
                  >
                    {cursosDisponibles.map((curso) => (
                      <option key={curso.cursoId} value={curso.cursoId}>
                        {curso.codigo} · {curso.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mcursos__campo">
                  <span className="mcursos__campo-label">Semestre</span>
                  <select
                    className="catalogo__select"
                    value={semestreSeleccionado}
                    onChange={(e) => setSemestreSeleccionado(e.target.value)}
                  >
                    {[...new Set(cursosDisponibles.map((c) => c.semestre))]
                      .sort((a, b) => (a < b ? 1 : -1))
                      .map((semestre) => (
                        <option key={semestre} value={semestre}>
                          {semestreCorto(semestre)}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="mcursos__modal-ayuda">
                  Tu inscripción quedará con estado <strong>PENDIENTE</strong> hasta que el
                  administrador la confirme.
                </p>
                <div className="mcursos__modal-acciones">
                  <Button variant="secondary" onClick={() => setModalAbierto(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={inscribirse} loading={inscribiendo}>
                    Inscribirme
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
