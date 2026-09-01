jest.mock('../src/auth/auth-context', () => ({ useAuth: jest.fn() }));
jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: '/api', allowedDomains: [] } }));

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../src/auth/auth-context';
import { catalogApi, type Capitulo } from '../src/api/catalog';
import { ChapterManager } from '../src/components/ChapterManager';
import { ChapterTimeline } from '../src/components/ChapterTimeline';
import { PlayerProgressBar } from '../src/components/PlayerProgressBar';

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
    expect(screen.getByRole('button', { name: /Segundo/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Introducción')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Introducción/ }));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  test('no renderiza barra cuando no hay capítulos', () => {
    const { container } = render(<ChapterTimeline capitulos={[]} duracion={120} currentSeconds={0} onSeek={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  test('no muestra la barra segmentada gráfica, solo la lista de capítulos', () => {
    const { container } = render(<ChapterTimeline
      capitulos={[chapter(), chapter({ capituloId: 'cap-2', titulo: 'Segundo', inicioSegundos: 60, finSegundos: 120, orden: 2 })]}
      duracion={120}
      currentSeconds={0}
      onSeek={jest.fn()}
    />);
    expect(container.querySelector('.clase__segmentacion-barra')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Introducción|Segundo/ })).toHaveLength(2);
  });
});

describe('PlayerProgressBar', () => {
  test('muestra play/pause, tiempo y rendeiza capítulos y pines de apuntes', () => {
    const onSeek = jest.fn();
    const onTogglePlay = jest.fn();
    const { container } = render(<PlayerProgressBar
      currentSeconds={10}
      duracion={120}
      isPlaying={false}
      onTogglePlay={onTogglePlay}
      onSeek={onSeek}
      capitulos={[chapter()]}
      apuntes={[
        { apunteId: 'ap-1', titulo: 'Intro', posicion: 10 },
        { apunteId: 'ap-2', titulo: 'Tema', posicion: 45 },
      ]}
    />);
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Apunte/ })).toHaveLength(2);
    expect(container.querySelector('.clase__barra-capitulo')).not.toBeNull();
  });

  test('al hacer clic en play dispara onTogglePlay, y al pin abre el apunte', () => {
    const onTogglePlay = jest.fn();
    const onAbrirApunte = jest.fn();
    render(<PlayerProgressBar
      currentSeconds={10}
      duracion={120}
      isPlaying={false}
      onTogglePlay={onTogglePlay}
      onSeek={jest.fn()}
      apuntes={[{ apunteId: 'ap-1', titulo: 'Intro', posicion: 10 }]}
      onAbrirApunte={onAbrirApunte}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));
    expect(onTogglePlay).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Apunte Intro/ }));
    expect(onAbrirApunte).toHaveBeenCalledWith('ap-1', 10);
  });

  test('tooltip hover en la barra: sin apunte cercano abre apunte nuevo, con apunte abre el existente', () => {
    type Rect = { left: number; width: number; top: number; height: number; right: number; bottom: number; x: number; y: number; toJSON: () => Record<string, unknown> };
    const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 100, top: 0, height: 20, right: 100, bottom: 20, x: 0, y: 0,
      toJSON: () => ({}),
    } as unknown as Rect);
    const onAbrirApunte = jest.fn();
    const { container, rerender } = render(<PlayerProgressBar
      currentSeconds={10}
      duracion={100}
      isPlaying={false}
      onTogglePlay={jest.fn()}
      onSeek={jest.fn()}
      apuntes={[{ apunteId: 'ap-1', titulo: 'Resumen', posicion: 50 }]}
      onAbrirApunte={onAbrirApunte}
    />);
    const barra = container.querySelector('.clase__barra-seek') as HTMLElement;
    const botonTooltip = () => container.querySelector('.clase__barra-tooltip-boton') as HTMLButtonElement;

    fireEvent.mouseMove(barra, { clientX: 10 });
    expect(botonTooltip().textContent).toMatch(/Nuevo apunte/);
    fireEvent.click(botonTooltip());
    expect(onAbrirApunte).toHaveBeenCalledWith(null, 10);

    onAbrirApunte.mockClear();
    const props = {
      currentSeconds: 50,
      duracion: 100,
      isPlaying: false,
      onTogglePlay: jest.fn(),
      onSeek: jest.fn(),
      apuntes: [{ apunteId: 'ap-1', titulo: 'Resumen', posicion: 50 }],
      onAbrirApunte: onAbrirApunte,
    };
    rerender(<PlayerProgressBar {...props} />);
    fireEvent.mouseMove(barra, { clientX: 50 });
    expect(botonTooltip().textContent).toMatch(/Resumen/);
    fireEvent.click(botonTooltip());
    expect(onAbrirApunte).toHaveBeenCalledWith('ap-1', 50);

    rectSpy.mockRestore();
  });

  test('tooltip usa la posicion sobre la barra, no la reproduccion, para decidir ver/apunte nuevo', () => {
    type Rect = { left: number; width: number; top: number; height: number; right: number; bottom: number; x: number; y: number; toJSON: () => Record<string, unknown> };
    const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, width: 100, top: 0, height: 20, right: 100, bottom: 20, x: 0, y: 0,
      toJSON: () => ({}),
    } as unknown as Rect);
    const onAbrirApunte = jest.fn();
    const { container } = render(<PlayerProgressBar
      currentSeconds={50}
      duracion={100}
      isPlaying={false}
      onTogglePlay={jest.fn()}
      onSeek={jest.fn()}
      apuntes={[{ apunteId: 'ap-1', titulo: 'Resumen', posicion: 50 }]}
      onAbrirApunte={onAbrirApunte}
    />);
    const barra = container.querySelector('.clase__barra-seek') as HTMLElement;
    const botonTooltip = () => container.querySelector('.clase__barra-tooltip-boton') as HTMLButtonElement;

    fireEvent.mouseMove(barra, { clientX: 30 });
    expect(botonTooltip().textContent).toMatch(/Nuevo apunte/);
    fireEvent.click(botonTooltip());
    expect(onAbrirApunte).toHaveBeenCalledWith(null, 30);

    rectSpy.mockRestore();
  });

  test('navega con flechas del teclado sobre la barra de progreso', () => {
    const onSeek = jest.fn();
    const { container } = render(<PlayerProgressBar
      currentSeconds={30}
      duracion={100}
      isPlaying={false}
      onTogglePlay={jest.fn()}
      onSeek={onSeek}
    />);
    fireEvent.keyDown(container.querySelector('.clase__barra-seek') as HTMLElement, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(35);
    fireEvent.keyDown(container.querySelector('.clase__barra-seek') as HTMLElement, { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(25);
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
