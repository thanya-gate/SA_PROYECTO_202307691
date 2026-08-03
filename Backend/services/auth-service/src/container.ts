import { config } from './config/env';
import { EmailDomainValidator } from './domain/services/email-domain-validator';
import { InMemoryUserRepository } from './infrastructure/persistence/memory/in-memory-user-repository';
import { InMemorySessionRepository } from './infrastructure/persistence/memory/in-memory-session-repository';
import { InMemoryVerificationTokenRepository } from './infrastructure/persistence/memory/in-memory-verification-token-repository';
import { PostgresUserRepository } from './infrastructure/persistence/postgres/postgres-user-repository';
import { PostgresSessionRepository } from './infrastructure/persistence/postgres/postgres-session-repository';
import { PostgresVerificationTokenRepository } from './infrastructure/persistence/postgres/postgres-verification-token-repository';
import { JwtTokenService } from './infrastructure/auth/jwt-token-service';
import { BcryptPasswordService } from './infrastructure/auth/bcrypt-password-service';
import { MockOAuthProvider } from './infrastructure/oauth/mock-oauth-provider';
import { UserRepository } from './application/ports/user-repository';
import { SessionRepository } from './application/ports/session-repository';
import { VerificationTokenRepository } from './application/ports/verification-token-repository';
import { TokenService, PasswordService } from './application/ports/token-service';
import { SessionService } from './application/services/session.service';
import { AuthService } from './application/services/auth.service';
import { ProfileService } from './application/services/profile.service';
import { AccountService } from './application/services/account.service';


export class Container {
  readonly userRepository: UserRepository;
  readonly sessionRepository: SessionRepository;
  readonly verificationTokenRepository: VerificationTokenRepository;
  readonly tokenService: TokenService;
  readonly passwordService: PasswordService;
  readonly domainValidator: EmailDomainValidator;
  readonly oauthProvider: MockOAuthProvider;

  readonly sessionService: SessionService;
  readonly authService: AuthService;
  readonly profileService: ProfileService;
  readonly accountService: AccountService;

  constructor() {
    const usePostgres = config.DATABASE_URL.trim().length > 0;

    this.userRepository = usePostgres
      ? new PostgresUserRepository()
      : new InMemoryUserRepository();
    this.sessionRepository = usePostgres
      ? new PostgresSessionRepository()
      : new InMemorySessionRepository();
    this.verificationTokenRepository = usePostgres
      ? new PostgresVerificationTokenRepository()
      : new InMemoryVerificationTokenRepository();

    this.tokenService = new JwtTokenService({
      secret: config.JWT_SECRET,
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });
    this.passwordService = new BcryptPasswordService();
    this.domainValidator = new EmailDomainValidator(config.ALLOWED_EMAIL_DOMAINS);
    this.oauthProvider = new MockOAuthProvider(config.OAUTH_MOCK_ISSUER);

    this.sessionService = new SessionService(this.sessionRepository);
    this.authService = new AuthService(
      this.userRepository,
      this.sessionService,
      this.passwordService,
      this.tokenService,
      this.domainValidator,
      config.SESSION_TTL_MS,
    );
    this.profileService = new ProfileService(this.userRepository, this.sessionService);
    this.accountService = new AccountService(
      this.userRepository,
      this.verificationTokenRepository,
      this.passwordService,
      this.tokenService,
      this.domainValidator,
    );
  }
}

export const container = new Container();
