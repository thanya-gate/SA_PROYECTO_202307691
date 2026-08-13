import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const COLLAPSED_KEY = 'yousac_sidebar_collapsed';
const MOBILE_BREAKPOINT = '(max-width: 767px)';

type IconProps = { children: ReactNode };

function Icon({ children }: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const HomeIcon = () => (
  <Icon>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);
const GridIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);
const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </Icon>
);
const ChartIcon = () => (
  <Icon>
    <line x1="5" y1="20" x2="5" y2="12" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="19" y1="20" x2="19" y2="8" />
  </Icon>
);
const MenuIcon = () => (
  <Icon>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Icon>
);
const DashboardIcon = () => (
  <Icon>
    <rect x="3" y="3" width="8" height="10" rx="1.5" />
    <rect x="13" y="3" width="8" height="6" rx="1.5" />
    <rect x="13" y="11" width="8" height="10" rx="1.5" />
    <rect x="3" y="15" width="8" height="6" rx="1.5" />
  </Icon>
);
const UsersIcon = () => (
  <Icon>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
const ContentIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <polyline points="8 10 12 14 16 10" />
    <line x1="12" y1="2" x2="12" y2="4" />
  </Icon>
);
const UploadIcon = () => (
  <Icon>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Icon>
);
const BellIcon = () => (
  <Icon>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Icon>
);
const SettingsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);
const LogoutIcon = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </Icon>
);

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  disabled?: boolean;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Principal', end: true, icon: <HomeIcon /> },
  { to: '/catalogo', label: 'Catálogo', icon: <GridIcon /> },
  { to: '/mis-cursos', label: 'Mis cursos', icon: <ContentIcon /> },
  {
    to: '',
    label: 'Notificaciones',
    icon: <BellIcon />,
    disabled: true,
    description: 'Revisar las notificaciones del sistema',
  },
  { to: '/historial', label: 'Historial', icon: <ClockIcon /> },
  { to: '/analitica', label: 'Analítica', icon: <ChartIcon /> },
  { to: '/perfil', label: 'Mi perfil', icon: <SettingsIcon /> },
];

const DOCENTE_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Principal', end: true, icon: <HomeIcon /> },
  { to: '/catalogo', label: 'Catálogo', icon: <GridIcon /> },
  {
    to: '/admin/cursos',
    label: 'Gestión Académica',
    icon: <DashboardIcon />,
    description: 'Cursos, semestres, escuelas y asignación de catedráticos',
  },
  {
    to: '/admin/contenido',
    label: 'Gestión de Contenido',
    icon: <UploadIcon />,
    description: 'Subir videos y material por curso y carga masiva CSV',
  },
  {
    to: '',
    label: 'Notificaciones',
    icon: <BellIcon />,
    disabled: true,
    description: 'Revisar las notificaciones del sistema',
  },
  { to: '/analitica', label: 'Analítica', icon: <ChartIcon /> },
  { to: '/perfil', label: 'Mi perfil', icon: <SettingsIcon /> },
];

