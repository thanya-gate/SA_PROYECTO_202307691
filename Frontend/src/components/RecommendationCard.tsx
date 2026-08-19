import { Link } from 'react-router-dom';
import type { RecomendacionItem } from '../api/analitica';

export interface RecomendacionConClase extends RecomendacionItem {
  clase?: {
    codigo: string;
    curso: string;
    escuela: string;
    unidad: string;
    tema: string;
    semestre: string;
    anio: number;
  };
}

export function RecommendationCard({ item }: { item: RecomendacionConClase }) {
  const titulo = item.clase?.tema || item.clase?.curso || 'Clase sin título';
  const meta = [item.clase?.codigo, item.clase?.curso, item.clase?.unidad, item.clase?.semestre]
    .filter(Boolean)
    .join(' · ');
  const porcentaje = Math.min(100, Math.max(0, item.porcentajeRecomendacion));

  return (
    <Link to={`/catalogo/clase/${item.claseId}`} className="home-card">
      <div className="home-card__cabecera">
        <h3 className="home-card__titulo">{titulo}</h3>
        <span className="home-card__badge home-card__badge--recomendacion">
          {porcentaje.toFixed(0)}%
        </span>
      </div>
      {meta && <p className="home-card__meta">{meta}</p>}
      <div className="home-card__progreso" aria-hidden="true">
        <div
          className="home-card__progreso-llenado home-card__progreso-llenado--recomendacion"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <div className="home-card__pie">
        <span className="home-card__recomendacion-label">Recomendado para ti</span>
        <span className="home-card__estrellas">
          ★ {item.promedioCalificacion.toFixed(1)}
        </span>
      </div>
    </Link>
  );
}
