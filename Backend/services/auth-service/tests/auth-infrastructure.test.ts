import { BcryptPasswordService } from '../src/infrastructure/auth/bcrypt-password-service';
import { JwtTokenService } from '../src/infrastructure/auth/jwt-token-service';
import { MockOAuthProvider } from '../src/infrastructure/oauth/mock-oauth-provider';
import { Role } from '../src/domain/enums/role';

describe('adaptadores de seguridad y OAuth', () => {
  test('hash de contraseña no permite recuperar el texto y verifica correctamente', async () => {
    const password = new BcryptPasswordService();
    const hash = await password.hash('secreto-unitario');
    await expect(password.verify('secreto-unitario', hash)).resolves.toBe(true);
    await expect(password.verify('otro-secreto', hash)).resolves.toBe(false);
    expect(hash).not.toBe('secreto-unitario');
  });

  test('firma y verifica JWT con issuer/audience, y clasifica tokens inválidos/expirados', async () => {
    const tokens = new JwtTokenService({
      secret: 'unit-test-secret-with-16-chars',
      expiresIn: '10m',
      issuer: 'issuer-test',
      audience: 'audience-test',
    });
    const signed = await tokens.signAccessToken({
      sub: 'user-1', email: 'u@ing.usac.edu.gt', roles: [Role.ESTUDIANTE], sessionId: 'session-1',
    });
    await expect(tokens.verifyAccessToken(signed.token)).resolves.toMatchObject({
      sub: 'user-1', email: 'u@ing.usac.edu.gt', roles: [Role.ESTUDIANTE], sessionId: 'session-1',
    });
    await expect(tokens.verifyAccessToken('not-a-jwt')).rejects.toMatchObject({ code: 'SESION_INVALIDA' });

    const expired = new JwtTokenService({
      secret: 'unit-test-secret-with-16-chars', expiresIn: '-1s', issuer: 'issuer-test', audience: 'audience-test',
    });
    const expiredToken = await expired.signAccessToken({ sub: 'u', email: 'u@ing.usac.edu.gt', roles: [], sessionId: 's' });
    await expect(expired.verifyAccessToken(expiredToken.token)).rejects.toMatchObject({ code: 'SESION_EXPIRADA' });
  });

  test('consume códigos OAuth una sola vez y rechaza códigos desconocidos', async () => {
    const oauth = new MockOAuthProvider('https://issuer.test');
    expect(oauth.issuerUrl).toBe('https://issuer.test');
    const code = oauth.authorize('persona@ing.usac.edu.gt', [Role.ESTUDIANTE]);
    await expect(oauth.exchangeCode(code)).resolves.toMatchObject({
      email: 'persona@ing.usac.edu.gt', emailVerified: true,
    });
    await expect(oauth.exchangeCode(code)).rejects.toMatchObject({ code: 'TOKEN_INVALIDO' });
    expect(() => oauth.exchange('missing')).toThrow(expect.objectContaining({ code: 'TOKEN_INVALIDO' }));
  });
});
