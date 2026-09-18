import { apiFetch } from './http';
import { config } from '../config/env';

export interface Checkpoint {
  historialId: string;
  claseId: string;
  segundoActual: number;
  duracion: number;
  porcentajeAvance: number;
  fechaActualizacion: string;
}

export interface HistorialItem {
  claseId: string;
  fechaUltimaVisualizacion: string;
  segundoActual: number;
  duracion: number;
  porcentajeAvance: number;
  tieneCheckpoint: boolean;
  codigo?: string;
  curso?: string;
  escuela?: string;
  unidad?: string;
  tema?: string;
  semestre?: string;
  anio?: number;
  urlVideo?: string;
}

interface GuardarCheckpointResponse {
  message: string;
  historialId: string;
  porcentajeAvance: number;
}

interface ObtenerCheckpointResponse {
  checkpoint: Checkpoint | null;
}

interface HistorialResponse {
  items: HistorialItem[];
}

export interface Apunte {
  apunteId: string;
  estudianteId: string;
  claseId: string;
  titulo: string;
  contenidoMarkdown: string;
  posicionSegundos: number;
  fechaCreacion: string;
  fechaActualizacion: string;
}

interface RegistrarCalificacionResponse {
  message: string;
  registrada: boolean;
}

export interface Playlist {
  playlistId: string;
  estudianteId: string;
  nombre: string;
  esPublica: boolean;
  enlacePublico: string;
  cantidadItems: number;
  fechaCreacion: string;
  fechaActualizacion: string;
  clasePortada?: string;
  claseId?: string;
  codigo?: string;
  curso?: string;
  escuela?: string;
  unidad?: string;
  tema?: string;
  semestre?: string;
  anio?: number;
  urlVideo?: string;
}

export interface PlaylistItem {
  playlistItemId: string;
  claseId: string;
  orden: number;
  segundoInicio: number;
  fechaAgregado: string;
  codigo?: string;
  curso?: string;
  escuela?: string;
  unidad?: string;
  tema?: string;
  semestre?: string;
  anio?: number;
  urlVideo?: string;
}

