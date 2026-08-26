import { AuthService } from '../src/application/services/auth.service';
import { AccountService } from '../src/application/services/account.service';
import { ProfileService } from '../src/application/services/profile.service';
import { SessionService } from '../src/application/services/session.service';
import { SolicitudService } from '../src/application/services/solicitud.service';
import { EmailDomainValidator } from '../src/domain/services/email-domain-validator';
import { InMemoryUserRepository } from '../src/infrastructure/persistence/memory/in-memory-user-repository';
import { InMemorySessionRepository } from '../src/infrastructure/persistence/memory/in-memory-session-repository';
import { InMemoryVerificationTokenRepository } from '../src/infrastructure/persistence/memory/in-memory-verification-token-repository';
import { createUser } from '../src/domain/entities/user';
import { Role } from '../src/domain/enums/role';
import { SessionStatus, TokenType, TokenUsageState } from '../src/domain/enums/auth';
import {
  makePasswordService,
  makeSessionRepository,
  makeTokenService,
  makeUser,
  makeUserRepository,
  OTHER_USER_ID,
  USER_ID,
} from './fakes';

const validator = new EmailDomainValidator(['ingenieria.usac.edu.gt', 'ing.usac.edu.gt']);

function registerInput(overrides: Record<string, unknown> = {}) {
  return {
    email: 'nuevo@ingenieria.usac.edu.gt',
    password: 'secreto-123',
    confirmPassword: 'secreto-123',
    rol: Role.ESTUDIANTE,
    carnet: '20230002',
    dpi: '9876543210987',
    fechaNacimiento: '2000-01-01',
    ...overrides,
  } as any;
}

