import { InscripcionService } from '../src/application/services/inscripcion.service';
import { InscripcionRepository } from '../src/application/ports/inscripcion-repository';
import {
  asignarAuxiliarCatedraticoSchema,
  asignarCatedraticoCursoSchema,
  inscribirEstudianteSchema,
  registrarCursoSchema,
  registrarDocenteSchema,
} from '../src/application/dto/inscripcion-schemas';
import { DomainError } from '../src/domain/errors/domain-error';

const ESTUDIANTE_ID = '11111111-1111-4111-8111-111111111111';
const DOCENTE_ID = '22222222-2222-4222-8222-222222222222';
const AUXILIAR_ID = '33333333-3333-4333-8333-333333333333';
const CURSO_ID = '44444444-4444-4444-8444-444444444444';
const ASIGNACION_ID = '55555555-5555-4555-8555-555555555555';

function makeRepository(): jest.Mocked<InscripcionRepository> {
  return {
    registrarCurso: jest.fn().mockResolvedValue({
      cursoId: CURSO_ID, codigo: 'SA', nombre: 'Software Avanzado', escuela: 'Sistemas', semestre: '2026-2', anio: 2026,
    }),
    registrarDocente: jest.fn().mockResolvedValue({ docenteId: DOCENTE_ID }),
    registrarAuxiliar: jest.fn().mockResolvedValue({ auxiliarId: AUXILIAR_ID }),
    inscribirEstudiante: jest.fn().mockResolvedValue({ inscripcionId: 'ins-1', estadoMatricula: 'PENDIENTE' }),
    asignarCatedraticoCurso: jest.fn().mockResolvedValue({ asignacionId: ASIGNACION_ID }),
    asignarAuxiliarCatedratico: jest.fn().mockResolvedValue({ asignacionAuxiliarId: 'aa-1' }),
    consultarPanelEstudiante: jest.fn().mockResolvedValue([]),
    consultarCursosCatedratico: jest.fn().mockResolvedValue([]),
    consultarEstadoMatricula: jest.fn().mockResolvedValue('MATRICULADO'),
    listarCursos: jest.fn().mockResolvedValue([]),
    listarDocentes: jest.fn().mockResolvedValue([]),
    listarAuxiliares: jest.fn().mockResolvedValue([]),
    listarAsignaciones: jest.fn().mockResolvedValue([]),
    listarEstudiantesDeCurso: jest.fn().mockResolvedValue([ESTUDIANTE_ID]),
    eliminarDocente: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DTOs de inscripción y asignaciones', () => {
  const validCourse = {
    codigo: ' SA ', nombre: ' Software Avanzado ', escuela: ' Sistemas ', semestre: '2026-2', anio: 2026,
  };

  test('recorta textos válidos y conserva el formato académico', () => {
    expect(registrarCursoSchema.parse(validCourse)).toEqual({
      codigo: 'SA', nombre: 'Software Avanzado', escuela: 'Sistemas', semestre: '2026-2', anio: 2026,
    });
    expect(registrarDocenteSchema.safeParse({ usuarioId: DOCENTE_ID }).success).toBe(true);
    expect(asignarAuxiliarCatedraticoSchema.safeParse({ auxiliarId: AUXILIAR_ID, asignacionDocenteId: ASIGNACION_ID }).success).toBe(true);
  });

  test.each([
    ['curso sin código', { ...validCourse, codigo: '' }],
    ['semestre inválido', { ...validCourse, semestre: '2026-3' }],
    ['año decimal', { ...validCourse, anio: 2026.5 }],
    ['año fuera de rango', { ...validCourse, anio: 1999 }],
  ])('rechaza %s', (_name, input) => {
    expect(registrarCursoSchema.safeParse(input).success).toBe(false);
  });

  test('exige UUIDs en inscripción, docente y auxiliar', () => {
    expect(inscribirEstudianteSchema.safeParse({ estudianteId: 'bad', cursoId: CURSO_ID, semestre: '2026-2' }).success).toBe(false);
    expect(asignarCatedraticoCursoSchema.safeParse({ docenteId: DOCENTE_ID, cursoId: CURSO_ID, semestre: '2026-2' }).success).toBe(true);
    expect(asignarAuxiliarCatedraticoSchema.safeParse({ auxiliarId: AUXILIAR_ID, asignacionDocenteId: 'bad' }).success).toBe(false);
  });
});

