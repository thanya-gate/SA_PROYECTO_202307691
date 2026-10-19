import { Link } from 'react-router-dom';
import { CardThumbnail } from './CardThumbnail';
import type { ClaseExterna, ClaseResumen } from '../api/catalog';
import { thumbnailDeClase } from '../utils/video';

export function ClaseCard({ clase, mostrarOrigen = false }: { clase: ClaseResumen; mostrarOrigen?: boolean }) {
  return (
    <Link to={`/catalogo/clase/${clase.claseId}`} className="clase-card">
      <div className="clase-card__thumb" aria-hidden="true">
        {/* La miniatura se superpone al fondo degradado; los rótulos quedan encima. */}
        <CardThumbnail src={thumbnailDeClase(clase.urlVideo, clase.claseId)} alt="" />
        <span className="clase-card__codigo">{clase.codigo}</span>
        <span className="clase-card__semestre">{clase.semestre}</span>
      </div>
      <div className="clase-card__body">
        {mostrarOrigen && <span className="clase-card__origen">Grabación Local – Facultad</span>}
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

export function ClaseExternaCard({ clase }: { clase: ClaseExterna }) {
  return (
    <Link to={`/catalogo/externa/${encodeURIComponent(clase.id)}`} className="clase-card">
      <div className="clase-card__thumb" aria-hidden="true">
        <CardThumbnail src={thumbnailDeClase(clase.videoUrl, clase.id)} alt="" />
        <span className="clase-card__codigo">{clase.codigoCurso ?? ''}</span>
        <span className="clase-card__semestre">{clase.semestre ?? ''}</span>
      </div>
      <div className="clase-card__body">
        <span className="clase-card__origen clase-card__origen--externa">
          Grabación Externa – {clase.origen.grupo}
        </span>
        <h3 className="clase-card__titulo">{clase.curso}</h3>
        <p className="clase-card__tema">
          {clase.unidad ? `${clase.unidad} · ` : ''}
          {clase.titulo}
        </p>
        <p className="clase-card__meta">{clase.anio ?? ''}</p>
      </div>
    </Link>
  );
}
