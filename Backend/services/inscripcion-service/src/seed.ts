import { query } from './infrastructure/persistence/postgres/db';

interface IdRow {
  id: string;
}

interface ExisteRow {
  existe: boolean;
}

const ESTUDIANTE_DEMO = '00000000-0000-0000-0000-000000000101';

const CURSOS: Array<{
  codigo: string;
  nombre: string;
  escuela: string;
  semestre: string;
  año: number;
}> = [
  { codigo: 'CC308', nombre: 'Comunicaciones y Redes de Computadoras', escuela: 'Escuela de Ciencias y Sistemas', semestre: '2026-1', año: 2026 },
  { codigo: 'CC201', nombre: 'Física II', escuela: 'Escuela de Ciencias y Sistemas', semestre: '2026-1', año: 2026 },
  { codigo: 'MA205', nombre: 'Estadística 1', escuela: 'Escuela de Matemática', semestre: '2026-1', año: 2026 },
];

const DOCENTES: Array<{ codigoCurso: string; usuarioId: string }> = [
  { codigoCurso: 'CC308', usuarioId: '00000000-0000-0000-0000-000000000201' },
  { codigoCurso: 'CC201', usuarioId: '00000000-0000-0000-0000-000000000202' },
  { codigoCurso: 'MA205', usuarioId: '00000000-0000-0000-0000-000000000203' },
];

const AUXILIARES: Array<{ codigoCurso: string; usuarioId: string }> = [
  { codigoCurso: 'CC308', usuarioId: '00000000-0000-0000-0000-000000000301' },
  { codigoCurso: 'CC201', usuarioId: '00000000-0000-0000-0000-000000000302' },
];

export async function seedInscripcionData(): Promise<void> {
  const { rows } = await query<ExisteRow>(
    "SELECT EXISTS (SELECT 1 FROM curso WHERE codigo = 'CC308') AS existe",
  );
  if (rows[0].existe) return;

  for (const curso of CURSOS) {
    await query(
      'INSERT INTO curso (codigo, nombre, escuela, semestre, año) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (codigo) DO NOTHING',
      [curso.codigo, curso.nombre, curso.escuela, curso.semestre, curso.año],
    );
  }

  for (const docente of DOCENTES) {
    await query('INSERT INTO docente (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING', [docente.usuarioId]);
  }

  for (const auxiliar of AUXILIARES) {
    await query('INSERT INTO auxiliar (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING', [auxiliar.usuarioId]);
  }

  const semestre = '2026-1';

  for (const docente of DOCENTES) {
    const { rows: cursoRows } = await query<IdRow>(
      'SELECT id FROM curso WHERE codigo = $1',
      [docente.codigoCurso],
    );
    const cursoId = cursoRows[0].id;

    const { rows: docenteRows } = await query<IdRow>(
      'SELECT id FROM docente WHERE usuario_id = $1',
      [docente.usuarioId],
    );
    const docenteId = docenteRows[0].id;

    await query('CALL sp_asignar_catedratico_curso($1, $2, $3, NULL)', [
      docenteId,
      cursoId,
      semestre,
    ]);

    const aux = AUXILIARES.find((a) => a.codigoCurso === docente.codigoCurso);
    if (aux) {
      const { rows: auxRows } = await query<IdRow>(
        'SELECT id FROM auxiliar WHERE usuario_id = $1',
        [aux.usuarioId],
      );
      const { rows: asigRows } = await query<IdRow>(
        'SELECT id FROM asignacion_docente WHERE docente_id = $1 AND curso_id = $2 AND semestre = $3',
        [docenteId, cursoId, semestre],
      );
      await query('CALL sp_asignar_auxiliar_catedratico($1, $2, NULL)', [
        auxRows[0].id,
        asigRows[0].id,
      ]);
    }
  }

  for (const codigoCurso of ['CC308', 'MA205']) {
    const { rows: cursoRows } = await query<IdRow>(
      'SELECT id FROM curso WHERE codigo = $1',
      [codigoCurso],
    );
    await query('CALL sp_inscribir_estudiante($1, $2, $3, NULL)', [
      ESTUDIANTE_DEMO,
      cursoRows[0].id,
      semestre,
    ]);
  }
}
