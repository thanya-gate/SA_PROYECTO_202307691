import request from 'supertest';
import * as grpc from '@grpc/grpc-js';
import { GrpcError } from '../src/grpc/auth-client';
import { createGateway } from '../src/server';

// Recorre todas las rutas HTTP del gateway con sesión de administrador y
// clientes gRPC simulados: cada endpoint debe responder sin error 500.

const ID = '11111111-1111-4111-8111-111111111111';

const usuario = {
  userId: ID, email: 'admin@ingenieria.usac.edu.gt', emailVerified: true, roles: ['ROLE_ADMIN'],
  nombres: 'Ana', apellidos: 'Pérez',
};

// Respuesta por defecto de cualquier RPC; los casos que necesitan forma específica la sobrescriben.
function clienteSimulado(fijos: Record<string, unknown> = {}): any {
  return new Proxy(
    {},
    {
      get: (_t, metodo: string) =>
        jest.fn(async () => (metodo in fijos ? fijos[metodo] : {})),
    },
  );
}

const auth = clienteSimulado({
  validateSession: { session: { sessionId: 's1', userId: ID, email: usuario.email, roles: ['ROLE_ADMIN'] } },
  getCurrentUser: { user: usuario, sessionId: 's1' },
  login: { user: usuario, accessToken: 't', expiresAt: 'x' },
  register: { user: usuario, accessToken: 't', expiresAt: 'x' },
  oauthCallback: { user: usuario, accessToken: 't', expiresAt: 'x', provider: 'mock' },
  updateProfile: { user: usuario },
  listarUsuarios: { usuarios: [usuario] },
  listarSolicitudesRol: { solicitudes: [] },
  resolverSolicitudRol: { solicitud: { usuarioId: ID, rolSolicitado: 'ROLE_CATEDRATICO', estado: 'APROBADA' } },
});

const app = createGateway({
  authGrpc: auth,
  catalogGrpc: clienteSimulado({
    getClase: { clase: { claseId: ID, etiquetas: [], participantes: [], capitulos: [] } },
    actualizarUrlVideo: { clase: { claseId: ID, urlVideo: 'https://youtu.be/abcdef123' } },
  }),
  reproductionGrpc: clienteSimulado(),
  analiticaGrpc: clienteSimulado(),
  inscripcionGrpc: clienteSimulado({ listarCursos: { cursos: [] }, registrarDocente: { docenteId: ID }, asignarCatedraticoCurso: { asignacionId: ID } }),
  notificacionesGrpc: clienteSimulado(),
  storage: clienteSimulado(),
  academix: clienteSimulado(),
  catalogoExterno: null,
});

