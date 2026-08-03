import { VerificationToken } from '../../domain/entities/verification-token';
import { TokenType, TokenUsageState } from '../../domain/enums/auth';
import { DomainError } from '../../domain/errors/domain-error';
import { UserRepository } from '../ports/user-repository';
import { VerificationTokenRepository } from '../ports/verification-token-repository';
import { PasswordService, TokenService } from '../ports/token-service';
import { EmailDomainValidator } from '../../domain/services/email-domain-validator';

export class AccountService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: VerificationTokenRepository,
    private readonly password: PasswordService,
    private readonly tokenService: TokenService,
    private readonly domainValidator: EmailDomainValidator,
  ) {}

  async requestEmailVerification(email: string): Promise<{ token: string }> {
    const normalized = this.domainValidator.validate(email);
    const user = await this.users.findByEmail(normalized);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    const token = await this.issueToken(user.userId, TokenType.VERIFICACION_CORREO);
    return { token };
  }

  async confirmEmailVerification(token: string): Promise<void> {
    const record = await this.consumeToken(token, TokenType.VERIFICACION_CORREO);
    await this.users.markEmailVerified(record.userId);
  }

  async requestPasswordReset(email: string): Promise<{ token: string }> {
    const normalized = this.domainValidator.validate(email);
    const user = await this.users.findByEmail(normalized);
    if (!user) {
      return { token: this.tokenService.generateRandomToken() };
    }
    const token = await this.issueToken(user.userId, TokenType.RESET_PASSWORD);
    return { token };
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const record = await this.consumeToken(token, TokenType.RESET_PASSWORD);
    const passwordHash = await this.password.hash(newPassword);
    await this.users.updatePassword(record.userId, passwordHash);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    const valid = await this.password.verify(currentPassword, user.passwordHash);
    if (!valid) {
      throw new DomainError('CREDENCIALES_INVALIDAS', 'La contraseña actual no es correcta', 401);
    }
    const passwordHash = await this.password.hash(newPassword);
    await this.users.updatePassword(userId, passwordHash);
  }

  private async issueToken(userId: string, type: TokenType): Promise<string> {
    const token = this.tokenService.generateRandomToken();
    const record: VerificationToken = {
      token,
      userId,
      type,
      state: TokenUsageState.PENDIENTE,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      createdAt: new Date(),
    };
    await this.tokens.save(record);
    return token;
  }

  private async consumeToken(
    token: string,
    type: TokenType,
  ): Promise<VerificationToken> {
    const record = await this.tokens.findByToken(token);
    if (!record || record.type !== type) {
      throw new DomainError('TOKEN_INVALIDO', 'Token inválido', 400);
    }
    if (record.state === TokenUsageState.USADO) {
      throw new DomainError('TOKEN_INVALIDO', 'El token ya fue utilizado', 400);
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new DomainError('TOKEN_EXPIRADO', 'El token ha expirado', 400);
    }
    await this.tokens.markUsed(token);
    return record;
  }
}
