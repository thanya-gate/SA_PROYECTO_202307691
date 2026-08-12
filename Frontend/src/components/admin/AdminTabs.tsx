import { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  type CargaCsvResult,
  type CursoAdminItem,
  type DocenteAdminItem,
  type EscuelaAdminItem,
  type SemestreAdminItem,
} from '../../api/admin';
import { authApi, type PublicUser, type SolicitudEstado, type SolicitudRolItem } from '../../api/auth';
import {
  inscripcionApi,
  type AsignacionDocenteItem,
  type AuxiliarInscripcion,
  type CursoRegistrado,
} from '../../api/inscripcion';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';

export interface EstadoCrud {
  mensaje: string | null;
  error: string | null;
  ocupado: boolean;
}

export function formatearMensaje(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function nombreUsuario(u: PublicUser): string {
  const nombre = [u.nombres, u.apellidos].filter(Boolean).join(' ').trim();
  return nombre || u.email;
}

function semestreCorto(semestre: string): string {
  const partes = semestre.split('-');
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : semestre;
}

function rolLegible(rol: string): string {
  const sinPrefijo = rol.replace(/^ROLE_/, '');
  const nombres: Record<string, string> = {
    ESTUDIANTE: 'Estudiante',
    CATEDRATICO: 'Catedrático',
    AUXILIAR: 'Auxiliar',
    ADMIN: 'Administrador',
  };
  return nombres[sinPrefijo] ?? sinPrefijo;
}

function nombreSolicitante(s: SolicitudRolItem): string {
  return [s.nombres, s.apellidos].filter(Boolean).join(' ').trim() || s.correo;
}

export function TituloSeccion({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <header className="catalogo__hero">
      <h1 className="catalogo__title">{titulo}</h1>
      <p className="catalogo__subtitle">{detalle}</p>
    </header>
  );
}

function Notificaciones({ estado }: { estado: EstadoCrud }) {
  return (
    <>
      {estado.error && (
        <Alert tone="error">
          <strong>Error:</strong> {estado.error}
        </Alert>
      )}
      {estado.mensaje && (
        <Alert tone="success">
          <strong>¡Listo!</strong> {estado.mensaje}
        </Alert>
      )}
    </>
  );
}

export function SemestresTab({ token }: { token: string }) {
  const [semestres, setSemestres] = useState<SemestreAdminItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const [form, setForm] = useState({ nombre: '', anio: '' });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const res = await adminApi.listarSemestres(token);
      setSemestres(res.semestres);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los semestres'));
      setSemestres([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(s: SemestreAdminItem) {
    setEditandoId(s.semestreId);
    setForm({ nombre: s.nombre, anio: String(s.anio) });
    setEstado({ mensaje: null, error: null, ocupado: false });
  }

  async function guardar() {
    const anio = Number(form.anio);
    if (!form.nombre.trim() || !anio) {
      setEstado({ mensaje: null, error: 'El nombre del semestre y el año son obligatorios.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      if (editandoId) {
        await adminApi.actualizarSemestre(token, editandoId, form.nombre.trim(), anio);
        setEstado({ mensaje: 'Semestre actualizado correctamente.', error: null, ocupado: false });
      } else {
        await adminApi.registrarSemestre(token, form.nombre.trim(), anio);
        setEstado({ mensaje: 'Semestre registrado correctamente.', error: null, ocupado: false });
      }
      setForm({ nombre: '', anio: '' });
      setEditandoId(null);
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo guardar el semestre'), ocupado: false });
    }
  }

  async function eliminar(s: SemestreAdminItem) {
    if (!window.confirm(`¿Eliminar el semestre ${s.nombre}?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await adminApi.eliminarSemestre(token, s.semestreId);
      setEstado({ mensaje: `Semestre ${s.nombre} eliminado.`, error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo eliminar el semestre'), ocupado: false });
    }
  }

  return (
    <>
      <TituloSeccion
        titulo="Semestres"
        detalle="Registra o actualiza los semestres académicos que agrupan las clases grabadas."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <TextField
          label="Nombre"
          placeholder="2026-1"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <TextField
          label="Año"
          placeholder="2026"
          inputMode="numeric"
          value={form.anio}
          onChange={(e) => setForm({ ...form, anio: e.target.value.replace(/\D/g, '') })}
        />
      </div>
      <div className="gcursos__form-acciones">
        <Button onClick={guardar} loading={estado.ocupado}>
          {editandoId ? 'Actualizar semestre' : 'Registrar semestre'}
        </Button>
        {editandoId && (
          <Button
            variant="secondary"
            onClick={() => {
              setEditandoId(null);
              setForm({ nombre: '', anio: '' });
            }}
          >
            Cancelar edición
          </Button>
        )}
      </div>

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando semestres…
        </p>
      ) : semestres.length === 0 ? (
        <p className="catalogo__estado">Aún no hay semestres registrados.</p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Año</th>
                <th>Clases</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {semestres.map((s) => (
                <tr key={s.semestreId}>
                  <td className="asig__celda-semestre">{s.nombre}</td>
                  <td>{s.anio}</td>
                  <td>{s.clases}</td>
                  <td className="asig__celda-accion">
                    <div className="admin-acciones">
                      <Button variant="secondary" onClick={() => editar(s)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => eliminar(s)} disabled={estado.ocupado}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function EscuelasTab({ token }: { token: string }) {
  const [escuelas, setEscuelas] = useState<EscuelaAdminItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const res = await adminApi.listarEscuelas(token);
      setEscuelas(res.escuelas);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar las escuelas'));
      setEscuelas([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(e: EscuelaAdminItem) {
    setEditandoId(e.escuelaId);
    setNombre(e.nombre);
    setEstado({ mensaje: null, error: null, ocupado: false });
  }

  async function guardar() {
    if (!nombre.trim()) {
      setEstado({ mensaje: null, error: 'El nombre de la escuela es obligatorio.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      if (editandoId) {
        await adminApi.actualizarEscuela(token, editandoId, nombre.trim());
        setEstado({ mensaje: 'Escuela actualizada correctamente.', error: null, ocupado: false });
      } else {
        await adminApi.registrarEscuela(token, nombre.trim());
        setEstado({ mensaje: 'Escuela registrada correctamente.', error: null, ocupado: false });
      }
      setNombre('');
      setEditandoId(null);
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo guardar la escuela'), ocupado: false });
    }
  }

  async function eliminar(e: EscuelaAdminItem) {
    if (!window.confirm(`¿Eliminar la escuela "${e.nombre}"?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await adminApi.eliminarEscuela(token, e.escuelaId);
      setEstado({ mensaje: `Escuela "${e.nombre}" eliminada.`, error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo eliminar la escuela'), ocupado: false });
    }
  }

  return (
    <>
      <TituloSeccion
        titulo="Escuelas / Áreas"
        detalle="Registra o actualiza las escuelas del catálogo a las que pertenecen los cursos."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <TextField
          label="Nombre de la escuela"
          placeholder="Escuela de Ciencias y Sistemas"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div className="gcursos__form-acciones">
        <Button onClick={guardar} loading={estado.ocupado}>
          {editandoId ? 'Actualizar escuela' : 'Registrar escuela'}
        </Button>
        {editandoId && (
          <Button
            variant="secondary"
            onClick={() => {
              setEditandoId(null);
              setNombre('');
            }}
          >
            Cancelar edición
          </Button>
        )}
      </div>

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando escuelas…
        </p>
      ) : escuelas.length === 0 ? (
        <p className="catalogo__estado">Aún no hay escuelas registradas.</p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cursos</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {escuelas.map((e) => (
                <tr key={e.escuelaId}>
                  <td>
                    <span className="asig__curso">{e.nombre}</span>
                  </td>
                  <td>{e.cursos}</td>
                  <td className="asig__celda-accion">
                    <div className="admin-acciones">
                      <Button variant="secondary" onClick={() => editar(e)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => eliminar(e)} disabled={estado.ocupado}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function CursosCatalogoTab({ token }: { token: string }) {
  const [cursos, setCursos] = useState<CursoAdminItem[]>([]);
  const [escuelas, setEscuelas] = useState<EscuelaAdminItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const [form, setForm] = useState({ codigo: '', nombre: '', escuela: '' });
  const [editando, setEditando] = useState<CursoAdminItem | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const [resCursos, resEscuelas] = await Promise.all([
        adminApi.listarCursos(token),
        adminApi.listarEscuelas(token),
      ]);
      setCursos(resCursos.cursos);
      setEscuelas(resEscuelas.escuelas);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los cursos'));
      setCursos([]);
      setEscuelas([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(c: CursoAdminItem) {
    setEditando(c);
    setForm({ codigo: c.codigo, nombre: c.nombre, escuela: c.escuela });
    setEstado({ mensaje: null, error: null, ocupado: false });
  }

  async function guardar() {
    if (!form.codigo.trim() || !form.nombre.trim() || !form.escuela.trim()) {
      setEstado({ mensaje: null, error: 'Código, nombre y escuela son obligatorios.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    const input = {
      codigo: form.codigo.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      escuela: form.escuela.trim(),
    };
    try {
      if (editando) {
        await adminApi.actualizarCurso(token, editando.cursoId, input);
        setEstado({ mensaje: 'Curso actualizado correctamente.', error: null, ocupado: false });
      } else {
        await adminApi.registrarCurso(token, input);
        setEstado({ mensaje: 'Curso registrado en el catálogo.', error: null, ocupado: false });
      }
      setForm({ codigo: '', nombre: '', escuela: '' });
      setEditando(null);
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo guardar el curso'), ocupado: false });
    }
  }

  async function eliminar(c: CursoAdminItem) {
    if (!window.confirm(`¿Eliminar el curso ${c.codigo} del catálogo?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await adminApi.eliminarCurso(token, c.cursoId);
      setEstado({ mensaje: `Curso ${c.codigo} eliminado del catálogo.`, error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo eliminar el curso'), ocupado: false });
    }
  }

  return (
    <>
      <TituloSeccion
        titulo="Cursos del catálogo"
        detalle="Registra o actualiza los cursos que pueden tener clases grabadas."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <TextField
          label="Código"
          placeholder="CC308"
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
        />
        <TextField
          label="Nombre"
          placeholder="Comunicaciones y Redes de Computadoras"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Escuela</span>
          <select
            className="catalogo__select"
            value={form.escuela}
            onChange={(e) => setForm({ ...form, escuela: e.target.value })}
          >
            <option value="">Selecciona una escuela…</option>
            {escuelas.map((e) => (
              <option key={e.escuelaId} value={e.nombre}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="gcursos__form-acciones">
        <Button onClick={guardar} loading={estado.ocupado}>
          {editando ? 'Actualizar curso' : 'Registrar curso'}
        </Button>
        {editando && (
          <Button
            variant="secondary"
            onClick={() => {
              setEditando(null);
              setForm({ codigo: '', nombre: '', escuela: '' });
            }}
          >
            Cancelar edición
          </Button>
        )}
      </div>

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando cursos…
        </p>
      ) : cursos.length === 0 ? (
        <p className="catalogo__estado">Aún no hay cursos registrados en el catálogo.</p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Escuela</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => (
                <tr key={c.cursoId}>
                  <td className="asig__celda-id">{c.codigo}</td>
                  <td>
                    <span className="asig__curso">{c.nombre}</span>
                  </td>
                  <td>
                    <span className="asig__escuela">{c.escuela}</span>
                  </td>
                  <td className="asig__celda-accion">
                    <div className="admin-acciones">
                      <Button variant="secondary" onClick={() => editar(c)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => eliminar(c)} disabled={estado.ocupado}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function DocentesTab({ token }: { token: string }) {
  const [docentes, setDocentes] = useState<DocenteAdminItem[]>([]);
  const [candidatos, setCandidatos] = useState<PublicUser[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const [usuarioId, setUsuarioId] = useState('');
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const [resDocentes, resUsuarios] = await Promise.all([
        adminApi.listarDocentes(token),
        authApi.listarUsuariosPorRol(token, ['ROLE_CATEDRATICO', 'ROLE_AUXILIAR']),
      ]);
      setDocentes(resDocentes.docentes);
      setCandidatos(resUsuarios.usuarios);
      setUsuarioId((prev) => prev || resUsuarios.usuarios[0]?.userId || '');
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los docentes'));
      setDocentes([]);
      setCandidatos([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const docentesPorUsuario = useCallback(() => {
    const map = new Map<string, DocenteAdminItem>();
    for (const d of docentes) map.set(d.usuarioId, d);
    return map;
  }, [docentes]);

  async function registrar() {
    if (!usuarioId) {
      setEstado({ mensaje: null, error: 'Selecciona un usuario para registrar como docente.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await adminApi.registrarDocente(token, usuarioId);
      setEstado({ mensaje: 'Docente registrado correctamente.', error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo registrar el docente'), ocupado: false });
    }
  }

  async function eliminar(d: DocenteAdminItem) {
    const nombre = candidatos.find((u) => u.userId === d.usuarioId);
    if (!window.confirm(`¿Eliminar el docente ${nombre ? nombreUsuario(nombre) : d.usuarioId}?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await adminApi.eliminarDocente(token, d.docenteId);
      setEstado({ mensaje: 'Docente eliminado.', error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo eliminar el docente'), ocupado: false });
    }
  }

  const registrados = docentesPorUsuario();

  return (
    <>
      <TituloSeccion
        titulo="Registros de docentes"
        detalle="Habilita a catedráticos y auxiliares como docentes con permisos de publicación de clases."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Usuario (catedrático o auxiliar)</span>
          <select
            className="catalogo__select"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
          >
            {candidatos.length === 0 && <option value="">No hay usuarios con rol de docente o auxiliar</option>}
            {candidatos.map((u) => (
              <option key={u.userId} value={u.userId} disabled={registrados.has(u.userId)}>
                {nombreUsuario(u)} ({u.email}) {registrados.has(u.userId) ? '— ya registrado' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="gcursos__form-acciones">
        <Button onClick={registrar} loading={estado.ocupado}>
          Registrar docente
        </Button>
      </div>

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando docentes…
        </p>
      ) : docentes.length === 0 ? (
        <p className="catalogo__estado">Aún no hay docentes registrados.</p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {docentes.map((d) => {
                const usuario = candidatos.find((u) => u.userId === d.usuarioId);
                return (
                  <tr key={d.docenteId}>
                    <td>
                      <span className="asig__curso">{usuario ? nombreUsuario(usuario) : d.usuarioId}</span>
                      <span className="asig__escuela">{usuario?.email}</span>
                    </td>
                    <td>{usuario?.roles.includes('ROLE_CATEDRATICO') ? 'Catedrático' : 'Auxiliar'}</td>
                    <td className="asig__celda-accion">
                      <div className="admin-acciones">
                        <Button variant="secondary" onClick={() => eliminar(d)} disabled={estado.ocupado}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function RolesTab({ token }: { token: string }) {
  const [estudiantes, setEstudiantes] = useState<PublicUser[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const res = await authApi.listarUsuariosPorRol(token, ['ROLE_ESTUDIANTE']);
      setEstudiantes(res.usuarios);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los estudiantes'));
      setEstudiantes([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternarRol(u: PublicUser, rol: 'ROLE_AUXILIAR' | 'ROLE_CATEDRATICO') {
    const tieneRol = u.roles.includes(rol);
    const accion = tieneRol ? 'Quitar' : 'Otorgar';
    const mensajeRol = rol === 'ROLE_AUXILIAR' ? 'auxiliar' : 'catedrático';
    if (!window.confirm(`¿${accion} el rol de ${mensajeRol} a ${nombreUsuario(u)}?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      if (tieneRol) {
        await authApi.quitarRol(token, u.userId, rol);
      } else {
        await authApi.asignarRol(token, u.userId, rol);
      }
      setEstado({
        mensaje: `Rol de ${mensajeRol} ${tieneRol ? 'retirado' : 'otorgado'} a ${nombreUsuario(u)}.`,
        error: null,
        ocupado: false,
      });
      await cargar();
    } catch (err: unknown) {
      setEstado({
        mensaje: null,
        error: formatearMensaje(err, `No se pudo ${accion.toLowerCase()} el rol de ${mensajeRol}`),
        ocupado: false,
      });
    }
  }

  return (
    <>
      <TituloSeccion
        titulo="Roles de los estudiantes"
        detalle="Determina quién puede ser auxiliar o catedrático: otorga o retira los roles de cada estudiante."
      />
      <Notificaciones estado={estado} />

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando estudiantes…
        </p>
      ) : estudiantes.length === 0 ? (
        <p className="catalogo__estado">Aún no hay estudiantes registrados.</p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Carnet</th>
                <th>Roles</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((u) => (
                <tr key={u.userId}>
                  <td>
                    <span className="asig__curso">{nombreUsuario(u)}</span>
                    <span className="asig__escuela">{u.email}</span>
                  </td>
                  <td className="asig__celda-semestre">{u.carnet ?? '—'}</td>
                  <td>
                    <div className="asig__roles">
                      {u.roles.map((r) => (
                        <span key={r} className="asig__rol-badge">
                          {rolLegible(r)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="asig__celda-accion">
                    <div className="admin-acciones">
                      {u.roles.includes('ROLE_AUXILIAR') ? (
                        <Button variant="secondary" onClick={() => alternarRol(u, 'ROLE_AUXILIAR')} disabled={estado.ocupado}>
                          Quitar auxiliar
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => alternarRol(u, 'ROLE_AUXILIAR')} disabled={estado.ocupado}>
                          Hacer auxiliar
                        </Button>
                      )}
                      {u.roles.includes('ROLE_CATEDRATICO') ? (
                        <Button variant="secondary" onClick={() => alternarRol(u, 'ROLE_CATEDRATICO')} disabled={estado.ocupado}>
                          Quitar catedrático
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => alternarRol(u, 'ROLE_CATEDRATICO')} disabled={estado.ocupado}>
                          Hacer catedrático
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function SolicitudesTab({ token }: { token: string }) {
  const [solicitudes, setSolicitudes] = useState<SolicitudRolItem[]>([]);
  const [filtro, setFiltro] = useState<SolicitudEstado>('PENDIENTE');
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const res = await authApi.listarSolicitudesRol(token, filtro);
      setSolicitudes(res.solicitudes);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar las solicitudes'));
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, [token, filtro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function resolver(s: SolicitudRolItem, aprobado: boolean) {
    const verbo = aprobado ? 'Aprobar' : 'Rechazar';
    if (!window.confirm(`¿${verbo} la solicitud de ${nombreSolicitante(s)} para ser ${rolLegible(s.rolSolicitado)}?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await authApi.resolverSolicitudRol(token, s.solicitudId, aprobado);
      setEstado({
        mensaje: `Solicitud ${aprobado ? 'aprobada' : 'rechazada'}: a ${nombreSolicitante(s)} se le otorgó el rol de ${rolLegible(s.rolSolicitado)}.`,
        error: null,
        ocupado: false,
      });
      await cargar();
    } catch (err: unknown) {
      setEstado({
        mensaje: null,
        error: formatearMensaje(err, `No se pudo ${aprobado ? 'aprobar' : 'rechazar'} la solicitud`),
        ocupado: false,
      });
    }
  }

  return (
    <>
      <TituloSeccion
        titulo="Solicitudes de rol"
        detalle="Los estudiantes solicitan ser catedráticos o auxiliares. Aprueba o rechaza cada solicitud."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Estado</span>
          <select
            className="catalogo__select"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as SolicitudEstado)}
          >
            <option value="PENDIENTE">Pendientes</option>
            <option value="ACEPTADA">Aprobadas</option>
            <option value="RECHAZADA">Rechazadas</option>
          </select>
        </label>
      </div>

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando solicitudes…
        </p>
      ) : solicitudes.length === 0 ? (
        <p className="catalogo__estado">No hay solicitudes en este estado.</p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Rol solicitado</th>
                <th>Fecha</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.solicitudId}>
                  <td>
                    <span className="asig__curso">{nombreSolicitante(s)}</span>
                    <span className="asig__escuela">{s.correo}</span>
                  </td>
                  <td className="asig__celda-semestre">{rolLegible(s.rolSolicitado)}</td>
                  <td className="asig__celda-semestre">
                    {new Date(s.fechaSolicitud).toLocaleDateString()}
                  </td>
                  <td className="asig__celda-accion">
                    {s.estado === 'PENDIENTE' ? (
                      <div className="admin-acciones">
                        <Button onClick={() => resolver(s, true)} loading={estado.ocupado}>
                          Aprobar
                        </Button>
                        <Button variant="secondary" onClick={() => resolver(s, false)} disabled={estado.ocupado}>
                          Rechazar
                        </Button>
                      </div>
                    ) : (
                      <span className="asig__muted">Resuelta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function AsignarCursosTab({ token }: { token: string }) {
  const [cursos, setCursos] = useState<CursoRegistrado[]>([]);
  const [usuarios, setUsuarios] = useState<PublicUser[]>([]);
  const [auxiliares, setAuxiliares] = useState<AuxiliarInscripcion[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionDocenteItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const [formDocente, setFormDocente] = useState({ cursoId: '', semestre: '', usuarioId: '' });
  const [formAuxiliar, setFormAuxiliar] = useState({ asignacionId: '', auxiliarId: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const [resCursos, resUsuarios, resAuxiliares, resAsignaciones] = await Promise.all([
        inscripcionApi.listarCursos(token),
        authApi.listarUsuariosPorRol(token, ['ROLE_CATEDRATICO', 'ROLE_AUXILIAR']),
        inscripcionApi.listarAuxiliares(token),
        inscripcionApi.listarAsignaciones(token),
      ]);
      setCursos(resCursos.cursos);
      setUsuarios(resUsuarios.usuarios);
      setAuxiliares(resAuxiliares.auxiliares);
      setAsignaciones(resAsignaciones.asignaciones);
      setFormDocente((prev) => ({
        cursoId: prev.cursoId || resCursos.cursos[0]?.cursoId || '',
        semestre: prev.semestre || resCursos.cursos[0]?.semestre || '',
        usuarioId:
          prev.usuarioId ||
          resUsuarios.usuarios.find((u) => u.roles.includes('ROLE_CATEDRATICO'))?.userId ||
          resUsuarios.usuarios[0]?.userId ||
          '',
      }));
      setFormAuxiliar((prev) => ({
        asignacionId: prev.asignacionId || resAsignaciones.asignaciones[0]?.asignacionId || '',
        auxiliarId: prev.auxiliarId || resAuxiliares.auxiliares[0]?.auxiliarId || '',
      }));
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los datos de asignación'));
      setCursos([]);
      setUsuarios([]);
      setAuxiliares([]);
      setAsignaciones([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombrePorUsuario = useCallback(() => {
    const map = new Map<string, string>();
    for (const u of usuarios) map.set(u.userId, nombreUsuario(u));
    return map;
  }, [usuarios]);

  async function asignarCatedratico() {
    if (!formDocente.cursoId || !formDocente.semestre || !formDocente.usuarioId) {
      setEstado({ mensaje: null, error: 'Selecciona curso, semestre y catedrático.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      const res = await inscripcionApi.asignarDocenteCurso(
        token,
        formDocente.usuarioId,
        formDocente.cursoId,
        formDocente.semestre,
      );
      setEstado({
        mensaje: `Catedrático asignado al curso (asignación ${res.asignacionId.slice(0, 8)}…).`,
        error: null,
        ocupado: false,
      });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo asignar el catedrático'), ocupado: false });
    }
  }

  async function asignarAuxiliar() {
    if (!formAuxiliar.asignacionId || !formAuxiliar.auxiliarId) {
      setEstado({ mensaje: null, error: 'Selecciona la asignación del catedrático y un auxiliar.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      const res = await inscripcionApi.asignarAuxiliarCatedratico(
        token,
        formAuxiliar.auxiliarId,
        formAuxiliar.asignacionId,
      );
      setEstado({
        mensaje: `Auxiliar vinculado al catedrático (asignación ${res.asignacionAuxiliarId.slice(0, 8)}…).`,
        error: null,
        ocupado: false,
      });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo asignar el auxiliar'), ocupado: false });
    }
  }

  const nombres = nombrePorUsuario();

  return (
    <>
      <TituloSeccion
        titulo="Asignar cursos"
        detalle="Asigna catedráticos a los cursos del semestre y vincula auxiliares con cada catedrático."
      />
      <Notificaciones estado={estado} />

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando datos de asignación…
        </p>
      ) : (
        <>
          <section className="gcursos__panel" aria-label="Asignar catedrático">
            <h2 className="gcursos__panel-titulo">Asignar catedrático a un curso</h2>
            <div className="gcursos__form">
              <label className="catalogo__campo">
                <span className="catalogo__campo-label">Curso</span>
                <select
                  className="catalogo__select"
                  value={formDocente.cursoId}
                  onChange={(e) => {
                    const curso = cursos.find((c) => c.cursoId === e.target.value);
                    setFormDocente((prev) => ({
                      ...prev,
                      cursoId: e.target.value,
                      semestre: curso?.semestre ?? prev.semestre,
                    }));
                  }}
                >
                  {cursos.map((c) => (
                    <option key={c.cursoId} value={c.cursoId}>
                      {c.codigo} · {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="catalogo__campo">
                <span className="catalogo__campo-label">Semestre</span>
                <select
                  className="catalogo__select"
                  value={formDocente.semestre}
                  onChange={(e) => setFormDocente((prev) => ({ ...prev, semestre: e.target.value }))}
                >
                  {[...new Set(cursos.map((c) => c.semestre))]
                    .sort((a, b) => (a < b ? 1 : -1))
                    .map((semestre) => (
                      <option key={semestre} value={semestre}>
                        {semestreCorto(semestre)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="catalogo__campo">
                <span className="catalogo__campo-label">Catedrático</span>
                <select
                  className="catalogo__select"
                  value={formDocente.usuarioId}
                  onChange={(e) => setFormDocente((prev) => ({ ...prev, usuarioId: e.target.value }))}
                >
                  {usuarios
                    .filter((u) => u.roles.includes('ROLE_CATEDRATICO'))
                    .map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {nombreUsuario(u)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="gcursos__form-acciones">
              <Button onClick={asignarCatedratico} loading={estado.ocupado}>
                Asignar catedrático
              </Button>
            </div>
          </section>

          <section className="gcursos__panel" aria-label="Asignar auxiliar">
            <h2 className="gcursos__panel-titulo">Asignar auxiliar a un catedrático</h2>
            <div className="gcursos__form">
              <label className="catalogo__campo">
                <span className="catalogo__campo-label">Asignación (curso — catedrático)</span>
                <select
                  className="catalogo__select"
                  value={formAuxiliar.asignacionId}
                  onChange={(e) => setFormAuxiliar((prev) => ({ ...prev, asignacionId: e.target.value }))}
                >
                  {asignaciones.map((a) => (
                    <option key={a.asignacionId} value={a.asignacionId}>
                      {a.codigo} · {a.curso} ({semestreCorto(a.semestre)}) —{' '}
                      {nombres.get(a.docenteUsuarioId) ?? a.docenteUsuarioId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="catalogo__campo">
                <span className="catalogo__campo-label">Auxiliar</span>
                <select
                  className="catalogo__select"
                  value={formAuxiliar.auxiliarId}
                  onChange={(e) => setFormAuxiliar((prev) => ({ ...prev, auxiliarId: e.target.value }))}
                >
                  {auxiliares.map((a) => (
                    <option key={a.auxiliarId} value={a.auxiliarId}>
                      {nombres.get(a.usuarioId) ?? a.usuarioId}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="gcursos__form-acciones">
              <Button onClick={asignarAuxiliar} loading={estado.ocupado}>
                Asignar auxiliar
              </Button>
            </div>
          </section>

          <section className="gcursos__panel" aria-label="Asignaciones vigentes">
            <h2 className="gcursos__panel-titulo">Asignaciones vigentes</h2>
            {asignaciones.length === 0 ? (
              <p className="catalogo__estado">Aún no hay asignaciones de catedráticos.</p>
            ) : (
              <div className="gcursos__tabla-wrap">
                <table className="asig__tabla">
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Semestre</th>
                      <th>Catedrático</th>
                      <th>Auxiliar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asignaciones.map((a) => (
                      <tr key={a.asignacionId}>
                        <td>
                          <span className="asig__curso">{a.codigo} · {a.curso}</span>
                        </td>
                        <td className="asig__celda-semestre">{semestreCorto(a.semestre)}</td>
                        <td>{nombres.get(a.docenteUsuarioId) ?? a.docenteUsuarioId}</td>
                        <td>
                          {a.auxiliarUsuarioId
                            ? nombres.get(a.auxiliarUsuarioId) ?? a.auxiliarUsuarioId
                            : <span className="asig__muted">Sin auxiliar</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export function CsvTab({ token }: { token: string }) {
  const [csv, setCsv] = useState('');
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });
  const [resultado, setResultado] = useState<CargaCsvResult | null>(null);

  function leerArchivo(archivo: File | null) {
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setCsv(String(lector.result ?? ''));
    lector.readAsText(archivo);
  }

  async function subir() {
    if (!csv.trim()) {
      setEstado({ mensaje: null, error: 'Pega o selecciona un archivo CSV con las clases.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    setResultado(null);
    try {
      const res = await adminApi.cargarCsv(token, csv);
      setResultado(res);
      setEstado({ mensaje: res.message, error: null, ocupado: false });
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo procesar el CSV'), ocupado: false });
    }
  }

  const ejemplo = [
    'codigo_curso,titulo_clase,unidad,tema,semestre,año,escuela,fecha,documento,url_video,duracion_minutos,etiquetas',
    'CC308,Grabación 1,1,Sistemas Operativos,2026-1,2026,Escuela de Ciencias y Sistemas,2026-03-01,https://m.f/1,https://v/1,120,sistemas;clase',
  ].join('\n');

  return (
    <>
      <TituloSeccion
        titulo="Carga masiva de catálogo (CSV)"
        detalle="Sube un archivo CSV con las clases grabadas de un semestre. El servidor las registra mediante el procedimiento almacenado sp_cargar_clases_csv."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Archivo CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="catalogo__select"
            onChange={(e) => leerArchivo(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Contenido del CSV</span>
          <textarea
            className="admin-textarea"
            rows={8}
            placeholder="… o pega aquí el contenido del archivo"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </label>
      </div>
      <div className="gcursos__form-acciones">
        <Button onClick={subir} loading={estado.ocupado}>
          Procesar CSV
        </Button>
      </div>

      {resultado && (
        <div className="admin-resumen">
          <p>
            <strong>{resultado.registradas}</strong> clases registradas · <strong>{resultado.omitidas}</strong> filas
            omitidas · <strong>{resultado.totalProcesadas}</strong> filas procesadas
          </p>
        </div>
      )}

      <details className="admin-ayuda">
        <summary>Formato esperado del CSV</summary>
        <pre className="admin-ayuda__pre">{ejemplo}</pre>
        <p className="catalogo__estado">
          Columnas: codigo_curso, titulo_clase, unidad, tema, semestre, año, escuela, fecha, documento, url_video,
          duracion_minutos, etiquetas. La primera fila debe ser el encabezado.
        </p>
      </details>
    </>
  );
}
