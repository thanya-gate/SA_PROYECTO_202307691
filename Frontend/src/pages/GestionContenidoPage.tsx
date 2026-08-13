import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inscripcionApi, type CursoCatedraticoItem } from '../api/inscripcion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { CsvTab, formatearMensaje, TituloSeccion } from '../components/admin/AdminTabs';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

type Tab = 'subir' | 'csv';

const TABS: { id: Tab; label: string }[] = [
  { id: 'subir', label: 'Subir contenido' },
  { id: 'csv', label: 'Carga masiva' },
];

function semestreCorto(semestre: string): string {
  const partes = semestre.split('-');
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : semestre;
}

function SubirContenidoTab({ token }: { token: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles.includes('ROLE_ADMIN') ?? false;

  const [cursos, setCursos] = useState<CursoCatedraticoItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      let items = (await inscripcionApi.cursosCatedratico(token)).items;
      if (items.length === 0 && isAdmin) {
        const todos = await inscripcionApi.listarCursos(token);
        items = todos.cursos.map((c) => ({
          cursoId: c.cursoId,
          codigo: c.codigo,
          curso: c.nombre,
          semestre: c.semestre,
          anio: c.anio,
          auxiliares: [],
        }));
      }
      setCursos(items);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los cursos'));
      setCursos([]);
    } finally {
      setCargando(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <>
      <TituloSeccion
        titulo="Subir contenido"
        detalle="Elige un curso y sube la grabación de la clase (video) o material de apoyo (PDF, PPTX, DOCX…)."
      />
      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando cursos…
        </p>
      ) : cursos.length === 0 ? (
        <div className="gcursos__panel">
          <p className="catalogo__estado">
            No tienes cursos asignados.
            {isAdmin
              ? ' Usa el apartado “Carga masiva” para registrar las clases de un semestre.'
              : ' Espera a que un administrador te asigne cursos o usa la carga masiva.'}
          </p>
        </div>
      ) : (
        <div className="gcursos__panel">
          <p className="catalogo__subtitle">
            Selecciona un curso para publicar una clase grabada o adjuntarle material a una clase existente.
          </p>
          <div className="gcursos__tabla-wrap">
            <table className="asig__tabla">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Semestre</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {cursos.map((c) => (
                  <tr key={c.cursoId}>
                    <td>
                      <span className="asig__curso">
                        {c.codigo} · {c.curso}
                      </span>
                    </td>
                    <td className="asig__celda-semestre">
                      {semestreCorto(c.semestre)} · {c.anio}
                    </td>
                    <td className="asig__celda-accion">
                      <div className="admin-acciones">
                        <Button
                          onClick={() =>
                            navigate(`/admin/contenido/subir/${c.cursoId}?returnTo=/admin/contenido`)
                          }
                        >
                          Subir clase
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigate(
                              `/admin/contenido/subir/${c.cursoId}?modo=material&returnTo=/admin/contenido`,
                            )
                          }
                        >
                          Subir material
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function GestionContenidoPage() {
  const { token, user } = useAuth();
  const tokenActual = token ?? '';
  const [tab, setTab] = useState<Tab>('subir');

  return (
    <AppLayout>
      <div className="admin">
        <header className="admin__hero">
          <div>
            <h1 className="admin__title">Gestión de Contenido</h1>
            <p className="admin__subtitle">
              Sube grabaciones y material de apoyo por curso, o usa la carga masiva (CSV) para registrar
              las clases de un semestre completo.
            </p>
          </div>
          <span className="admin__badge">
            {user?.roles.includes('ROLE_ADMIN')
              ? 'Administrador'
              : user?.roles.includes('ROLE_AUXILIAR')
                ? 'Auxiliar'
                : 'Docente'}
          </span>
        </header>

        <nav className="admin-tabs" role="tablist" aria-label="Módulos de gestión de contenido">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`admin-tabs__tab${tab === t.id ? ' admin-tabs__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'subir' && <SubirContenidoTab token={tokenActual} />}
        {tab === 'csv' && <CsvTab token={tokenActual} />}
      </div>
    </AppLayout>
  );
}
