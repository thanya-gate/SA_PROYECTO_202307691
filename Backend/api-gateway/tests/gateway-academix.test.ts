import request from 'supertest';
import { createGateway } from '../src/server';
import { AcademixApi, crearAcademixApi, nombreCompleto } from '../src/academix/client';

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('cliente de Academix', () => {
  it('arma las rutas públicas de Academix', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, {}));
    const api = crearAcademixApi('https://academix.test/', fetchFn);

    await api.talleres('Software Avanzado');
    await api.reservar('EVT-1', 'Ana Pérez', 'ana@ingenieria.usac.edu.gt');
    await api.estadoReserva('trk/1');
    await api.credenciales('Ana Pérez');
    await api.verificar('CERT-2026-000001');

    const urls = fetchFn.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      'https://academix.test/catalogo/api/talleres/eventos?busqueda=Software+Avanzado&limite=20',
      'https://academix.test/reservas/api/reservas',
      'https://academix.test/reservas/api/reservas/trk%2F1/estado',
      'https://academix.test/certificados/api/certificados/credenciales?titular=Ana+P%C3%A9rez',
      'https://academix.test/certificados/api/certificados/verificar?codigo=CERT-2026-000001&exigirFirma=true',
    ]);
    expect(JSON.parse(fetchFn.mock.calls[1][1].body)).toEqual({
      eventoId: 'EVT-1',
      estudianteNombre: 'Ana Pérez',
      estudianteCorreo: 'ana@ingenieria.usac.edu.gt',
      canal: 'yousac',
    });
  });

  it('traduce fallos a errores de dominio', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(crearAcademixApi('').talleres('x')).rejects.toMatchObject({ httpStatus: 503, code: 'ACADEMIX_NO_CONFIGURADO' });
    await expect(crearAcademixApi('https://a.test', jest.fn().mockRejectedValue(new Error('timeout'))).talleres('x')).rejects.toMatchObject({ httpStatus: 503 });
    await expect(crearAcademixApi('https://a.test', jest.fn().mockResolvedValue(respuesta(500, {}))).talleres('x')).rejects.toMatchObject({ httpStatus: 502 });
    await expect(
      crearAcademixApi('https://a.test', jest.fn().mockResolvedValue(respuesta(409, { mensaje: 'Sin cupo' }))).reservar('E', 'n', 'c'),
    ).rejects.toMatchObject({ httpStatus: 409, message: 'Sin cupo' });
    warn.mockRestore();
  });

  it('nombreCompleto usa nombres y apellidos o cae al correo', () => {
    expect(nombreCompleto({ nombres: 'Ana', apellidos: 'Pérez', email: 'a@x' })).toBe('Ana Pérez');
    expect(nombreCompleto({ nombres: null, apellidos: null, email: 'a@x' })).toBe('a@x');
  });
});

describe('rutas /academix del gateway', () => {
  const user = { userId: 'u1', email: 'ana@ingenieria.usac.edu.gt', nombres: 'Ana', apellidos: 'Pérez', roles: ['ROLE_ESTUDIANTE'] };
  const auth = {
    validateSession: jest.fn(async () => ({
      session: { sessionId: 's1', userId: 'u1', email: user.email, roles: user.roles },
    })),
    getCurrentUser: jest.fn(async () => ({ user, sessionId: 's1' })),
  };
  const academix: jest.Mocked<AcademixApi> = {
    talleres: jest.fn().mockResolvedValue({ eventos: [{ eventoId: 'EVT-1' }], total: 1 }),
    reservar: jest.fn().mockResolvedValue({ trackingId: 'trk-1', estado: 'PENDIENTE' }),
    estadoReserva: jest.fn().mockResolvedValue({ trackingId: 'trk-1', estado: 'CONFIRMADA' }),
    credenciales: jest.fn().mockResolvedValue({ credenciales: [] }),
    verificar: jest.fn().mockResolvedValue({ estadoTexto: 'VALIDA' }),
  };
  const app = createGateway({ authGrpc: auth as any, academix });
  const conSesion = (r: request.Test) => r.set('Authorization', 'Bearer t');

  it('requiere sesión', async () => {
    await request(app).get('/academix/talleres').expect(401);
  });

  it('lista talleres del curso', async () => {
    const res = await conSesion(request(app).get('/academix/talleres?curso=Software%20Avanzado')).expect(200);
    expect(res.body.total).toBe(1);
    expect(academix.talleres).toHaveBeenCalledWith('Software Avanzado');
  });

  it('reserva con nombre y correo de la sesión, no del cliente', async () => {
    const res = await conSesion(request(app).post('/academix/reservas'))
      .send({ eventoId: 'EVT-1', estudianteCorreo: 'otro@x.com' })
      .expect(202);
    expect(res.body.trackingId).toBe('trk-1');
    expect(academix.reservar).toHaveBeenCalledWith('EVT-1', 'Ana Pérez', 'ana@ingenieria.usac.edu.gt');
    await conSesion(request(app).post('/academix/reservas')).send({}).expect(400);
  });

  it('consulta estado, billetera y verificación', async () => {
    await conSesion(request(app).get('/academix/reservas/trk-1')).expect(200);
    await conSesion(request(app).get('/academix/certificados')).expect(200);
    expect(academix.credenciales).toHaveBeenCalledWith('Ana Pérez');
    const v = await conSesion(request(app).get('/academix/certificados/CERT-1/verificar')).expect(200);
    expect(v.body.estadoTexto).toBe('VALIDA');
  });
});
