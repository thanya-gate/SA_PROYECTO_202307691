import { PoolClient } from 'pg';
import { query, withTransaction } from './db';
import { DomainError } from '../../../domain/errors/domain-error';
import {
  CatalogRepository,
  PublicarClaseInput,
  ActualizarClaseInput,
  RegistrarCursoInput,
  SearchCriteria,
  BuscarResult,
  ClaseCSVInput,
  CargarClasesCSVResult,
  RegistrarSemestreInput,
  ActualizarSemestreInput,
  RegistrarEscuelaInput,
  ActualizarEscuelaInput,
  ActualizarCursoInput,
} from '../../../application/ports/catalog-repository';
import {
  ClaseDetalle,
  CursoAdmin,
  CursoCatalogo,
  EscuelaAdmin,
  Participante,
  SemestreAdmin,
  SemestreResumen,
} from '../../../domain/entities/clase';

interface BuscarRow {
  clase_id: string;
  codigo: string;
  curso: string;
  unidad: string | null;
  tema: string | null;
  semestre: string;
  año: number;
  url_video: string;
  total: string;
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

interface SemestreAdminRow {
  id: string;
  nombre: string;
  año: number;
  clases: string;
}

interface EscuelaAdminRow {
  id: string;
  nombre: string;
  cursos: string;
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
  async buscar(criteria: SearchCriteria): Promise<BuscarResult> {
    const page = Math.max(Math.trunc(criteria.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Math.trunc(criteria.pageSize ?? 10), 1), 10);
    const res = await query<BuscarRow>(
      'SELECT * FROM fn_buscar_clases($1, $2, $3, $4, $5, $6, $7)',
      [
        criteria.semestre ?? null,
        criteria.escuela ?? null,
        criteria.curso ?? null,
        criteria.catedratico ?? null,
        criteria.tema ?? null,
        page,
        pageSize,
      ],
    );
    const resultados = res.rows.map((r) => ({
      claseId: r.clase_id,
      codigo: r.codigo,
      curso: r.curso,
      unidad: r.unidad,
      tema: r.tema,
      semestre: r.semestre,
      anio: r.año,
      urlVideo: r.url_video,
    }));
    let total = res.rows.length > 0 ? Number(res.rows[0].total) : 0;
    if (res.rows.length === 0) {
      const countRes = await query<{ fn_contar_clases: string }>(
        'SELECT fn_contar_clases($1, $2, $3, $4, $5)',
        [
          criteria.semestre ?? null,
          criteria.escuela ?? null,
          criteria.curso ?? null,
          criteria.catedratico ?? null,
          criteria.tema ?? null,
        ],
      );
      total = Number(countRes.rows[0]?.fn_contar_clases ?? 0);
    }
    return {
      resultados,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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

  async buscarCursoPorCodigo(codigo: string): Promise<CursoCatalogo | null> {
    const res = await query<CursoRow>(
      'SELECT id, codigo, nombre, escuela FROM curso_catalogo WHERE codigo = $1',
      [codigo],
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return { cursoId: row.id, codigo: row.codigo, nombre: row.nombre, escuela: row.escuela };
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

  async actualizarUrlMaterial(claseId: string, urlMaterial: string): Promise<ClaseDetalle | null> {
    const res = await query('UPDATE clase_grabada SET url_material = $2 WHERE id = $1', [claseId, urlMaterial]);
    if (res.rowCount === 0) return null;
    return this.getClase(claseId);
  }

  async actualizarDuracion(claseId: string, duracion: number): Promise<ClaseDetalle | null> {
    const res = await query('UPDATE clase_grabada SET duracion = $2 WHERE id = $1', [claseId, duracion]);
    if (res.rowCount === 0) return null;
    return this.getClase(claseId);
  }

  async actualizarClase(input: ActualizarClaseInput): Promise<ClaseDetalle | null> {
    await withTransaction(async (client) => {
      await client.query(
        `CALL sp_actualizar_clase(
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL
         )`,
        [
          input.claseId,
          input.cursoId,
          input.unidad ?? null,
          input.tema ?? null,
          input.fechaImparticion ?? null,
          input.semestre,
          input.anio,
          input.duracion,
          input.urlVideo ?? '',
          input.urlMaterial ?? null,
        ],
      );

      await client.query('DELETE FROM clase_etiqueta WHERE clase_id = $1', [input.claseId]);
      await client.query('DELETE FROM participante_clase WHERE clase_id = $1', [input.claseId]);

      await this.asociarEtiquetas(client, input.claseId, input.etiquetas);
      await this.asociarParticipantes(client, input.claseId, input.participantes);
    });
    return this.getClase(input.claseId);
  }

  async eliminarClase(claseId: string): Promise<void> {
    const res = await query<{ p_eliminado: boolean }>(
      'CALL sp_eliminar_clase($1, NULL)',
      [claseId],
    );
    if (!res.rows[0]?.p_eliminado) {
      throw new DomainError('CLASE_NO_ENCONTRADA', 'La clase no existe', 404);
    }
  }

  async cargarClasesCSV(clases: ClaseCSVInput[]): Promise<CargarClasesCSVResult> {
    if (clases.length === 0) {
      throw new DomainError('ENTRADA_INVALIDA', 'El archivo CSV no contiene filas que procesar', 400);
    }

    const payload = clases.map((c) => ({
      codigo_curso: c.codigoCurso,
      nombre_curso: c.nombreCurso ?? null,
      escuela: c.escuela ?? null,
      unidad: c.unidad ?? null,
      tema: c.tema ?? null,
      fecha_imparticion: c.fechaImparticion ?? null,
      semestre: c.semestre,
      año: c.anio,
      url_video: c.urlVideo,
      url_material: c.urlMaterial ?? null,
      duracion: c.duracion ?? 0,
      etiquetas: c.etiquetas ?? [],
      docentes: c.docentes ?? [],
      auxiliares: c.auxiliares ?? [],
    }));

    const res = await query<{ p_registradas: string; p_omitidas: string }>(
      'CALL sp_cargar_clases_csv($1::jsonb, NULL, NULL)',
      [JSON.stringify(payload)],
    );
    const row = res.rows[0];
    return {
      registradas: Number(row?.p_registradas ?? 0),
      omitidas: Number(row?.p_omitidas ?? 0),
    };
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

  async listarSemestres(): Promise<SemestreAdmin[]> {
    const res = await query<SemestreAdminRow>('SELECT * FROM vw_semestres ORDER BY año DESC, nombre');
    return res.rows.map((r) => ({
      semestreId: r.id,
      nombre: r.nombre,
      anio: r.año,
      clases: Number(r.clases),
    }));
  }

  async registrarSemestre(input: RegistrarSemestreInput): Promise<{ semestreId: string }> {
    const res = await query<{ p_semestre_id: string }>(
      'CALL sp_registrar_semestre($1, $2, NULL)',
      [input.nombre, input.anio],
    );
    const semestreId = res.rows[0]?.p_semestre_id;
    if (!semestreId) {
      throw new DomainError('ENTRADA_INVALIDA', 'No se pudo registrar el semestre', 400);
    }
    return { semestreId };
  }

  async actualizarSemestre(input: ActualizarSemestreInput): Promise<void> {
    const res = await query<{ p_actualizado: boolean }>(
      'CALL sp_actualizar_semestre($1, $2, $3, NULL)',
      [input.semestreId, input.nombre, input.anio],
    );
    if (!res.rows[0]?.p_actualizado) {
      throw new DomainError('SEMESTRE_NO_ENCONTRADO', 'El semestre no existe', 404);
    }
  }

  async eliminarSemestre(semestreId: string): Promise<void> {
    const res = await query<{ p_eliminado: boolean }>(
      'CALL sp_eliminar_semestre($1, NULL)',
      [semestreId],
    );
    if (!res.rows[0]?.p_eliminado) {
      throw new DomainError('SEMESTRE_NO_ENCONTRADO', 'El semestre no existe', 404);
    }
  }

  async listarEscuelas(): Promise<EscuelaAdmin[]> {
    const res = await query<EscuelaAdminRow>('SELECT * FROM vw_escuelas ORDER BY nombre');
    return res.rows.map((r) => ({
      escuelaId: r.id,
      nombre: r.nombre,
      cursos: Number(r.cursos),
    }));
  }

  async registrarEscuela(input: RegistrarEscuelaInput): Promise<{ escuelaId: string }> {
    const res = await query<{ p_escuela_id: string }>(
      'CALL sp_registrar_escuela($1, NULL)',
      [input.nombre],
    );
    const escuelaId = res.rows[0]?.p_escuela_id;
    if (!escuelaId) {
      throw new DomainError('ENTRADA_INVALIDA', 'No se pudo registrar la escuela', 400);
    }
    return { escuelaId };
  }

  async actualizarEscuela(input: ActualizarEscuelaInput): Promise<void> {
    const res = await query<{ p_actualizado: boolean }>(
      'CALL sp_actualizar_escuela($1, $2, NULL)',
      [input.escuelaId, input.nombre],
    );
    if (!res.rows[0]?.p_actualizado) {
      throw new DomainError('ESCUELA_NO_ENCONTRADA', 'La escuela no existe', 404);
    }
  }

  async eliminarEscuela(escuelaId: string): Promise<void> {
    const res = await query<{ p_eliminado: boolean }>(
      'CALL sp_eliminar_escuela($1, NULL)',
      [escuelaId],
    );
    if (!res.rows[0]?.p_eliminado) {
      throw new DomainError('ESCUELA_NO_ENCONTRADA', 'La escuela no existe', 404);
    }
  }

  async listarCursos(): Promise<CursoAdmin[]> {
    const res = await query<CursoRow>('SELECT id, codigo, nombre, escuela FROM curso_catalogo ORDER BY codigo');
    return res.rows.map((r) => ({
      cursoId: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      escuela: r.escuela,
    }));
  }

  async actualizarCurso(input: ActualizarCursoInput): Promise<void> {
    const res = await query<{ p_actualizado: boolean }>(
      'CALL sp_actualizar_curso_catalogo($1, $2, $3, $4, NULL)',
      [input.cursoId, input.codigo, input.nombre, input.escuela],
    );
    if (!res.rows[0]?.p_actualizado) {
      throw new DomainError('CURSO_NO_ENCONTRADO', 'El curso no existe en el catálogo', 404);
    }
  }

  async eliminarCurso(cursoId: string): Promise<void> {
    const res = await query<{ p_eliminado: boolean }>(
      'CALL sp_eliminar_curso_catalogo($1, NULL)',
      [cursoId],
    );
    if (!res.rows[0]?.p_eliminado) {
      throw new DomainError('CURSO_NO_ENCONTRADO', 'El curso no existe en el catálogo', 404);
    }
  }
}
