import { TokenType, TokenUsageState } from '../enums/auth';

/**
 * Entidad Token de verificación.
 * Refleja la tabla `token_verificacion` del DER (VERIFICACION_CORREO / RESET_PASSWORD).
 */
export interface VerificationToken {
  token: string;
  userId: string;
  type: TokenType;
  state: TokenUsageState;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
}
