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

/**
 * Determina si la URL se reproduce con el <video> nativo: archivos servidos
 * por la plataforma (/media/...) o archivos alojados en el bucket de Cloud
 * Storage (URL absoluta que no es de YouTube).
 */
export function esVideoLocal(url: string): boolean {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('/media/')) return true;
  return /^https?:\/\//i.test(url) && youtubeVideoId(url) === null;
}

/**
 * Deduce la miniatura de una clase a partir de su URL de video:
 *  - YouTube: usa la imagen oficial del video (img.youtube.com).
 *  - Archivo propio: el gateway genera thumbnails/<claseId>.jpg junto al
 *    video, así que la URL se obtiene reemplazando el segmento /clases/ por
 *    /thumbnails/ (funciona igual con rutas relativas y URLs del bucket).
 * Devuelve null cuando no hay miniatura deducible; la tarjeta mostrará su
 * marcador genérico.
 */
export function thumbnailDeClase(urlVideo: string | undefined, claseId: string | undefined): string | null {
  if (!urlVideo || !claseId) return null;
  const yt = youtubeVideoId(urlVideo);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  if (/\/clases\/[^/?#]+/.test(urlVideo)) {
    return urlVideo.replace(/\/clases\/[^/?#]+/, `/thumbnails/${encodeURIComponent(claseId)}.jpg`);
  }
  return null;
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

/**
 * Convierte un texto de duración ("mm:ss", "h:mm:ss" o segundos sueltos) a
 * segundos. Devuelve null si el formato es inválido.
 */
export function parseDuracionInput(valor: string): number | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  const partes = limpio.split(':');
  if (partes.length > 3) return null;
  let segundos = 0;
  for (const parte of partes) {
    const p = parte.trim();
    if (!/^\d{1,2}$/.test(p)) return null;
    segundos = segundos * 60 + Number(p);
  }
  return segundos;
}

/**
 * Detecta la duración (en segundos) de un archivo de video usando el elemento
 * <video> del navegador. Sirve como respaldo cuando ffprobe no puede leer los
 * metadatos en el servidor.
 */
export function detectarDuracionArchivo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return resolve(null);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const terminar = (valor: number | null) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(valor);
    };
    video.onloadedmetadata = () => {
      const dur = video.duration;
      terminar(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null);
    };
    video.onerror = () => terminar(null);
    setTimeout(() => terminar(null), 8000);
    video.src = url;
  });
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
