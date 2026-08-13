import { useEffect, useMemo, useState } from 'react';
import { catalogApi, type ClaseResumen, type SemestreResumen } from '../api/catalog';
import { useAuth } from '../auth/auth-context';
import { ClaseCard } from '../components/ClaseCard';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';

interface Filtros {
  semestre: string;
  curso: string;
  catedratico: string;
  escuela: string;
  tema: string;
}

const FILTROS_VACIOS: Filtros = { semestre: '', curso: '', catedratico: '', escuela: '', tema: '' };
const PAGE_SIZE = 10;

export default function CatalogPage() {
  const { token } = useAuth();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [clases, setClases] = useState<ClaseResumen[]>([]);
  const [semestres, setSemestres] = useState<SemestreResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);

  const tokenActual = token ?? '';

  useEffect(() => {
    let active = true;
    catalogApi
      .semestres('', tokenActual)
      .then((res) => {
        if (active) setSemestres(res.semestres);
      })
      .catch(() => {
      });
    return () => {
      active = false;
    };
  }, [tokenActual]);

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    catalogApi
      .search({ ...filtros, page: pagina, pageSize: PAGE_SIZE }, tokenActual)
      .then((res) => {
        if (active) {
          setClases(res.resultados);
          setTotal(res.total);
          setTotalPaginas(res.totalPages);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo');
          setClases([]);
          setTotal(0);
          setTotalPaginas(0);
        }
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => {
      active = false;
    };
  }, [filtros, pagina, tokenActual]);

  function actualizar(campo: keyof Filtros, valor: string) {
    setPagina(1);
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  function limpiar() {
    setPagina(1);
    setFiltros(FILTROS_VACIOS);
  }

  const opcionesSemestres = useMemo(() => {
    const unicos = new Map<string, SemestreResumen>();
    for (const s of semestres) {
      if (!unicos.has(s.semestre)) unicos.set(s.semestre, s);
    }
    return [...unicos.values()].sort((a, b) => (a.semestre < b.semestre ? 1 : -1));
  }, [semestres]);

  const hayFiltros = Object.values(filtros).some((v) => v.trim().length > 0);

  function irAPagina(siguiente: number) {
    if (siguiente >= 1 && siguiente <= totalPaginas && siguiente !== pagina) {
      setPagina(siguiente);
    }
  }

  return (
    <AppLayout>
      <section className="catalogo">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Catálogo de clases grabadas</h1>
          <p className="catalogo__subtitle">
            Busca grabaciones de semestres anteriores por semestre, curso, catedrático, escuela o tema.
          </p>
        </div>

        <div className="catalogo__filtros" role="search" aria-label="Búsqueda avanzada de clases">
          <div className="catalogo__busqueda">
            <label className="catalogo__busqueda-label" htmlFor="buscar-tema">
              Search
            </label>
            <input
              id="buscar-tema"
              className="catalogo__busqueda-input"
              type="search"
              placeholder="Buscar por tema o etiqueta…"
              value={filtros.tema}
              onChange={(e) => actualizar('tema', e.target.value)}
            />
          </div>

          <div className="catalogo__filtros-grid">
            <label className="catalogo__campo">
              <span className="catalogo__campo-label">Semestre</span>
              <select
                className="catalogo__select"
                value={filtros.semestre}
                onChange={(e) => actualizar('semestre', e.target.value)}
              >
                <option value="">Todos</option>
                {opcionesSemestres.map((s) => (
                  <option key={s.semestre} value={s.semestre}>
                    {s.semestre}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Curso"
              placeholder="Código o nombre"
              value={filtros.curso}
              onChange={(e) => actualizar('curso', e.target.value)}
            />
            <TextField
              label="Docente"
              placeholder="Nombre del catedrático"
              value={filtros.catedratico}
              onChange={(e) => actualizar('catedratico', e.target.value)}
            />
            <TextField
              label="Escuela"
              placeholder="Área o escuela"
              value={filtros.escuela}
              onChange={(e) => actualizar('escuela', e.target.value)}
            />
          </div>

          {hayFiltros && (
            <div className="catalogo__acciones">
              <Button variant="secondary" onClick={limpiar}>
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        <section className="catalogo__resultados" aria-label="Resultados de búsqueda">
          <h2 className="catalogo__resultados-titulo">{hayFiltros ? 'Resultados' : 'Recomendados para ti'}</h2>
          {cargando ? (
            <p className="catalogo__estado" role="status">
              Cargando catálogo…
            </p>
          ) : clases.length === 0 ? (
            <p className="catalogo__estado">No se encontraron clases con los filtros seleccionados.</p>
          ) : (
            <>
              <p className="catalogo__estado">
                {total} clase{total === 1 ? '' : 's'} encontrada{total === 1 ? '' : 's'}
              </p>
              <div className="catalogo__grid">
                {clases.map((clase) => (
                  <ClaseCard key={clase.claseId} clase={clase} />
                ))}
              </div>
              {totalPaginas > 1 && (
                <nav className="paginacion" aria-label="Paginación de resultados">
                  <button
                    type="button"
                    className="paginacion__boton"
                    disabled={pagina <= 1}
                    onClick={() => irAPagina(pagina - 1)}
                  >
                    Anterior
                  </button>
                  <span className="paginacion__info" role="status">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    className="paginacion__boton"
                    disabled={pagina >= totalPaginas}
                    onClick={() => irAPagina(pagina + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </section>
    </AppLayout>
  );
}
