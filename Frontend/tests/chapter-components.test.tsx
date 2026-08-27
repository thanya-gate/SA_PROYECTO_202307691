jest.mock('../src/auth/auth-context', () => ({ useAuth: jest.fn() }));
jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: '/api', allowedDomains: [] } }));

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../src/auth/auth-context';
import { catalogApi, type Capitulo } from '../src/api/catalog';
import { ChapterManager } from '../src/components/ChapterManager';
import { ChapterTimeline } from '../src/components/ChapterTimeline';

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const claseId = 'clase-1';

function chapter(overrides: Partial<Capitulo> = {}): Capitulo {
  return {
    capituloId: 'cap-1',
    claseId,
    titulo: 'Introducción',
    inicioSegundos: 0,
    finSegundos: 60,
    orden: 1,
    fechaCreacion: '2026-08-25T00:00:00.000Z',
    fechaActualizacion: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('ChapterTimeline', () => {
  test('ordena visualmente, marca el capítulo activo y navega al inicio', () => {
    const onSeek = jest.fn();
    render(<ChapterTimeline
      capitulos={[chapter({ capituloId: 'cap-2', titulo: 'Segundo', inicioSegundos: 60, finSegundos: 120, orden: 2 }), chapter()]}
      duracion={120}
      currentSeconds={70}
      onSeek={onSeek}
    />);
    expect(screen.getByRole('button', { name: /Ir a Segundo/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Introducción')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ir a Introducción/ }));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  test('no renderiza barra cuando no hay capítulos', () => {
    const { container } = render(<ChapterTimeline capitulos={[]} duracion={120} currentSeconds={0} onSeek={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ChapterManager', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>);
    jest.spyOn(catalogApi, 'crearCapitulo').mockResolvedValue({ message: 'ok', capitulo: chapter({ capituloId: 'cap-2', titulo: 'Nuevo', inicioSegundos: 60, finSegundos: 120, orden: 2 }) });
    jest.spyOn(catalogApi, 'actualizarCapitulo').mockResolvedValue({ message: 'ok', capitulo: chapter({ titulo: 'Editado' }) });
    jest.spyOn(catalogApi, 'eliminarCapitulo').mockResolvedValue({ message: 'ok', claseId });
  });

  afterEach(() => jest.restoreAllMocks());

  test('no llama API si la duración es cero o el rango es inválido', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<ChapterManager claseId={claseId} duracion={0} capitulos={[]} onChange={onChange} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Agregar más' }).closest('form')!);
    expect(catalogApi.crearCapitulo).not.toHaveBeenCalled();
    expect(screen.getByText(/duración válida/i)).toBeInTheDocument();

    rerender(<ChapterManager claseId={claseId} duracion={120} capitulos={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Inicio'));
    await user.type(screen.getByLabelText('Inicio'), '1:00');
    await user.clear(screen.getByLabelText('Fin'));
    await user.type(screen.getByLabelText('Fin'), '0:30');
    fireEvent.submit(screen.getByRole('button', { name: 'Agregar más' }).closest('form')!);
    expect(catalogApi.crearCapitulo).not.toHaveBeenCalled();
    expect(screen.getByText(/final debe ser mayor/i)).toBeInTheDocument();
  });

  test('crea capítulo y actualiza la lista local ordenada', async () => {
    const onChange = jest.fn();
    render(<ChapterManager claseId={claseId} duracion={120} capitulos={[chapter()]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nombre'), 'Nuevo');
    await user.clear(screen.getByLabelText('Inicio'));
    await user.type(screen.getByLabelText('Inicio'), '1:00');
    await user.clear(screen.getByLabelText('Fin'));
    await user.type(screen.getByLabelText('Fin'), '2:00');
    await user.click(screen.getByRole('button', { name: 'Agregar más' }));
    await waitFor(() => expect(catalogApi.crearCapitulo).toHaveBeenCalledWith(
      claseId,
      expect.objectContaining({ titulo: 'Nuevo', inicioSegundos: 60, finSegundos: 120 }),
      'token',
    ));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ titulo: 'Nuevo' })]));
  });

  test('elimina capítulo solo después de confirmación y actualiza la lista', async () => {
    const onChange = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ChapterManager claseId={claseId} duracion={120} capitulos={[chapter()]} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(catalogApi.eliminarCapitulo).toHaveBeenCalledWith('cap-1', 'token'));
    expect(onChange).toHaveBeenCalledWith([]);
    confirmSpy.mockRestore();
  });
});
