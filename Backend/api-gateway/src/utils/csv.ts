export interface ClaseCSVRow {
  codigoCurso?: string;
  nombreCurso?: string;
  escuela?: string;
  unidad?: string;
  tema?: string;
  fechaImparticion?: string;
  semestre?: string;
  anio?: number;
  urlVideo?: string;
  urlMaterial?: string;
  duracion?: number;
  etiquetas: string[];
  docentes: string[];
  auxiliares: string[];
}

export const CSV_HEADER = [
  'codigo_curso',
  'nombre_curso',
  'escuela',
  'unidad',
  'tema',
  'fecha_imparticion',
  'semestre',
  'año',
  'url_video',
  'url_material',
  'duracion',
  'etiquetas',
  'docentes',
  'auxiliares',
].join(',');

const HEADER_ALIASES: Record<string, string> = {
  codigo_curso: 'codigoCurso',
  codigo: 'codigoCurso',
  nombre_curso: 'nombreCurso',
  nombre: 'nombreCurso',
  escuela: 'escuela',
  area: 'escuela',
  unidad: 'unidad',
  tema: 'tema',
  fecha_imparticion: 'fechaImparticion',
  fecha: 'fechaImparticion',
  semestre: 'semestre',
  año: 'anio',
  ano: 'anio',
  anio: 'anio',
  url_video: 'urlVideo',
  url: 'urlVideo',
  url_material: 'urlMaterial',
  material: 'urlMaterial',
  duracion: 'duracion',
  etiquetas: 'etiquetas',
  tags: 'etiquetas',
  docentes: 'docentes',
  auxiliares: 'auxiliares',
};

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0].trim() !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0].trim() !== '') rows.push(row);
  return rows;
}

function splitMulti(value: string): string[] {
  return value
    .split(/[|;]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function toOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function parseClasesCsv(text: string): ClaseCSVRow[] {
  if (!text || text.trim().length === 0) {
    throw new CsvParseError('El archivo CSV está vacío');
  }

  const rawRows = parseCsv(text);
  if (rawRows.length === 0) {
    throw new CsvParseError('El archivo CSV no contiene filas');
  }

  const header = rawRows[0].map((h) => h.trim().toLowerCase());
  const index: Record<string, number> = {};
  let recognized = 0;
  header.forEach((name, i) => {
    const key = HEADER_ALIASES[name];
    if (key && index[key] === undefined) {
      index[key] = i;
      recognized++;
    }
  });
  if (recognized === 0) {
    throw new CsvParseError(
      'Encabezado CSV inválido. Columnas esperadas: codigo_curso,nombre_curso,escuela,unidad,tema,fecha_imparticion,semestre,año,url_video,url_material,duracion,etiquetas,docentes,auxiliares',
    );
  }

  const get = (row: string[], key: string): string => {
    const i = index[key];
    return i !== undefined && i < row.length ? (row[i] ?? '').trim() : '';
  };

  return rawRows.slice(1).map((row) => ({
    codigoCurso: get(row, 'codigoCurso'),
    nombreCurso: get(row, 'nombreCurso') || undefined,
    escuela: get(row, 'escuela') || undefined,
    unidad: get(row, 'unidad') || undefined,
    tema: get(row, 'tema') || undefined,
    fechaImparticion: get(row, 'fechaImparticion') || undefined,
    semestre: get(row, 'semestre') || undefined,
    anio: toOptionalInt(get(row, 'anio')),
    urlVideo: get(row, 'urlVideo') || undefined,
    urlMaterial: get(row, 'urlMaterial') || undefined,
    duracion: toOptionalInt(get(row, 'duracion')),
    etiquetas: splitMulti(get(row, 'etiquetas')),
    docentes: splitMulti(get(row, 'docentes')),
    auxiliares: splitMulti(get(row, 'auxiliares')),
  }));
}
