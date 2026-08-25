import { config } from '../config/env';
import { apiFetch, ApiError } from './http';

export interface MaterialAdjunto {
  materialId: string;
  claseId: string;
  nombreArchivo: string;
  mimeType: string;
  extension: string;
  tamanoBytes: number;
  versionActual: number;
  totalDescargas: number;
  subidoPor?: string;
  fechaSubida?: string;
  urlArchivo: string;
}

interface ListaMaterialesResponse {
  materiales: MaterialAdjunto[];
}

interface MaterialResponse {
  message?: string;
  material?: MaterialAdjunto;
}

interface DescargaResponse {
  message: string;
  totalDescargas: number;
}

// Debe coincidir con MATERIAL_EXTENSIONS del api-gateway
export const MATERIALES_ACEPTADOS =
  '.pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip,.py,.go,.sql';

export const TAMANO_MAXIMO_MATERIAL = 50 * 1024 * 1024;

// El navegador suele mandar application/octet-stream para código fuente;
// deducimos el MIME por extensión para que el gateway lo acepte directo.
const MIME_POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.zip': 'application/zip',
  '.py': 'text/x-python',
  '.go': 'text/x-go',
  '.sql': 'application/sql',
};

function contentTypeDeArchivo(file: File): string {
  const m = /\.([A-Za-z0-9]{1,9})$/.exec(file.name.toLowerCase());
  const porExtension = m ? MIME_POR_EXTENSION[`.${m[1]}`] : undefined;
  return porExtension ?? file.type ?? 'application/octet-stream';
}

/**
 * El gateway recibe el nombre original en el header x-filename; los headers
 * HTTP solo admiten ASCII imprimible, así que aplicamos la misma normalización
 * del servidor (NFKD + reemplazo de caracteres especiales) antes de enviarlo.
 */
function nombreParaHeader(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? '';
  return (
    base
      .normalize('NFKD')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 120) || 'material'
  );
}

async function subirBinario(
  ruta: string,
  file: File,
  token: string,
): Promise<MaterialResponse> {
  if (file.size > TAMANO_MAXIMO_MATERIAL) {
    throw new ApiError(413, 'ARCHIVO_MUY_GRANDE', 'El archivo supera el límite de 50 MB');
  }
  return fetch(`${config.apiBaseUrl}${ruta}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentTypeDeArchivo(file),
      'x-filename': nombreParaHeader(file.name),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
    credentials: 'include',
  }).then(async (response) => {
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const envelope = data as { error?: { code?: string; message?: string } };
      throw new ApiError(
        response.status,
        envelope?.error?.code ?? 'ERROR_DESCONOCIDO',
        envelope?.error?.message ?? `Error del servidor (${response.status})`,
      );
    }
    return data as MaterialResponse;
  });
}

export const materialesApi = {
  listar: (claseId: string, token: string): Promise<ListaMaterialesResponse> =>
    apiFetch<ListaMaterialesResponse>(`/catalog/classes/${encodeURIComponent(claseId)}/materials`, { token }),

  subir: (claseId: string, file: File, token: string): Promise<MaterialResponse> =>
    subirBinario(`/catalog/classes/${encodeURIComponent(claseId)}/materials`, file, token),

  subirVersion: (materialId: string, file: File, token: string): Promise<MaterialResponse> =>
    subirBinario(`/catalog/materials/${encodeURIComponent(materialId)}/versiones`, file, token),

  eliminar: (materialId: string, token: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/catalog/materials/${encodeURIComponent(materialId)}`, {
      method: 'DELETE',
      token,
    }),

  registrarDescarga: (materialId: string, token: string): Promise<DescargaResponse> =>
    apiFetch<DescargaResponse>(`/catalog/materials/${encodeURIComponent(materialId)}/descarga`, {
      method: 'POST',
      token,
    }),
};
