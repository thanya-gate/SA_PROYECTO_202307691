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
  RegistrarMaterialInput,
  AgregarVersionMaterialInput,
  EliminarMaterialResult,
  CrearCapituloInput,
  ActualizarCapituloInput,
} from '../../../application/ports/catalog-repository';
import {
  Capitulo,
  ClaseDetalle,
  CursoAdmin,
  CursoCatalogo,
  EscuelaAdmin,
  MaterialAdjunto,
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
  curso_id: string;
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

interface MaterialRow {
  material_id: string;
  clase_id: string;
  nombre_archivo: string;
  mime_type: string;
  extension: string;
  tamano_bytes: string | number;
  version_actual: string | number;
  total_descargas: string | number;
  subido_por: string | null;
  fecha_subida: Date;
  url_archivo: string | null;
}

interface CapituloRow {
  capitulo_id: string;
  clase_id: string;
  titulo: string;
  inicio_segundos: number;
  fin_segundos: number;
  orden: number;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
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

function mapMaterial(r: MaterialRow): MaterialAdjunto {
  return {
    materialId: r.material_id,
    claseId: r.clase_id,
    nombreArchivo: r.nombre_archivo,
    mimeType: r.mime_type,
    extension: r.extension,
    tamanoBytes: Number(r.tamano_bytes ?? 0),
    versionActual: Number(r.version_actual ?? 1),
    totalDescargas: Number(r.total_descargas ?? 0),
    subidoPor: r.subido_por,
    fechaSubida: new Date(r.fecha_subida).toISOString(),
    urlArchivo: r.url_archivo,
  };
}

function mapCapitulo(r: CapituloRow): Capitulo {
  return {
    capituloId: r.capitulo_id,
    claseId: r.clase_id,
    titulo: r.titulo,
    inicioSegundos: Number(r.inicio_segundos),
    finSegundos: Number(r.fin_segundos),
    orden: Number(r.orden),
    fechaCreacion: new Date(r.fecha_creacion).toISOString(),
    fechaActualizacion: new Date(r.fecha_actualizacion).toISOString(),
  };
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
      `SELECT clase_id, curso_id, codigo, curso, escuela, unidad, tema,
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
      cursoId: row.curso_id,
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
      materiales: await this.listarMateriales(claseId),
      capitulos: await this.listarCapitulos(claseId),
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

  async buscarCursoPorId(cursoId: string): Promise<CursoCatalogo | null> {
    const res = await query<CursoRow>(
      'SELECT id, codigo, nombre, escuela FROM curso_catalogo WHERE id = $1',
      [cursoId],
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

//Material

  async registrarMaterial(input: RegistrarMaterialInput): Promise<MaterialAdjunto> {
    const res = await query<{ p_material_id: string }>(
      `CALL sp_registrar_material($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.claseId,
        input.nombreArchivo,
        input.mimeType,
        input.extension,
        input.tamanoBytes ?? 0,
        input.urlArchivo,
        input.materialId ?? null,
      ],
    );
    const materialId = res.rows[0]?.p_material_id ?? input.materialId;
    return this.obtenerMaterial(materialId) as Promise<MaterialAdjunto>;
  }

  async obtenerMaterial(materialId: string): Promise<MaterialAdjunto | null> {
    const res = await query<MaterialRow>(
      `SELECT material_id, clase_id, nombre_archivo, mime_type, extension,
              tamano_bytes, version_actual, total_descargas, subido_por,
              fecha_subida, url_archivo
       FROM vw_materiales_clase WHERE material_id = $1`,
      [materialId],
    );
    if (res.rows.length === 0) return null;
    return mapMaterial(res.rows[0]);
  }

  async agregarVersionMaterial(input: AgregarVersionMaterialInput): Promise<MaterialAdjunto> {
    const res = await query<{ p_numero_version: string | number }>(
      'CALL sp_agregar_version_material($1, $2, $3, NULL)',
      [input.materialId, input.tamanoBytes ?? 0, input.urlArchivo],
    );
    if (res.rows.length === 0 || !res.rows[0]?.p_numero_version) {
      throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
    }
    return this.obtenerMaterial(input.materialId) as Promise<MaterialAdjunto>;
  }

  async listarMateriales(claseId: string): Promise<MaterialAdjunto[]> {
    const res = await query<MaterialRow>(
      `SELECT material_id, clase_id, nombre_archivo, mime_type, extension,
              tamano_bytes, version_actual, total_descargas, subido_por,
              fecha_subida, url_archivo
       FROM vw_materiales_clase
       WHERE clase_id = $1
       ORDER BY fecha_subida DESC`,
      [claseId],
    );
    return res.rows.map(mapMaterial);
  }

  async eliminarMaterial(materialId: string): Promise<EliminarMaterialResult> {
    const res = await query<{ p_eliminado: boolean; p_clase_id: string | null }>(
      'CALL sp_eliminar_material($1, NULL, NULL)',
      [materialId],
    );
    return {
      eliminado: Boolean(res.rows[0]?.p_eliminado),
      claseId: res.rows[0]?.p_clase_id ?? null,
    };
  }

  async registrarDescargaMaterial(materialId: string): Promise<number> {
    const res = await query<{ p_total_descargas: string | number }>(
      'CALL sp_registrar_descarga_material($1, NULL)',
      [materialId],
    );
    if (!res.rows[0] || res.rows[0].p_total_descargas === null) {
      throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
    }
    return Number(res.rows[0].p_total_descargas);
  }

  async listarCapitulos(claseId: string): Promise<Capitulo[]> {
    const res = await query<CapituloRow>(
      `SELECT capitulo_id, clase_id, titulo, inicio_segundos, fin_segundos,
              orden, fecha_creacion, fecha_actualizacion
       FROM vw_capitulos_clase
       WHERE clase_id = $1
       ORDER BY orden, inicio_segundos, capitulo_id`,
      [claseId],
    );
    return res.rows.map(mapCapitulo);
  }

  async crearCapitulo(input: CrearCapituloInput): Promise<Capitulo> {
    const res = await query<{ p_capitulo_id: string }>(
      'CALL sp_crear_capitulo($1, $2, $3, $4, $5, NULL)',
      [
        input.claseId,
        input.titulo,
        input.inicioSegundos,
        input.finSegundos,
        input.orden && input.orden > 0 ? input.orden : null,
      ],
    );
    const capituloId = res.rows[0]?.p_capitulo_id;
    if (!capituloId) {
      throw new DomainError('ENTRADA_INVALIDA', 'No se pudo crear el capitulo', 400);
    }
    const capitulos = await query<CapituloRow>(
      `SELECT capitulo_id, clase_id, titulo, inicio_segundos, fin_segundos,
              orden, fecha_creacion, fecha_actualizacion
       FROM vw_capitulos_clase WHERE capitulo_id = $1`,
      [capituloId],
    );
    if (capitulos.rows.length === 0) {
      throw new DomainError('CAPITULO_NO_ENCONTRADO', 'Capitulo no encontrado tras crearlo', 404);
    }
    return mapCapitulo(capitulos.rows[0]);
  }

  async actualizarCapitulo(input: ActualizarCapituloInput): Promise<Capitulo | null> {
    const res = await query<{ p_actualizado: boolean }>(
      'CALL sp_actualizar_capitulo($1, $2, $3, $4, $5, $6, NULL)',
      [
        input.capituloId,
        input.claseId,
        input.titulo,
        input.inicioSegundos,
        input.finSegundos,
        input.orden && input.orden > 0 ? input.orden : null,
      ],
    );
    if (!res.rows[0]?.p_actualizado) return null;
    const capitulos = await query<CapituloRow>(
      `SELECT capitulo_id, clase_id, titulo, inicio_segundos, fin_segundos,
              orden, fecha_creacion, fecha_actualizacion
       FROM vw_capitulos_clase WHERE capitulo_id = $1`,
      [input.capituloId],
    );
    return capitulos.rows.length > 0 ? mapCapitulo(capitulos.rows[0]) : null;
  }

  async eliminarCapitulo(capituloId: string): Promise<{ eliminado: boolean; claseId: string | null }> {
    const res = await query<{ p_eliminado: boolean; p_clase_id: string | null }>(
      'CALL sp_eliminar_capitulo($1, NULL, NULL)',
      [capituloId],
    );
    return {
      eliminado: Boolean(res.rows[0]?.p_eliminado),
      claseId: res.rows[0]?.p_clase_id ?? null,
    };
  }
}
