import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

const STATS = [
  { label: 'Usuarios', value: '—' },
  { label: 'Cursos', value: '—' },
  { label: 'Grabaciones', value: '—' },
  { label: 'Reproducciones', value: '—' },
];

export default function AdminPage() {
  return (
    <AppLayout>
      <div className="admin">
        <header className="admin__hero">
          <div>
            <h1 className="admin__title">Dashboard</h1>
            <p className="admin__subtitle">
              Panel exclusivo de administración del sistema. Los módulos de gestión se habilitarán en las próximas
              iteraciones.
            </p>
          </div>
          <span className="admin__badge">Administrador</span>
        </header>

        <section className="admin__stats" aria-label="Resumen del sistema">
          {STATS.map((stat) => (
            <article key={stat.label} className="admin__stat">
              <span className="admin__stat-label">{stat.label}</span>
              <span className="admin__stat-value">{stat.value}</span>
            </article>
          ))}
        </section>

        <section className="admin__panel" aria-label="Acceso rápido">
          <h2 className="admin__panel-title">Acceso rápido</h2>
          <div className="admin__acceso">
            <Link to="/catalogo" className="asig__ir">
              Ver catálogo de clases
            </Link>
          </div>
        </section>

        <section className="admin__panel" aria-label="Actividad reciente">
          <h2 className="admin__panel-title">Actividad reciente</h2>
          <div className="admin__empty">
            Aún no hay actividad para mostrar. La analítica del panel se integrará con el microservicio de analítica.
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
