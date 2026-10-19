import { DomainError } from '../domain/domain-error';

// Cliente server-to-server de Academix Pass & CertiHub (Prácticas 7–10). El
// navegador nunca llama a Academix: así no hay CORS y el nombre/correo del
// estudiante salen de la sesión de YoUSAC, no del cliente.
export interface AcademixApi {
  talleres(curso: string): Promise<unknown>;
  reservar(eventoId: string, nombre: string, correo: string): Promise<unknown>;
  estadoReserva(trackingId: string): Promise<unknown>;
  credenciales(titular: string): Promise<unknown>;
  verificar(codigo: string): Promise<unknown>;
}

export function crearAcademixApi(baseUrl: string, fetchFn: typeof fetch = fetch, timeoutMs = 5000): AcademixApi {
  const base = baseUrl.replace(/\/+$/, '');

  async function pedir(ruta: string, init: RequestInit = {}): Promise<unknown> {
    if (!base) throw new DomainError('ACADEMIX_NO_CONFIGURADO', 'La integración con Academix no está configurada', 503);
    let res: Response;
    try {
      res = await fetchFn(`${base}${ruta}`, {
        ...init,
        headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      console.warn(JSON.stringify({ nivel: 'WARN', evento: 'academix_error', ruta, error: String(err) }));
      throw new DomainError('ACADEMIX_NO_DISPONIBLE', 'Academix Pass no responde en este momento', 503);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const mensaje = (body as { error?: string; mensaje?: string }).mensaje ?? (body as { error?: string }).error;
      throw new DomainError('ACADEMIX_ERROR', mensaje || `Academix respondió ${res.status}`, res.status >= 500 ? 502 : res.status);
    }
    return body;
  }

  const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

  return {
    talleres: (curso) => pedir(`/catalogo/api/talleres/eventos?${q({ busqueda: curso, limite: '20' })}`),
    reservar: (eventoId, nombre, correo) =>
      pedir('/reservas/api/reservas', {
        method: 'POST',
        body: JSON.stringify({ eventoId, estudianteNombre: nombre, estudianteCorreo: correo, canal: 'yousac' }),
      }),
    estadoReserva: (trackingId) => pedir(`/reservas/api/reservas/${encodeURIComponent(trackingId)}/estado`),
    credenciales: (titular) => pedir(`/certificados/api/certificados/credenciales?${q({ titular })}`),
    verificar: (codigo) => pedir(`/certificados/api/certificados/verificar?${q({ codigo, exigirFirma: 'true' })}`),
  };
}

export function nombreCompleto(user: { nombres?: string | null; apellidos?: string | null; email: string }): string {
  const nombre = `${user.nombres ?? ''} ${user.apellidos ?? ''}`.trim();
  return nombre || user.email;
}
