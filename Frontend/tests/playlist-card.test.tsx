import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Playlist } from '../src/api/reproduccion';
import { PlaylistCard } from '../src/components/PlaylistCard';

function playlist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    playlistId: 'playlist-1',
    estudianteId: 'estudiante-1',
    nombre: 'Repaso del segundo parcial',
    esPublica: true,
    enlacePublico: 'enlace-abc',
    cantidadItems: 2,
    fechaCreacion: '2026-09-10T10:00:00.000Z',
    fechaActualizacion: '2026-09-11T10:00:00.000Z',
    clasePortada: 'clase-1',
    urlVideo: 'https://www.youtube.com/watch?v=abc123',
    curso: 'Software Avanzado',
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof PlaylistCard>> = {}) {
  return render(
    <MemoryRouter>
      <PlaylistCard
        playlist={playlist()}
        urlDetalle="/playlists/playlist-1"
        etiqueta="Pública"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('PlaylistCard', () => {
  test('muestra miniatura, sello, nombre y meta como las tarjetas de video', () => {
    const { container } = renderCard();
    expect(container.querySelector('.card-thumb__placeholder')).not.toBeNull();
    expect(screen.getByText('Repaso del segundo parcial')).toBeInTheDocument();
    expect(screen.getByText('Pública')).toBeInTheDocument();
    expect(screen.getByText(/2 elementos/)).toBeInTheDocument();
  });

  test('enlaza al detalle de la playlist', () => {
    renderCard();
    const vinculo = screen.getByRole('link', { name: /Abrir Repaso del segundo parcial/ });
    expect(vinculo).toHaveAttribute('href', '/playlists/playlist-1');
  });

  test('sin conOpciones no muestra el menú de tres puntos', () => {
    renderCard({ conOpciones: false });
    expect(screen.queryByRole('button', { name: /Opciones de la playlist/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar playlist/ })).not.toBeInTheDocument();
  });

  test('abre el menú, ejecuta la opción elegida y lo cierra', () => {
    const onCopiarEnlace = jest.fn();
    const onAlternarVisibilidad = jest.fn();
    const onEliminar = jest.fn();
    renderCard({ conOpciones: true, onCopiarEnlace, onAlternarVisibilidad, onEliminar });

    fireEvent.click(screen.getByRole('button', { name: /Opciones de la playlist/ }));
    expect(screen.getByRole('button', { name: /Copiar enlace para compartir/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hacer privada/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eliminar playlist/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hacer privada/ }));
    expect(onAlternarVisibilidad).toHaveBeenCalledTimes(1);
    expect(onCopiarEnlace).not.toHaveBeenCalled();
    expect(onEliminar).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Eliminar playlist/ })).not.toBeInTheDocument();
  });

  test('playlist privada oculta "Copiar enlace" y sugiere convertir en pública', () => {
    renderCard({
      conOpciones: true,
      playlist: playlist({ esPublica: false, enlacePublico: '' }),
      onCopiarEnlace: jest.fn(),
      onAlternarVisibilidad: jest.fn(),
      onEliminar: jest.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Opciones de la playlist/ }));
    expect(screen.queryByRole('button', { name: /Copiar enlace para compartir/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Convertir en pública/ })).toBeInTheDocument();
  });

  test('eliminar invoca el callback de eliminación', () => {
    const onEliminar = jest.fn();
    renderCard({ conOpciones: true, onEliminar });

    fireEvent.click(screen.getByRole('button', { name: /Opciones de la playlist/ }));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar playlist/ }));
    expect(onEliminar).toHaveBeenCalledTimes(1);
  });
});