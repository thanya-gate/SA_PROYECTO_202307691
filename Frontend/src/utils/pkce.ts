/**
 * PKCE (Proof Key for Code Exchange) utilities para OAuth 2.0.
 *
 * RFC 7636: https://datatracker.ietf.org/doc/html/rfc7636
 *
 * Flujo:
 * 1. El SPA genera un code_verifier (43-128 chars, random).
 * 2. Calcula el code_challenge = base64url(SHA-256(code_verifier)).
 * 3. Envía el code_challenge al servidor de autorización (Google).
 * 4. Al intercambiar el authorization code, envía el code_verifier original.
 * 5. El servidor verifica: SHA-256(code_verifier) == code_challenge.
 */

const OAUTH_CODE_VERIFIER_KEY = 'yousac_oauth_code_verifier';

function base64UrlEncode(buffer: Uint8Array): string {
  const bytes = String.fromCharCode(...buffer);
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function saveCodeVerifier(verifier: string): void {
  try {
    sessionStorage.setItem(OAUTH_CODE_VERIFIER_KEY, verifier);
  } catch {
    // sessionStorage no disponible
  }
}

export function loadCodeVerifier(): string | null {
  try {
    return sessionStorage.getItem(OAUTH_CODE_VERIFIER_KEY);
  } catch {
    return null;
  }
}

export function clearCodeVerifier(): void {
  try {
    sessionStorage.removeItem(OAUTH_CODE_VERIFIER_KEY);
  } catch {
    // ignore
  }
}
