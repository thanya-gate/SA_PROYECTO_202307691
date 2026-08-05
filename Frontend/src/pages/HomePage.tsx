import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';

const MODULES = [
  { name: 'Catálogo', description: 'Explorar grabaciones por semestre, curso y catedrático', to: '/catalogo' },
  { name: 'Reproductor', description: 'Ver clases con checkpoint de avance', to: '' },
  { name: 'Asignaciones', description: 'Cursos inscritos y permisos por rol', to: '' },
  { name: 'Analítica', description: 'Tendencias y recomendaciones', to: '/analitica' },
];

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="home">
      <header className="home__header">
        <Logo size="small" />
        <nav className="home__nav" aria-label="Módulos">
          {MODULES.map((m) =>
            m.to ? (
              <button key={m.name} type="button" className="home__nav-link home__nav-link--link" onClick={() => navigate(m.to)}>
                {m.name}
              </button>
            ) : (
              <button key={m.name} type="button" className="home__nav-link" disabled title={m.description}>
                {m.name}
              </button>
            ),
          )}
        </nav>
        <div className="home__session">
          <span className="home__email">{user?.email}</span>
          <Button variant="secondary" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="home__main">
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
      </main>
    </div>
  );
}
