import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { Alert } from '../components/ui/Alert';
import { adminApi } from '../api/admin';
import { analiticaApi, type RankingItem } from '../api/analitica';
import { catalogApi } from '../api/catalog';

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

const COLORES = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

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

function PieChart({ items, label }: { items: { label: string; value: number; color: string }[]; label: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <div className="admin__empty">Sin datos de {label}.</div>;

  let acumulado = 0;
  const segmentos = items.map((item) => {
    const inicio = acumulado;
    acumulado += (item.value / total) * 100;
    return `${item.color} ${inicio}% ${acumulado}%`;
  });
  const conic = `conic-gradient(${segmentos.join(', ')})`;

  return (
    <div className="admin__pie-wrap">
      <div className="admin__pie" style={{ background: conic }} aria-label={label}>
        <div className="admin__pie-hole" />
      </div>
      <ul className="admin__pie-legend">
        {items.map((item) => (
          <li key={item.label} className="admin__pie-legend-item">
            <span className="admin__pie-swatch" style={{ background: item.color }} />
            <span className="admin__pie-legend-label">{item.label}</span>
            <span className="admin__pie-legend-value">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
    return <p className="catalogo__estado">Sin datos aun.</p>;
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

export default function AdminPage() {
  const { token } = useAuth();
  const tokenActual = token ?? '';

  const [totalCursos, setTotalCursos] = useState(0);
  const [totalGrabaciones, setTotalGrabaciones] = useState(0);
  const [totalEscuelas, setTotalEscuelas] = useState(0);
  const [totalSemestres, setTotalSemestres] = useState(0);

  const [semana, setSemana] = useState(isoHoy());
  const [semanaCalculada, setSemanaCalculada] = useState('');
  const [masVistas, setMasVistas] = useState<RankingConClase[]>([]);
  const [tendencias, setTendencias] = useState<RankingConClase[]>([]);
  const [ranking, setRanking] = useState<RankingConClase[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const buscarClase = async (claseId: string): Promise<ClaseInfo | undefined> => {
      try {
        const res = await catalogApi.getClase(claseId, tokenActual);
        const c = res.clase;
        return { codigo: c.codigo, curso: c.curso, escuela: c.escuela, unidad: c.unidad, tema: c.tema, semestre: c.semestre, anio: c.anio };
      } catch { return undefined; }
    };

    const enriquecer = async (items: RankingItem[]): Promise<RankingConClase[]> =>
      Promise.all(items.map(async (item) => ({ ...item, clase: await buscarClase(item.claseId) })));

    setCargando(true);
    setError(null);

    const semanaParam = lunesDe(semana);
    const LIMITE = 10;

    Promise.all([
      adminApi.listarCursos(tokenActual),
      adminApi.listarSemestres(tokenActual),
      adminApi.listarEscuelas(tokenActual),
      analiticaApi.clasesMasVistas(semanaParam, LIMITE, tokenActual).then(async (res) => ({
        semana: res.semana,
        items: await enriquecer(res.items),
      })),
      analiticaApi.tendenciasExamenes(LIMITE, tokenActual).then(async (res) => enriquecer(res.items)),
      analiticaApi.rankingMejorValoradas(LIMITE, tokenActual).then(async (res) => enriquecer(res.items)),
    ])
      .then(([cursosRes, semestresRes, escuelasRes, vistasRes, tendenciasRes, rankingRes]) => {
        if (!active) return;
        setTotalCursos(cursosRes.cursos.length);
        setTotalGrabaciones(semestresRes.semestres.reduce((a, s) => a + s.clases, 0));
        setTotalEscuelas(escuelasRes.escuelas.length);
        setTotalSemestres(semestresRes.semestres.length);
        setSemanaCalculada(vistasRes.semana);
        setMasVistas(vistasRes.items);
        setTendencias(tendenciasRes);
        setRanking(rankingRes);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar la analitica');
      })
      .finally(() => { if (active) setCargando(false); });

    return () => { active = false; };
  }, [semana, tokenActual]);

  const tituloDe = (item: RankingConClase): string =>
    item.clase?.tema || item.clase?.curso || 'Clase sin titulo';

  const metaDe = (item: RankingConClase): string =>
    [item.clase?.codigo, item.clase?.curso, item.clase?.unidad, item.clase?.semestre]
      .filter(Boolean)
      .join(' · ');

  const vistasPieItems = useMemo(() =>
    masVistas.slice(0, 8).map((item, idx) => ({
      label: item.clase?.tema || item.clase?.curso || `Clase ${idx + 1}`,
      value: item.totalVistas,
      color: COLORES[idx % COLORES.length],
    })),
  [masVistas]);

  const tendenciasPieItems = useMemo(() =>
    tendencias.slice(0, 8).map((item, idx) => ({
      label: item.clase?.tema || item.clase?.curso || `Clase ${idx + 1}`,
      value: item.totalVistas,
      color: COLORES[idx % COLORES.length],
    })),
  [tendencias]);

  const ratingPieItems = useMemo(() =>
    ranking.slice(0, 8).map((item, idx) => ({
      label: item.clase?.tema || item.clase?.curso || `Clase ${idx + 1}`,
      value: item.promedioCalificacion,
      color: COLORES[idx % COLORES.length],
    })),
  [ranking]);

  const totalVistasGlobal = masVistas.reduce((s, i) => s + i.totalVistas, 0);
  const promRatingGlobal = ranking.length > 0
    ? (ranking.reduce((s, i) => s + i.promedioCalificacion, 0) / ranking.length).toFixed(1)
    : '0.0';

  return (
    <AppLayout>
      <div className="admin">
        <header className="admin__hero">
          <div>
            <h1 className="admin__title">Dashboard</h1>
            <p className="admin__subtitle">
              Resumen general de la plataforma YoUSAC — metricas, tendencias y reportes de uso.
            </p>
          </div>
          <span className="admin__badge">Administrador</span>
        </header>

        <section className="admin__stats" aria-label="Resumen del sistema">
          <article className="admin__stat">
            <span className="admin__stat-value">{cargando ? '...' : totalCursos}</span>
            <span className="admin__stat-label">Cursos</span>
          </article>
          <article className="admin__stat">
            <span className="admin__stat-value">{cargando ? '...' : totalGrabaciones}</span>
            <span className="admin__stat-label">Grabaciones</span>
          </article>
          <article className="admin__stat">
            <span className="admin__stat-value">{cargando ? '...' : totalEscuelas}</span>
            <span className="admin__stat-label">Escuelas</span>
          </article>
          <article className="admin__stat">
            <span className="admin__stat-value">{cargando ? '...' : totalSemestres}</span>
            <span className="admin__stat-label">Semestres</span>
          </article>
        </section>

        <div className="admin__grid">
          <section className="admin__panel" aria-label="Distribucion de vistas">
            <h2 className="admin__panel-title">Distribucion de vistas por clase</h2>
            <p className="admin__panel-subtitle">Total de vistas esta semana: {totalVistasGlobal}</p>
            <PieChart items={vistasPieItems} label="vistas" />
          </section>
          <section className="admin__panel" aria-label="Tendencias">
            <h2 className="admin__panel-title">Tendencias en epoca de examenes</h2>
            <p className="admin__panel-subtitle">Clases mas consultadas en las ultimas 3 semanas.</p>
            <PieChart items={tendenciasPieItems} label="tendencias" />
          </section>
        </div>

        <div className="admin__grid">
          <section className="admin__panel" aria-label="Rating promedio">
            <h2 className="admin__panel-title">Rating promedio por clase</h2>
            <p className="admin__panel-subtitle">Promedio global: {promRatingGlobal} estrellas</p>
            <PieChart items={ratingPieItems} label="calificaciones" />
          </section>
          <section className="admin__panel" aria-label="Accesos rapidos">
            <h2 className="admin__panel-title">Accesos rapidos</h2>
            <div className="admin__links">
              <Link to="/analitica" className="admin__link-card">
                <span className="admin__link-text">Analitica completa</span>
              </Link>
              <Link to="/catalogo" className="admin__link-card">
                <span className="admin__link-text">Catalogo de clases</span>
              </Link>
              <Link to="/gestion/cursos" className="admin__link-card">
                <span className="admin__link-text">Gestion de cursos</span>
              </Link>
              <Link to="/gestion/usuarios" className="admin__link-card">
                <span className="admin__link-text">Gestion de usuarios</span>
              </Link>
            </div>
          </section>
        </div>

        <div className="analitica" style={{ marginTop: '1.5rem' }}>
          <h2 className="analitica__titulo" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Reportes de analitica
          </h2>

          {error && <Alert tone="error"><strong>Error:</strong> {error}</Alert>}

          {cargando ? (
            <p className="catalogo__estado" role="status">Cargando reportes...</p>
          ) : (
            <div className="analitica__grid">
              <section className="analitica__seccion" aria-label="Clases mas vistas">
                <div className="analitica__cabecera">
                  <div>
                    <h3 className="analitica__titulo">Clases mas vistas</h3>
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

              <section className="analitica__seccion" aria-label="Tendencias en examenes">
                <div className="analitica__cabecera">
                  <div>
                    <h3 className="analitica__titulo">Tendencias en epoca de examenes</h3>
                    <p className="analitica__subtitulo">Clases mas consultadas en las ultimas 3 semanas.</p>
                  </div>
                </div>
                <ListaRanking items={tendencias} tituloDe={tituloDe} metaDe={metaDe} />
              </section>

              <section className="analitica__seccion" aria-label="Mejor valoradas">
                <div className="analitica__cabecera">
                  <div>
                    <h3 className="analitica__titulo">Mejor valoradas</h3>
                    <p className="analitica__subtitulo">Ranking por vistas y calificacion promedio.</p>
                  </div>
                </div>
                <ListaRanking items={ranking} tituloDe={tituloDe} metaDe={metaDe} />
              </section>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
