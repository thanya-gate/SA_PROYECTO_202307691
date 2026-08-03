import bcrypt from 'bcryptjs';
import { PasswordService } from '../../application/ports/token-service';

const SALT_ROUNDS = 12;

/** Hashing de contraseñas con bcrypt (nunca texto plano, RNF-05). */
export class BcryptPasswordService implements PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
