jest.mock('../src/api/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: '/api', allowedDomains: [] } }));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: string }) => <div>{children}</div> }));

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiFetch } from '../src/api/http';
import { catalogApi, type ClaseExterna } from '../src/api/catalog';
import { ClaseCard, ClaseExternaCard } from '../src/components/ClaseCard';
import { aCapitulos } from '../src/pages/ClaseExternaPage';

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

const externa: ClaseExterna = {
  id: 'ext/1',
  titulo: 'Árboles B',
  curso: 'Estructuras de Datos',
  codigoCurso: '0772',
  videoUrl: 'https://aliado.test/clases/ext-1.mp4',
  tipoVideo: 'archivo',
  capitulos: [
    { titulo: 'Intro', inicioSeg: 0, finSeg: 60 },
    { titulo: 'Inserción', inicioSeg: 60, finSeg: 300 },
  ],
  origen: { grupo: 'YoUSAC G7', institucion: 'CUNOC' },
};

describe('catalogApi federado', () => {
  beforeEach(() => apiFetchMock.mockReset());

  test('pide externos con q y página, y el detalle con id encodeado', async () => {
    apiFetchMock.mockResolvedValue({ aliado: 'G7', resultados: [] } as never);
    await catalogApi.externos(' arboles ', 2, 'token');
    expect(apiFetchMock).toHaveBeenCalledWith('/catalog/externos?q=arboles&page=2', { token: 'token' });

    apiFetchMock.mockResolvedValue({ clase: externa } as never);
    await catalogApi.getExterna('ext/1', 'token');
    expect(apiFetchMock).toHaveBeenCalledWith('/catalog/externo/ext%2F1', { token: 'token' });
  });
});

describe('tarjetas con origen', () => {
  test('la externa muestra el grupo aliado y enlaza a su vista', () => {
    render(
      <MemoryRouter>
        <ClaseExternaCard clase={externa} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Grabación Externa – YoUSAC G7')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/catalogo/externa/ext%2F1');
  });

  test('la local muestra su etiqueta solo si se pide', () => {
    const local = { claseId: 'c1', codigo: '0770', curso: 'Redes', unidad: '', tema: 'VLSM', semestre: '2S', anio: 2026, urlVideo: '' };
    const { rerender } = render(
      <MemoryRouter>
        <ClaseCard clase={local} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Grabación Local – Facultad')).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <ClaseCard clase={local} mostrarOrigen />
      </MemoryRouter>,
    );
    expect(screen.getByText('Grabación Local – Facultad')).toBeInTheDocument();
  });
});

test('aCapitulos adapta los marcadores del contrato al formato local', () => {
  expect(aCapitulos(externa)).toEqual([
    expect.objectContaining({ capituloId: 'ext/1-0', titulo: 'Intro', inicioSegundos: 0, finSegundos: 60, orden: 0 }),
    expect.objectContaining({ capituloId: 'ext/1-1', titulo: 'Inserción', inicioSegundos: 60, finSegundos: 300, orden: 1 }),
  ]);
});
