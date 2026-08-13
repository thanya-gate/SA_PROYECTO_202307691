import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  adminApi,
  type CargaCsvResult,
  type CursoAdminItem,
  type DocenteAdminItem,
  type EscuelaAdminItem,
  type SemestreAdminItem,
} from '../../api/admin';
import {
  authApi,
  type PublicUser,
  type RegisterRole,
  type SolicitudRolItem,
} from '../../api/auth';
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

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const TrashIcon = () => <img className="admin-icon" src="/borrar.png" alt="" aria-hidden="true" />;

const EditIcon = () => (
  <img className="admin-icon" src="/editar-informacion.png" alt="" aria-hidden="true" />
);

const RestoreIcon = () => (
  <Icon>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </Icon>
);

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
                        <EditIcon /> Editar
                      </Button>
                      <Button variant="secondary" onClick={() => eliminar(s)} disabled={estado.ocupado}>
                        <TrashIcon /> Eliminar
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
                        <EditIcon /> Editar
                      </Button>
                      <Button variant="secondary" onClick={() => eliminar(e)} disabled={estado.ocupado}>
                        <TrashIcon /> Eliminar
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
                        <EditIcon /> Editar
                      </Button>
                      <Button variant="secondary" onClick={() => eliminar(c)} disabled={estado.ocupado}>
                        <TrashIcon /> Eliminar
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

type RolDocente = 'CATEDRATICO' | 'AUXILIAR';

