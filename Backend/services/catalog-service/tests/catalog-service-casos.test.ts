import { CatalogService } from '../src/application/services/catalog.service';

// Casos de uso administrativos y de clases: validación de entrada y
// traducción de "no encontrado" a errores de dominio, con repositorio simulado.

const uuid = '11111111-1111-4111-8111-111111111111';
const clase = { claseId: uuid };

function repo(overrides: Record<string, jest.Mock> = {}): any {
  const base: Record<string, jest.Mock> = {
    buscar: jest.fn().mockResolvedValue({ resultados: [], total: 0 }),
    cargarClasesCSV: jest.fn().mockResolvedValue({ registradas: 1, omitidas: 0 }),
    getClase: jest.fn().mockResolvedValue(clase),
    listarPorSemestre: jest.fn().mockResolvedValue([]),
    buscarCursoPorCodigo: jest.fn().mockResolvedValue({ cursoId: uuid }),
    publicarClase: jest.fn().mockResolvedValue({ claseId: uuid, fechaPublicacion: 'hoy' }),
    actualizarClase: jest.fn().mockResolvedValue(clase),
    eliminarClase: jest.fn().mockResolvedValue(undefined),
    actualizarUrlMaterial: jest.fn().mockResolvedValue(clase),
    registrarCurso: jest.fn().mockResolvedValue({ cursoId: uuid }),
    actualizarUrlVideo: jest.fn().mockResolvedValue(clase),
    actualizarDuracion: jest.fn().mockResolvedValue(clase),
    listarSemestres: jest.fn().mockResolvedValue([]),
    registrarSemestre: jest.fn().mockResolvedValue({ semestreId: uuid }),
    actualizarSemestre: jest.fn().mockResolvedValue(undefined),
    eliminarSemestre: jest.fn().mockResolvedValue(undefined),
    listarEscuelas: jest.fn().mockResolvedValue([]),
    registrarEscuela: jest.fn().mockResolvedValue({ escuelaId: uuid }),
    actualizarEscuela: jest.fn().mockResolvedValue(undefined),
    eliminarEscuela: jest.fn().mockResolvedValue(undefined),
    listarCursos: jest.fn().mockResolvedValue([]),
    actualizarCurso: jest.fn().mockResolvedValue(undefined),
    eliminarCurso: jest.fn().mockResolvedValue(undefined),
    obtenerMaterial: jest.fn().mockResolvedValue({ materialId: uuid }),
    agregarVersionMaterial: jest.fn().mockResolvedValue({ materialId: uuid }),
    listarMateriales: jest.fn().mockResolvedValue([]),
    eliminarMaterial: jest.fn().mockResolvedValue({ eliminado: true }),
    registrarDescargaMaterial: jest.fn().mockResolvedValue(3),
  };
  return { ...base, ...overrides };
}

const publicar = { cursoId: uuid, semestre: '2026-2', anio: 2026, duracion: 60, urlVideo: 'https://v.test/a.mp4' };