const AUXILIAR_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Principal', end: true, icon: <HomeIcon /> },
  { to: '/catalogo', label: 'Catálogo', icon: <GridIcon /> },
  { to: '/mis-cursos', label: 'Mis cursos', icon: <ContentIcon /> },
  {
    to: '/admin/contenido',
    label: 'Gestión de Contenido',
    icon: <UploadIcon />,
    description: 'Subir videos y material por curso y carga masiva CSV',
  },
  {
    to: '',
    label: 'Notificaciones',
    icon: <BellIcon />,
    disabled: true,
    description: 'Revisar las notificaciones del sistema',
  },
  { to: '/historial', label: 'Historial', icon: <ClockIcon /> },
  { to: '/analitica', label: 'Analítica', icon: <ChartIcon /> },
  { to: '/perfil', label: 'Mi perfil', icon: <SettingsIcon /> },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    end: true,
    icon: <DashboardIcon />,
    description: 'Resumen general de la plataforma',
  },
  { to: '/catalogo', label: 'Catálogo', icon: <GridIcon /> },
  {
    to: '/admin/usuarios',
    label: 'Gestión de Usuarios',
    icon: <UsersIcon />,
    description: 'Administrar cuentas, roles y permisos',
  },
  {
    to: '/admin/cursos',
    label: 'Gestión Académica',
    icon: <ContentIcon />,
    description: 'Administrar cursos del catálogo, semestres, escuelas y asignación de catedráticos',
  },
  {
    to: '/admin/contenido',
    label: 'Gestión de Contenido',
    icon: <UploadIcon />,
    description: 'Subir videos y material por curso y carga masiva CSV',
  },
  {
    to: '',
    label: 'Notificaciones',
    icon: <BellIcon />,
    disabled: true,
    description: 'Revisar y enviar notificaciones del sistema',
  },
  {
    to: '',
    label: 'Reportes',
    icon: <ChartIcon />,
    disabled: true,
    description: 'Métricas y reportes de uso de la plataforma',
  },
  {
    to: '',
    label: 'Configuraciones',
    icon: <SettingsIcon />,
    disabled: true,
    description: 'Configuración general de la plataforma',
  },
  { to: '/perfil', label: 'Mi perfil', icon: <SettingsIcon /> },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.roles.includes('ROLE_ADMIN') ?? false;
  const isCatedratico = user?.roles.includes('ROLE_CATEDRATICO') ?? false;
  const isAuxiliar = user?.roles.includes('ROLE_AUXILIAR') ?? false;
  const navItems = isAdmin
    ? ADMIN_NAV_ITEMS
    : isCatedratico
      ? DOCENTE_NAV_ITEMS
      : isAuxiliar
        ? AUXILIAR_NAV_ITEMS
        : NAV_ITEMS;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_BREAKPOINT).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = () => {
      setMobile(mq.matches);
      if (!mq.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function handleToggle() {
    if (mobile) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
      }
      return next;
    });
  }

  function handleNavClick() {
    if (mobile) setMobileOpen(false);
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase();

  const sidebarClass = [
    'app-layout__sidebar',
    !mobile && collapsed ? 'app-layout__sidebar--collapsed' : '',
    mobile && mobileOpen ? 'app-layout__sidebar--open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app-layout">
      <aside className={sidebarClass}>
        <div className="app-layout__sidebar-header">
          <NavLink to="/" className="app-layout__brand" aria-label="YoUSAC" onClick={handleNavClick}>
            <Logo size="small" />
          </NavLink>
          <ThemeToggle />
          <button
            className="app-layout__toggle"
            onClick={handleToggle}
            aria-label={mobile ? (mobileOpen ? 'Ocultar menú' : 'Mostrar menú') : collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-expanded={mobile ? mobileOpen : !collapsed}
          >
            <MenuIcon />
          </button>
        </div>
        <nav className="app-layout__nav" aria-label={isAdmin ? 'Panel de administración' : 'Módulos'}>
          {navItems.map((item) => {
            const content = (
              <>
                <span className="app-layout__nav-icon">{item.icon}</span>
                <span className="app-layout__nav-label">{item.label}</span>
              </>
            );

            if (item.disabled) {
              return (
                <button
                  key={item.label}
                  type="button"
                  className="app-layout__nav-link app-layout__nav-link--disabled"
                  disabled
                  title={item.description}
                >
                  {content}
                </button>
              );
            }

            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={handleNavClick}
                title={!mobile && collapsed ? item.label : undefined}
                className={({ isActive }) => `app-layout__nav-link${isActive ? ' app-layout__nav-link--active' : ''}`}
              >
                {content}
              </NavLink>
            );
          })}
        </nav>
        <div className="app-layout__session">
          <span className="app-layout__avatar" title={user?.email}>
            {initials}
          </span>
          {!mobile && collapsed ? (
            <button
              className="app-layout__logout app-layout__logout--icon"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogoutIcon />
            </button>
          ) : (
            <div className="app-layout__session-info">
              <span className="app-layout__email" title={user?.email}>
                {user?.email}
              </span>
              <button className="app-layout__logout" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>
      {mobile && mobileOpen && <div className="app-layout__backdrop" onClick={() => setMobileOpen(false)} />}
      <main className="app-layout__main">
        {children}
      </main>
    </div>
  );
}
