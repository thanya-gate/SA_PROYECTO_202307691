import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi, type ClaseResumen } from '../api/catalog';
import { reproduccionApi, type Playlist, type PlaylistItem } from '../api/reproduccion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { CardThumbnail } from '../components/CardThumbnail';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { formatFecha, formatSegundos, thumbnailDeClase } from '../utils/video';

export default function PlaylistDetallePage() {
  const { playlistId = '' } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const tokenActual = token ?? '';

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ClaseResumen[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [agregandoId, setAgregandoId] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    reproduccionApi
      .obtenerPlaylist(playlistId, tokenActual)
      .then((res) => {
        if (!res.playlist) {
          setError('La playlist no existe o no tienes acceso a ella.');
          setPlaylist(null);
          setItems([]);
          return;
        }
        setPlaylist(res.playlist);
        setNombre(res.playlist.nombre);
        setItems(res.items ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la playlist');
        setPlaylist(null);
        setItems([]);
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId, tokenActual]);

  async function guardarCambios(event: FormEvent) {
    event.preventDefault();
    if (!playlist || guardando) return;
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await reproduccionApi.actualizarPlaylist(playlist.playlistId, nombreLimpio, playlist.esPublica, tokenActual);
      setPlaylist(res.playlist);
      setNombre(res.playlist.nombre);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el nombre');
    } finally {
      setGuardando(false);
    }
  }

  async function alternarVisibilidad() {
    if (!playlist) return;
    setError(null);
    try {
      const res = await reproduccionApi.actualizarPlaylist(
        playlist.playlistId,
        playlist.nombre,
        !playlist.esPublica,
        tokenActual,
      );
      setPlaylist(res.playlist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la visibilidad');
    }
  }

  async function eliminarPlaylist() {
    if (!playlist) return;
    const confirmacion = window.confirm(`¿Eliminar la playlist "${playlist.nombre}"? Se retirarán todos sus elementos.`);
    if (!confirmacion) return;
    try {
      await reproduccionApi.eliminarPlaylist(playlist.playlistId, tokenActual);
      navigate('/playlists', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la playlist');
    }
  }

  async function copiarEnlace() {
    if (!playlist?.esPublica || !playlist.enlacePublico) return;
    const enlace = `${window.location.origin}/playlists/publicas/${playlist.enlacePublico}`;
    try {
      await navigator.clipboard.writeText(enlace);
      setError(null);
    } catch {
      setError('No se pudo copiar el enlace al portapapeles');
    }
  }

  async function reordenar(nuevaOrden: PlaylistItem[]) {
    if (!playlist) return;
    setError(null);
    const ids = nuevaOrden.map((item) => item.playlistItemId);
    try {
      const res = await reproduccionApi.reordenarPlaylist(playlist.playlistId, ids, tokenActual);
      setItems(res.items ?? nuevaOrden);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reordenar la playlist');
      cargar();
    }
  }

  function mover(index: number, delta: number) {
    const destino = index + delta;
    if (destino < 0 || destino >= items.length) return;
    const copia = [...items];
    const [item] = copia.splice(index, 1);
    copia.splice(destino, 0, item);
    void reordenar(copia);
  }

  async function eliminarItem(item: PlaylistItem) {
    if (!playlist) return;
    setError(null);
    try {
      const res = await reproduccionApi.eliminarItemPlaylist(playlist.playlistId, item.playlistItemId, tokenActual);
      setItems((prev) => prev.filter((i) => i.playlistItemId !== item.playlistItemId));
      setPlaylist((prev) => (prev ? { ...prev, cantidadItems: res.cantidadItems } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el elemento');
    }
  }

  async function buscarClases() {
    const termino = busqueda.trim();
    if (!termino) return;
    setBuscando(true);
    setError(null);
    try {
      const res = await catalogApi.search({ curso: termino, page: 1, pageSize: 8 }, tokenActual);
      setResultados(res.resultados);
    } catch (err) {
      setResultados([]);
      setError(err instanceof Error ? err.message : 'No se pudo buscar en el catálogo');
    } finally {
      setBuscando(false);
    }
  }

  async function agregarClase(clase: ClaseResumen) {
    if (!playlist) return;
    setAgregandoId(clase.claseId);
    setError(null);
    try {
      const res = await reproduccionApi.agregarItemPlaylist(playlist.playlistId, clase.claseId, 0, tokenActual);
      setItems((prev) => [...prev, res.item]);
      setPlaylist((prev) => (prev ? { ...prev, cantidadItems: res.cantidadItems } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la clase');
    } finally {
      setAgregandoId(null);
    }
  }

  return (
    <AppLayout>
      <section className="playlists">
        <Link to="/playlists" className="catalogo__volver">
          ← Mis playlists
        </Link>

        {cargando ? (
          <p className="catalogo__estado" role="status">
            Cargando playlist…
          </p>
        ) : error && !playlist ? (
          <Alert tone="error">{error}</Alert>
        ) : playlist ? (
          <>
            <div className="playlists__hero">
              {items[0] && (
                <div className="playlists__item-thumb" aria-hidden="true">
                  <CardThumbnail src={thumbnailDeClase(items[0].urlVideo, items[0].claseId)} alt="" />
                </div>
              )}
              <span
                className={`playlists__badge${playlist.esPublica ? ' playlists__badge--publica' : ' playlists__badge--privada'}`}
              >
                {playlist.esPublica ? 'Pública' : 'Privada'}
              </span>
              {editando ? (
                <form className="playlists__editar" onSubmit={guardarCambios}>
                  <TextField
                    label="Nombre de la playlist"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={120}
                  />
                  <div className="playlists__editar-acciones">
                    <Button type="submit" disabled={guardando || nombre.trim().length === 0} loading={guardando}>
                      Guardar
                    </Button>
                    <Button variant="secondary" onClick={() => setEditando(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <h1 className="playlists__hero-titulo">{playlist.nombre}</h1>
                  <p className="playlists__meta">
                    {items.length} {items.length === 1 ? 'elemento' : 'elementos'} · Creada el{' '}
                    {formatFecha(playlist.fechaCreacion)}
                  </p>
                  <div className="playlists__acciones">
                    <Button variant="secondary" onClick={() => setEditando(true)}>
                      Renombrar
                    </Button>
                    <Button variant="secondary" onClick={() => void alternarVisibilidad()}>
                      {playlist.esPublica ? 'Hacer privada' : 'Convertir en pública'}
                    </Button>
                    {playlist.esPublica && playlist.enlacePublico && (
                      <Button variant="secondary" onClick={() => void copiarEnlace()}>
                        Copiar enlace para compartir
                      </Button>
                    )}
                    <Button variant="danger" onClick={() => void eliminarPlaylist()}>
                      Eliminar playlist
                    </Button>
                  </div>
                </>
              )}
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            <section className="catalogo__resultados" aria-label="Agregar clase a la playlist">
              <h2 className="catalogo__resultados-titulo">Agregar grabaciones</h2>
              <div className="playlists__buscar">
                <TextField
                  label="Buscar en el catálogo"
                  placeholder="Curso, código o tema…"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setResultados(null);
                  }}
                />
                <Button variant="secondary" onClick={() => void buscarClases()} disabled={buscando || busqueda.trim().length === 0} loading={buscando}>
                  Buscar
                </Button>
              </div>
              {resultados !== null && (
                <ul className="playlists__resultados" aria-label="Resultados de la búsqueda de clases">
                  {resultados.length === 0 ? (
                    <li className="playlists__resultado playlists__resultado--vacio">
                      No se encontraron clases con ese criterio.
                    </li>
                  ) : (
                    resultados.map((clase) => (
                      <li key={clase.claseId} className="playlists__resultado">
                        <div className="playlists__resultado-thumb" aria-hidden="true">
                          <CardThumbnail src={thumbnailDeClase(clase.urlVideo, clase.claseId)} alt="" />
                        </div>
                        <div className="playlists__resultado-info">
                          <p className="playlists__resultado-titulo">{clase.curso}</p>
                          <p className="playlists__resultado-meta">
                            {clase.codigo} · {clase.semestre} · {clase.anio}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => void agregarClase(clase)}
                          disabled={agregandoId === clase.claseId}
                          loading={agregandoId === clase.claseId}
                        >
                          {agregandoId === clase.claseId ? 'Agregando…' : 'Agregar'}
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </section>

            <section className="catalogo__resultados" aria-label="Elementos de la playlist">
              <h2 className="catalogo__resultados-titulo">Contenido</h2>
              {items.length === 0 ? (
                <p className="catalogo__estado">
                  Esta playlist está vacía. Agrega grabaciones del catálogo para armar tu ruta de repaso.
                </p>
              ) : (
                <ol className="playlists__items" aria-label="Elementos ordenados de la playlist">
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
                        <Button variant="secondary" onClick={() => mover(index, -1)} disabled={index === 0} aria-label={`Subir elemento ${index + 1}`}>
                          ↑
                        </Button>
                        <Button variant="secondary" onClick={() => mover(index, 1)} disabled={index === items.length - 1} aria-label={`Bajar elemento ${index + 1}`}>
                          ↓
                        </Button>
                        <Button variant="danger" onClick={() => void eliminarItem(item)} aria-label={`Eliminar elemento ${index + 1}`}>
                          Quitar
                        </Button>
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