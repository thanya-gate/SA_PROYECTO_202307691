export interface OAuthTokenExchangeResult {
  sub: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Puerto para el proveedor OAuth 2.0 (inyección de dependencias).
 *
 * Cada implementación (Google, Mock, Microsoft Entra, etc.) intercambia un
 * authorization code por el perfil federado del usuario. En el flujo PKCE el
 * code_verifier se envía para demostrar que el cliente que inició el flujo es
 * el mismo que intercambia el código.
 */
export interface OAuthProvider {
  exchangeCode(code: string, codeVerifier?: string): Promise<OAuthTokenExchangeResult>;
}
