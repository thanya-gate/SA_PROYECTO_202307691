import { config } from '../config/env';
import { apiFetch, ApiError } from './http';

interface SubirVideoResponse {
  message: string;
  urlVideo: string;
  clase: {
    claseId: string;
    urlVideo: string;
  };
}

interface EstablecerUrlResponse {
  message: string;
  clase: {
    claseId: string;
    urlVideo: string;
  };
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export const mediaApi = {
  subirVideo: (claseId: string, file: File, token: string): Promise<SubirVideoResponse> =>
    fetch(`${config.apiBaseUrl}/catalog/classes/${encodeURIComponent(claseId)}/video`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
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
        const envelope = data as ErrorEnvelope;
        throw new ApiError(
          response.status,
          envelope?.error?.code ?? 'ERROR_DESCONOCIDO',
          envelope?.error?.message ?? `Error del servidor (${response.status})`,
        );
      }
      return data as SubirVideoResponse;
    }),

  establecerUrlVideo: (claseId: string, urlVideo: string, token: string): Promise<EstablecerUrlResponse> =>
    apiFetch<EstablecerUrlResponse>(`/catalog/classes/${encodeURIComponent(claseId)}/video-url`, {
      method: 'POST',
      body: { urlVideo },
      token,
    }),
};
