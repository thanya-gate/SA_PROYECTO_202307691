import { PoolClient } from 'pg';
import { query, withTransaction } from './db';
import { DomainError } from '../../../domain/errors/domain-error';
import {
  InscripcionRepository,
  RegistrarCursoInput,
  RegistrarDocenteInput,
  RegistrarAuxiliarInput,
  InscribirEstudianteInput,
  AsignarCatedraticoCursoInput,
  AsignarAuxiliarCatedraticoInput,
} from '../../../application/ports/inscripcion-repository';
import {
  AsignacionDocenteItem,
  AuxiliarInscripcion,
  CursoCatedraticoItem,
  CursoInscripcion,
  DocenteInscripcion,
  PanelEstudianteItem,
} from '../../../domain/entities/inscripcion';

interface CursoRow {
  id: string;
  codigo: string;
  nombre: string;
  escuela: string;
  semestre: string;
  año: number;
}

interface IdRow {
  id: string;
}

interface PanelRow {
  curso_id: string;
  codigo: string;
  curso: string;
  escuela: string;
  semestre: string;
  año: number;
  estado_matricula: string;
  catedratico_usuario_id: string | null;
}

interface CatedraticoRow {
  curso_id: string;
  codigo: string;
  curso: string;
  semestre: string;
  año: number;
  auxiliares: string[];
}

interface EstadoRow {
  fn_estado_matricula: string;
}

interface AsignacionRow {
  asignacion_id: string;
  docente_id: string;
  docente_usuario_id: string;
  curso_id: string;
  codigo: string;
  curso: string;
  semestre: string;
  año: number;
  auxiliar_id: string | null;
  auxiliar_usuario_id: string | null;
}

export class PostgresInscripcionRepository implements InscripcionRepository {
  async registrarCurso(input: RegistrarCursoInput): Promise<CursoInscripcion> {
    return withTransaction(async (client) => {
      const existing = await client.query<IdRow>('SELECT id FROM curso WHERE codigo = $1', [input.codigo]);
      if (existing.rows.length > 0) {
        return this.getCursoByCodigo(client, input.codigo);
      }
      await client.query(
        'INSERT INTO curso (codigo, nombre, escuela, semestre, año) VALUES ($1, $2, $3, $4, $5)',
        [input.codigo, input.nombre, input.escuela, input.semestre, input.anio],
      );
      return this.getCursoByCodigo(client, input.codigo);
    });
  }

  async registrarDocente(input: RegistrarDocenteInput): Promise<{ docenteId: string }> {
    return withTransaction(async (client) => {
      const existing = await client.query<IdRow>(
        'SELECT id FROM docente WHERE usuario_id = $1',
        [input.usuarioId],
      );
      if (existing.rows.length > 0) {
        return { docenteId: existing.rows[0].id };
      }
      const { rows } = await client.query<IdRow>(
        'INSERT INTO docente (usuario_id) VALUES ($1) RETURNING id',
        [input.usuarioId],
      );
      return { docenteId: rows[0].id };
    });
  }

  async registrarAuxiliar(input: RegistrarAuxiliarInput): Promise<{ auxiliarId: string }> {
    return withTransaction(async (client) => {
      const existing = await client.query<IdRow>(
        'SELECT id FROM auxiliar WHERE usuario_id = $1',
        [input.usuarioId],
      );
      if (existing.rows.length > 0) {
        return { auxiliarId: existing.rows[0].id };
      }
      const { rows } = await client.query<IdRow>(
        'INSERT INTO auxiliar (usuario_id) VALUES ($1) RETURNING id',
        [input.usuarioId],
      );
      return { auxiliarId: rows[0].id };
    });
  }

