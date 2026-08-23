import { Link } from 'react-router-dom';
import { CardThumbnail } from './CardThumbnail';
import type { ClaseResumen } from '../api/catalog';
import { thumbnailDeClase } from '../utils/video';

export function ClaseCard({ clase }: { clase: ClaseResumen }) {
  return (
    <Link to={`/catalogo/clase/${clase.claseId}`} className="clase-card">
      <div className="clase-card__thumb" aria-hidden="true">
        {/* La miniatura se superpone al fondo degradado; los rótulos quedan encima. */}
        <CardThumbnail src={thumbnailDeClase(clase.urlVideo, clase.claseId)} alt="" />
        <span className="clase-card__codigo">{clase.codigo}</span>
        <span className="clase-card__semestre">{clase.semestre}</span>
      </div>
      <div className="clase-card__body">
        <h3 className="clase-card__titulo">{clase.curso}</h3>
        <p className="clase-card__tema">
          {clase.unidad ? `${clase.unidad} · ` : ''}
          {clase.tema}
        </p>
        <p className="clase-card__meta">{clase.anio}</p>
      </div>
    </Link>
  );
}
