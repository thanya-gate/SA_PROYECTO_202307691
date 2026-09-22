'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/', label: 'Eventos', key: 'events' },
  { href: '/reservas', label: 'Consultar reserva', key: 'reservations' },
  { href: '/verificar', label: 'Verificar credencial', key: 'credentials' },
];

function isActive(pathname: string, key: string): boolean {
  if (key === 'events') return pathname === '/' || pathname === '/evento' || pathname === '/reservar';
  if (key === 'reservations') return pathname.startsWith('/reservas');
  return pathname.startsWith('/verificar');
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="brand" aria-label="Academix Pass & CertiHub">
        <span>Academix Pass</span>
        <strong>&amp; CertiHub</strong>
      </div>

      <button
        type="button"
        className="menu-toggle"
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        MENÚ
      </button>

      <nav className={`site-nav${menuOpen ? ' site-nav--open' : ''}`} aria-label="Navegación principal">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActive(pathname, link.key) ? 'site-nav__link site-nav__link--active' : 'site-nav__link'}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