  async inscribirEstudiante(
    input: InscribirEstudianteInput,
  ): Promise<{ inscripcionId: string; estadoMatricula: string }> {
    return withTransaction(async (client) => {
      await client.query('CALL sp_inscribir_estudiante($1, $2, $3, NULL)', [
        input.estudianteId,
        input.cursoId,
        input.semestre,
      ]);
      const { rows } = await client.query<{ id: string; estado_matricula: string }>(
        `SELECT id, estado_matricula FROM asignacion_curso
         WHERE estudiante_id = $1 AND curso_id = $2 AND semestre = $3`,
        [input.estudianteId, input.cursoId, input.semestre],
      );
      if (rows.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'No se pudo recuperar la inscripción', 400);
      }
      return { inscripcionId: rows[0].id, estadoMatricula: rows[0].estado_matricula };
    });
  }

  async asignarCatedraticoCurso(
    input: AsignarCatedraticoCursoInput,
  ): Promise<{ asignacionId: string }> {
    return withTransaction(async (client) => {
      await client.query('CALL sp_asignar_catedratico_curso($1, $2, $3, NULL)', [
        input.docenteId,
        input.cursoId,
        input.semestre,
      ]);
      const { rows } = await client.query<IdRow>(
        `SELECT id FROM asignacion_docente
         WHERE docente_id = $1 AND curso_id = $2 AND semestre = $3`,
        [input.docenteId, input.cursoId, input.semestre],
      );
      if (rows.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'No se pudo recuperar la asignación', 400);
      }
      return { asignacionId: rows[0].id };
    });
  }

  async asignarAuxiliarCatedratico(
    input: AsignarAuxiliarCatedraticoInput,
  ): Promise<{ asignacionAuxiliarId: string }> {
    return withTransaction(async (client) => {
      await client.query('CALL sp_asignar_auxiliar_catedratico($1, $2, NULL)', [
        input.auxiliarId,
        input.asignacionDocenteId,
      ]);
      const { rows } = await client.query<IdRow>(
        `SELECT id FROM asignacion_auxiliar
         WHERE auxiliar_id = $1 AND asignacion_docente_id = $2`,
        [input.auxiliarId, input.asignacionDocenteId],
      );
      if (rows.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'No se pudo recuperar la asignación de auxiliar', 400);
      }
      return { asignacionAuxiliarId: rows[0].id };
    });
  }

  async consultarPanelEstudiante(estudianteId: string): Promise<PanelEstudianteItem[]> {
    const res = await query<PanelRow>(
      'SELECT * FROM vw_panel_estudiante WHERE estudiante_id = $1 ORDER BY semestre DESC',
      [estudianteId],
    );
    return res.rows.map((r) => ({
      cursoId: r.curso_id,
      codigo: r.codigo,
      curso: r.curso,
      escuela: r.escuela,
      semestre: r.semestre,
      anio: r.año,
      estadoMatricula: r.estado_matricula,
      catedraticoUsuarioId: r.catedratico_usuario_id,
    }));
  }

  async consultarCursosCatedratico(catedraticoUsuarioId: string): Promise<CursoCatedraticoItem[]> {
    const res = await query<CatedraticoRow>(
      'SELECT * FROM vw_cursos_por_catedratico WHERE catedratico_usuario_id = $1 ORDER BY semestre DESC',
      [catedraticoUsuarioId],
    );
    return res.rows.map((r) => ({
      cursoId: r.curso_id,
      codigo: r.codigo,
      curso: r.curso,
      semestre: r.semestre,
      anio: r.año,
      auxiliares: r.auxiliares ?? [],
    }));
  }

  async consultarEstadoMatricula(estudianteId: string, cursoId: string): Promise<string> {
    const res = await query<EstadoRow>('SELECT fn_estado_matricula($1, $2)', [
      estudianteId,
      cursoId,
    ]);
    return res.rows[0]?.fn_estado_matricula ?? 'SIN_MATRICULA';
  }

  async listarCursos(): Promise<CursoInscripcion[]> {
    const res = await query<CursoRow>(
      'SELECT id, codigo, nombre, escuela, semestre, año FROM curso ORDER BY semestre DESC, codigo ASC',
    );
    return res.rows.map((r) => ({
      cursoId: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      escuela: r.escuela,
      semestre: r.semestre,
      anio: r.año,
    }));
  }

  async listarDocentes(): Promise<DocenteInscripcion[]> {
    const res = await query<{ id: string; usuario_id: string }>(
      'SELECT id, usuario_id FROM docente ORDER BY usuario_id ASC',
    );
    return res.rows.map((r) => ({ docenteId: r.id, usuarioId: r.usuario_id }));
  }

  async listarAuxiliares(): Promise<AuxiliarInscripcion[]> {
    const res = await query<{ id: string; usuario_id: string }>(
      'SELECT id, usuario_id FROM auxiliar ORDER BY usuario_id ASC',
    );
    return res.rows.map((r) => ({ auxiliarId: r.id, usuarioId: r.usuario_id }));
  }

  async listarAsignaciones(): Promise<AsignacionDocenteItem[]> {
    const res = await query<AsignacionRow>(`
      SELECT
        ad.id AS asignacion_id,
        ad.docente_id,
        d.usuario_id AS docente_usuario_id,
        c.id AS curso_id,
        c.codigo,
        c.nombre AS curso,
        ad.semestre,
        c.año,
        aa.auxiliar_id,
        a.usuario_id AS auxiliar_usuario_id
      FROM asignacion_docente ad
      JOIN docente d ON d.id = ad.docente_id
      JOIN curso c ON c.id = ad.curso_id
      LEFT JOIN asignacion_auxiliar aa ON aa.asignacion_docente_id = ad.id
      LEFT JOIN auxiliar a ON a.id = aa.auxiliar_id
      ORDER BY ad.semestre DESC, c.codigo ASC
    `);
    return res.rows.map((r) => ({
      asignacionId: r.asignacion_id,
      docenteId: r.docente_id,
      docenteUsuarioId: r.docente_usuario_id,
      cursoId: r.curso_id,
      codigo: r.codigo,
      curso: r.curso,
      semestre: r.semestre,
      anio: r.año,
      auxiliarId: r.auxiliar_id ?? null,
      auxiliarUsuarioId: r.auxiliar_usuario_id ?? null,
    }));
  }

  async eliminarDocente(docenteId: string): Promise<void> {
    const res = await query<{ p_eliminado: boolean }>(
      'CALL sp_eliminar_docente($1, NULL)',
      [docenteId],
    );
    if (!res.rows[0]?.p_eliminado) {
      throw new DomainError('DOCENTE_NO_ENCONTRADO', 'El docente no existe', 404);
    }
  }

  private async getCursoByCodigo(client: PoolClient, codigo: string): Promise<CursoInscripcion> {
    const { rows } = await client.query<CursoRow>(
      'SELECT id, codigo, nombre, escuela, semestre, año FROM curso WHERE codigo = $1',
      [codigo],
    );
    if (rows.length === 0) {
      throw new DomainError('CURSO_NO_ENCONTRADO', 'Curso no encontrado', 404);
    }
    const r = rows[0];
    return {
      cursoId: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      escuela: r.escuela,
      semestre: r.semestre,
      anio: r.año,
    };
  }
}