describe('InscripcionService', () => {
  test('delega operaciones válidas con entradas normalizadas', async () => {
    const repository = makeRepository();
    const service = new InscripcionService(repository);

    await expect(service.registrarCurso({
      codigo: ' SA ', nombre: ' Software Avanzado ', escuela: ' Sistemas ', semestre: '2026-2', anio: 2026,
    })).resolves.toMatchObject({ cursoId: CURSO_ID });
    expect(repository.registrarCurso).toHaveBeenCalledWith({
      codigo: 'SA', nombre: 'Software Avanzado', escuela: 'Sistemas', semestre: '2026-2', anio: 2026,
    });
    await expect(service.registrarDocente({ usuarioId: DOCENTE_ID })).resolves.toEqual({ docenteId: DOCENTE_ID });
    await expect(service.registrarAuxiliar({ usuarioId: AUXILIAR_ID })).resolves.toEqual({ auxiliarId: AUXILIAR_ID });
    await expect(service.inscribirEstudiante({ estudianteId: ESTUDIANTE_ID, cursoId: CURSO_ID, semestre: '2026-2' }))
      .resolves.toMatchObject({ estadoMatricula: 'PENDIENTE' });
    await expect(service.asignarCatedraticoCurso({ docenteId: DOCENTE_ID, cursoId: CURSO_ID, semestre: '2026-2' }))
      .resolves.toEqual({ asignacionId: ASIGNACION_ID });
    await expect(service.asignarAuxiliarCatedratico({ auxiliarId: AUXILIAR_ID, asignacionDocenteId: ASIGNACION_ID }))
      .resolves.toEqual({ asignacionAuxiliarId: 'aa-1' });
  });

  test('rechaza entradas inválidas antes de tocar el repositorio', async () => {
    const repository = makeRepository();
    const service = new InscripcionService(repository);

    await expect(service.registrarCurso({
      codigo: '', nombre: 'Curso', escuela: 'Sistemas', semestre: '2026-2', anio: 2026,
    })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    await expect(service.registrarDocente({ usuarioId: 'bad' })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.inscribirEstudiante({ estudianteId: ESTUDIANTE_ID, cursoId: CURSO_ID, semestre: '2026-3' }))
      .rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.asignarAuxiliarCatedratico({ auxiliarId: 'bad', asignacionDocenteId: ASIGNACION_ID }))
      .rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    expect(repository.registrarCurso).not.toHaveBeenCalled();
    expect(repository.registrarDocente).not.toHaveBeenCalled();
    expect(repository.inscribirEstudiante).not.toHaveBeenCalled();
    expect(repository.asignarAuxiliarCatedratico).not.toHaveBeenCalled();
  });

  test('valida identificadores requeridos para consultas y eliminación', async () => {
    const repository = makeRepository();
    const service = new InscripcionService(repository);

    await expect(service.consultarPanelEstudiante('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.consultarCursosCatedratico('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.consultarEstadoMatricula('', CURSO_ID)).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.consultarEstadoMatricula(ESTUDIANTE_ID, '')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.listarEstudiantesDeCurso(CURSO_ID, '')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(service.eliminarDocente('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    expect(repository.consultarPanelEstudiante).not.toHaveBeenCalled();
    expect(repository.eliminarDocente).not.toHaveBeenCalled();
  });

  test('expone consultas y devuelve errores del repositorio sin ocultarlos', async () => {
    const repository = makeRepository();
    const service = new InscripcionService(repository);
    const failure = new DomainError('CONFLICTO', 'inscripción duplicada', 409);
    repository.inscribirEstudiante.mockRejectedValue(failure);

    await expect(service.consultarPanelEstudiante(ESTUDIANTE_ID)).resolves.toEqual([]);
    await expect(service.consultarCursosCatedratico(DOCENTE_ID)).resolves.toEqual([]);
    await expect(service.consultarEstadoMatricula(ESTUDIANTE_ID, CURSO_ID)).resolves.toBe('MATRICULADO');
    await expect(service.listarCursos()).resolves.toEqual([]);
    await expect(service.listarDocentes()).resolves.toEqual([]);
    await expect(service.listarAuxiliares()).resolves.toEqual([]);
    await expect(service.listarAsignaciones()).resolves.toEqual([]);
    await expect(service.listarEstudiantesDeCurso(CURSO_ID, '2026-2')).resolves.toEqual([ESTUDIANTE_ID]);
    await expect(service.eliminarDocente(DOCENTE_ID)).resolves.toBeUndefined();
    await expect(service.inscribirEstudiante({ estudianteId: ESTUDIANTE_ID, cursoId: CURSO_ID, semestre: '2026-2' }))
      .rejects.toBe(failure);
  });
});
