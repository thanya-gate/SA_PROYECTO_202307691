import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { DocentesTab, RolesTab, SolicitudesTab } from '../components/admin/AdminTabs';

type Tab = 'docentes' | 'roles' | 'solicitudes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'docentes', label: 'Docentes' },
  { id: 'roles', label: 'Roles de estudiantes' },
  { id: 'solicitudes', label: 'Solicitudes de rol' },
];

export default function GestionUsuariosPage() {
  const { token } = useAuth();
  const tokenActual = token ?? '';
  const [tab, setTab] = useState<Tab>('docentes');

  return (
    <AppLayout>
      <div className="admin">
        <header className="admin__hero">
          <div>
            <h1 className="admin__title">Gestión de Usuarios</h1>
            <p className="admin__subtitle">
              Administra los registros de docentes de la plataforma. Habilita a catedráticos y
              auxiliares con permisos de publicación de clases.
            </p>
          </div>
          <span className="admin__badge">Administrador</span>
        </header>

        <nav className="admin-tabs" role="tablist" aria-label="Módulos de gestión de usuarios">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`admin-tabs__tab${tab === t.id ? ' admin-tabs__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'docentes' && <DocentesTab token={tokenActual} />}
        {tab === 'roles' && <RolesTab token={tokenActual} />}
        {tab === 'solicitudes' && <SolicitudesTab token={tokenActual} />}
      </div>
    </AppLayout>
  );
}
