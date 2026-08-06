import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  inscripcionApi,
  type CursoCatedraticoItem,
  type PanelEstudianteItem,
} from '../api/inscripcion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';

type Vista = 'estudiante' | 'catedratico' | 'auxiliar';

const TABS = [
  { id: 'cursos', label: 'Cursos Asignados' },
  { id: 'estado', label: 'Estado Matrícula' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'configuracion', label: 'Configuración cuenta' },
] as const;

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

export default function AsignacionesPage() {
  const { user, token } = useAuth();
  const tokenActual = token ?? '';
  const esAdmin = user?.roles.includes('ROLE_ADMIN') ?? false;
  const esEstudiante = user?.roles.includes('ROLE_ESTUDIANTE') ?? false;
  const esCatedratico = user?.roles.includes('ROLE_CATEDRATICO') ?? false;
  const esAuxiliar = user?.roles.includes('ROLE_AUXILIAR') ?? false;

  const [vistaAdmin, setVistaAdmin] = useState<'estudiante' | 'catedratico'>('estudiante');
  const [userIdAdmin, setUserIdAdmin] = useState('');

  const vista: Vista = esAdmin
    ? vistaAdmin
    : esEstudiante
      ? 'estudiante'
      : esCatedratico
        ? 'catedratico'
        : esAuxiliar
          ? 'auxiliar'
          : 'estudiante';

  const [panel, setPanel] = useState<PanelEstudianteItem[]>([]);
  const [cursos, setCursos] = useState<CursoCatedraticoItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroSemestre, setFiltroSemestre] = useState('');
  const [filtroAnio, setFiltroAnio] = useState('');

  const adminId = esAdmin && userIdAdmin.trim() ? userIdAdmin.trim() : undefined;

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);

    const cargar = async () => {
      let items: Array<PanelEstudianteItem | CursoCatedraticoItem> = [];
      if (vista === 'estudiante') {
        items = (await inscripcionApi.panelEstudiante(tokenActual, adminId)).items;
      } else if (vista === 'catedratico') {
        items = (await inscripcionApi.cursosCatedratico(tokenActual, adminId)).items;
      }

      if (!active) return;
      if (vista === 'estudiante') {
        setPanel(items as PanelEstudianteItem[]);
        setCursos([]);
      } else if (vista === 'catedratico') {
        setCursos(items as CursoCatedraticoItem[]);
        setPanel([]);
      }
    };

    cargar()
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar tus asignaciones');
          setPanel([]);
          setCursos([]);
        }
      })
      .finally(() => {
        if (active) setCargando(false);
      });

    return () => {
      active = false;
    };
  }, [vista, adminId, tokenActual]);

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
    <BarraFiltros
      busqueda={busqueda}
      semestres={semestres}
      anios={anios}
      filtroSemestre={filtroSemestre}
      filtroAnio={filtroAnio}
      onBusqueda={setBusqueda}
      onSemestre={setFiltroSemestre}
      onAnio={setFiltroAnio}
    />
  );

  return (
    <AppLayout>
      <section className="asig">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Asignaciones</h1>
          <p className="catalogo__subtitle">
            Consulta los cursos en los que estás inscrito o asignado y el estado de tu matrícula según
            tu rol.
          </p>
        </div>

        <nav className="asig__tabs" aria-label="Secciones de tu cuenta">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`asig__tab${tab.id === 'cursos' ? ' asig__tab--active' : ' asig__tab--disabled'}`}
              disabled={tab.id !== 'cursos'}
              title={tab.id !== 'cursos' ? 'Disponible próximamente' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

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

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        {vista === 'auxiliar' ? (
          <div className="asig__vacio">
            <p className="asig__vacio-titulo">Asignaciones de auxiliar</p>
            <p className="asig__vacio-texto">
              Como auxiliar, tus asignaciones se gestionan desde los cursos del catedrático al que
              apoyas. Explora el catálogo para consultar las clases disponibles.
            </p>
          </div>
        ) : cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando asignaciones…
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
      </section>
    </AppLayout>
  );
}

function BarraFiltros({
  busqueda,
  semestres,
  anios,
  filtroSemestre,
  filtroAnio,
  onBusqueda,
  onSemestre,
  onAnio,
}: {
  busqueda: string;
  semestres: Array<[string, number]>;
  anios: number[];
  filtroSemestre: string;
  filtroAnio: string;
  onBusqueda: (v: string) => void;
  onSemestre: (v: string) => void;
  onAnio: (v: string) => void;
}) {
  return (
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
          onChange={(e) => onBusqueda(e.target.value)}
        />
      </div>
      <label className="asig__toolbar-select">
        <span>Semestre</span>
        <select value={filtroSemestre} onChange={(e) => onSemestre(e.target.value)}>
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
        <select value={filtroAnio} onChange={(e) => onAnio(e.target.value)}>
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
