import { PoolClient } from 'pg';
import { query, withTransaction } from './db';
import { DomainError } from '../../../domain/errors/domain-error';
import { CatalogRepository, PublicarClaseInput, RegistrarCursoInput, SearchCriteria } from '../../../application/ports/catalog-repository';
import { ClaseDetalle, ClaseResumen, CursoCatalogo, Participante, SemestreResumen } from '../../../domain/entities/clase';

interface BuscarRow {
  clase_id: string;
  codigo: string;
  curso: string;
  unidad: string | null;
  tema: string | null;
  semestre: string;
  año: number;
  url_video: string;
}

interface FichaRow {
  clase_id: string;
  codigo: string;
  curso: string;
  escuela: string;
  unidad: string | null;
  tema: string | null;
  fecha_imparticion: string | null; 
  semestre: string;
  año: number;
  duracion: number;
  url_video: string;
  url_material: string | null;
  fecha_publicacion: Date;
  participantes: string[];
  etiquetas: string[];
}

interface SemestreRow {
  semestre: string;
  año: number;
  escuela: string;
  total_clases: string;
}

interface CursoRow {
  id: string;
  codigo: string;
  nombre: string;
  escuela: string;
}

const PARTICIPANTE_REGEX = /^(.+) \((CATEDRATICO|AUXILIAR)\)$/;

function parseParticipantes(raw: string[]): Participante[] {
  const result: Participante[] = [];
  for (const entry of raw) {
    const match = PARTICIPANTE_REGEX.exec(entry);
    if (match) {
      result.push({ nombre: match[1], rol: match[2] });
    }
  }
  return result;
}


export class PostgresCatalogRepository implements CatalogRepository {
  async buscar(criteria: SearchCriteria): Promise<ClaseResumen[]> {
    const res = await query<BuscarRow>(
      'SELECT * FROM fn_buscar_clases($1, $2, $3, $4, $5)',
      [
        criteria.semestre ?? null,
        criteria.escuela ?? null,
        criteria.curso ?? null,
        criteria.catedratico ?? null,
        criteria.tema ?? null,
      ],
    );
    return res.rows.map((r) => ({
      claseId: r.clase_id,
      codigo: r.codigo,
      curso: r.curso,
      unidad: r.unidad,
      tema: r.tema,
      semestre: r.semestre,
      anio: r.año,
      urlVideo: r.url_video,
    }));
  }

  async getClase(claseId: string): Promise<ClaseDetalle | null> {
    const res = await query<FichaRow>(
      `SELECT clase_id, codigo, curso, escuela, unidad, tema,
              to_char(fecha_imparticion, 'YYYY-MM-DD') AS fecha_imparticion,
              semestre, año, duracion, url_video, url_material,
              fecha_publicacion, participantes, etiquetas
       FROM vw_ficha_tecnica_clase WHERE clase_id = $1`,
      [claseId],
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      claseId: row.clase_id,
      codigo: row.codigo,
      curso: row.curso,
      escuela: row.escuela,
      unidad: row.unidad,
      tema: row.tema,
      fechaImparticion: row.fecha_imparticion,
      semestre: row.semestre,
      anio: row.año,
      duracion: row.duracion,
      urlVideo: row.url_video,
      urlMaterial: row.url_material,
      fechaPublicacion: row.fecha_publicacion.toISOString(),
      participantes: parseParticipantes(row.participantes ?? []),
      etiquetas: row.etiquetas ?? [],
    };
  }

  async listarPorSemestre(semestre?: string): Promise<SemestreResumen[]> {
    const res = semestre
      ? await query<SemestreRow>(
          'SELECT * FROM vw_catalogo_por_semestre WHERE semestre = $1 ORDER BY año DESC, semestre',
          [semestre],
        )
      : await query<SemestreRow>('SELECT * FROM vw_catalogo_por_semestre ORDER BY año DESC, semestre');
    return res.rows.map((r) => ({
      semestre: r.semestre,
      anio: r.año,
      escuela: r.escuela,
      totalClases: Number(r.total_clases),
    }));
  }

  async publicarClase(
    input: PublicarClaseInput,
  ): Promise<{ claseId: string; fechaPublicacion: string }> {
    return withTransaction(async (client) => {
      await client.query('CALL sp_publicar_clase($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)', [
        input.cursoId,
        input.unidad ?? null,
        input.tema ?? null,
        input.fechaImparticion ?? null,
        input.semestre,
        input.anio,
        input.urlVideo,
        input.urlMaterial ?? null,
        input.duracion,
      ]);

      const { rows } = await client.query<{ id: string; fecha_publicacion: Date }>(
        `SELECT id, fecha_publicacion
         FROM clase_grabada
         WHERE curso_id = $1 AND semestre = $2 AND url_video = $3
         ORDER BY fecha_publicacion DESC
         LIMIT 1`,
        [input.cursoId, input.semestre, input.urlVideo],
      );
      if (rows.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'No se pudo recuperar la clase publicada', 400);
      }
      const { id: claseId, fecha_publicacion } = rows[0];

      await this.asociarEtiquetas(client, claseId, input.etiquetas);
      await this.asociarParticipantes(client, claseId, input.participantes);

      return { claseId, fechaPublicacion: fecha_publicacion.toISOString() };
    });
  }

  async registrarCurso(input: RegistrarCursoInput): Promise<CursoCatalogo> {
    return withTransaction(async (client) => {
      await client.query('CALL sp_registrar_curso_catalogo($1, $2, $3, NULL)', [
        input.codigo,
        input.nombre,
        input.escuela,
      ]);

      const { rows } = await client.query<CursoRow>(
        'SELECT id, codigo, nombre, escuela FROM curso_catalogo WHERE codigo = $1',
        [input.codigo],
      );
      if (rows.length === 0) {
        throw new DomainError('CURSO_NO_ENCONTRADO', 'Curso no encontrado tras registrarlo', 404);
      }
      const row = rows[0];
      return { cursoId: row.id, codigo: row.codigo, nombre: row.nombre, escuela: row.escuela };
    });
  }

  async actualizarUrlVideo(claseId: string, urlVideo: string): Promise<ClaseDetalle | null> {
    const res = await query('UPDATE clase_grabada SET url_video = $2 WHERE id = $1', [claseId, urlVideo]);
    if (res.rowCount === 0) return null;
    return this.getClase(claseId);
  }

  private async asociarEtiquetas(
    client: PoolClient,
    claseId: string,
    etiquetas: string[],
  ): Promise<void> {
    if (etiquetas.length === 0) return;
    await client.query('CALL sp_asociar_etiquetas($1, $2)', [claseId, etiquetas]);
  }

  private async asociarParticipantes(
    client: PoolClient,
    claseId: string,
    participantes: Participante[],
  ): Promise<void> {
    if (participantes.length === 0) return;
    await client.query('CALL sp_asociar_participantes($1, $2, $3)', [
      claseId,
      participantes.map((p) => p.nombre),
      participantes.map((p) => p.rol),
    ]);
  }
}
