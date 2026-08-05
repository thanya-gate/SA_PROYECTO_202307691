import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Alert } from '../components/ui/Alert';
import { ApiError } from '../api/http';
import { isInstitutionalEmail } from '../utils/domain';
import type { RegisterRole } from '../api/auth';

const MIN_PASSWORD_LENGTH = 8;
const CARNET_PATTERN = /^\d{8,10}$/;
const DPI_PATTERN = /^\d{13}$/;

type TipoCuenta = 'estudiante' | 'docente';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<TipoCuenta>('estudiante');
  const [carnet, setCarnet] = useState('');
  const [dpi, setDpi] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function cambiarTipo(next: TipoCuenta) {
    setTipo(next);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const esEstudiante = tipo === 'estudiante';

    if (esEstudiante && !CARNET_PATTERN.test(carnet)) {
      setError('El carnet debe contener de 8 a 10 dígitos.');
      return;
    }
    if (!DPI_PATTERN.test(dpi)) {
      setError('El DPI debe contener exactamente 13 dígitos.');
      return;
    }
    const fecha = new Date(`${fechaNacimiento}T00:00:00Z`);
    if (!fechaNacimiento || Number.isNaN(fecha.getTime()) || fecha.getTime() > Date.now()) {
      setError('Ingresa una fecha de nacimiento válida (no futura).');
      return;
    }
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

    const rol: RegisterRole = esEstudiante ? 'ESTUDIANTE' : 'CATEDRATICO';

    setSubmitting(true);
    try {
      await register({ carnet: esEstudiante ? carnet : '', dpi, fechaNacimiento, email, password, confirmPassword, rol });
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

        <div className="auth-card__tabs" role="tablist" aria-label="Tipo de cuenta">
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'estudiante'}
            className={`auth-card__tab${tipo === 'estudiante' ? ' auth-card__tab--active' : ''}`}
            onClick={() => cambiarTipo('estudiante')}
          >
            Estudiante
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'docente'}
            className={`auth-card__tab${tipo === 'docente' ? ' auth-card__tab--active' : ''}`}
            onClick={() => cambiarTipo('docente')}
          >
            Docente
          </button>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          {tipo === 'estudiante' ? (
            <TextField
              id="register-carnet"
              label="Carnet"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="202307691"
              value={carnet}
              onChange={(e) => setCarnet(e.target.value.replace(/\D/g, ''))}
              required
            />
          ) : null}
          <TextField
            id="register-dpi"
            label="DPI"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234567890123"
            value={dpi}
            onChange={(e) => setDpi(e.target.value.replace(/\D/g, ''))}
            required
          />
          <TextField
            id="register-birthdate"
            label="Fecha de Nacimiento"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
            required
          />
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
            Crear cuenta de {tipo === 'estudiante' ? 'estudiante' : 'docente'}
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
