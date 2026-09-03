jest.mock('../src/auth/auth-context', () => ({ useAuth: jest.fn() }));
jest.mock('../src/api/reproduccion', () => ({
  reproduccionApi: {
    guardarApunte: jest.fn(),
    eliminarApunte: jest.fn(),
  },
}));
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children, components }: { children: unknown; components: { a: (props: { href: string; children: string }) => unknown } }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const contenido = String(children);
    const match = contenido.match(/\[(\d{2}:\d{2})\]\(apunte-time:\/\/(\d{2}:\d{2})\)/);
    if (!match) return React.createElement('div', null, contenido);
    return React.createElement(
      'div',
      null,
      components.a({ href: `apunte-time://${match[2]}`, children: match[1] }) as import('react').ReactNode,
    );
  },
}));
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    setFillColor: jest.fn(),
    rect: jest.fn(),
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    setDrawColor: jest.fn(),
    setLineWidth: jest.fn(),
    line: jest.fn(),
    splitTextToSize: jest.fn((value: string) => [value]),
    addPage: jest.fn(),
    save: jest.fn(),
  })),
}));

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jsPDF } from 'jspdf';
import { reproduccionApi, type Apunte } from '../src/api/reproduccion';
import { useAuth } from '../src/auth/auth-context';
import { ApunteEditor } from '../src/components/ApunteEditor';

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const guardarApunteMock = reproduccionApi.guardarApunte as jest.MockedFunction<typeof reproduccionApi.guardarApunte>;
const eliminarApunteMock = reproduccionApi.eliminarApunte as jest.MockedFunction<typeof reproduccionApi.eliminarApunte>;
const jsPDFMock = jsPDF as unknown as jest.Mock;

const apunte: Apunte = {
  apunteId: 'apunte-1',
  estudianteId: 'estudiante-1',
  claseId: 'clase-1',
  titulo: 'Tema Uno',
  contenidoMarkdown: '[01:30] concepto',
  posicionSegundos: 90,
  fechaCreacion: '2026-09-01T10:00:00.000Z',
  fechaActualizacion: '2026-09-01T10:00:00.000Z',
};

function renderEditor(overrides: Partial<React.ComponentProps<typeof ApunteEditor>> = {}) {
  const props: React.ComponentProps<typeof ApunteEditor> = {
    claseId: 'clase-1',
    currentSeconds: 90.9,
    apunte: null,
    onGuardado: jest.fn(),
    onEliminado: jest.fn(),
    onCerrar: jest.fn(),
    onSeek: jest.fn(),
    ...overrides,
  };
  render(<ApunteEditor {...props} />);
  return props;
}

describe('ApunteEditor', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ token: 'token-1' } as ReturnType<typeof useAuth>);
    guardarApunteMock.mockReset();
    eliminarApunteMock.mockReset();
    jsPDFMock.mockClear();
    (URL.createObjectURL as jest.Mock).mockClear();
    (URL.revokeObjectURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('inserta un marcador [MM:SS] y permite saltar al segundo exacto desde la vista previa', async () => {
    const props = renderEditor();
    const textarea = screen.getByPlaceholderText(/Escribe tus apuntes/i);

    await userEvent.click(screen.getByTitle('Insertar marcador [01:30]'));
    expect(textarea).toHaveValue('[01:30] ');

    await userEvent.click(screen.getByTitle('Ir a 1:30'));
    expect(props.onSeek).toHaveBeenCalledWith(90);
  });

  test('aplica formato Markdown sobre el texto seleccionado', () => {
    renderEditor();
    const textarea = screen.getByPlaceholderText(/Escribe tus apuntes/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'concepto' } });
    textarea.setSelectionRange(0, 8);
    fireEvent.click(screen.getByTitle('Negrita'));
    expect(textarea).toHaveValue('**concepto**');
  });

  test('guarda un apunte nuevo con título limpio, posición entera y token de sesión', async () => {
    const props = renderEditor();
    guardarApunteMock.mockResolvedValue({ message: 'ok', apunte });
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/Título del apunte/i), '  Tema Uno  ');
    await user.type(screen.getByPlaceholderText(/Escribe tus apuntes/i), '# Contenido');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(guardarApunteMock).toHaveBeenCalledWith(
      'clase-1',
      '',
      'Tema Uno',
      '# Contenido',
      90,
      'token-1',
    ));
    expect(props.onGuardado).toHaveBeenCalledWith(apunte);
    expect(screen.getByRole('status')).toHaveTextContent('Apunte guardado correctamente.');
  });

  test('actualiza por identificador y conserva el marcador original del apunte', async () => {
    renderEditor({ apunte, currentSeconds: 300 });
    guardarApunteMock.mockResolvedValue({ message: 'ok', apunte });

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(guardarApunteMock).toHaveBeenCalledWith(
      'clase-1',
      'apunte-1',
      'Tema Uno',
      '[01:30] concepto',
      90,
      'token-1',
    ));
  });

  test('muestra el error del backend cuando no puede guardar', async () => {
    renderEditor();
    guardarApunteMock.mockRejectedValue(new Error('Servicio no disponible'));
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Título del apunte/i), 'Tema');
    await user.type(screen.getByPlaceholderText(/Escribe tus apuntes/i), 'Contenido');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
  });

  test('elimina un apunte confirmado y notifica el cierre del editor', async () => {
    const props = renderEditor({ apunte });
    eliminarApunteMock.mockResolvedValue({ message: 'ok', eliminado: true });
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(eliminarApunteMock).toHaveBeenCalledWith('apunte-1', 'token-1'));
    expect(props.onEliminado).toHaveBeenCalledWith('apunte-1');
    expect(props.onCerrar).toHaveBeenCalled();
  });

  test('exporta el apunte existente en PDF y Markdown', async () => {
    renderEditor({ apunte });
    let nombreDescarga = '';
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      nombreDescarga = this.download;
    });

    await userEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    const pdf = jsPDFMock.mock.results[0].value;
    expect(pdf.save).toHaveBeenCalledWith('apunte-tema-uno.pdf');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar .md' }));
    expect(nombreDescarga).toBe('apunte-tema-uno.md');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
