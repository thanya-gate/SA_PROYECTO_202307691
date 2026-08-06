const YOUTUBE_WATCH = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/;

export function youtubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(YOUTUBE_WATCH);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}`;
}

export function youtubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(YOUTUBE_WATCH);
  return match ? match[1] : null;
}

export function esVideoLocal(url: string): boolean {
  return typeof url === 'string' && url.startsWith('/media/');
}

export function formatSegundos(totalSegundos: number): string {
  if (!Number.isFinite(totalSegundos) || totalSegundos <= 0) return '0:00';
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = Math.floor(totalSegundos % 60);
  const mm = String(minutos).padStart(2, '0');
  const ss = String(segundos).padStart(2, '0');
  return horas > 0 ? `${horas}:${mm}:${ss}` : `${minutos}:${ss}`;
}

export function formatDuracion(totalSegundos: number): string {
  if (!Number.isFinite(totalSegundos) || totalSegundos <= 0) return '—';
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  if (horas > 0) {
    return `${horas} h ${minutos} min`;
  }
  return `${minutos} min`;
}

export function formatFecha(iso: string | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
}
