import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__theme">
        <ThemeToggle />
      </div>
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
