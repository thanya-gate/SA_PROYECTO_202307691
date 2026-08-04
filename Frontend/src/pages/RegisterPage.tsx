import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Alert } from '../components/ui/Alert';
import { ApiError } from '../api/http';
import { isInstitutionalEmail } from '../utils/domain';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isInstitutionalEmail(email)) {
      setError('Correo no autorizado. Solo se permiten dominios @ing.usac.edu.gt y @ingenieria.usac.edu.gt.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, confirmPassword);
      navigate('/login', { state: { registered: email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="register-title">
        <h1 id="register-title" className="auth-card__title">
          Crear cuenta
        </h1>
        <p className="auth-card__hint">
          El registro está restringido al dominio institucional de la Facultad de Ingeniería.
        </p>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <TextField
            id="register-email"
            label="Correo Institucional"
            type="email"
            autoComplete="username"
            placeholder="persona@ingenieria.usac.edu.gt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            id="register-password"
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <TextField
            id="register-confirm-password"
            label="Confirmar Contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={submitting} className="auth-card__submit">
            Crear cuenta
          </Button>
        </form>

        <div className="auth-card__divider">
          <span>¿Ya tienes cuenta?</span>
          <Link className="auth-card__link" to="/login">
            Iniciar sesión
          </Link>
        </div>
      </section>
    </AuthLayout>
  );
}
