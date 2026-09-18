import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { reproduccionApi, type Playlist } from '../api/reproduccion';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { PlaylistCard } from '../components/PlaylistCard';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';

export default function PlaylistsPage() {
  const { token } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [publicas, setPublicas] = useState<Playlist[]>([]);
  const [cargandoPublicas, setCargandoPublicas] = useState(true);
  const [errorPublicas, setErrorPublicas] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [esPublica, setEsPublica] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const tokenActual = token ?? '';

  const cargar = () => {
    setCargando(true);
    setError(null);
    reproduccionApi
      .listarPlaylists(tokenActual)
      .then((res) => setPlaylists(res.playlists ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las playlists');
        setPlaylists([]);
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    cargarPublicas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenActual]);

  function cargarPublicas() {
    setCargandoPublicas(true);
    setErrorPublicas(null);
    reproduccionApi
      .listarPlaylistsPublicas(tokenActual)
      .then((res) => setPublicas(res.playlists ?? []))
      .catch((err: unknown) => {
        setErrorPublicas(err instanceof Error ? err.message : 'No se pudieron cargar las playlists compartidas');
        setPublicas([]);
      })
      .finally(() => setCargandoPublicas(false));
  }

  async function crearPlaylist(event: FormEvent) {
    event.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || creando) return;
    setCreando(true);
    setErrorCrear(null);
    try {
      const res = await reproduccionApi.crearPlaylist(nombreLimpio, esPublica, tokenActual);
      setPlaylists((prev) => [res.playlist, ...prev]);
      setNombre('');
      setEsPublica(false);
    } catch (err) {
      setErrorCrear(err instanceof Error ? err.message : 'No se pudo crear la playlist');
    } finally {
      setCreando(false);
    }
  }

  async function alternarVisibilidad(playlist: Playlist) {
    try {
      const res = await reproduccionApi.actualizarPlaylist(
        playlist.playlistId,
        playlist.nombre,
        !playlist.esPublica,
        tokenActual,
      );
      setPlaylists((prev) =>
        prev.map((p) => (p.playlistId === playlist.playlistId ? res.playlist : p)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la visibilidad');
    }
  }

  async function eliminar(playlist: Playlist) {
    const confirmacion = window.confirm(`¿Eliminar la playlist "${playlist.nombre}"? Se retirarán todos sus elementos.`);
    if (!confirmacion) return;
    try {
      await reproduccionApi.eliminarPlaylist(playlist.playlistId, tokenActual);
      setPlaylists((prev) => prev.filter((p) => p.playlistId !== playlist.playlistId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la playlist');
    }
  }

  async function copiarEnlace(playlist: Playlist) {
    const enlace = `${window.location.origin}/playlists/publicas/${playlist.enlacePublico}`;
    try {
      await navigator.clipboard.writeText(enlace);
      setError(null);
    } catch {
      setError('No se pudo copiar el enlace al portapapeles');
    }
  }

  return (
    <AppLayout>
      <section className="playlists">
        <div className="catalogo__hero">
          <h1 className="catalogo__title">Playlists de repaso</h1>
        </div>

        {error && (
          <Alert tone="error">
            <strong>Error:</strong> {error}
          </Alert>
        )}

        <form className="playlists__crear" onSubmit={crearPlaylist}>
          <h2 className="catalogo__resultados-titulo">Nueva playlist</h2>
          <div className="playlists__crear-campos">
            <TextField
              label="Nombre"
              placeholder="Ej. Repaso para el Segundo Parcial de Software Avanzado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
            />
            <label className="playlists__visibilidad">
              <input
                type="checkbox"
                checked={esPublica}
                onChange={(e) => setEsPublica(e.target.checked)}
              />
              <span>
                <strong>Pública</strong>
              </span>
            </label>
          </div>
          {errorCrear && <Alert tone="error">{errorCrear}</Alert>}
          <Button type="submit" disabled={creando || nombre.trim().length === 0} loading={creando}>
            {creando ? 'Creando…' : 'Crear playlist'}
          </Button>
        </form>

        <section className="catalogo__resultados" aria-label="Mis playlists">
          <h2 className="catalogo__resultados-titulo">Mis playlists</h2>
          {cargando ? (
            <p className="catalogo__estado" role="status">
              Cargando playlists…
            </p>
          ) : playlists.length === 0 ? (
            <div className="historial__vacio">
              <p className="catalogo__estado">Aún no has creado playlists de repaso.</p>
              <Link to="/catalogo" className="catalogo__volver">
                Explorar el catálogo →
              </Link>
            </div>
          ) : (
            <div className="catalogo__grid" aria-label="Mis playlists">
              {playlists.map((playlist) => (
                <PlaylistCard
                  key={playlist.playlistId}
                  playlist={playlist}
                  urlDetalle={`/playlists/${playlist.playlistId}`}
                  etiqueta={playlist.esPublica ? 'Pública' : 'Privada'}
                  conOpciones
                  onCopiarEnlace={() => void copiarEnlace(playlist)}
                  onAlternarVisibilidad={() => void alternarVisibilidad(playlist)}
                  onEliminar={() => void eliminar(playlist)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="catalogo__resultados" aria-label="Playlists compartidas por compañeros">
          <h2 className="catalogo__resultados-titulo">Playlists compartidas por compañeros</h2>
          {cargandoPublicas ? (
            <p className="catalogo__estado" role="status">
              Cargando playlists públicas…
            </p>
          ) : errorPublicas ? (
            <Alert tone="error">
              <strong>Error:</strong> {errorPublicas}
            </Alert>
          ) : publicas.length === 0 ? (
            <p className="catalogo__estado">Aún no hay playlists públicas de otros estudiantes.</p>
          ) : (
            <div className="catalogo__grid" aria-label="Playlists públicas de compañeros">
              {publicas.map((compartida) => (
                <PlaylistCard
                  key={compartida.playlistId}
                  playlist={compartida}
                  urlDetalle={`/playlists/publicas/${compartida.enlacePublico}`}
                  etiqueta="Pública · Compañero"
                />
              ))}
            </div>
          )}
        </section>
      </section>
    </AppLayout>
  );
}