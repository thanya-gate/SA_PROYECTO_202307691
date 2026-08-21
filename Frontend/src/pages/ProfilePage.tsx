import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  inscripcionApi,
  type CursoCatedraticoItem,
  type PanelEstudianteItem,
} from '../api/inscripcion';
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
    carnet: '',
    dpi: '',
    fechaNacimiento: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = user?.roles.includes('ROLE_ADMIN') ?? false;
  const esCatedratico = user?.roles.includes('ROLE_CATEDRATICO') ?? false;
  const esAuxiliar = user?.roles.includes('ROLE_AUXILIAR') ?? false;

  const [vistaAdmin, setVistaAdmin] = useState<'estudiante' | 'catedratico'>('estudiante');
  const [userIdAdmin, setUserIdAdmin] = useState('');
  const vista: 'estudiante' | 'catedratico' = esAdmin
    ? vistaAdmin
    : esEstudiante || esAuxiliar
      ? 'estudiante'
      : esCatedratico
        ? 'catedratico'
        : 'estudiante';

  const [panel, setPanel] = useState<PanelEstudianteItem[]>([]);
  const [cursos, setCursos] = useState<CursoCatedraticoItem[]>([]);
  const [cargandoCursos, setCargandoCursos] = useState(false);
  const [errorCursos, setErrorCursos] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroSemestre, setFiltroSemestre] = useState('');
  const [filtroAnio, setFiltroAnio] = useState('');

  const adminId = esAdmin && userIdAdmin.trim() ? userIdAdmin.trim() : undefined;

  useEffect(() => {
    if (user) {
      setForm({
        nombres: user.nombres ?? '',
        apellidos: user.apellidos ?? '',
        telefonoCelular: user.telefonoCelular ?? '',
        carrera: user.carrera ?? '',
        carnet: user.carnet ?? '',
        dpi: user.dpi ?? '',
        fechaNacimiento: user.fechaNacimiento ?? '',
      });
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    if (seccion !== 'cursos') return;
    setCargandoCursos(true);
    setErrorCursos(null);
    const cargar = async () => {
      if (vista === 'estudiante') {
        const res = await inscripcionApi.panelEstudiante(tokenActual, adminId);
        if (active) {
          setPanel(res.items);
          setCursos([]);
        }
      } else if (vista === 'catedratico') {
        const res = await inscripcionApi.cursosCatedratico(tokenActual, adminId);
        if (active) {
          setCursos(res.items);
          setPanel([]);
        }
      }
    };
    cargar()
      .catch((err: unknown) => {
        if (active) {
          setErrorCursos(err instanceof Error ? err.message : 'No se pudieron cargar tus cursos');
          setPanel([]);
          setCursos([]);
        }
      })
      .finally(() => {
        if (active) setCargandoCursos(false);
      });
    return () => {
      active = false;
    };
  }, [seccion, vista, adminId, tokenActual]);

  const semestres = useMemo(() => {
    const fuentes: Array<{ semestre: string; anio: number }> = vista === 'estudiante' ? panel : cursos;
    const valores = new Map<string, number>();
    for (const item of fuentes) valores.set(item.semestre, item.anio);
    return [...valores.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [vista, panel, cursos]);

  const anios = useMemo(() => {
    const fuentes: Array<{ anio: number }> = vista === 'estudiante' ? panel : cursos;
    return [...new Set(fuentes.map((item) => item.anio))].sort((a, b) => b - a);
  }, [vista, panel, cursos]);

  const coincide = (codigo: string, curso: string): boolean => {
    const termino = busqueda.toLowerCase();
    return codigo.toLowerCase().includes(termino) || curso.toLowerCase().includes(termino);
  };

  const panelFiltrado = useMemo(
    () =>
      panel.filter(
        (item) =>
          coincide(item.codigo, item.curso) &&
          (filtroSemestre === '' || item.semestre === filtroSemestre) &&
          (filtroAnio === '' || String(item.anio) === filtroAnio),
      ),
    [panel, busqueda, filtroSemestre, filtroAnio],
  );

  const cursosFiltrados = useMemo(
    () =>
      cursos.filter(
        (item) =>
          coincide(item.codigo, item.curso) &&
          (filtroSemestre === '' || item.semestre === filtroSemestre) &&
          (filtroAnio === '' || String(item.anio) === filtroAnio),
      ),
    [cursos, busqueda, filtroSemestre, filtroAnio],
  );

  const hayFiltros = busqueda !== '' || filtroSemestre !== '' || filtroAnio !== '';

  const mensajeVacio = hayFiltros
    ? 'No hay cursos que coincidan con los filtros.'
    : vista === 'estudiante'
      ? 'No hay cursos asociados a tu cuenta este semestre.'
      : 'Aún no tienes cursos asignados este semestre.';

  const barraFiltros = (
    <div className="asig__toolbar">
      <div className="asig__toolbar-busqueda">
        <span className="asig__toolbar-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          className="asig__toolbar-input"
          placeholder="Search"
          aria-label="Buscar curso"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      <label className="asig__toolbar-select">
        <span>Semestre</span>
        <select value={filtroSemestre} onChange={(e) => setFiltroSemestre(e.target.value)}>
          <option value="">Todos</option>
          {semestres.map(([semestre]) => (
            <option key={semestre} value={semestre}>
              {semestreCorto(semestre)}
            </option>
          ))}
        </select>
      </label>
      <label className="asig__toolbar-select">
        <span>Año</span>
        <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)}>
          <option value="">Todos</option>
          {anios.map((anio) => (
            <option key={anio} value={String(anio)}>
              {anio}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

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
        carnet: form.carnet.trim() || undefined,
        dpi: form.dpi.trim() || undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
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
                    <input
                      className="perfil__input"
                      value={form.carnet}
                      onChange={(e) => setForm((f) => ({ ...f, carnet: e.target.value }))}
                      placeholder="Ej. 202307691"
                    />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">DPI</span>
                    <input
                      className="perfil__input"
                      value={form.dpi}
                      onChange={(e) => setForm((f) => ({ ...f, dpi: e.target.value }))}
                      placeholder="Ej. 1234567890123"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="perfil__campo">
                    <span className="perfil__campo-label">Fecha de nacimiento</span>
                    <input
                      className="perfil__input"
                      type="date"
                      value={form.fechaNacimiento}
                      onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
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
                    Cursos en los que estás inscrito o asignado y el estado de tu matrícula según tu
                    rol.
                  </p>
                </header>

                {esAdmin && (
                  <div className="asig__admin">
                    <span className="asig__admin-label">Vista de administración</span>
                    <div className="asig__admin-controles">
                      <div className="asig__admin-switch" role="group" aria-label="Tipo de panel">
                        <button
                          type="button"
                          className={`asig__admin-btn${vistaAdmin === 'estudiante' ? ' asig__admin-btn--active' : ''}`}
                          onClick={() => setVistaAdmin('estudiante')}
                        >
                          Panel estudiante
                        </button>
                        <button
                          type="button"
                          className={`asig__admin-btn${vistaAdmin === 'catedratico' ? ' asig__admin-btn--active' : ''}`}
                          onClick={() => setVistaAdmin('catedratico')}
                        >
                          Panel catedrático
                        </button>
                      </div>
                      <input
                        type="text"
                        className="asig__admin-input"
                        placeholder="ID de usuario (opcional)"
                        value={userIdAdmin}
                        onChange={(e) => setUserIdAdmin(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {errorCursos && (
                  <Alert tone="error">
                    <strong>Error:</strong> {errorCursos}
                  </Alert>
                )}

                {cargandoCursos ? (
                  <p className="catalogo__estado" role="status">
                    Cargando tus cursos…
                  </p>
                ) : vista === 'estudiante' ? (
                  <div className="asig__tabla-wrap">
                    {barraFiltros}
                    {panelFiltrado.length === 0 ? (
                      <p className="catalogo__estado">{mensajeVacio}</p>
                    ) : (
                      <TablaPanel items={panelFiltrado} />
                    )}
                  </div>
                ) : (
                  <div className="asig__tabla-wrap">
                    {barraFiltros}
                    {cursosFiltrados.length === 0 ? (
                      <p className="catalogo__estado">{mensajeVacio}</p>
                    ) : (
                      <TablaCatedratico items={cursosFiltrados} />
                    )}
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

function TablaPanel({ items }: { items: PanelEstudianteItem[] }) {
  return (
    <table className="asig__tabla">
      <thead>
        <tr>
          <th>ID</th>
          <th>Curso</th>
          <th>Semestre</th>
          <th>Estado matrícula</th>
          <th aria-label="Acción" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.cursoId}>
            <td className="asig__celda-id">{item.codigo}</td>
            <td>
              <span className="asig__curso">{item.curso}</span>
              <span className="asig__escuela">{item.escuela}</span>
            </td>
            <td className="asig__celda-semestre">
              {semestreCorto(item.semestre)} · {item.anio}
            </td>
            <td>
              <BadgeEstado estado={item.estadoMatricula} />
            </td>
            <td className="asig__celda-accion">
              <Link to="/catalogo" className="asig__ir">
                Ir
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaCatedratico({ items }: { items: CursoCatedraticoItem[] }) {
  return (
    <table className="asig__tabla">
      <thead>
        <tr>
          <th>ID</th>
          <th>Curso</th>
          <th>Semestre</th>
          <th>Auxiliares</th>
          <th aria-label="Acción" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.cursoId}>
            <td className="asig__celda-id">{item.codigo}</td>
            <td>
              <span className="asig__curso">{item.curso}</span>
            </td>
            <td className="asig__celda-semestre">
              {semestreCorto(item.semestre)} · {item.anio}
            </td>
            <td className="asig__celda-auxiliares">
              {item.auxiliares.length === 0 ? (
                <span className="asig__muted">Sin auxiliares</span>
              ) : (
                item.auxiliares.map((aux) => (
                  <span key={aux} className="asig__aux" title={aux}>
                    {aux.slice(0, 8)}
                  </span>
                ))
              )}
            </td>
            <td className="asig__celda-accion">
              <Link to="/catalogo" className="asig__ir">
                Ir
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BadgeEstado({ estado }: { estado: string }) {
  const clase =
    estado === 'ACTIVA'
      ? 'asig__badge asig__badge--activa'
      : estado === 'PENDIENTE'
        ? 'asig__badge asig__badge--pendiente'
        : estado === 'RETIRADA'
          ? 'asig__badge asig__badge--retirada'
          : 'asig__badge asig__badge--sin';
  return <span className={clase}>{etiquetaEstado(estado)}</span>;
}
