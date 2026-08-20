import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analiticaApi,
  type RankingItem,
  type RecomendacionItem,
} from '../api/analitica';
import { catalogApi, type ClaseDetalle } from '../api/catalog';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';

interface ClaseInfo {
  codigo: string;
  curso: string;
  escuela: string;
  unidad: string;
  tema: string;
  semestre: string;
  anio: number;
}

interface RankingConClase extends RankingItem {
  clase?: ClaseInfo;
}

interface RecomendacionConClase extends RecomendacionItem {
  clase?: ClaseInfo;
}

const LIMITE = 10;

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

function formatearFecha(iso: string): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

export default function AnaliticaPage() {
  const { token, user } = useAuth();
  const tokenActual = token ?? '';

  const [semana, setSemana] = useState(isoHoy());
  const [semanaCalculada, setSemanaCalculada] = useState('');
  const [masVistas, setMasVistas] = useState<RankingConClase[]>([]);
  const [tendencias, setTendencias] = useState<RankingConClase[]>([]);
  const [ranking, setRanking] = useState<RankingConClase[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionConClase[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const puedeRecomendaciones =
    user?.roles.includes('ROLE_ESTUDIANTE') || user?.roles.includes('ROLE_ADMIN') || false;

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);

    const enriquecerRanking = async (items: RankingItem[]): Promise<RankingConClase[]> =>
      Promise.all(
        items.map(async (item) => ({
          ...item,
          clase: await buscarClase(item.claseId),
        })),
      );

    const enriquecerRecomendaciones = async (
      items: RecomendacionItem[],
    ): Promise<RecomendacionConClase[]> =>
      Promise.all(
        items.map(async (item) => ({
          ...item,
          clase: await buscarClase(item.claseId),
        })),
      );

    const buscarClase = async (claseId: string): Promise<ClaseInfo | undefined> => {
      try {
        const res = await catalogApi.getClase(claseId, tokenActual);
        return aClaseInfo(res.clase);
      } catch {
        return undefined;
      }
    };

    const semanaParam = lunesDe(semana);

    const tareas = [
      analiticaApi
        .clasesMasVistas(semanaParam, LIMITE, tokenActual)
        .then(async (res) => ({
          semana: res.semana,
          items: await enriquecerRanking(res.items),
        }))
        .then((res) => {
          if (active) {
            setSemanaCalculada(res.semana);
            setMasVistas(res.items);
          }
        }),
      analiticaApi
        .tendenciasExamenes(LIMITE, tokenActual)
        .then(async (res) => enriquecerRanking(res.items))
        .then((items) => {
          if (active) setTendencias(items);
        }),
      analiticaApi
        .rankingMejorValoradas(LIMITE, tokenActual)
        .then(async (res) => enriquecerRanking(res.items))
        .then((items) => {
          if (active) setRanking(items);
        }),
      (puedeRecomendaciones
        ? analiticaApi
            .recomendaciones(LIMITE, tokenActual)
            .then(async (res) => enriquecerRecomendaciones(res.items))
        : Promise.resolve([])
      ).then((items) => {
        if (active) setRecomendaciones(items);
      }),
    ];

    Promise.all(tareas)
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la analítica');
        }
      })
      .finally(() => {
        if (active) setCargando(false);
      });

    return () => {
      active = false;
    };
  }, [semana, tokenActual, puedeRecomendaciones]);

  const tituloDe = (item: RankingConClase | RecomendacionConClase): string =>
    item.clase?.tema || item.clase?.curso || 'Clase sin título';

  const metaDe = (item: RankingConClase | RecomendacionConClase): string =>
    [item.clase?.codigo, item.clase?.curso, item.clase?.unidad, item.clase?.semestre]
      .filter(Boolean)
      .join(' · ');

  return (
    <AppLayout>
      <section className="analitica">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Analítica académica</h1>
          <p className="catalogo__subtitle">
            Clases más vistas, tendencias en época de exámenes, ranking mejor valorado y
            recomendaciones personalizadas.
          </p>
        </div>

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando analítica…
          </p>
        ) : (
          <div className="analitica__grid">
            <section className="analitica__seccion" aria-label="Clases más vistas">
              <div className="analitica__cabecera">
                <div>
                  <h2 className="analitica__titulo">Clases más vistas</h2>
                  <p className="analitica__subtitulo">
                    {semanaCalculada ? `Semana del ${formatearFecha(semanaCalculada)}` : 'Semana actual'}
                  </p>
                </div>
                <label className="analitica__semana">
                  <span className="analitica__semana-label">Semana</span>
                  <input
                    type="date"
                    className="analitica__semana-input"
                    value={semana}
                    onChange={(e) => setSemana(e.target.value)}
                  />
                </label>
              </div>
              <ListaRanking items={masVistas} tituloDe={tituloDe} metaDe={metaDe} />
            </section>

            <section className="analitica__seccion" aria-label="Tendencias en época de exámenes">
              <div className="analitica__cabecera">
                <div>
                  <h2 className="analitica__titulo">Tendencias en época de exámenes</h2>
                  <p className="analitica__subtitulo">Clases más consultadas en las últimas 3 semanas.</p>
                </div>
              </div>
              <ListaRanking items={tendencias} tituloDe={tituloDe} metaDe={metaDe} />
            </section>

            <section className="analitica__seccion" aria-label="Ranking mejor valorado">
              <div className="analitica__cabecera">
                <div>
                  <h2 className="analitica__titulo">Mejor valoradas</h2>
                  <p className="analitica__subtitulo">Ranking por vistas y calificación promedio.</p>
                </div>
              </div>
              <ListaRanking items={ranking} tituloDe={tituloDe} metaDe={metaDe} />
            </section>

            {puedeRecomendaciones && (
              <section className="analitica__seccion" aria-label="Recomendaciones para ti">
                <div className="analitica__cabecera">
                  <div>
                    <h2 className="analitica__titulo">Recomendaciones para ti</h2>
                    <p className="analitica__subtitulo">
                      Porcentaje de recomendación calculado según tu historial.
                    </p>
                  </div>
                </div>
                <ListaRecomendaciones items={recomendaciones} tituloDe={tituloDe} metaDe={metaDe} />
              </section>
            )}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="catalogo__estado">{mensaje}</p>;
}

