import { useEffect, useState, type FormEvent } from 'react';
import { inscripcionApi, type PanelEstudianteItem } from '../api/inscripcion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

type Seccion = 'credenciales' | 'cursos' | 'documentos' | 'preferencias';

const SECCIONES: Array<{ id: Seccion; label: string }> = [
  { id: 'credenciales', label: 'Credenciales' },
  { id: 'cursos', label: 'Cursos asignados' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'preferencias', label: 'Preferencias' },
];

function etiquetaEstado(estado: string): string {
  switch (estado) {
    case 'ACTIVA':
      return 'Activa';
    case 'PENDIENTE':
      return 'Pendiente';
    case 'RETIRADA':
      return 'Retirada';
    case 'SIN_MATRICULA':
      return 'Sin matrícula';
    default:
      return estado;
  }
}

function semestreCorto(semestre: string): string {
  const partes = semestre.split('-');
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : semestre;
}

export default function ProfilePage() {
  const { user, token, updateProfile } = useAuth();
  const tokenActual = token ?? '';
  const esEstudiante = user?.roles.includes('ROLE_ESTUDIANTE') ?? false;

  const [seccion, setSeccion] = useState<Seccion>('credenciales');

  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    telefonoCelular: '',
    carrera: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<PanelEstudianteItem[]>([]);
  const [cargandoCursos, setCargandoCursos] = useState(false);
  const [errorCursos, setErrorCursos] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        nombres: user.nombres ?? '',
        apellidos: user.apellidos ?? '',
        telefonoCelular: user.telefonoCelular ?? '',
        carrera: user.carrera ?? '',
      });
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    if (seccion !== 'cursos' || !esEstudiante) return;
    setCargandoCursos(true);
    setErrorCursos(null);
    inscripcionApi
      .panelEstudiante(tokenActual)
      .then((res) => {
        if (active) setPanel(res.items);
      })
      .catch((err: unknown) => {
        if (active) setErrorCursos(err instanceof Error ? err.message : 'No se pudieron cargar tus cursos');
      })
      .finally(() => {
        if (active) setCargandoCursos(false);
      });
    return () => {
      active = false;
    };
  }, [seccion, tokenActual, esEstudiante]);

  async function guardarCredenciales(event: FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      await updateProfile({
        nombres: form.nombres.trim() || undefined,
        apellidos: form.apellidos.trim() || undefined,
        telefonoCelular: form.telefonoCelular.trim() || undefined,
        carrera: form.carrera.trim() || undefined,
      });
      setMensaje('Tus datos fueron actualizados correctamente.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar tus datos');
    } finally {
      setGuardando(false);
    }
  }

  const iniciales = `${user?.nombres?.slice(0, 1) ?? ''}${user?.apellidos?.slice(0, 1) ?? ''}`.toUpperCase();

  return (
    <AppLayout>
      <section className="perfil">
        <div className="catalogo__hero perfil__hero">
          <div>
            <h1 className="catalogo__title">Mi perfil</h1>
            <p className="catalogo__subtitle">
              Tu información personal, tus cursos y las preferencias de la cuenta.
            </p>
          </div>
        </div>

        <div className="perfil__layout">
          <aside className="perfil__sidebar">
            {SECCIONES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`perfil__nav${seccion === item.id ? ' perfil__nav--active' : ''}`}
                onClick={() => setSeccion(item.id)}
              >
                {item.label}
              </button>
            ))}
          </aside>

          <div className="perfil__contenido">
            {seccion === 'credenciales' && (
              <form className="perfil__form" onSubmit={guardarCredenciales} noValidate>
                <header className="perfil__contenido-header">
                  <h2 className="perfil__titulo">Credenciales</h2>
                  <p className="perfil__subtitulo">
                    Datos que identifican tu cuenta y que las demás personas pueden ver.
                  </p>
                </header>

                <div className="perfil__identidad">
                  <span className="perfil__avatar" aria-hidden="true">
                    {iniciales || '?'}
                  </span>
                  <div>
                    <p className="perfil__nombre">
                      {user?.nombres && user?.apellidos
                        ? `${user.nombres} ${user.apellidos}`
                        : user?.email}
                    </p>
                    <p className="perfil__rol">
                      {user?.roles.map((rol) => rol.replace('ROLE_', '')).join(' · ') || 'Sin roles'}
                    </p>
                  </div>
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

                <div className="perfil__grid">
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Nombres</span>
                    <input
                      className="perfil__input"
                      value={form.nombres}
                      onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                      placeholder="Tus nombres"
                    />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Apellidos</span>
                    <input
                      className="perfil__input"
                      value={form.apellidos}
                      onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                      placeholder="Tus apellidos"
                    />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Teléfono celular</span>
                    <input
                      className="perfil__input"
                      value={form.telefonoCelular}
                      onChange={(e) => setForm((f) => ({ ...f, telefonoCelular: e.target.value }))}
                      placeholder="Ej. 55551234"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Carrera</span>
                    <input
                      className="perfil__input"
                      value={form.carrera}
                      onChange={(e) => setForm((f) => ({ ...f, carrera: e.target.value }))}
                      placeholder="Ej. Ingeniería en Ciencias y Sistemas"
                    />
                  </label>
                </div>

                <div className="perfil__grid">
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Correo institucional</span>
                    <input className="perfil__input" value={user?.email ?? ''} disabled readOnly />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Carnet</span>
                    <input className="perfil__input" value={user?.carnet ?? ''} disabled readOnly />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">DPI</span>
                    <input className="perfil__input" value={user?.dpi ?? ''} disabled readOnly />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Fecha de nacimiento</span>
                    <input
                      className="perfil__input"
                      value={user?.fechaNacimiento ?? ''}
                      disabled
                      readOnly
                    />
                  </label>
                </div>

                <div className="perfil__acciones">
                  <Button type="submit" loading={guardando}>
                    Guardar cambios
                  </Button>
                </div>
              </form>
            )}

            {seccion === 'cursos' && (
              <div>
                <header className="perfil__contenido-header">
                  <h2 className="perfil__titulo">Cursos asignados</h2>
                  <p className="perfil__subtitulo">
                    Cursos en los que estás inscrito y el estado de tu matrícula.
                  </p>
                </header>

                {!esEstudiante ? (
                  <div className="asig__vacio">
                    <p className="asig__vacio-titulo">Consulta de cursos solo para estudiantes</p>
                    <p className="asig__vacio-texto">
                      Los catedráticos y auxiliares pueden ver sus asignaciones desde el módulo de
                      Asignaciones.
                    </p>
                  </div>
                ) : cargandoCursos ? (
                  <p className="catalogo__estado" role="status">
                    Cargando tus cursos…
                  </p>
                ) : errorCursos ? (
                  <Alert tone="error">
                    <strong>Error:</strong> {errorCursos}
                  </Alert>
                ) : panel.length === 0 ? (
                  <div className="asig__vacio">
                    <p className="asig__vacio-titulo">Aún no tienes cursos asignados</p>
                    <p className="asig__vacio-texto">
                      Inscríbete a un curso desde el módulo Mis cursos para verlo aquí.
                    </p>
                  </div>
                ) : (
                  <div className="perfil__lista-cursos">
                    {panel.map((item) => (
                      <article key={item.cursoId} className="perfil__curso">
                        <div>
                          <h3 className="perfil__curso-titulo">
                            {item.codigo} · {item.curso}
                          </h3>
                          <p className="perfil__curso-meta">
                            {item.escuela} · {semestreCorto(item.semestre)} {item.anio}
                          </p>
                        </div>
                        <span
                          className={`mcursos__badge mcursos__badge--${item.estadoMatricula.toLowerCase()}`}
                        >
                          {etiquetaEstado(item.estadoMatricula)}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {seccion === 'documentos' && (
              <div>
                <header className="perfil__contenido-header">
                  <h2 className="perfil__titulo">Documentos</h2>
                  <p className="perfil__subtitulo">
                    Constancias y documentos académicos de tu cuenta.
                  </p>
                </header>
                <div className="perfil__vacio">
                  <p className="perfil__vacio-titulo">Sin documentos</p>
                  <p className="perfil__vacio-texto">
                    Aquí aparecerán tus constancias, certificados y otros documentos cuando estén
                    disponibles.
                  </p>
                </div>
              </div>
            )}

            {seccion === 'preferencias' && (
              <div>
                <header className="perfil__contenido-header">
                  <h2 className="perfil__titulo">Preferencias</h2>
                  <p className="perfil__subtitulo">
                    Personaliza tu experiencia en la plataforma.
                  </p>
                </header>
                <div className="perfil__vacio">
                  <p className="perfil__vacio-titulo">Sin preferencias</p>
                  <p className="perfil__vacio-texto">
                    Las opciones de idioma, notificaciones y accesibilidad estarán disponibles
                    próximamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
