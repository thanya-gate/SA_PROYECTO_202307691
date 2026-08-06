import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Alert } from '../components/ui/Alert';
import { ApiError } from '../api/http';
import { isInstitutionalEmail } from '../utils/domain';

interface LocationState {
  registered?: string;
}

export default function LoginPage() {
  const { login, loginWithOAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [oauthOpen, setOauthOpen] = useState(false);
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isInstitutionalEmail(email)) {
      setError('Correo no autorizado. Solo se permiten dominios @ing.usac.edu.gt y @ingenieria.usac.edu.gt.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isInstitutionalEmail(oauthEmail)) {
      setError('Correo no autorizado. Solo se permiten dominios @ing.usac.edu.gt y @ingenieria.usac.edu.gt.');
      return;
    }

    setOauthSubmitting(true);
    try {
      // Redirige a la pantalla del proveedor institucional (IdP). El navegador
      // volverá a /oauth/callback con el authorization code.
      await loginWithOAuth(oauthEmail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el flujo de autenticación institucional.');
      setOauthSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title" className="auth-card__title">
          Iniciar sesión
        </h1>
        <p className="auth-card__hint">Accede con tu correo institucional de la Facultad de Ingeniería.</p>

        {state?.registered ? (
          <Alert tone="success">Cuenta creada. Ahora puedes iniciar sesión.</Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <TextField
            id="login-email"
            label="Correo Institucional"
            type="email"
            autoComplete="username"
            placeholder="persona@ingenieria.usac.edu.gt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            id="login-password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={submitting} className="auth-card__submit">
            Iniciar Sesión
          </Button>
        </form>

        <div className="auth-card__divider">
          <span>¿Aún no tienes cuenta?</span>
          <Link className="auth-card__link" to="/register">
            Créala aquí
          </Link>
        </div>

        <div className="auth-card__oauth">
          {!oauthOpen ? (
            <Button variant="oauth" type="button" onClick={() => setOauthOpen(true)}>
              Ingresar con cuenta institucional
            </Button>
          ) : (
            <form className="auth-card__oauth-form" onSubmit={handleOAuth} noValidate>
              <TextField
                id="oauth-email"
                label="Correo institucional (OAuth)"
                type="email"
                placeholder="persona@ing.usac.edu.gt"
                value={oauthEmail}
                onChange={(e) => setOauthEmail(e.target.value)}
                autoFocus
                required
              />
              <Button variant="oauth" type="submit" loading={oauthSubmitting}>
                Ir a la cuenta institucional
              </Button>
              <p className="auth-card__oauth-hint">
                Serás redirigido a la pantalla del proveedor institucional para autenticarte.
              </p>
            </form>
          )}
        </div>
      </section>
    </AuthLayout>
  );
}
