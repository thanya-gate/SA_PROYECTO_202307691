import type { ReactNode } from 'react';

interface AlertProps {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
