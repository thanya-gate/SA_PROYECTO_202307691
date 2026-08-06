import { config } from '../config/env';

export function isInstitutionalEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return config.allowedDomains.some((domain) => lower.endsWith(domain));
}
