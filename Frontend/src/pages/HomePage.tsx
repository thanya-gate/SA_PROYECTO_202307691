import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { ContinueWatchingCard } from '../components/ContinueWatchingCard';
import { RecommendationCard, type RecomendacionConClase } from '../components/RecommendationCard';
import { reproduccionApi, type HistorialItem } from '../api/reproduccion';
import { analiticaApi, type RankingItem } from '../api/analitica';
import { catalogApi, type ClaseDetalle } from '../api/catalog';

interface ClaseInfo {
  codigo: string;
  curso: string;
  escuela: string;
  unidad: string;
  tema: string;
  semestre: string;
  anio: number;
}

interface TrendingConClase extends RankingItem {
  clase?: ClaseInfo;
}

const LIMITE = 5;

function aClaseInfo(clase: ClaseDetalle): ClaseInfo {
  return {
    codigo: clase.codigo,
    curso: clase.curso,
    escuela: clase.escuela,
    unidad: clase.unidad,
    tema: clase.tema,
    semestre: clase.semestre,
    anio: clase.anio,
  };
}

function isoHoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const diasDesdeLunes = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diasDesdeLunes);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default function HomePage() {
  const { user, token } = useAuth();
  const tokenActual = token ?? '';

  const [continuarViendo, setContinuarViendo] = useState<HistorialItem[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionConClase[]>([]);
  const [tendencias, setTendencias] = useState<TrendingConClase[]>([]);
  const [cargando, setCargando] = useState(true);

  const esEstudiante = user?.roles.includes('ROLE_ESTUDIANTE') ?? false;
  const esCatedratico = user?.roles.includes('ROLE_CATEDRATICO') ?? false;
  const esAuxiliar = user?.roles.includes('ROLE_AUXILIAR') ?? false;
  const puedeRecomendaciones = esEstudiante || (user?.roles.includes('ROLE_ADMIN') ?? false);
  const esContenido = esCatedratico || esAuxiliar;

  if (user?.roles.includes('ROLE_ADMIN')) {
    return <Navigate to="/admin" replace />;
  }

  useEffect(() => {
    let active = true;
    setCargando(true);

    const buscarClase = async (claseId: string): Promise<ClaseInfo | undefined> => {
      try {
        const res = await catalogApi.getClase(claseId, tokenActual);
        return aClaseInfo(res.clase);
      } catch {
        return undefined;
      }
    };

    const tareas: Promise<void>[] = [];

    tareas.push(
      reproduccionApi
        .historial(tokenActual)
        .then(async (res) => {
          const conCheckpoint = res.items
            .filter((i) => i.tieneCheckpoint && i.segundoActual > 0)
            .slice(0, LIMITE);
          if (active) setContinuarViendo(conCheckpoint);
        })
        .catch(() => {}),
    );

    if (puedeRecomendaciones) {
      tareas.push(
        analiticaApi
          .recomendaciones(LIMITE, tokenActual)
          .then(async (res) => {
            const items: RecomendacionConClase[] = await Promise.all(
              res.items.map(async (item) => ({
                ...item,
                clase: await buscarClase(item.claseId),
              })),
            );
            if (active) setRecomendaciones(items);
          })
          .catch(() => {}),
      );
    }

    tareas.push(
      analiticaApi
        .clasesMasVistas(lunesDe(isoHoy()), LIMITE, tokenActual)
        .then(async (res) => {
          const items: TrendingConClase[] = await Promise.all(
            res.items.map(async (item) => ({
              ...item,
              clase: await buscarClase(item.claseId),
            })),
          );
          if (active) setTendencias(items);
        })
        .catch(() => {}),
    );

    Promise.all(tareas).finally(() => {
      if (active) setCargando(false);
    });

    return () => {
      active = false;
    };
  }, [tokenActual, puedeRecomendaciones]);

  return (
    <AppLayout wide>
      <div className="home__main">
        <h1 className="home__welcome">Hola, {user?.email}</h1>
        <p className="home__subtitle">
          {esContenido
            ? 'Bienvenido al panel de contenido de YoUSAC.'
            : 'Bienvenido a tu plataforma de clases grabadas.'}
        </p>

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando tu contenido…
          </p>
        ) : (
          <>
            {continuarViendo.length > 0 && (
              <section className="home__section" aria-label="Continuar viendo">
                <div className="home__section-header">
                  <h2 className="home__section-title">Continuar viendo</h2>
                  <Link to="/historial" className="home__section-link">
                    Ver todo
                  </Link>
                </div>
                <div className="home__cards">
                  {continuarViendo.map((item) => (
                    <ContinueWatchingCard key={item.claseId} item={item} />
                  ))}
                </div>
              </section>
            )}

            {puedeRecomendaciones && recomendaciones.length > 0 && (
              <section className="home__section" aria-label="Recomendaciones">
                <div className="home__section-header">
                  <h2 className="home__section-title">Recomendado para ti</h2>
                  <Link to="/analitica" className="home__section-link">
                    Ver analítica
                  </Link>
                </div>
                <div className="home__cards">
                  {recomendaciones.map((item) => (
                    <RecommendationCard key={item.claseId} item={item} />
                  ))}
                </div>
              </section>
            )}

            {tendencias.length > 0 && (
              <section className="home__section" aria-label="Tendencias">
                <div className="home__section-header">
                  <h2 className="home__section-title">Tendencias</h2>
                  <Link to="/analitica" className="home__section-link">
                    Ver analítica
                  </Link>
                </div>
                <div className="home__cards">
                  {tendencias.map((item) => (
                    <Link
                      key={item.claseId}
                      to={`/catalogo/clase/${item.claseId}`}
                      className="home-card"
                    >
                      <div className="home-card__cabecera">
                        <h3 className="home-card__titulo">
                          {item.clase?.tema || item.clase?.curso || 'Clase sin título'}
                        </h3>
                        <span className="home-card__badge home-card__badge--tendencia">
                          #{item.posicion}
                        </span>
                      </div>
                      {(item.clase?.codigo || item.clase?.curso) && (
                        <p className="home-card__meta">
                          {[item.clase?.codigo, item.clase?.curso, item.clase?.semestre]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <div className="home-card__pie">
                        <span className="home-card__vistas">{item.totalVistas} vistas</span>
                        <span className="home-card__estrellas">
                          ★ {item.promedioCalificacion.toFixed(1)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {continuarViendo.length === 0 && recomendaciones.length === 0 && tendencias.length === 0 && (
              <div className="home__vacio">
                <p>No hay contenido para mostrar aún.</p>
                <Link to="/catalogo" className="home__catalogo-link">
                  Explorar catálogo de clases
                </Link>
              </div>
            )}
          </>
        )}


      </div>
    </AppLayout>
  );
}