function ListaRanking({
  items,
  tituloDe,
  metaDe,
}: {
  items: RankingConClase[];
  tituloDe: (item: RankingConClase) => string;
  metaDe: (item: RankingConClase) => string;
}) {
  if (items.length === 0) {
    return (
      <Vacio mensaje="Sin datos todavía. Reproduce y califica clases para generar analítica." />
    );
  }
  return (
    <ol className="analitica__lista">
      {items.map((item) => (
        <li key={item.claseId}>
          <Link to={`/catalogo/clase/${item.claseId}`} className="analitica__item">
            <span className="analitica__item-pos">{item.posicion}</span>
            <div className="analitica__item-cuerpo">
              <h3 className="analitica__item-titulo">{tituloDe(item)}</h3>
              <p className="analitica__item-meta">{metaDe(item)}</p>
            </div>
            <div className="analitica__item-metricas">
              <span className="analitica__item-vistas">{item.totalVistas} vistas</span>
              <span className="analitica__item-estrellas">
                ★ {item.promedioCalificacion.toFixed(1)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function ListaRecomendaciones({
  items,
  tituloDe,
  metaDe,
}: {
  items: RecomendacionConClase[];
  tituloDe: (item: RecomendacionConClase) => string;
  metaDe: (item: RecomendacionConClase) => string;
}) {
  if (items.length === 0) {
    return <Vacio mensaje="Aún no hay recomendaciones para tu perfil." />;
  }
  return (
    <ol className="analitica__lista">
      {items.map((item) => {
        const porcentaje = Math.min(100, Math.max(0, item.porcentajeRecomendacion));
        return (
          <li key={item.claseId}>
            <Link to={`/catalogo/clase/${item.claseId}`} className="analitica__item">
              <span className="analitica__item-pos">#</span>
              <div className="analitica__item-cuerpo">
                <h3 className="analitica__item-titulo">{tituloDe(item)}</h3>
                <p className="analitica__item-meta">{metaDe(item)}</p>
              </div>
              <div className="analitica__item-metricas">
                <span className="analitica__item-vistas">{porcentaje.toFixed(1)}%</span>
                <span className="analitica__item-estrellas">
                  ★ {item.promedioCalificacion.toFixed(1)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