describe('AuthService', () => {
  test('registra estudiante, crea sesión y firma token', async () => {
    const users = makeUserRepository();
    const sessions = new SessionService(makeSessionRepository());
    const password = makePasswordService();
    const tokens = makeTokenService();
    const service = new AuthService(users, sessions, password, tokens, validator, 60_000);

    const result = await service.register(registerInput(), { ip: '127.0.0.1', userAgent: 'Jest' });

    expect(result.user.email).toBe('nuevo@ingenieria.usac.edu.gt');
    expect(result.user.roles).toEqual([Role.ESTUDIANTE]);
    expect(result.session.userId).toBe(result.user.userId);
    expect(password.hash).toHaveBeenCalledWith('secreto-123');
    expect(tokens.signAccessToken).toHaveBeenCalledWith(expect.objectContaining({
      sub: result.user.userId,
      email: result.user.email,
      roles: [Role.ESTUDIANTE],
      sessionId: result.session.sessionId,
    }));
  });

  test('crea una cuenta docente sin roles y genera la solicitud de autorización', async () => {
    const users = makeUserRepository();
    const service = new AuthService(
      users,
      new SessionService(makeSessionRepository()),
      makePasswordService(),
      makeTokenService(),
      validator,
      60_000,
    );

    const result = await service.register(registerInput({
      email: 'docente@ingenieria.usac.edu.gt',
      rol: Role.CATEDRATICO,
      carnet: '',
      requiereAutorizacion: true,
    }), {});

    expect(result.user.roles).toEqual([]);
    expect(users.crearSolicitudRol).toHaveBeenCalledWith(result.user.userId, Role.CATEDRATICO);
  });

  test('no consulta el repositorio si el dominio es inválido', async () => {
    const users = makeUserRepository();
    const service = new AuthService(
      users,
      new SessionService(makeSessionRepository()),
      makePasswordService(),
      makeTokenService(),
      validator,
      60_000,
    );

    await expect(service.register(registerInput({ email: 'fuera@gmail.com' }), {})).rejects.toMatchObject({
      code: 'DOMINIO_NO_AUTORIZADO',
    });
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.findByCarnet).not.toHaveBeenCalled();
    expect(users.findByDpi).not.toHaveBeenCalled();
  });

  test.each([
    ['correo', 'findByEmail', 'CORREO_YA_REGISTRADO'],
    ['carnet', 'findByCarnet', 'CARNET_YA_REGISTRADO'],
    ['DPI', 'findByDpi', 'DPI_YA_REGISTRADO'],
  ])('rechaza duplicado de %s antes de guardar', async (_name, method, code) => {
    const users = makeUserRepository();
    (users[method as keyof typeof users] as jest.Mock).mockResolvedValue(makeUser());
    const service = new AuthService(
      users,
      new SessionService(makeSessionRepository()),
      makePasswordService(),
      makeTokenService(),
      validator,
      60_000,
    );

    await expect(service.register(registerInput(), {})).rejects.toMatchObject({ code });
    expect(users.save).not.toHaveBeenCalled();
  });

  test('inicia sesión, normaliza el correo y rechaza cuenta inactiva o credenciales incorrectas', async () => {
    const user = makeUser();
    const users = makeUserRepository();
    users.findByEmail.mockResolvedValue(user);
    const password = makePasswordService(true);
    const service = new AuthService(
      users,
      new SessionService(makeSessionRepository()),
      password,
      makeTokenService(),
      validator,
      60_000,
    );

    await expect(service.login({ email: ' ESTUDIANTE@INGENIERIA.USAC.EDU.GT ', password: 'x' }, {}))
      .resolves.toMatchObject({ user });
    expect(users.findByEmail).toHaveBeenCalledWith('estudiante@ingenieria.usac.edu.gt');

    users.findByEmail.mockResolvedValue(null);
    await expect(service.login({ email: 'no@ing.usac.edu.gt', password: 'x' }, {})).rejects.toMatchObject({
      code: 'CREDENCIALES_INVALIDAS',
    });

    users.findByEmail.mockResolvedValue({ ...user, activo: false });
    await expect(service.login({ email: user.email, password: 'x' }, {})).rejects.toMatchObject({
      code: 'CUENTA_INACTIVA',
    });

    users.findByEmail.mockResolvedValue(user);
    password.verify.mockResolvedValue(false);
    await expect(service.login({ email: user.email, password: 'x' }, {})).rejects.toMatchObject({
      code: 'CREDENCIALES_INVALIDAS',
    });
  });

  test('valida credenciales sin crear sesión y enlaza OAuth para usuarios nuevos/existentes', async () => {
    const users = makeUserRepository();
    const password = makePasswordService(true);
    const tokens = makeTokenService();
    const sessionRepo = makeSessionRepository();
    const service = new AuthService(
      users,
      new SessionService(sessionRepo),
      password,
      tokens,
      validator,
      60_000,
    );

    const found = makeUser();
    users.findByEmail.mockResolvedValue(found);
    await expect(service.validateCredentials(found.email, 'x')).resolves.toBe(found);
    expect(sessionRepo.save).not.toHaveBeenCalled();

    users.findByEmail.mockResolvedValue(null);
    await expect(service.loginWithOAuth({
      sub: 'google-sub',
      email: 'oauth@ing.usac.edu.gt',
      emailVerified: true,
      roles: [Role.CATEDRATICO],
    }, {})).resolves.toMatchObject({ newUser: true, user: { email: 'oauth@ing.usac.edu.gt' } });
    expect(users.linkOAuthProvider).toHaveBeenCalledWith(expect.any(String), 'institucional');

    users.findByEmail.mockResolvedValue(found);
    await expect(service.loginWithOAuth({
      sub: 'existing-sub',
      email: found.email,
      emailVerified: true,
    }, {})).resolves.toMatchObject({ newUser: false, user: found });
    expect(users.linkOAuthProvider).toHaveBeenCalledWith(found.userId, 'institucional');
  });

  test('revoca una sesión y devuelve null cuando ya no está activa', async () => {
    const users = new InMemoryUserRepository();
    const user = createUser({ userId: USER_ID, email: 'u@ing.usac.edu.gt', passwordHash: 'hash' });
    await users.save(user);
    const sessionRepo = new InMemorySessionRepository();
    const sessionService = new SessionService(sessionRepo);
    const service = new AuthService(users, sessionService, makePasswordService(), makeTokenService(), validator, 60_000);
    const session = await sessionService.create({ userId: USER_ID });

    await expect(service.validateSession(session.sessionId)).resolves.toBe(user);
    await service.logout(session.sessionId);
    await expect(service.validateSession(session.sessionId)).resolves.toBeNull();
  });
});

