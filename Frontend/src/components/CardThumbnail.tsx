import { useEffect, useState } from 'react';

interface CardThumbnailProps {
  /** URL de la miniatura; null cuando la clase no tiene una deducible. */
  src: string | null;
  alt: string;
}

/**
 * Miniatura de clase para las tarjetas (inicio, catálogo, historial).
 * Carga diferida con <img loading="lazy"> y maneja tres estados:
 *  - cargando: la imagen está en descarga, se muestra el marcador debajo.
 *  - lista:    la imagen se ve sobre el marcador.
 *  - error:    la URL no existe (clases subidas antes del feature) y se
 *              queda el marcador genérico para siempre.
 */
export function CardThumbnail({ src, alt }: CardThumbnailProps) {
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando');

  // Al cambiar la URL se reinicia el estado (React reutiliza el componente
  // entre listas paginadas).
  useEffect(() => {
    setEstado(src ? 'cargando' : 'error');
  }, [src]);

  return (
    <div className="card-thumb">
      {src && estado !== 'error' && (
        <img
          className={`card-thumb__img${estado === 'lista' ? ' card-thumb__img--visible' : ''}`}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setEstado('lista')}
          onError={() => setEstado('error')}
        />
      )}
      <div className={`card-thumb__placeholder${estado === 'lista' ? ' card-thumb__placeholder--oculto' : ''}`} aria-hidden="true">
        <span className="card-thumb__icono">▶</span>
      </div>
    </div>
  );
}
