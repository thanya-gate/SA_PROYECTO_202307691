import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export default function AutorizacionPendientePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function cerrarSesion() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="pendiente-title">
        <h1 id="pendiente-title" className="auth-card__title">
          Cuenta pendiente de autorización
        </h1>
        <p className="auth-card__hint">
          Te registraste como {user?.email ? user.email : 'docente'}. Antes de acceder debes esperar la aprobación.
        </p>

        <Alert tone="info">
          <strong>Espera la autorización de un administrador.</strong> Un administrador debe aprobar tu cuenta de
          docente para que puedas publicar clases. Esta pantalla se desbloqueará automáticamente cuando tu cuenta sea
          autorizada.
        </Alert>

        <Button type="button" variant="secondary" className="auth-card__submit" onClick={cerrarSesion}>
          Cerrar sesión
        </Button>
      </section>
    </AuthLayout>
  );
}
