import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../api/http';
import { AuthLayout } from '../components/AuthLayout';
import { Alert } from '../components/ui/Alert';

const OAUTH_STATE_KEY = 'yousac_oauth_state';

/**
 * Ruta de retorno del proveedor institucional (redirect_uri del OAuth).
 * Recibe ?code=...&state=..., valida el estado (CSRF) e intercambia el código
 * por la sesión, igual que haría un SPA real.
 */
export default function OAuthCallbackPage() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    const state = params.get('state');

    if (!code) {
      setError('El proveedor no devolvió un código de autorización.');
      return;
    }

    let savedState: string | null = null;
    try {
      savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    } catch {
    }
    if (state !== savedState) {
      setError('Estado inválido en la respuesta OAuth. Vuelve a intentarlo.');
      return;
    }

    completeOAuthLogin(code)
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo completar el inicio de sesión institucional.');
      });
  }, [completeOAuthLogin, navigate, params]);

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="oauth-callback-title">
        <h1 id="oauth-callback-title" className="auth-card__title">
          Cuenta institucional
        </h1>
        {error ? (
          <>
            <Alert tone="error">{error}</Alert>
            <div className="auth-card__divider">
              <Link className="auth-card__link" to="/login">
                Volver al inicio de sesión
              </Link>
            </div>
          </>
        ) : (
          <p className="auth-card__hint" role="status">
            Procesando autenticación institucional…
          </p>
        )}
      </section>
    </AuthLayout>
  );
}