describe('CatalogService: clases', () => {
  it('search valida y delega al repositorio', async () => {
    const r = repo();
    await new CatalogService(r).search({ tema: 'redes', page: 2 } as any);
    expect(r.buscar).toHaveBeenCalledWith(expect.objectContaining({ tema: 'redes', page: 2, pageSize: 10 }));
    await expect(new CatalogService(r).search({ semestre: 'malo' } as any)).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
  });

  it('cargarClasesCSV exige filas', async () => {
    const s = new CatalogService(repo());
    await expect(s.cargarClasesCSV([])).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(s.cargarClasesCSV([{ codigoCurso: '0770' } as any])).resolves.toEqual({ registradas: 1, omitidas: 0 });
  });

  it('getClase y obtenerCursoPorCodigo informan no encontrado', async () => {
    const s = new CatalogService(repo({ getClase: jest.fn().mockResolvedValue(null), buscarCursoPorCodigo: jest.fn().mockResolvedValue(null) }));
    await expect(s.getClase(uuid)).rejects.toMatchObject({ code: 'CLASE_NO_ENCONTRADA' });
    await expect(s.obtenerCursoPorCodigo('x')).rejects.toMatchObject({ code: 'CURSO_NO_ENCONTRADO' });
    const ok = new CatalogService(repo());
    await expect(ok.getClase(uuid)).resolves.toBe(clase);
    await expect(ok.obtenerCursoPorCodigo('0770')).resolves.toEqual({ cursoId: uuid });
    await ok.listarPorSemestre('');
  });

  it('publicar y actualizar clase', async () => {
    const r = repo();
    const s = new CatalogService(r);
    await s.publicarClase({ ...publicar, urlVideo: undefined } as any);
    expect(r.publicarClase).toHaveBeenCalledWith(expect.objectContaining({ urlVideo: '' }));
    await expect(s.actualizarClase({ ...publicar, claseId: uuid } as any)).resolves.toBe(clase);
    await expect(
      new CatalogService(repo({ actualizarClase: jest.fn().mockResolvedValue(null) })).actualizarClase({ ...publicar, claseId: uuid } as any),
    ).rejects.toMatchObject({ code: 'CLASE_NO_ENCONTRADA' });
    await expect(s.publicarClase({ ...publicar, cursoId: 'no-uuid' } as any)).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
  });

  it.each([
    ['actualizarUrlVideo', 'https://v.test/b.mp4'],
    ['actualizarUrlMaterial', 'https://m.test/b.pdf'],
  ] as const)('%s valida la URL y la clase', async (metodo, url) => {
    const s = new CatalogService(repo());
    await expect(s[metodo](uuid, '  ')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(s[metodo](uuid, url)).resolves.toBe(clase);
    const nf = new CatalogService(repo({ [metodo]: jest.fn().mockResolvedValue(null) }));
    await expect(nf[metodo](uuid, url)).rejects.toMatchObject({ code: 'CLASE_NO_ENCONTRADA' });
  });

  it('actualizarDuracion exige entero positivo', async () => {
    const s = new CatalogService(repo());
    await expect(s.actualizarDuracion(uuid, 0)).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(s.actualizarDuracion(uuid, 120)).resolves.toBe(clase);
    await expect(new CatalogService(repo({ actualizarDuracion: jest.fn().mockResolvedValue(null) })).actualizarDuracion(uuid, 1))
      .rejects.toMatchObject({ code: 'CLASE_NO_ENCONTRADA' });
  });
});

describe('CatalogService: administración', () => {
  const s = new CatalogService(repo());

  it.each(['eliminarClase', 'eliminarSemestre', 'eliminarEscuela', 'eliminarCurso'] as const)(
    '%s exige id y delega',
    async (metodo) => {
      await expect(s[metodo]('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
      await expect(s[metodo](uuid)).resolves.toBeUndefined();
    },
  );

  it('registra y actualiza semestres, escuelas y cursos validando la entrada', async () => {
    await expect(s.registrarCurso({ codigo: '0770', nombre: 'Redes', escuela: 'Sistemas' })).resolves.toEqual({ cursoId: uuid });
    await expect(s.registrarSemestre({ nombre: '2026-2', anio: 2026 })).resolves.toEqual({ semestreId: uuid });
    await expect(s.actualizarSemestre({ semestreId: uuid, nombre: '2026-1', anio: 2026 })).resolves.toBeUndefined();
    await expect(s.registrarEscuela({ nombre: 'Sistemas' })).resolves.toEqual({ escuelaId: uuid });
    await expect(s.actualizarEscuela({ escuelaId: uuid, nombre: 'Civil' })).resolves.toBeUndefined();
    await expect(s.actualizarCurso({ cursoId: uuid, codigo: '0770', nombre: 'Redes', escuela: 'Sistemas' })).resolves.toBeUndefined();
    await expect(s.registrarSemestre({ nombre: '2026', anio: 2026 })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await s.listarSemestres();
    await s.listarEscuelas();
    await s.listarCursos();
  });
});

describe('CatalogService: materiales', () => {
  it('obtener, listar y eliminar validan id y existencia', async () => {
    const s = new CatalogService(repo());
    await expect(s.obtenerMaterial('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(s.obtenerMaterial(uuid)).resolves.toEqual({ materialId: uuid });
    await expect(s.listarMateriales('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(s.listarMateriales(uuid)).resolves.toEqual([]);
    await expect(s.eliminarMaterial('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(s.eliminarMaterial(uuid)).resolves.toEqual({ eliminado: true });

    const nf = new CatalogService(repo({
      obtenerMaterial: jest.fn().mockResolvedValue(null),
      eliminarMaterial: jest.fn().mockResolvedValue({ eliminado: false }),
    }));
    await expect(nf.obtenerMaterial(uuid)).rejects.toMatchObject({ code: 'MATERIAL_NO_ENCONTRADO' });
    await expect(nf.eliminarMaterial(uuid)).rejects.toMatchObject({ code: 'MATERIAL_NO_ENCONTRADO' });
  });

  it.each([
    ['agregarVersionMaterial', (s: CatalogService) => s.agregarVersionMaterial({ materialId: uuid, tamanoBytes: 1, urlArchivo: 'u' })],
    ['registrarDescargaMaterial', (s: CatalogService) => s.registrarDescargaMaterial(uuid)],
  ] as const)('%s traduce el error del repositorio', async (metodo, llamar) => {
    await expect(llamar(new CatalogService(repo()))).resolves.toBeDefined();
    const nf = new CatalogService(repo({ [metodo]: jest.fn().mockRejectedValue(new Error('MATERIAL_NO_ENCONTRADO')) }));
    await expect(llamar(nf)).rejects.toMatchObject({ code: 'MATERIAL_NO_ENCONTRADO' });
    const otro = new CatalogService(repo({ [metodo]: jest.fn().mockRejectedValue(new Error('timeout')) }));
    await expect(llamar(otro)).rejects.toThrow('timeout');
  });

  it('registrarDescargaMaterial exige id', async () => {
    await expect(new CatalogService(repo()).registrarDescargaMaterial('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
  });
});
