import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Logo } from './Logo';
import { Button } from './ui/Button';

const NAV_ITEMS = [
  { to: '/', label: 'Principal', end: true },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/historial', label: 'Historial' },
  { to: '/catalogo', label: 'Tendencias' },
  { to: '/catalogo', label: 'Categorías' },
  { to: '/catalogo', label: 'Mis cursos' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-layout">
      <header className="app-layout__header">
        <NavLink to="/" className="app-layout__brand" aria-label="YoUSAC">
          <Logo size="small" />
        </NavLink>
        <nav className="app-layout__nav" aria-label="Módulos">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-layout__nav-link${isActive ? ' app-layout__nav-link--active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-layout__session">
          <span className="app-layout__email" title={user?.email}>
            {user?.email}
          </span>
          <Button variant="secondary" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className="app-layout__main">{children}</main>
    </div>
  );
}