const rutas: Array<[string, string]> = [
  ['get', '/health/live'], ['get', '/health'],
  ['post', '/auth/register'], ['post', '/auth/login'], ['post', '/auth/logout'], ['get', '/auth/me'], ['patch', '/auth/me'],
  ['get', '/auth/usuarios'], ['post', '/auth/usuarios'], ['patch', `/auth/usuarios/${ID}`], ['delete', `/auth/usuarios/${ID}`],
  ['post', `/auth/usuarios/${ID}/reactivar`], ['post', '/auth/solicitudes'], ['get', '/auth/solicitudes'],
  ['post', `/auth/solicitudes/${ID}/resolver`], ['get', '/profiles/me'], ['patch', `/profiles/${ID}/roles`],
  ['delete', `/profiles/${ID}/roles/ROLE_AUXILIAR`], ['post', '/profiles/switch'], ['post', '/profiles/permission'],
  ['post', '/account/verify-email'], ['post', '/account/verify-email/confirm'], ['post', '/account/reset-password'],
  ['post', '/account/reset-password/confirm'], ['post', '/account/change-password'], ['post', '/auth/oauth/authorize'],
  ['post', '/auth/oauth/callback'],
  ['get', '/catalog/classes'], ['get', `/catalog/classes/${ID}`], ['get', `/catalog/classes/${ID}/chapters`],
  ['get', `/catalog/classes/${ID}/dudas`], ['patch', `/catalog/classes/${ID}`], ['delete', `/catalog/classes/${ID}`],
  ['get', '/catalog/semestres'], ['post', '/catalog/classes'], ['post', '/catalog/courses'], ['get', '/catalog/courses/0770'],
  ['get', '/admin/semestres'], ['post', '/admin/semestres'], ['patch', `/admin/semestres/${ID}`], ['delete', `/admin/semestres/${ID}`],
  ['get', '/admin/escuelas'], ['post', '/admin/escuelas'], ['patch', `/admin/escuelas/${ID}`], ['delete', `/admin/escuelas/${ID}`],
  ['get', '/admin/cursos'], ['post', '/admin/cursos'], ['patch', `/admin/cursos/${ID}`], ['delete', `/admin/cursos/${ID}`],
  ['get', '/admin/docentes'], ['post', '/admin/docentes'], ['delete', `/admin/docentes/${ID}`],
  ['post', `/catalog/classes/${ID}/video-url`], ['patch', `/catalog/classes/${ID}/duracion`],
  ['get', `/catalog/classes/${ID}/materials`], ['get', `/catalog/materials/${ID}`], ['delete', `/catalog/materials/${ID}`],
  ['post', `/catalog/materials/${ID}/descarga`],
  ['post', '/reproduccion/checkpoint'], ['get', `/reproduccion/checkpoint/${ID}`], ['get', '/reproduccion/historial'],
  ['post', '/reproduccion/calificaciones'], ['get', '/reproduccion/apuntes'], ['post', '/reproduccion/apuntes'],
  ['delete', `/reproduccion/apuntes/${ID}`], ['get', `/reproduccion/apuntes/${ID}/exportar`],
  ['get', '/analitica/clases-mas-vistas'], ['get', '/analitica/tendencias-examenes'], ['get', '/analitica/ranking-mejor-valoradas'],
  ['get', '/analitica/recomendaciones/me'], ['post', '/analitica/sincronizar/vista'], ['post', '/analitica/sincronizar/calificacion'],
  ['post', '/analitica/tendencias/recalcular'],
  ['get', '/inscripcion/panel/me'], ['get', '/inscripcion/cursos-catedratico'], ['get', `/inscripcion/estado-matricula/${ID}`],
  ['post', '/inscripcion/cursos'], ['post', '/inscripcion/docentes'], ['post', '/inscripcion/auxiliares'],
  ['get', '/inscripcion/cursos'], ['get', '/inscripcion/docentes'], ['get', '/inscripcion/auxiliares'],
  ['get', '/inscripcion/asignaciones'], ['post', '/inscripcion/inscripciones/auto'],
  ['post', `/inscripcion/estudiantes/${ID}/cursos/${ID}`], ['post', `/inscripcion/catedraticos/${ID}/cursos/${ID}`],
  ['post', `/inscripcion/cursos/${ID}/docente`], ['post', `/inscripcion/auxiliares/${ID}/asignaciones/${ID}`],
  ['post', '/notificaciones/avisos'], ['get', '/notificaciones/me'], ['get', '/notificaciones/plantillas'],
  ['get', '/notificaciones/cola'],
];

describe('cobertura de endpoints del gateway', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const estados: string[] = [];
  afterAll(() => {
    error.mockRestore();
    if (process.env.SMOKE_DEBUG) console.log(estados.join('\n'));
  });

  it.each(rutas)('%s %s responde sin error interno', async (metodo, ruta) => {
    const res = await (request(app) as any)[metodo](ruta).set('Authorization', 'Bearer admin').send({});
    // /health responde 503 a propósito cuando los servicios simulados no reportan estado.
    expect(res.status === 503 && ruta === '/health' ? 200 : res.status).toBeLessThan(500);
    estados.push(`${res.status} ${metodo.toUpperCase()} ${ruta}`);
  });
});

