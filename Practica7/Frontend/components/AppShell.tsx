import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="site-main">{children}</main>
    </div>
  );
}

export function PageIntro({
  caseId,
  title,
  description,
}: {
  caseId: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-intro">
      <p className="case-id">{caseId}</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </header>
  );
}

export function MockContractNote({ children }: { children: ReactNode }) {
  return <p className="contract-note">{children}</p>;
}
