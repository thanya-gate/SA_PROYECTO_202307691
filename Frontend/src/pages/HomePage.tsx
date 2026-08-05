import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <h1 className="home__welcome">Hola, {user?.email}</h1>
      <p className="home__subtitle">
        Sesión institucional activa. Verifica tu identidad y roles antes de continuar.
      </p>

      <section className="home__identity" aria-label="Datos de sesión">
        <h2>Mi sesión</h2>
        <dl className="home__identity-list">
          <div>
            <dt>Correo</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Correo verificado</dt>
            <dd>{user?.emailVerified ? 'Sí' : 'No'}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>
              <div className="home__roles">
                {user?.roles.map((role) => (
                  <span key={role} className="home__role">
                    {role.replace('ROLE_', '')}
                  </span>
                ))}
              </div>
            </dd>
          </div>
        </dl>
      </section>
    </AppLayout>
  );
}
