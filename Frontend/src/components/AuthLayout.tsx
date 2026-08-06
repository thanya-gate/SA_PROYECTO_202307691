import type { ReactNode } from 'react';
import { Logo } from './Logo';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <header className="auth-layout__header">
        <Logo size="large" />
        <p className="auth-layout__subtitle">Facultad de Ingeniería · USAC</p>
      </header>
      <main className="auth-layout__main">{children}</main>
      <footer className="auth-layout__footer">
        © {new Date().getFullYear()} Universidad de San Carlos de Guatemala
      </footer>
    </div>
  );
}
