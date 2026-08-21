import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/auth-context';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ClasePage from './pages/ClasePage';
import HistorialPage from './pages/HistorialPage';
import NotificacionesPage from './pages/NotificacionesPage';
import AnaliticaPage from './pages/AnaliticaPage';
import AdminPage from './pages/AdminPage';
import GestionCursosPage from './pages/GestionCursosPage';
import GestionContenidoPage from './pages/GestionContenidoPage';
import GestionUsuariosPage from './pages/GestionUsuariosPage';
import MisCursosPage from './pages/MisCursosPage';
import SubirClasePage from './pages/SubirClasePage';
import EditarClasePage from './pages/EditarClasePage';
import ProfilePage from './pages/ProfilePage';
import AutorizacionPendientePage from './pages/AutorizacionPendientePage';

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="app-loading" role="status">
        Cargando sesión…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.docentePendiente) {
    return <AutorizacionPendientePage />;
  }
  return children;
}

function RequireRole({ roles, children }: { roles: string[]; children: ReactElement }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="app-loading" role="status">
        Cargando sesión…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.docentePendiente) {
    return <AutorizacionPendientePage />;
  }
  if (!roles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/catalogo"
            element={
              <RequireAuth>
                <CatalogPage />
              </RequireAuth>
            }
          />
          <Route
            path="/catalogo/clase/:claseId"
            element={
              <RequireAuth>
                <ClasePage />
              </RequireAuth>
            }
          />
          <Route
            path="/catalogo/clase/:claseId/editar"
            element={
              <RequireRole roles={['ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR']}>
                <EditarClasePage />
              </RequireRole>
            }
          />
          <Route
            path="/historial"
            element={
              <RequireAuth>
                <HistorialPage />
              </RequireAuth>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <RequireAuth>
                <NotificacionesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/mis-cursos"
            element={
              <RequireAuth>
                <MisCursosPage />
              </RequireAuth>
            }
          />
          <Route
            path="/mis-cursos/:cursoId/subir-clase"
            element={
              <RequireAuth>
                <SubirClasePage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['ROLE_ADMIN']}>
                <AdminPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/cursos"
            element={
              <RequireRole roles={['ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR']}>
                <GestionCursosPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/contenido"
            element={
              <RequireRole roles={['ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR']}>
                <GestionContenidoPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/contenido/subir/:cursoId"
            element={
              <RequireRole roles={['ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR']}>
                <SubirClasePage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <RequireRole roles={['ROLE_ADMIN']}>
                <GestionUsuariosPage />
              </RequireRole>
            }
          />
          <Route
            path="/analitica"
            element={
              <RequireAuth>
                <AnaliticaPage />
              </RequireAuth>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