describe('AccountService', () => {
  test('emite y consume verificación de correo exactamente una vez', async () => {
    const users = new InMemoryUserRepository();
    const user = createUser({ userId: USER_ID, email: 'u@ing.usac.edu.gt', passwordHash: 'hash' });
    await users.save(user);
    const tokens = new InMemoryVerificationTokenRepository();
    const tokenService = makeTokenService();
    tokenService.generateRandomToken.mockReturnValue('verify-token');
    const account = new AccountService(users, tokens, makePasswordService(), tokenService, validator);

    await expect(account.requestEmailVerification(user.email)).resolves.toEqual({ token: 'verify-token' });
    await account.confirmEmailVerification('verify-token');
    await expect((await users.findById(USER_ID))?.emailVerified).toBe(true);
    await expect(account.confirmEmailVerification('verify-token')).rejects.toMatchObject({ code: 'TOKEN_INVALIDO' });
  });

  test('no enumera usuarios al solicitar reset y actualiza contraseña para usuarios válidos', async () => {
    const users = new InMemoryUserRepository();
    const user = createUser({ userId: USER_ID, email: 'u@ing.usac.edu.gt', passwordHash: 'old' });
    await users.save(user);
    const tokens = new InMemoryVerificationTokenRepository();
    const tokenService = makeTokenService();
    tokenService.generateRandomToken.mockReturnValueOnce('opaque-token').mockReturnValueOnce('reset-token');
    const password = makePasswordService();
    const account = new AccountService(users, tokens, password, tokenService, validator);

    await expect(account.requestPasswordReset('missing@ing.usac.edu.gt')).resolves.toEqual({ token: 'opaque-token' });
    await expect(account.requestPasswordReset(user.email)).resolves.toEqual({ token: 'reset-token' });
    await account.confirmPasswordReset('reset-token', 'new-password');
    expect(password.hash).toHaveBeenCalledWith('new-password');
    await expect((await users.findById(USER_ID))?.passwordHash).toBe('hash:new-password');
  });

  test('rechaza tokens expirados, de tipo incorrecto y cambios con contraseña actual inválida', async () => {
    const users = new InMemoryUserRepository();
    await users.save(createUser({ userId: USER_ID, email: 'u@ing.usac.edu.gt', passwordHash: 'old' }));
    const tokens = new InMemoryVerificationTokenRepository();
    await tokens.save({
      token: 'expired', userId: USER_ID, type: TokenType.RESET_PASSWORD,
      state: TokenUsageState.PENDIENTE, expiresAt: new Date(Date.now() - 1), createdAt: new Date(),
    });
    await tokens.save({
      token: 'email-token', userId: USER_ID, type: TokenType.VERIFICACION_CORREO,
      state: TokenUsageState.PENDIENTE, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(),
    });
    const password = makePasswordService(false);
    const account = new AccountService(users, tokens, password, makeTokenService(), validator);

    await expect(account.confirmPasswordReset('expired', 'new-password')).rejects.toMatchObject({ code: 'TOKEN_EXPIRADO' });
    await expect(account.confirmPasswordReset('email-token', 'new-password')).rejects.toMatchObject({ code: 'TOKEN_INVALIDO' });
    await expect(account.confirmPasswordReset('missing', 'new-password')).rejects.toMatchObject({ code: 'TOKEN_INVALIDO' });
    await expect(account.changePassword(USER_ID, 'wrong', 'new-password')).rejects.toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
  });
});

