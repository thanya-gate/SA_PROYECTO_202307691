import { randomUUID } from 'crypto';
import { createUser, User } from '../../domain/entities/user';
import { Session } from '../../domain/entities/session';
import { Role } from '../../domain/enums/role';
import { EmailDomainValidator } from '../../domain/services/email-domain-validator';
import { DomainError } from '../../domain/errors/domain-error';
import { UserRepository } from '../ports/user-repository';
import { PasswordService, TokenService } from '../ports/token-service';
import { SessionService } from './session.service';
import { LoginInput, RegisterInput } from '../dto/auth-schemas';

export interface LoginResult {
  user: User;
  session: Session;
  accessToken: string;
  expiresAt: Date;
}

export interface OAuthProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  roles?: Role[];
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly domainValidator: EmailDomainValidator,
    private readonly sessionTtlMs: number,
  ) {}

  async register(
    input: RegisterInput,
    meta: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const email = this.domainValidator.validate(input.email);

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new DomainError(
        'CORREO_YA_REGISTRADO',
        'Ya existe una cuenta con este correo',
        409,
      );
    }

    const rol = input.rol ?? Role.ESTUDIANTE;
    const carnet = rol === Role.ESTUDIANTE ? input.carnet.trim() : '';
    const dpi = input.dpi.trim();

    // Registro público de docentes: la cuenta se crea sin roles hasta que el
    // administrador autorice la solicitud de CATEDRATICO. Al aprobar, se le
    // otorga únicamente el rol CATEDRATICO.
    const requiereAutorizacion = input.requiereAutorizacion === true && rol === Role.CATEDRATICO;
    const rolesIniciales = requiereAutorizacion ? [] : [rol];

    if (carnet && (await this.users.findByCarnet(carnet))) {
      throw new DomainError('CARNET_YA_REGISTRADO', 'Este carnet ya está registrado', 409);
    }
    if (await this.users.findByDpi(dpi)) {
      throw new DomainError('DPI_YA_REGISTRADO', 'Este DPI ya está registrado', 409);
    }

    const passwordHash = await this.password.hash(input.password);
    const user = createUser({
      userId: randomUUID(),
      email,
      passwordHash,
      carnet: carnet || null,
      dpi,
      fechaNacimiento: input.fechaNacimiento,
      roles: rolesIniciales,
    });

    await this.users.save(user);

    if (requiereAutorizacion) {
      await this.users.crearSolicitudRol(user.userId, Role.CATEDRATICO);
    }

    return this.establishSession(user, meta);
  }

  async login(
    input: LoginInput,
    meta: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const email = this.domainValidator.validate(input.email);

    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new DomainError(
        'CREDENCIALES_INVALIDAS',
        'Credenciales incorrectas',
        401,
      );
    }
    if (user.activo === false) {
      throw new DomainError('CUENTA_INACTIVA', 'La cuenta está desactivada', 403);
    }

    const valid = await this.password.verify(input.password, user.passwordHash);
    if (!valid) {
      throw new DomainError(
        'CREDENCIALES_INVALIDAS',
        'Credenciales incorrectas',
        401,
      );
    }

    return this.establishSession(user, meta);
  }

  /**
   * Verifica credenciales contra el directorio sin crear una sesión.
   * Lo consume el proveedor de identidad institucional (IdP) para autenticar
   * al usuario como lo haría un IdP real (p. ej. Google Workspace / Entra ID):
   * la cuenta debe existir y la contraseña debe coincidir. Nunca revela cuál
   * de las dos falló.
   */
  async validateCredentials(email: string, password: string): Promise<User> {
    const normalizedEmail = this.domainValidator.validate(email);

    const user = await this.users.findByEmail(normalizedEmail);
    if (!user) {
      throw new DomainError(
        'CREDENCIALES_INVALIDAS',
        'Credenciales incorrectas',
        401,
      );
    }
    if (user.activo === false) {
      throw new DomainError('CUENTA_INACTIVA', 'La cuenta está desactivada', 403);
    }

    const valid = await this.password.verify(password, user.passwordHash);
    if (!valid) {
      throw new DomainError(
        'CREDENCIALES_INVALIDAS',
        'Credenciales incorrectas',
        401,
      );
    }

    return user;
  }

  async loginWithOAuth(
    profile: OAuthProfile,
    meta: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const email = this.domainValidator.validate(profile.email);

    let user = await this.users.findByEmail(email);

    if (!user) {
      const passwordHash = await this.password.hash(randomUUID());
      user = createUser({
        userId: randomUUID(),
        email,
        passwordHash,
        emailVerified: profile.emailVerified,
        roles: profile.roles,
      });
      await this.users.save(user);
      await this.users.linkOAuthProvider(user.userId, 'institucional');
    } else {
      const hasProvider = user.oauthProviders.includes('institucional');
      if (!hasProvider) {
        await this.users.linkOAuthProvider(user.userId, 'institucional');
      }
    }

    return this.establishSession(user, meta);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const validated = await this.sessions.validate(sessionId);
    if (!validated) return null;
    return this.users.findById(validated.user.userId);
  }

  private async establishSession(
    user: User,
    meta: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const session = await this.sessions.create({
      userId: user.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      ttlMs: this.sessionTtlMs,
    });

    const { token, expiresAt } = await this.tokens.signAccessToken({
      sub: user.userId,
      email: user.email,
      roles: user.roles,
      sessionId: session.sessionId,
    });

    return { user, session, accessToken: token, expiresAt };
  }
}
