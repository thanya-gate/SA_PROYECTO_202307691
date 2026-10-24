import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Academix Pass & CertiHub',
  description: 'Catálogo de eventos, reservas académicas y verificación pública de credenciales.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