export const reproduccionApi = {
  guardarCheckpoint: (claseId: string, segundoActual: number, duracion: number, token: string, evento?: string): Promise<GuardarCheckpointResponse> =>
    apiFetch<GuardarCheckpointResponse>('/reproduccion/checkpoint', {
      method: 'POST',
      body: { claseId, segundoActual, duracion, ...(evento ? { evento } : {}) },
      token,
    }),

  obtenerCheckpoint: (claseId: string, token: string): Promise<ObtenerCheckpointResponse> =>
    apiFetch<ObtenerCheckpointResponse>(`/reproduccion/checkpoint/${encodeURIComponent(claseId)}`, { token }),

  historial: (token: string): Promise<HistorialResponse> =>
    apiFetch<HistorialResponse>('/reproduccion/historial', { token }),

  registrarCalificacion: (historialId: string, puntuacion: number, comentario: string, token: string, claseId?: string): Promise<RegistrarCalificacionResponse> =>
    apiFetch<RegistrarCalificacionResponse>('/reproduccion/calificaciones', {
      method: 'POST',
      body: { historialId, puntuacion, comentario, ...(claseId ? { claseId } : {}) },
      token,
    }),

  // ===== Cuaderno de apuntes (varios por clase) =====

  listarApuntes: (token: string, claseId?: string): Promise<{ apuntes: Apunte[] }> =>
    apiFetch<{ apuntes: Apunte[] }>(
      `/reproduccion/apuntes${claseId ? `?claseId=${encodeURIComponent(claseId)}` : ''}`,
      { token },
    ),

  guardarApunte: (claseId: string, apunteId: string, titulo: string, contenidoMarkdown: string, posicionSegundos: number, token: string): Promise<{ message: string; apunte: Apunte }> =>
    apiFetch<{ message: string; apunte: Apunte }>('/reproduccion/apuntes', {
      method: 'POST',
      body: { claseId, ...(apunteId ? { apunteId } : {}), titulo, contenidoMarkdown, posicionSegundos },
      token,
    }),

  eliminarApunte: (apunteId: string, token: string): Promise<{ message: string; eliminado: boolean }> =>
    apiFetch<{ message: string; eliminado: boolean }>(`/reproduccion/apuntes/${encodeURIComponent(apunteId)}`, {
      method: 'DELETE',
      token,
    }),

  exportarApunteMd: async (claseId: string, token: string): Promise<{ nombreArchivo: string; contenidoMd: string; mimeType: string }> => {
    const response = await fetch(`${config.apiBaseUrl}/reproduccion/apuntes/${encodeURIComponent(claseId)}/exportar`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contenidoMd = await response.text();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="?(.+?)"?$/);
    return {
      nombreArchivo: match ? match[1] : `apuntes-${claseId}.md`,
      contenidoMd,
      mimeType: response.headers.get('Content-Type') ?? 'text/markdown',
    };
  },

  // ===== Playlists de repaso (RF-F2-05) =====

  listarPlaylists: (token: string): Promise<{ playlists: Playlist[] }> =>
    apiFetch<{ playlists: Playlist[] }>('/reproduccion/playlists', { token }),

  listarPlaylistsPublicas: (token: string): Promise<{ playlists: Playlist[] }> =>
    apiFetch<{ playlists: Playlist[] }>('/reproduccion/playlists/publicas', { token }),

  crearPlaylist: (nombre: string, esPublica: boolean, token: string): Promise<{ message: string; playlist: Playlist }> =>
    apiFetch<{ message: string; playlist: Playlist }>('/reproduccion/playlists', {
      method: 'POST',
      body: { nombre, esPublica },
      token,
    }),

  obtenerPlaylist: (playlistId: string, token: string): Promise<{ playlist: Playlist | null; items: PlaylistItem[] }> =>
    apiFetch<{ playlist: Playlist | null; items: PlaylistItem[] }>(`/reproduccion/playlists/${encodeURIComponent(playlistId)}`, { token }),

  obtenerPlaylistPublica: (enlace: string, token: string): Promise<{ playlist: Playlist | null; items: PlaylistItem[] }> =>
    apiFetch<{ playlist: Playlist | null; items: PlaylistItem[] }>(`/reproduccion/playlists/publicas/${encodeURIComponent(enlace)}`, { token }),

  actualizarPlaylist: (playlistId: string, nombre: string, esPublica: boolean, token: string): Promise<{ message: string; playlist: Playlist }> =>
    apiFetch<{ message: string; playlist: Playlist }>(`/reproduccion/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'PATCH',
      body: { nombre, esPublica },
      token,
    }),

  eliminarPlaylist: (playlistId: string, token: string): Promise<{ message: string; eliminada: boolean }> =>
    apiFetch<{ message: string; eliminada: boolean }>(`/reproduccion/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'DELETE',
      token,
    }),

  agregarItemPlaylist: (playlistId: string, claseId: string, segundoInicio: number, token: string): Promise<{ message: string; item: PlaylistItem; cantidadItems: number }> =>
    apiFetch<{ message: string; item: PlaylistItem; cantidadItems: number }>(`/reproduccion/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: 'POST',
      body: { claseId, segundoInicio },
      token,
    }),

  reordenarPlaylist: (playlistId: string, itemsOrdenados: string[], token: string): Promise<{ message: string; items: PlaylistItem[] }> =>
    apiFetch<{ message: string; items: PlaylistItem[] }>(`/reproduccion/playlists/${encodeURIComponent(playlistId)}/items/orden`, {
      method: 'PUT',
      body: { itemsOrdenados },
      token,
    }),

  eliminarItemPlaylist: (playlistId: string, playlistItemId: string, token: string): Promise<{ message: string; eliminado: boolean; cantidadItems: number }> =>
    apiFetch<{ message: string; eliminado: boolean; cantidadItems: number }>(`/reproduccion/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(playlistItemId)}`, {
      method: 'DELETE',
      token,
    }),
};
