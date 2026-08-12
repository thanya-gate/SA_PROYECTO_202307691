import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { AppLayout } from '../components/AppLayout';
import {
  AsignarCursosTab,
  CursosCatalogoTab,
  EscuelasTab,
  SemestresTab,
} from '../components/admin/AdminTabs';

type Tab = 'cursos' | 'semestres' | 'escuelas' | 'asignar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cursos', label: 'Cursos' },
  { id: 'semestres', label: 'Semestres' },
  { id: 'escuelas', label: 'Escuelas / Áreas' },
  { id: 'asignar', label: 'Asignar catedráticos' },
];

export default function GestionCursosPage() {
  const { token, user } = useAuth();
  const tokenActual = token ?? '';
  const [tab, setTab] = useState<Tab>('cursos');

  return (
    <AppLayout>
      <div className="admin">
        <header className="admin__hero">
          <div>
            <h1 className="admin__title">Gestión Académica</h1>
            <p className="admin__subtitle">
              Administra el catálogo de cursos (crear, editar y eliminar), los semestres, las
              escuelas o áreas y la asignación de catedráticos. Todos los cambios se persisten
              mediante procedimientos almacenados del catálogo.
            </p>
          </div>
          <span className="admin__badge">
            {user?.roles.includes('ROLE_ADMIN') ? 'Administrador' : 'Docente'}
          </span>
        </header>

        <nav className="admin-tabs" role="tablist" aria-label="Módulos de gestión académica">
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

        {tab === 'cursos' && <CursosCatalogoTab token={tokenActual} />}
        {tab === 'semestres' && <SemestresTab token={tokenActual} />}
        {tab === 'escuelas' && <EscuelasTab token={tokenActual} />}
        {tab === 'asignar' && <AsignarCursosTab token={tokenActual} />}
      </div>
    </AppLayout>
  );
}
