import { useCallback, useEffect, useState } from 'react';
import { inscripcionApi, type CursoRegistrado, type DocenteInscripcion } from '../api/inscripcion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';

interface Asignaciones {
  [cursoId: string]: { docenteId: string; semestre: string };
}

function semestreCorto(semestre: string): string {
  const partes = semestre.split('-');
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : semestre;
}

export default function GestionCursosPage() {
  const { token } = useAuth();
  const tokenActual = token ?? '';

  const [cursos, setCursos] = useState<CursoRegistrado[]>([]);
  const [docentes, setDocentes] = useState<DocenteInscripcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ codigo: '', nombre: '', escuela: '', semestre: '', anio: '' });
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [asignaciones, setAsignaciones] = useState<Asignaciones>({});
  const [asignando, setAsignando] = useState<string | null>(null);
  const [errorAsignacion, setErrorAsignacion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resCursos, resDocentes] = await Promise.all([
        inscripcionApi.listarCursos(tokenActual),
        inscripcionApi.listarDocentes(tokenActual),
      ]);
      setCursos(resCursos.cursos);
      setDocentes(resDocentes.docentes);
      setAsignaciones((prev) => {
        const next: Asignaciones = {};
        for (const curso of resCursos.cursos) {
          const previo = prev[curso.cursoId];
          next[curso.cursoId] = {
            docenteId: previo?.docenteId ?? resDocentes.docentes[0]?.docenteId ?? '',
            semestre: previo?.semestre ?? curso.semestre,
          };
        }
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos');
      setCursos([]);
      setDocentes([]);
    } finally {
      setCargando(false);
    }
  }, [tokenActual]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function crearCurso() {
    const anio = Number(form.anio);
    if (!form.codigo.trim() || !form.nombre.trim() || !form.escuela.trim() || !form.semestre.trim() || !anio) {
      setErrorForm('Completa todos los campos: código, nombre, escuela, semestre y año.');
      return;
    }
    setCreando(true);
    setErrorForm(null);
    setMensaje(null);
    try {
      const res = await inscripcionApi.registrarCurso(tokenActual, {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        escuela: form.escuela.trim(),
        semestre: form.semestre.trim(),
        anio,
      });
      setMensaje(`Curso ${res.curso.codigo} registrado correctamente.`);
      setForm({ codigo: '', nombre: '', escuela: '', semestre: '', anio: '' });
      await cargar();
    } catch (err: unknown) {
      setErrorForm(err instanceof Error ? err.message : 'No se pudo registrar el curso');
    } finally {
      setCreando(false);
    }
  }

  function cambiarAsignacion(cursoId: string, campo: 'docenteId' | 'semestre', valor: string) {
    setAsignaciones((prev) => ({
      ...prev,
      [cursoId]: { ...prev[cursoId], [campo]: valor },
    }));
  }

  async function asignarDocente(cursoId: string) {
    const config = asignaciones[cursoId];
    if (!config?.docenteId || !config?.semestre) return;
    setAsignando(cursoId);
    setErrorAsignacion(null);
    setMensaje(null);
    try {
      const res = await inscripcionApi.asignarCatedraticoCurso(
        tokenActual,
        config.docenteId,
        cursoId,
        config.semestre,
      );
      setMensaje(`Catedrático asignado al curso (${res.asignacionId.slice(0, 8)}…).`);
    } catch (err: unknown) {
      setErrorAsignacion(err instanceof Error ? err.message : 'No se pudo asignar el catedrático');
    } finally {
      setAsignando(null);
    }
  }

  return (
    <AppLayout>
      <section className="gcursos">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Gestión de Cursos</h1>
          <p className="catalogo__subtitle">
            Crea los cursos del semestre y asigna al catedrático responsable.
          </p>
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

        <section className="gcursos__panel" aria-label="Registrar curso">
          <h2 className="gcursos__panel-titulo">Registrar curso</h2>
          <div className="gcursos__form">
            <TextField
              label="Código"
              placeholder="CC308"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            />
            <TextField
              label="Nombre"
              placeholder="Comunicaciones y Redes de Computadoras"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <TextField
              label="Escuela"
              placeholder="Escuela de Ciencias y Sistemas"
              value={form.escuela}
              onChange={(e) => setForm({ ...form, escuela: e.target.value })}
            />
            <TextField
              label="Semestre"
              placeholder="2026-2"
              value={form.semestre}
              onChange={(e) => setForm({ ...form, semestre: e.target.value })}
            />
            <TextField
              label="Año"
              placeholder="2026"
              inputMode="numeric"
              value={form.anio}
              onChange={(e) => setForm({ ...form, anio: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          {errorForm && (
            <Alert tone="error">
              <strong>Error:</strong> {errorForm}
            </Alert>
          )}
          <div className="gcursos__form-acciones">
            <Button onClick={crearCurso} loading={creando}>
              Crear curso
            </Button>
          </div>
        </section>

        <section className="gcursos__panel" aria-label="Cursos registrados">
          <h2 className="gcursos__panel-titulo">Cursos registrados</h2>
          {cargando ? (
            <p className="catalogo__estado" role="status">
              Cargando cursos…
            </p>
          ) : cursos.length === 0 ? (
            <p className="catalogo__estado">Aún no hay cursos registrados.</p>
          ) : (
            <div className="gcursos__tabla-wrap">
              <table className="asig__tabla">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Curso</th>
                    <th>Semestre</th>
                    <th>Asignar catedrático</th>
                    <th aria-label="Acción" />
                  </tr>
                </thead>
                <tbody>
                  {cursos.map((curso) => {
                    const config = asignaciones[curso.cursoId];
                    return (
                      <tr key={curso.cursoId}>
                        <td className="asig__celda-id">{curso.codigo}</td>
                        <td>
                          <span className="asig__curso">{curso.nombre}</span>
                          <span className="asig__escuela">{curso.escuela}</span>
                        </td>
                        <td className="asig__celda-semestre">
                          {semestreCorto(curso.semestre)} · {curso.anio}
                        </td>
                        <td>
                          {docentes.length === 0 ? (
                            <span className="asig__muted">
                              Sin docentes registrados. Regístralos vía API o seed.
                            </span>
                          ) : (
                            <div className="gcursos__asignar">
                              <select
                                className="catalogo__select"
                                value={config?.docenteId ?? ''}
                                onChange={(e) => cambiarAsignacion(curso.cursoId, 'docenteId', e.target.value)}
                              >
                                {docentes.map((docente) => (
                                  <option key={docente.docenteId} value={docente.docenteId}>
                                    {docente.usuarioId.slice(0, 8)}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="catalogo__select"
                                value={config?.semestre ?? curso.semestre}
                                onChange={(e) => cambiarAsignacion(curso.cursoId, 'semestre', e.target.value)}
                              >
                                {[...new Set(cursos.map((c) => c.semestre))]
                                  .sort((a, b) => (a < b ? 1 : -1))
                                  .map((semestre) => (
                                    <option key={semestre} value={semestre}>
                                      {semestreCorto(semestre)}
                                    </option>
                                  ))}
                              </select>
                              <Button
                                variant="secondary"
                                onClick={() => asignarDocente(curso.cursoId)}
                                loading={asignando === curso.cursoId}
                              >
                                Asignar
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="asig__celda-accion">
                          {config?.docenteId && (
                            <span className="asig__muted">{config.docenteId.slice(0, 8)}…</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {errorAsignacion && (
            <Alert tone="error">
              <strong>Error:</strong> {errorAsignacion}
            </Alert>
          )}
        </section>

        <section className="gcursos__panel" aria-label="Solicitudes de catedráticos">
          <h2 className="gcursos__panel-titulo">Solicitudes de asignación de catedráticos</h2>
          <div className="gcursos__pendiente">
            <p>
              Aquí llegarán las solicitudes de los catedráticos que quieran ser asignados a un curso.
            </p>
            <p className="gcursos__pendiente-nota">
              <span className="gcursos__pendiente-badge">PENDIENTE</span>
              Se habilitará con el microservicio de notificaciones, que aún no forma parte de la
              plataforma.
            </p>
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
