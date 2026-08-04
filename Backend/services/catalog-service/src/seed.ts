import { query } from './infrastructure/persistence/postgres/db';

interface IdRow {
  id: string;
}

interface ExisteRow {
  existe: boolean;
}

interface SeedClase {
  curso: string;
  unidad: string;
  tema: string;
  fecha: string;
  semestre: string;
  año: number;
  url: string;
  material: string | null;
  duracion: number;
  etiquetas: string[];
  participantes: Array<{ nombre: string; rol: string }>;
}

const ETIQUETAS = ['fundamentos', 'redes', 'probabilidad', 'sistemas', 'estadistica'];

const CURSOS: Array<{ codigo: string; nombre: string; escuela: string }> = [
  { codigo: 'CC308', nombre: 'Comunicaciones y Redes de Computadoras', escuela: 'Escuela de Ciencias y Sistemas' },
  { codigo: 'CC201', nombre: 'Física II', escuela: 'Escuela de Ciencias y Sistemas' },
  { codigo: 'MA205', nombre: 'Estadística 1', escuela: 'Escuela de Matemática' },
];

const CLASES: SeedClase[] = [
  {
    curso: 'CC308', unidad: 'Unidad 1', tema: 'Introducción a redes de computadoras',
    fecha: '2026-01-20', semestre: '2026-1', año: 2026,
    url: 'https://youtube.com/watch?v=cc308-u1', material: null, duracion: 5400,
    etiquetas: ['fundamentos', 'redes'],
    participantes: [
      { nombre: 'Ing. Marta López', rol: 'CATEDRATICO' },
      { nombre: 'Pablo Díaz', rol: 'AUXILIAR' },
    ],
  },
  {
    curso: 'CC308', unidad: 'Unidad 2', tema: 'Capa de enlace de datos',
    fecha: '2026-02-10', semestre: '2026-1', año: 2026,
    url: 'https://youtube.com/watch?v=cc308-u2', material: 'https://drive.usac.edu.gt/cc308-u2.pdf', duracion: 5100,
    etiquetas: ['redes'],
    participantes: [{ nombre: 'Ing. Marta López', rol: 'CATEDRATICO' }],
  },
  {
    curso: 'CC201', unidad: 'Unidad 4', tema: 'Movimiento armónico simple',
    fecha: '2026-01-25', semestre: '2026-1', año: 2026,
    url: 'https://youtube.com/watch?v=cc201-u4', material: null, duracion: 4800,
    etiquetas: ['fundamentos'],
    participantes: [
      { nombre: 'Lic. Jorge Ramos', rol: 'CATEDRATICO' },
      { nombre: 'Ana Torres', rol: 'AUXILIAR' },
    ],
  },
  {
    curso: 'MA205', unidad: 'Unidad 3', tema: 'Distribuciones de probabilidad',
    fecha: '2026-02-01', semestre: '2026-1', año: 2026,
    url: 'https://youtube.com/watch?v=ma205-u3', material: 'https://drive.usac.edu.gt/ma205-u3.pdf', duracion: 4200,
    etiquetas: ['probabilidad', 'estadistica'],
    participantes: [{ nombre: 'Dr. Elena Ruiz', rol: 'CATEDRATICO' }],
  },
  {
    curso: 'CC308', unidad: 'Unidad 5', tema: 'Protocolo IP y enrutamiento',
    fecha: '2026-07-15', semestre: '2026-2', año: 2026,
    url: 'https://youtube.com/watch?v=cc308-u5', material: null, duracion: 5400,
    etiquetas: ['redes'],
    participantes: [
      { nombre: 'Ing. Marta López', rol: 'CATEDRATICO' },
      { nombre: 'Pablo Díaz', rol: 'AUXILIAR' },
    ],
  },
  {
    curso: 'MA205', unidad: 'Unidad 1', tema: 'Introducción a la estadística descriptiva',
    fecha: '2025-08-05', semestre: '2025-2', año: 2025,
    url: 'https://youtube.com/watch?v=ma205-u1', material: null, duracion: 3900,
    etiquetas: ['estadistica'],
    participantes: [{ nombre: 'Dr. Elena Ruiz', rol: 'CATEDRATICO' }],
  },
];

export async function seedCatalogData(): Promise<void> {
  const { rows } = await query<ExisteRow>(
    "SELECT EXISTS (SELECT 1 FROM curso_catalogo WHERE codigo = 'CC308') AS existe",
  );
  if (rows[0].existe) return;

  for (const nombre of ETIQUETAS) {
    await query('INSERT INTO etiqueta (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [nombre]);
  }

  for (const curso of CURSOS) {
    await query('CALL sp_registrar_curso_catalogo($1, $2, $3, NULL)', [
      curso.codigo,
      curso.nombre,
      curso.escuela,
    ]);
  }

  for (const clase of CLASES) {
    const { rows: cursoRows } = await query<IdRow>(
      'SELECT id FROM curso_catalogo WHERE codigo = $1',
      [clase.curso],
    );
    const cursoId = cursoRows[0].id;

    await query('CALL sp_publicar_clase($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)', [
      cursoId,
      clase.unidad,
      clase.tema,
      clase.fecha,
      clase.semestre,
      clase.año,
      clase.url,
      clase.material,
      clase.duracion,
    ]);

    const { rows: claseRows } = await query<IdRow>(
      'SELECT id FROM clase_grabada WHERE url_video = $1',
      [clase.url],
    );
    const claseId = claseRows[0].id;

    if (clase.etiquetas.length > 0) {
      await query('CALL sp_asociar_etiquetas($1, $2)', [claseId, clase.etiquetas]);
    }
    if (clase.participantes.length > 0) {
      await query('CALL sp_asociar_participantes($1, $2, $3)', [
        claseId,
        clase.participantes.map((p) => p.nombre),
        clase.participantes.map((p) => p.rol),
      ]);
    }
  }
}
