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
import AnaliticaPage from './pages/AnaliticaPage';
import AdminPage from './pages/AdminPage';
import AsignacionesPage from './pages/AsignacionesPage';
import GestionCursosPage from './pages/GestionCursosPage';
import MisCursosPage from './pages/MisCursosPage';
import ProfilePage from './pages/ProfilePage';

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
  return children;
}

function RequireRole({ role, children }: { role: string; children: ReactElement }) {
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
  if (!user.roles.includes(role)) {
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
            path="/historial"
            element={
              <RequireAuth>
                <HistorialPage />
              </RequireAuth>
            }
          />
          <Route
            path="/asignaciones"
            element={
              <RequireAuth>
                <AsignacionesPage />
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
            path="/admin/cursos"
            element={
              <RequireRole role="ROLE_ADMIN">
                <GestionCursosPage />
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
          <Route
            path="/admin"
            element={
              <RequireRole role="ROLE_ADMIN">
                <AdminPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
