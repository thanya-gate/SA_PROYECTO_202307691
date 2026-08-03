import { DomainError } from '../errors/domain-error';

/**
 * Validador de dominio institucional (RF-01 / RF-02 / CDU0001.2).
 * Rechaza correos fuera de los dominios de la Facultad de Ingeniería.
 */
export class EmailDomainValidator {
  private readonly allowedDomains: string[];

  constructor(allowedDomains: string[]) {
    this.allowedDomains = allowedDomains.map((d) => d.toLowerCase());
  }

  /**
   * Valida que el correo pertenezca a un dominio institucional permitido.
   * Lanza DomainError DOMINIO_NO_AUTORIZADO si no lo es.
   */
  validate(email: string): string {
    const normalized = email.trim().toLowerCase();
    const domain = normalized.split('@')[1];

    if (!domain || !this.allowedDomains.includes(domain)) {
      throw new DomainError(
        'DOMINIO_NO_AUTORIZADO',
        'Correo no autorizado. Solo se permite el correo institucional de la Facultad de Ingeniería (@ingenieria.usac.edu.gt / @ing.usac.edu.gt).',
        403,
        { email: normalized },
      );
    }

    return normalized;
  }

  /** Variante booleana (sin lanzar excepción), útil para gRPC y pruebas. */
  isAllowed(email: string): boolean {
    const domain = email.trim().toLowerCase().split('@')[1];
    return !!domain && this.allowedDomains.includes(domain);
  }
}
