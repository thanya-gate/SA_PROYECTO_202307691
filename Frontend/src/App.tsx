import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/auth-context';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ClasePage from './pages/ClasePage';
import HistorialPage from './pages/HistorialPage';

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
