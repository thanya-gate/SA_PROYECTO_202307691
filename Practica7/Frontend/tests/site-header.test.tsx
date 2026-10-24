import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteHeader } from '@/components/SiteHeader';

let mockPathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('navegación pública', () => {
  it('expone los tres accesos y permite abrir el menú móvil', async () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Consultar reserva' })).toHaveAttribute('href', '/reservas');
    expect(screen.getByRole('link', { name: 'Verificar credencial' })).toHaveAttribute('href', '/verificar');

    const menu = screen.getByRole('button', { name: 'Abrir menú' });
    await userEvent.setup().click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
  });
});