describe('SessionService, ProfileService y SolicitudService', () => {
  test('expira, revoca y filtra sesiones activas', async () => {
    const repository = new InMemorySessionRepository();
    const sessions = new SessionService(repository);
    const expired = await sessions.create({ userId: USER_ID, ttlMs: -1 });
    const active = await sessions.create({ userId: USER_ID, ttlMs: 60_000 });

    await expect(sessions.validate(expired.sessionId)).resolves.toBeNull();
    await expect(repository.findById(expired.sessionId)).resolves.toMatchObject({ status: 'EXPIRADA' });
    await sessions.revoke(active.sessionId);
    await expect(sessions.validate(active.sessionId)).resolves.toBeNull();
    await expect(sessions.findActiveByUserId(USER_ID)).resolves.toEqual([]);
  });

  test('gestiona perfiles, permisos y cambio de sesión', async () => {
    const users = new InMemoryUserRepository();
    await users.save(makeUser({ roles: [Role.ESTUDIANTE, Role.AUXILIAR] }));
    const sessionRepository = new InMemorySessionRepository();
    const sessions = new SessionService(sessionRepository);
    const profile = new ProfileService(users, sessions);
    const session = await sessions.create({ userId: USER_ID });

    await expect(profile.getProfiles(USER_ID)).resolves.toMatchObject({ roles: [Role.ESTUDIANTE, Role.AUXILIAR] });
    await expect(profile.checkPermission(USER_ID, 'catalogo', 'publicar')).resolves.toBe(false);
    await expect(profile.assignRole(USER_ID, Role.ADMIN)).resolves.toMatchObject({ roles: [Role.ESTUDIANTE, Role.AUXILIAR, Role.ADMIN] });
    await expect(profile.assignRole(USER_ID, Role.ADMIN)).rejects.toMatchObject({ code: 'CONFLICTO_ALMACENAMIENTO' });
    await expect(profile.removeRole(USER_ID, Role.AUXILIAR)).resolves.toMatchObject({ roles: [Role.ESTUDIANTE, Role.ADMIN] });
    await expect(profile.switchActiveProfile(USER_ID, Role.ADMIN, session.sessionId)).resolves.toBeUndefined();
    await expect(sessions.validate(session.sessionId)).resolves.toBeNull();
    await expect(profile.removeRole(USER_ID, Role.ESTUDIANTE)).resolves.toMatchObject({ roles: [Role.ADMIN] });
    await expect(profile.removeRole(USER_ID, Role.ADMIN)).rejects.toMatchObject({ code: 'ROL_INVALIDO' });
    await expect(profile.getProfiles(OTHER_USER_ID)).rejects.toMatchObject({ code: 'USUARIO_NO_ENCONTRADO' });
  });

  test('crea, filtra, aprueba y no permite resolver dos veces la misma solicitud', async () => {
    const users = new InMemoryUserRepository();
    await users.save(makeUser({ roles: [Role.ESTUDIANTE] }));
    const solicitudes = new SolicitudService(users);

    await expect(solicitudes.crearSolicitud(USER_ID, Role.ADMIN)).rejects.toMatchObject({ code: 'ROL_INVALIDO' });
    const solicitud = await solicitudes.crearSolicitud(USER_ID, Role.CATEDRATICO);
    await expect(solicitudes.listarSolicitudes('PENDIENTE', USER_ID)).resolves.toHaveLength(1);
    await expect(solicitudes.crearSolicitud(USER_ID, Role.CATEDRATICO)).rejects.toMatchObject({ code: 'SOLICITUD_DUPLICADA' });
    await expect(solicitudes.resolverSolicitud('', true, OTHER_USER_ID)).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    await expect(solicitudes.resolverSolicitud(solicitud.solicitudId, true, OTHER_USER_ID)).resolves.toMatchObject({ estado: 'ACEPTADA' });
    await expect((await users.findById(USER_ID))?.roles).toContain(Role.CATEDRATICO);
    await expect(solicitudes.resolverSolicitud(solicitud.solicitudId, false, OTHER_USER_ID)).rejects.toMatchObject({ code: 'SOLICITUD_RESUELTA' });
  });

  test('los adaptadores de memoria conservan revocación, roles y tokens', async () => {
    const sessions = new InMemorySessionRepository();
    const session = {
      sessionId: 'session-1', userId: USER_ID, status: SessionStatus.ACTIVA,
      issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
    };
    await sessions.save(session);
    await expect(sessions.revokeAllForUser(USER_ID)).resolves.toBe(1);
    await expect(sessions.findById('session-1')).resolves.toMatchObject({ status: 'REVOCADA' });

    const verification = new InMemoryVerificationTokenRepository();
    await verification.save({ token: 't', userId: USER_ID, type: TokenType.RESET_PASSWORD, state: TokenUsageState.PENDIENTE, expiresAt: new Date(Date.now() + 1000), createdAt: new Date() });
    await verification.markUsed('t');
    await expect(verification.findByToken('t')).resolves.toMatchObject({ state: TokenUsageState.USADO });
  });
});
