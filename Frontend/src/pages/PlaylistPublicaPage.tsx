import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { reproduccionApi, type Playlist, type PlaylistItem } from '../api/reproduccion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { CardThumbnail } from '../components/CardThumbnail';
import { Alert } from '../components/ui/Alert';
import { formatFecha, formatSegundos, thumbnailDeClase } from '../utils/video';

export default function PlaylistPublicaPage() {
  const { enlace = '' } = useParams();
  const { token } = useAuth();
  const tokenActual = token ?? '';

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    reproduccionApi
      .obtenerPlaylistPublica(enlace, tokenActual)
      .then((res) => {
        if (!active) return;
        setPlaylist(res.playlist);
        setItems(res.items ?? []);
        if (!res.playlist) setError('La playlist pública no existe o dejó de compartirse.');
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la playlist compartida');
          setPlaylist(null);
          setItems([]);
        }
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => {
      active = false;
    };
  }, [enlace, tokenActual]);

  return (
    <AppLayout>
      <section className="playlists">
        <Link to="/catalogo" className="catalogo__volver">
          ← Ir al catálogo
        </Link>

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando playlist compartida…
          </p>
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : playlist ? (
          <>
            <div className="playlists__hero">
              {items[0] && (
                <div className="playlists__item-thumb" aria-hidden="true">
                  <CardThumbnail src={thumbnailDeClase(items[0].urlVideo, items[0].claseId)} alt="" />
                </div>
              )}
              <span className="playlists__badge playlists__badge--publica">Compartida</span>
              <h1 className="playlists__hero-titulo">{playlist.nombre}</h1>
              <p className="playlists__meta">
                {items.length} {items.length === 1 ? 'elemento' : 'elementos'} · Creada por un compañero de la
                facultad · Actualizada el {formatFecha(playlist.fechaActualizacion)}
              </p>
            </div>

            <section className="catalogo__resultados" aria-label="Contenido de la playlist compartida">
              <h2 className="catalogo__resultados-titulo">Contenido</h2>
              {items.length === 0 ? (
                <p className="catalogo__estado">La playlist compartida aún no tiene elementos.</p>
              ) : (
                <ol className="playlists__items" aria-label="Elementos de la playlist compartida">
                  {items.map((item, index) => (
                    <li key={item.playlistItemId} className="playlists__item">
                      <span className="playlists__item-orden">{index + 1}</span>
                      <div className="playlists__item-thumb" aria-hidden="true">
                        <CardThumbnail src={thumbnailDeClase(item.urlVideo, item.claseId)} alt="" />
                      </div>
                      <div className="playlists__item-info">
                        <p className="playlists__item-titulo">{item.curso || 'Clase'}</p>
                        <p className="playlists__item-meta">
                          {item.codigo ? `${item.codigo} · ` : ''}
                          {item.tema || 'Sin tema'}
                          {item.semestre ? ` · ${item.semestre} ${item.anio ?? ''}` : ''}
                        </p>
                        {item.segundoInicio > 0 && (
                          <p className="playlists__item-fragmento">Fragmento desde {formatSegundos(item.segundoInicio)}</p>
                        )}
                      </div>
                      <div className="playlists__item-acciones">
                        <Link
                          className="btn btn--primary"
                          to={`/catalogo/clase/${item.claseId}${item.segundoInicio > 0 ? `?inicio=${item.segundoInicio}` : ''}`}
                        >
                          Reproducir
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </section>
    </AppLayout>
  );
}