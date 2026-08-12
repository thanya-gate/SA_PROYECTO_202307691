import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import { DocentesTab, EstudiantesTab, RolesTab } from '../components/admin/AdminTabs';

type Tab = 'estudiantes' | 'roles' | 'docentes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'estudiantes', label: 'Estudiantes' },
  { id: 'roles', label: 'Auxiliaturas' },
  { id: 'docentes', label: 'Docentes' },
];

export default function GestionUsuariosPage() {
  const { token } = useAuth();
  const tokenActual = token ?? '';
  const [tab, setTab] = useState<Tab>('estudiantes');

  return (
    <AppLayout>
      <div className="admin">
        <header className="admin__hero">
          <div>
            <h1 className="admin__title">Gestión de Usuarios</h1>
            <p className="admin__subtitle">
              Administra las cuentas de estudiantes, auxiliaturas y docentes de la plataforma.
            </p>          </div>
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

        {tab === 'estudiantes' && <EstudiantesTab token={tokenActual} />}
        {tab === 'roles' && <RolesTab token={tokenActual} />}
        {tab === 'docentes' && <DocentesTab token={tokenActual} />}
      </div>
    </AppLayout>
  );
}