export function DocentesTab({ token }: { token: string }) {
  const [docentes, setDocentes] = useState<DocenteAdminItem[]>([]);
  const [candidatos, setCandidatos] = useState<PublicUser[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudRolItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [formCrear, setFormCrear] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    carnet: '',
    dpi: '',
    fechaNacimiento: '',
    rol: 'CATEDRATICO' as RolDocente,
  });

  const [editando, setEditando] = useState<PublicUser | null>(null);
  const [formEdicion, setFormEdicion] = useState({
    nombres: '',
    apellidos: '',
    carnet: '',
    dpi: '',
    telefonoCelular: '',
    carrera: '',
  });
  const [estadoEdicion, setEstadoEdicion] = useState<EstadoCrud>({
    mensaje: null,
    error: null,
    ocupado: false,
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const [resDocentes, resUsuarios, resSolicitudes] = await Promise.all([
        adminApi.listarDocentes(token),
        authApi.listarUsuariosPorRol(token, ['ROLE_CATEDRATICO', 'ROLE_AUXILIAR']),
        authApi.listarSolicitudesRol(token, 'PENDIENTE'),
      ]);
      setDocentes(resDocentes.docentes);
      setCandidatos(resUsuarios.usuarios);
      setSolicitudes(resSolicitudes.solicitudes);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los docentes'));
      setDocentes([]);
      setCandidatos([]);
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function registrar() {
    const { email, password, confirmPassword, carnet, dpi, fechaNacimiento, rol } = formCrear;
    if (!email.trim() || !password || password.length < 8) {
      setEstado({ mensaje: null, error: 'El correo y una contraseña de al menos 8 caracteres son obligatorios.', ocupado: false });
      return;
    }
    if (password !== confirmPassword) {
      setEstado({ mensaje: null, error: 'Las contraseñas no coinciden.', ocupado: false });
      return;
    }
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      const creado = await authApi.crearUsuarioAdmin(token, {
        email: email.trim(),
        password,
        confirmPassword,
        carnet: carnet.trim(),
        dpi: dpi.trim(),
        fechaNacimiento,
        rol: 'CATEDRATICO',
      });
      if (rol === 'AUXILIAR') {
        await authApi.asignarRol(token, creado.user.userId, 'ROLE_AUXILIAR');
        await authApi.quitarRol(token, creado.user.userId, 'ROLE_CATEDRATICO');
      }
      await adminApi.registrarDocente(token, creado.user.userId);
      setEstado({ mensaje: `Docente ${email.trim()} (${rol === 'AUXILIAR' ? 'auxiliar' : 'catedrático'}) registrado correctamente.`, error: null, ocupado: false });
      setFormCrear({
        email: '',
        password: '',
        confirmPassword: '',
        carnet: '',
        dpi: '',
        fechaNacimiento: '',
        rol: 'CATEDRATICO',
      });
      setCrearAbierto(false);
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo registrar el docente'), ocupado: false });
    }
  }

  async function resolver(s: SolicitudRolItem, aprobado: boolean) {
    const persona = s.nombres ? `${s.nombres} ${s.apellidos ?? ''}`.trim() : s.correo;
    if (!window.confirm(`¿${aprobado ? 'Aprobar' : 'Rechazar'} la solicitud de ${rolLegible(s.rolSolicitado)} de ${persona}?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      const res = await authApi.resolverSolicitudRol(token, s.solicitudId, aprobado);
      setEstado({
        mensaje: aprobado
          ? `Solicitud de ${rolLegible(res.solicitud.rolSolicitado)} aprobada. ${persona} ya puede publicar clases.`
          : 'Solicitud rechazada.',
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

  function iniciarEdicion(u: PublicUser) {
    setEditando(u);
    setFormEdicion({
      nombres: u.nombres ?? '',
      apellidos: u.apellidos ?? '',
      carnet: u.carnet ?? '',
      dpi: u.dpi ?? '',
      telefonoCelular: u.telefonoCelular ?? '',
      carrera: u.carrera ?? '',
    });
    setEstadoEdicion({ mensaje: null, error: null, ocupado: false });
  }

  async function guardarEdicion() {
    if (!editando) return;
    setEstadoEdicion({ ...estadoEdicion, ocupado: true, error: null, mensaje: null });
    try {
      await authApi.actualizarUsuarioAdmin(token, editando.userId, {
        nombres: formEdicion.nombres.trim() || undefined,
        apellidos: formEdicion.apellidos.trim() || undefined,
        carnet: formEdicion.carnet.trim() || undefined,
        dpi: formEdicion.dpi.trim() || undefined,
        telefonoCelular: formEdicion.telefonoCelular.trim() || undefined,
        carrera: formEdicion.carrera.trim() || undefined,
      });
      setEstadoEdicion({
        mensaje: `Perfil de ${nombreUsuario(editando)} actualizado correctamente.`,
        error: null,
        ocupado: false,
      });
      setEditando(null);
      await cargar();
    } catch (err: unknown) {
      setEstadoEdicion({
        mensaje: null,
        error: formatearMensaje(err, 'No se pudo actualizar el perfil'),
        ocupado: false,
      });
    }
  }

  return (
    <>
      <TituloSeccion
        titulo="Docentes"
        detalle="Crea cuentas de catedráticos y auxiliares, aprueba los registros que quedaron pendientes y habilítalos con permisos de publicación de clases."
      />
      <Notificaciones estado={estado} />
      <Notificaciones estado={estadoEdicion} />

      {editando && (
        <div className="gcursos__form">
          <TextField
            label="Nombres"
            value={formEdicion.nombres}
            onChange={(e) => setFormEdicion({ ...formEdicion, nombres: e.target.value })}
          />
          <TextField
            label="Apellidos"
            value={formEdicion.apellidos}
            onChange={(e) => setFormEdicion({ ...formEdicion, apellidos: e.target.value })}
          />
          <TextField
            label="Carnet"
            value={formEdicion.carnet}
            onChange={(e) => setFormEdicion({ ...formEdicion, carnet: e.target.value })}
          />
          <TextField
            label="DPI"
            value={formEdicion.dpi}
            onChange={(e) => setFormEdicion({ ...formEdicion, dpi: e.target.value.replace(/\D/g, '') })}
          />
          <TextField
            label="Teléfono celular"
            value={formEdicion.telefonoCelular}
            onChange={(e) => setFormEdicion({ ...formEdicion, telefonoCelular: e.target.value })}
          />
          <TextField
            label="Carrera"
            value={formEdicion.carrera}
            onChange={(e) => setFormEdicion({ ...formEdicion, carrera: e.target.value })}
          />
        </div>
      )}
      {editando && (
        <div className="gcursos__form-acciones">
          <Button onClick={guardarEdicion} loading={estadoEdicion.ocupado}>
            Guardar cambios
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEditando(null);
              setEstadoEdicion({ mensaje: null, error: null, ocupado: false });
            }}
          >
            Cancelar edición
          </Button>
        </div>
      )}

      <div className="gcursos__form-acciones">
        <Button onClick={() => setCrearAbierto((v) => !v)} variant={crearAbierto ? 'secondary' : 'primary'}>
          {crearAbierto ? 'Cerrar formulario' : 'Crear docente'}
        </Button>
      </div>

      {crearAbierto && (
        <>
          <div className="gcursos__form">
            <TextField
              label="Correo institucional"
              type="email"
              value={formCrear.email}
              onChange={(e) => setFormCrear({ ...formCrear, email: e.target.value })}
            />
            <TextField
              label="Contraseña (mín. 8 caracteres)"
              type="password"
              value={formCrear.password}
              onChange={(e) => setFormCrear({ ...formCrear, password: e.target.value })}
            />
            <TextField
              label="Confirmar contraseña"
              type="password"
              value={formCrear.confirmPassword}
              onChange={(e) => setFormCrear({ ...formCrear, confirmPassword: e.target.value })}
            />
            <label className="catalogo__campo">
              <span className="catalogo__campo-label">Rol</span>
              <select
                className="catalogo__select"
                value={formCrear.rol}
                onChange={(e) => setFormCrear({ ...formCrear, rol: e.target.value as RolDocente })}
              >
                <option value="CATEDRATICO">Catedrático</option>
                <option value="AUXILIAR">Auxiliar</option>
              </select>
            </label>
            <TextField
              label="Carnet"
              value={formCrear.carnet}
              onChange={(e) => setFormCrear({ ...formCrear, carnet: e.target.value })}
            />
            <TextField
              label="DPI"
              value={formCrear.dpi}
              onChange={(e) => setFormCrear({ ...formCrear, dpi: e.target.value.replace(/\D/g, '') })}
            />
            <TextField
              label="Fecha de nacimiento"
              type="date"
              value={formCrear.fechaNacimiento}
              onChange={(e) => setFormCrear({ ...formCrear, fechaNacimiento: e.target.value })}
            />
          </div>
          <div className="gcursos__form-acciones">
            <Button onClick={registrar} loading={estado.ocupado}>
              Registrar docente
            </Button>
          </div>
        </>
      )}

      <section className="gcursos__panel" aria-label="Autorizar docentes">
        <h2 className="gcursos__panel-titulo">Autorizar docentes</h2>
        <p className="catalogo__subtitle">
          Los docentes que se registran por su cuenta quedan pendientes hasta que apruebes su cuenta para publicar clases.
        </p>
        {solicitudes.length === 0 ? (
          <p className="catalogo__estado">No hay solicitudes pendientes de autorización.</p>
        ) : (
          <div className="gcursos__tabla-wrap">
            <table className="asig__tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol solicitado</th>
                  <th>Fecha</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => (
                  <tr key={s.solicitudId}>
                    <td>
                      <span className="asig__curso">
                        {s.nombres ? `${s.nombres} ${s.apellidos ?? ''}`.trim() : s.correo}
                      </span>
                      <span className="asig__escuela">{s.correo}</span>
                    </td>
                    <td>
                      <span className="asig__rol-badge">{rolLegible(s.rolSolicitado)}</span>
                    </td>
                    <td className="asig__celda-semestre">
                      {new Date(s.fechaSolicitud).toLocaleDateString()}
                    </td>
                    <td className="asig__celda-accion">
                      <div className="admin-acciones">
                        <Button onClick={() => resolver(s, true)} loading={estado.ocupado}>
                          Aprobar
                        </Button>
                        <Button variant="secondary" onClick={() => resolver(s, false)} disabled={estado.ocupado}>
                          Rechazar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                        {usuario && (
                          <Button variant="secondary" onClick={() => iniciarEdicion(usuario)} disabled={estado.ocupado}>
                            <EditIcon /> Editar
                          </Button>
                        )}
                        <Button variant="secondary" onClick={() => eliminar(d)} disabled={estado.ocupado}>
                          <TrashIcon /> Eliminar
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
  const [busqueda, setBusqueda] = useState('');
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

  async function alternarRol(u: PublicUser) {
    const tieneRol = u.roles.includes('ROLE_AUXILIAR');
    const accion = tieneRol ? 'Quitar' : 'Otorgar';
    if (!window.confirm(`¿${accion} el rol de auxiliar a ${nombreUsuario(u)}?`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      if (tieneRol) {
        await authApi.quitarRol(token, u.userId, 'ROLE_AUXILIAR');
      } else {
        await authApi.asignarRol(token, u.userId, 'ROLE_AUXILIAR');
      }
      setEstado({
        mensaje: `Rol de auxiliar ${tieneRol ? 'retirado' : 'otorgado'} a ${nombreUsuario(u)}.`,
        error: null,
        ocupado: false,
      });
      await cargar();
    } catch (err: unknown) {
      setEstado({
        mensaje: null,
        error: formatearMensaje(err, `No se pudo ${accion.toLowerCase()} el rol de auxiliar`),
        ocupado: false,
      });
    }
  }

  const termino = busqueda.trim().toLowerCase();
  const filtrados = termino
    ? estudiantes.filter((u) => {
        const nombre = nombreUsuario(u).toLowerCase();
        const carnet = (u.carnet ?? '').toLowerCase();
        const email = u.email.toLowerCase();
        return nombre.includes(termino) || carnet.includes(termino) || email.includes(termino);
      })
    : estudiantes;

  return (
    <>
      <TituloSeccion
        titulo="Auxiliaturas"
        detalle="Busca a un estudiante y otórgale o retírale el rol de auxiliar."
      />
      <Notificaciones estado={estado} />

      <div className="gcursos__form">
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Buscar estudiante</span>
          <input
            type="search"
            className="catalogo__select"
            placeholder="Nombre, carnet o correo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando estudiantes…
        </p>
      ) : filtrados.length === 0 ? (
        <p className="catalogo__estado">
          {termino ? 'No se encontró ningún estudiante con ese nombre, carnet o correo.' : 'Aún no hay estudiantes registrados.'}
        </p>
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
              {filtrados.map((u) => (
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
                        <Button variant="secondary" onClick={() => alternarRol(u)} disabled={estado.ocupado}>
                          Quitar auxiliar
                        </Button>
                      ) : (
                        <Button onClick={() => alternarRol(u)} loading={estado.ocupado}>
                          Hacer auxiliar
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

const ROL_ESTUDIANTE = ['ROLE_ESTUDIANTE'];

export function EstudiantesTab({ token }: { token: string }) {
  const [usuarios, setUsuarios] = useState<PublicUser[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargaError, setCargaError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCrud>({ mensaje: null, error: null, ocupado: false });

  const [editando, setEditando] = useState<PublicUser | null>(null);
  const [formEdicion, setFormEdicion] = useState({
    nombres: '',
    apellidos: '',
    carnet: '',
    dpi: '',
    telefonoCelular: '',
    carrera: '',
  });
  const [estadoEdicion, setEstadoEdicion] = useState<EstadoCrud>({
    mensaje: null,
    error: null,
    ocupado: false,
  });

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [formCrear, setFormCrear] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    carnet: '',
    dpi: '',
    fechaNacimiento: '',
    rol: 'ESTUDIANTE' as RegisterRole,
  });
  const [estadoCrear, setEstadoCrear] = useState<EstadoCrud>({
    mensaje: null,
    error: null,
    ocupado: false,
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setCargaError(null);
    try {
      const res = await authApi.listarUsuariosPorRol(token, ROL_ESTUDIANTE, true);
      setUsuarios(res.usuarios);
    } catch (err: unknown) {
      setCargaError(formatearMensaje(err, 'No se pudieron cargar los usuarios'));
      setUsuarios([]);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function crear() {
    const { email, password, confirmPassword, carnet, dpi, fechaNacimiento, rol } = formCrear;
    if (!email.trim() || !password || password.length < 8) {
      setEstadoCrear({ mensaje: null, error: 'El correo y una contraseña de al menos 8 caracteres son obligatorios.', ocupado: false });
      return;
    }
    if (password !== confirmPassword) {
      setEstadoCrear({ mensaje: null, error: 'Las contraseñas no coinciden.', ocupado: false });
      return;
    }
    setEstadoCrear({ ...estadoCrear, ocupado: true, error: null, mensaje: null });
    try {
      await authApi.crearUsuarioAdmin(token, {
        email: email.trim(),
        password,
        confirmPassword,
        carnet: carnet.trim(),
        dpi: dpi.trim(),
        fechaNacimiento,
        rol,
      });
      setEstadoCrear({
        mensaje: `Usuario ${email.trim()} creado correctamente.`,
        error: null,
        ocupado: false,
      });
      setFormCrear({
        email: '',
        password: '',
        confirmPassword: '',
        carnet: '',
        dpi: '',
        fechaNacimiento: '',
        rol: 'ESTUDIANTE',
      });
      setCrearAbierto(false);
      await cargar();
    } catch (err: unknown) {
      setEstadoCrear({
        mensaje: null,
        error: formatearMensaje(err, 'No se pudo crear el usuario'),
        ocupado: false,
      });
    }
  }

  function iniciarEdicion(u: PublicUser) {
    setEditando(u);
    setFormEdicion({
      nombres: u.nombres ?? '',
      apellidos: u.apellidos ?? '',
      carnet: u.carnet ?? '',
      dpi: u.dpi ?? '',
      telefonoCelular: u.telefonoCelular ?? '',
      carrera: u.carrera ?? '',
    });
    setEstadoEdicion({ mensaje: null, error: null, ocupado: false });
  }

  async function guardarEdicion() {
    if (!editando) return;
    setEstadoEdicion({ ...estadoEdicion, ocupado: true, error: null, mensaje: null });
    try {
      await authApi.actualizarUsuarioAdmin(token, editando.userId, {
        nombres: formEdicion.nombres.trim() || undefined,
        apellidos: formEdicion.apellidos.trim() || undefined,
        carnet: formEdicion.carnet.trim() || undefined,
        dpi: formEdicion.dpi.trim() || undefined,
        telefonoCelular: formEdicion.telefonoCelular.trim() || undefined,
        carrera: formEdicion.carrera.trim() || undefined,
      });
      setEstadoEdicion({
        mensaje: `Perfil de ${nombreUsuario(editando)} actualizado correctamente.`,
        error: null,
        ocupado: false,
      });
      setEditando(null);
      await cargar();
    } catch (err: unknown) {
      setEstadoEdicion({
        mensaje: null,
        error: formatearMensaje(err, 'No se pudo actualizar el perfil'),
        ocupado: false,
      });
    }
  }

  async function desactivar(u: PublicUser) {
    if (!window.confirm(`¿Desactivar la cuenta de ${nombreUsuario(u)}? El usuario no podrá iniciar sesión.`)) return;
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await authApi.desactivarUsuario(token, u.userId);
      setEstado({ mensaje: `Cuenta de ${nombreUsuario(u)} desactivada.`, error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo desactivar la cuenta'), ocupado: false });
    }
  }

  async function reactivar(u: PublicUser) {
    setEstado({ ...estado, ocupado: true, error: null, mensaje: null });
    try {
      await authApi.reactivarUsuario(token, u.userId);
      setEstado({ mensaje: `Cuenta de ${nombreUsuario(u)} reactivada.`, error: null, ocupado: false });
      await cargar();
    } catch (err: unknown) {
      setEstado({ mensaje: null, error: formatearMensaje(err, 'No se pudo reactivar la cuenta'), ocupado: false });
    }
  }

  const termino = busqueda.trim().toLowerCase();
  const filtrados = termino
    ? usuarios.filter((u) => {
        const nombre = nombreUsuario(u).toLowerCase();
        const carnet = (u.carnet ?? '').toLowerCase();
        const email = u.email.toLowerCase();
        return nombre.includes(termino) || carnet.includes(termino) || email.includes(termino);
      })
    : usuarios;

  return (
    <>
      <TituloSeccion
        titulo="Estudiantes"
        detalle="Gestiona las cuentas de estudiantes: crea, edita perfiles y cambia el estado de la cuenta."
      />
      <Notificaciones estado={estado} />
      <Notificaciones estado={estadoEdicion} />
      <Notificaciones estado={estadoCrear} />

      <div className="gcursos__form">
        <label className="catalogo__campo">
          <span className="catalogo__campo-label">Buscar estudiante</span>
          <input
            type="search"
            className="catalogo__select"
            placeholder="Nombre, carnet o correo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>
      <div className="gcursos__form-acciones">
        <Button onClick={() => setCrearAbierto((v) => !v)} variant={crearAbierto ? 'secondary' : 'primary'}>
          {crearAbierto ? 'Cerrar formulario' : 'Crear estudiante'}
        </Button>
      </div>

      {crearAbierto && (
        <>
          <div className="gcursos__form">
            <TextField
              label="Correo institucional"
              type="email"
              value={formCrear.email}
              onChange={(e) => setFormCrear({ ...formCrear, email: e.target.value })}
            />
            <TextField
              label="Contraseña (mín. 8 caracteres)"
              type="password"
              value={formCrear.password}
              onChange={(e) => setFormCrear({ ...formCrear, password: e.target.value })}
            />
            <TextField
              label="Confirmar contraseña"
              type="password"
              value={formCrear.confirmPassword}
              onChange={(e) => setFormCrear({ ...formCrear, confirmPassword: e.target.value })}
            />
            <TextField
              label="Carnet"
              value={formCrear.carnet}
              onChange={(e) => setFormCrear({ ...formCrear, carnet: e.target.value })}
            />
            <TextField
              label="DPI"
              value={formCrear.dpi}
              onChange={(e) => setFormCrear({ ...formCrear, dpi: e.target.value.replace(/\D/g, '') })}
            />
            <TextField
              label="Fecha de nacimiento"
              type="date"
              value={formCrear.fechaNacimiento}
              onChange={(e) => setFormCrear({ ...formCrear, fechaNacimiento: e.target.value })}
            />
          </div>
          <div className="gcursos__form-acciones">
            <Button onClick={crear} loading={estadoCrear.ocupado}>
              Crear estudiante
            </Button>
          </div>
        </>
      )}

      {editando && (
        <>
          <div className="gcursos__form">
            <TextField
              label="Nombres"
              value={formEdicion.nombres}
              onChange={(e) => setFormEdicion({ ...formEdicion, nombres: e.target.value })}
            />
            <TextField
              label="Apellidos"
              value={formEdicion.apellidos}
              onChange={(e) => setFormEdicion({ ...formEdicion, apellidos: e.target.value })}
            />
            <TextField
              label="Carnet"
              value={formEdicion.carnet}
              onChange={(e) => setFormEdicion({ ...formEdicion, carnet: e.target.value })}
            />
            <TextField
              label="DPI"
              value={formEdicion.dpi}
              onChange={(e) => setFormEdicion({ ...formEdicion, dpi: e.target.value.replace(/\D/g, '') })}
            />
            <TextField
              label="Teléfono celular"
              value={formEdicion.telefonoCelular}
              onChange={(e) => setFormEdicion({ ...formEdicion, telefonoCelular: e.target.value })}
            />
            <TextField
              label="Carrera"
              value={formEdicion.carrera}
              onChange={(e) => setFormEdicion({ ...formEdicion, carrera: e.target.value })}
            />
          </div>
          <div className="gcursos__form-acciones">
            <Button onClick={guardarEdicion} loading={estadoEdicion.ocupado}>
              Guardar cambios
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditando(null);
                setEstadoEdicion({ mensaje: null, error: null, ocupado: false });
              }}
            >
              Cancelar edición
            </Button>
          </div>
        </>
      )}

      {cargaError && (
        <Alert tone="error">
          <strong>Error:</strong> {cargaError}
        </Alert>
      )}
      {cargando ? (
        <p className="catalogo__estado" role="status">
          Cargando estudiantes…
        </p>
      ) : filtrados.length === 0 ? (
        <p className="catalogo__estado">
          {termino ? 'No se encontró ningún estudiante con ese nombre, carnet o correo.' : 'Aún no hay estudiantes registrados.'}
        </p>
      ) : (
        <div className="gcursos__tabla-wrap">
          <table className="asig__tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Carnet</th>
                <th>Roles</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
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
                  <td>
                    {u.activo === false ? (
                      <span className="asig__rol-badge asig__rol-badge--inactivo">Inactivo</span>
                    ) : (
                      <span className="asig__rol-badge">Activo</span>
                    )}
                  </td>
                  <td className="asig__celda-accion">
                    <div className="admin-acciones">
                      <Button variant="secondary" onClick={() => iniciarEdicion(u)} disabled={estado.ocupado || estadoEdicion.ocupado}>
                        <EditIcon /> Editar
                      </Button>
                      {u.activo === false ? (
                        <Button variant="secondary" onClick={() => reactivar(u)} disabled={estado.ocupado}>
                          <RestoreIcon /> Reactivar
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => desactivar(u)} disabled={estado.ocupado}>
                          <TrashIcon /> Desactivar
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