// Mismas rutas con datos válidos: cubren el camino feliz, no solo la validación.
const correo = 'ana@ingenieria.usac.edu.gt';
const clase = { cursoId: ID, semestre: '2026-2', anio: 2026, duracion: 60, urlVideo: 'https://youtu.be/abcdef123', participantes: [{ nombre: 'Ing. X', rol: 'CATEDRATICO' }], etiquetas: ['redes'] };
const casosValidos: Array<[string, string, Record<string, unknown>]> = [
  ['post', '/auth/register', { email: correo, password: 'Segura123!', confirmPassword: 'Segura123!', carnet: '202307691', dpi: '1234567890101', fechaNacimiento: '2000-01-01', rol: 'ROLE_ESTUDIANTE' }],
  ['post', '/auth/login', { email: correo, password: 'Segura123!' }],
  ['get', '/auth/usuarios?rol=ROLE_CATEDRATICO&incluirInactivos=true', {}],
  ['post', '/auth/usuarios', { email: correo, password: 'Segura123!', confirmPassword: 'Segura123!', rol: 'ROLE_CATEDRATICO' }],
  ['post', '/auth/solicitudes', { rolSolicitado: 'ROLE_CATEDRATICO' }],
  ['post', `/auth/solicitudes/${ID}/resolver`, { aprobado: true }],
  ['patch', `/profiles/${ID}/roles`, { role: 'AUXILIAR' }],
  ['post', '/profiles/switch', { role: 'ADMIN' }],
  ['post', '/profiles/permission', { resource: 'clases', action: 'leer' }],
  ['post', '/account/verify-email/confirm', { token: 'tk' }],
  ['post', '/account/reset-password', { email: correo }],
  ['post', '/account/reset-password/confirm', { token: 'tk', newPassword: 'Nueva1234!' }],
  ['post', '/account/change-password', { currentPassword: 'Vieja1234!', newPassword: 'Nueva1234!' }],
  ['post', '/auth/oauth/authorize', { email: correo, state: 'st', codeChallenge: 'cc' }],
  ['post', '/auth/oauth/callback', { code: 'abc', codeVerifier: 'v' }],
  ['patch', `/catalog/classes/${ID}`, clase],
  ['post', '/catalog/classes', clase],
  ['post', '/catalog/courses', { codigo: '0770', nombre: 'Redes', escuela: 'Sistemas' }],
  ['post', '/admin/semestres', { nombre: '2026-2', anio: 2026 }],
  ['patch', `/admin/semestres/${ID}`, { nombre: '2026-1', anio: 2026 }],
  ['post', '/admin/escuelas', { nombre: 'Sistemas' }],
  ['patch', `/admin/escuelas/${ID}`, { nombre: 'Civil' }],
  ['post', '/admin/cursos', { codigo: '0770', nombre: 'Redes', escuela: 'Sistemas' }],
  ['patch', `/admin/cursos/${ID}`, { codigo: '0770', nombre: 'Redes', escuela: 'Sistemas' }],
  ['post', '/admin/docentes', { usuarioId: ID }],
  ['post', `/catalog/classes/${ID}/video-url`, { urlVideo: 'https://youtu.be/abcdef123' }],
  ['patch', `/catalog/classes/${ID}/duracion`, { duracion: 120 }],
  ['post', '/reproduccion/checkpoint', { claseId: ID, segundoActual: 30, duracion: 60, evento: 'PAUSA' }],
  ['post', '/reproduccion/calificaciones', { historialId: ID, puntuacion: 5, comentario: 'Buena', claseId: ID }],
  ['post', '/reproduccion/apuntes', { claseId: ID, titulo: 'Notas', contenidoMarkdown: '[01:30] subredes', posicionSegundos: 90 }],
  ['post', '/analitica/sincronizar/vista', { claseId: ID, duracionVista: 30 }],
  ['post', '/analitica/sincronizar/calificacion', { claseId: ID, puntuacion: 4 }],
  ['post', '/inscripcion/cursos', { codigo: '0770', nombre: 'Redes', escuela: 'Sistemas', semestre: '2026-2', anio: 2026 }],
  ['post', '/inscripcion/docentes', { usuarioId: ID }],
  ['post', '/inscripcion/auxiliares', { usuarioId: ID }],
  ['post', `/inscripcion/estudiantes/${ID}/cursos/${ID}`, { semestre: '2026-2' }],
  ['post', `/inscripcion/catedraticos/${ID}/cursos/${ID}`, { semestre: '2026-2' }],
  ['post', `/inscripcion/cursos/${ID}/docente`, { usuarioId: ID, semestre: '2026-2' }],
  ['post', '/notificaciones/avisos', { mensaje: 'Examen el lunes', destinatarioIds: [ID] }],
];

describe('endpoints del gateway con datos válidos', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  afterAll(() => error.mockRestore());

  it.each(casosValidos)('%s %s acepta la petición', async (metodo, ruta, cuerpo) => {
    const res = await (request(app) as any)[metodo](ruta).set('Authorization', 'Bearer admin').send(cuerpo);
    expect(res.status).toBeLessThan(400);
  });
});

// Con los microservicios caídos cada endpoint debe responder un error controlado
// (503 de gRPC UNAVAILABLE), nunca colgarse ni filtrar un 500 genérico.
describe('endpoints del gateway con microservicios no disponibles', () => {
  const caido = (): any =>
    new Proxy({}, { get: () => jest.fn().mockRejectedValue(new GrpcError(grpc.status.UNAVAILABLE, 'servicio caído')) });
  const appCaida = createGateway({
    authGrpc: clienteSimulado({
      validateSession: { session: { sessionId: 's1', userId: ID, email: usuario.email, roles: ['ROLE_ADMIN'] } },
    }),
    catalogGrpc: caido(),
    reproductionGrpc: caido(),
    analiticaGrpc: caido(),
    inscripcionGrpc: caido(),
    notificacionesGrpc: caido(),
    storage: caido(),
    academix: caido(),
    catalogoExterno: null,
  });
  const rutasConDatos = [
    ...rutas.filter(([, r]) => !r.startsWith('/auth') && !r.startsWith('/profiles') && !r.startsWith('/account')).map(([m, r]) => [m, r, {}] as const),
    ...casosValidos.filter(([, r]) => !r.startsWith('/auth') && !r.startsWith('/profiles') && !r.startsWith('/account')),
  ];
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  afterAll(() => {
    error.mockRestore();
    warn.mockRestore();
  });

  it.each(rutasConDatos)('%s %s responde un error controlado', async (metodo, ruta, cuerpo) => {
    const res = await (request(appCaida) as any)[metodo](ruta).set('Authorization', 'Bearer admin').send(cuerpo);
    expect(res.status).not.toBe(500);
  });
});
