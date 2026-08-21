import { Link } from 'react-router-dom';
import type { HistorialItem } from '../api/reproduccion';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ContinueWatchingCard({ item }: { item: HistorialItem }) {
  const titulo = item.tema || item.curso || 'Clase sin título';
  const meta = [item.codigo, item.curso, item.unidad, item.semestre].filter(Boolean).join(' · ');
  const avance = Math.min(100, Math.max(0, item.porcentajeAvance));

  return (
    <Link to={`/catalogo/clase/${item.claseId}`} className="home-card">
      <div className="home-card__cabecera">
        <h3 className="home-card__titulo">{titulo}</h3>
        <span className="home-card__badge home-card__badge--avance">
          {avance.toFixed(0)}%
        </span>
      </div>
      {meta && <p className="home-card__meta">{meta}</p>}
      <div className="home-card__progreso" aria-hidden="true">
        <div
          className="home-card__progreso-llenado"
          style={{ width: `${avance}%` }}
        />
      </div>
      <div className="home-card__pie">
        <span className="home-card__reanudar">
          Reanudar en {formatTime(item.segundoActual)}
        </span>
        <span className="home-card__fecha">
          {item.fechaUltimaVisualizacion
            ? new Date(item.fechaUltimaVisualizacion).toLocaleDateString('es-GT')
            : ''}
        </span>
      </div>
    </Link>
  );
}
