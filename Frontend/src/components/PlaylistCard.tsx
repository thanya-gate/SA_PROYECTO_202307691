import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Playlist } from '../api/reproduccion';
import { formatFecha, thumbnailDeClase } from '../utils/video';
import { CardThumbnail } from './CardThumbnail';

interface PlaylistCardProps {
  playlist: Playlist;
  /** URL a la que navega la tarjeta al hacer clic. */
  urlDetalle: string;
  /** Texto del sello sobre la miniatura (p. ej. "Pública" o "Pública · Compañero"). */
  etiqueta: string;
  /** Habilita el menú de tres puntos con las acciones de la playlist. */
  conOpciones?: boolean;
  onCopiarEnlace?: () => void;
  onAlternarVisibilidad?: () => void;
  onEliminar?: () => void;
}

/**
 * Tarjeta de playlist con el mismo formato que las tarjetas de video
 * (miniatura 16:9 del primer elemento). Las opciones de la playlist
 * (copiar enlace, visibilidad, eliminar) se agrupan en un menú de tres puntos.
 */
export function PlaylistCard({
  playlist,
  urlDetalle,
  etiqueta,
  conOpciones = false,
  onCopiarEnlace,
  onAlternarVisibilidad,
  onEliminar,
}: PlaylistCardProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  function ejecutar(accion?: () => void) {
    setMenuAbierto(false);
    accion?.();
  }

  return (
    <article className="playlist-card">
      <Link to={urlDetalle} className="playlist-card__link" aria-label={`Abrir ${playlist.nombre}`}>
        <div className="playlist-card__thumb" aria-hidden="true">
          <CardThumbnail src={thumbnailDeClase(playlist.urlVideo, playlist.claseId)} alt="" />
          <span className={`playlist-card__badge${playlist.esPublica ? ' playlist-card__badge--publica' : ''}`}>
            {etiqueta}
          </span>
        </div>
        <div className="playlist-card__body">
          <h3 className="playlist-card__titulo">{playlist.nombre}</h3>
          <p className="playlist-card__tema">{playlist.curso || 'Playlist de repaso'}</p>
          <p className="playlist-card__meta">
            {playlist.cantidadItems} {playlist.cantidadItems === 1 ? 'elemento' : 'elementos'} · Actualizada el{' '}
            {formatFecha(playlist.fechaActualizacion)}
          </p>
        </div>
      </Link>

      {conOpciones && (
        <div className="playlist-card__menu">
          <button
            type="button"
            className="playlist-card__menu-boton"
            aria-label="Opciones de la playlist"
            aria-expanded={menuAbierto}
            onClick={(e) => {
              e.preventDefault();
              setMenuAbierto((v) => !v);
            }}
          >
            ⋮
          </button>
          {menuAbierto && (
            <>
              <div className="playlist-card__menu-cierre" aria-hidden="true" onClick={() => setMenuAbierto(false)} />
              <div className="playlist-card__menu-pop" role="menu">
                {playlist.esPublica && onCopiarEnlace && (
                  <button type="button" className="playlist-card__menu-accion" onClick={() => ejecutar(onCopiarEnlace)}>
                    Copiar enlace para compartir
                  </button>
                )}
                {onAlternarVisibilidad && (
                  <button
                    type="button"
                    className="playlist-card__menu-accion"
                    onClick={() => ejecutar(onAlternarVisibilidad)}
                  >
                    {playlist.esPublica ? 'Hacer privada' : 'Convertir en pública'}
                  </button>
                )}
                {onEliminar && (
                  <button
                    type="button"
                    className="playlist-card__menu-accion playlist-card__menu-accion--peligro"
                    onClick={() => ejecutar(onEliminar)}
                  >
                    Eliminar playlist
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}