import { createUser, User } from '../src/domain/entities/user';
import { Role } from '../src/domain/enums/role';
import { Session } from '../src/domain/entities/session';
import { SessionStatus, TokenType, TokenUsageState } from '../src/domain/enums/auth';
import { SessionRepository } from '../src/application/ports/session-repository';
import { TokenService, PasswordService } from '../src/application/ports/token-service';
import { UserRepository } from '../src/application/ports/user-repository';
import { VerificationTokenRepository } from '../src/application/ports/verification-token-repository';

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    ...createUser({
      userId: USER_ID,
      email: 'estudiante@ingenieria.usac.edu.gt',
      passwordHash: 'hash:correcta',
      emailVerified: true,
      roles: [Role.ESTUDIANTE],
      nombres: 'Ada',
      apellidos: 'Lovelace',
      carnet: '20230001',
      dpi: '1234567890123',
      fechaNacimiento: '2000-01-01',
    }),
    ...overrides,
  };
}

export function makePasswordService(
  defaultVerification = true,
): jest.Mocked<PasswordService> {
  return {
    hash: jest.fn(async (plain: string) => `hash:${plain}`),
    verify: jest.fn(async (_plain: string, _hash: string) => defaultVerification),
  } as unknown as jest.Mocked<PasswordService>;
}

export function makeTokenService(): jest.Mocked<TokenService> {
  return {
    signAccessToken: jest.fn(async (_payload: { sub: string; email: string; roles: string[]; sessionId: string }) => ({
      token: 'access-token',
      expiresAt: new Date('2026-08-26T01:00:00.000Z'),
    })),
    verifyAccessToken: jest.fn(async (_token: string) => {
      throw new Error('not configured');
    }),
    generateRandomToken: jest.fn(() => 'generated-token'),
  } as unknown as jest.Mocked<TokenService>;
}

export function makeUserRepository(): jest.Mocked<UserRepository> {
  return {
    save: jest.fn(async (user: User) => user),
    findByEmail: jest.fn(async (_email: string) => null),
    findById: jest.fn(async (_userId: string) => null),
    findByCarnet: jest.fn(async (_carnet: string) => null),
    findByDpi: jest.fn(async (_dpi: string) => null),
    findByRoles: jest.fn(async (_roles: Role[], _incluirInactivos?: boolean) => []),
    addRole: jest.fn(async (userId: string, role: Role) => makeUser({ userId, roles: [role] })),
    removeRole: jest.fn(async (userId: string, role: Role) => makeUser({ userId, roles: [role] })),
    updatePassword: jest.fn(async (userId: string, passwordHash: string) => makeUser({ userId, passwordHash })),
    updateProfile: jest.fn(async (userId: string, _data) => makeUser({ userId })),
    desactivarUsuario: jest.fn(async (userId: string) => makeUser({ userId, activo: false })),
    reactivarUsuario: jest.fn(async (userId: string) => makeUser({ userId, activo: true })),
    markEmailVerified: jest.fn(async (userId: string) => makeUser({ userId, emailVerified: true })),
    linkOAuthProvider: jest.fn(async (userId: string, _provider: string) => makeUser({ userId, oauthProviders: ['institucional'] })),
    findByOAuthIdentity: jest.fn(async (_provider: string, _email: string) => null),
    crearSolicitudRol: jest.fn(async (usuarioId: string, rolSolicitado: Role) => ({
      solicitudId: 'sol-1',
      usuarioId,
      correo: 'estudiante@ingenieria.usac.edu.gt',
      nombres: 'Ada',
      apellidos: 'Lovelace',
      carnet: '20230001',
      rolSolicitado,
      estado: 'PENDIENTE' as const,
      fechaSolicitud: new Date(),
      fechaResolucion: null,
      resueltoPor: null,
    })),
    listarSolicitudesRol: jest.fn(async () => []),
    resolverSolicitudRol: jest.fn(async (_solicitudId: string, _aprobado: boolean, _resueltoPor: string) => {
      throw new Error('not configured');
    }),
  } as unknown as jest.Mocked<UserRepository>;
}

export function makeSessionRepository(): jest.Mocked<SessionRepository> {
  const sessions = new Map<string, Session>();
  return {
    save: jest.fn(async (session: Session) => {
      sessions.set(session.sessionId, session);
      return session;
    }),
    findById: jest.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
    findByUserId: jest.fn(async (userId: string) => [...sessions.values()].filter((s) => s.userId === userId)),
    revoke: jest.fn(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) return null;
      const revoked = { ...session, status: SessionStatus.REVOCADA, revokedAt: new Date() };
      sessions.set(sessionId, revoked);
      return revoked;
    }),
    revokeAllForUser: jest.fn(async (userId: string) => {
      let count = 0;
      for (const [sessionId, session] of sessions) {
        if (session.userId === userId && session.status === SessionStatus.ACTIVA) {
          sessions.set(sessionId, { ...session, status: SessionStatus.REVOCADA });
          count += 1;
        }
      }
      return count;
    }),
  };
}

export function makeVerificationTokenRepository(): jest.Mocked<VerificationTokenRepository> {
  const records = new Map<string, {
    token: string;
    userId: string;
    type: TokenType;
    state: TokenUsageState;
    expiresAt: Date;
    createdAt: Date;
    usedAt?: Date;
  }>();
  return {
    save: jest.fn(async (record) => {
      records.set(record.token, record);
      return record;
    }),
    findByToken: jest.fn(async (token) => records.get(token) ?? null),
    markUsed: jest.fn(async (token) => {
      const record = records.get(token);
      if (!record) return null;
      const used = { ...record, state: TokenUsageState.USADO, usedAt: new Date() };
      records.set(token, used);
      return used;
    }),
  };
}
