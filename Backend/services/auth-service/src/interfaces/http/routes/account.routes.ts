import { Router } from 'express';
import { container } from '../../../container';
import {
  changePasswordSchema,
  confirmResetSchema,
  requestResetSchema,
} from '../../../application/dto/auth-schemas';
import { createAuthenticate } from '../middleware/authenticate';

const router = Router();
const account = container.accountService;
const authenticate = createAuthenticate(container);

/** Emite token VERIFICACION_CORREO (dispara notificación en producción). */
router.post('/verify-email', authenticate, async (req, res, next) => {
  try {
    const { token } = await account.requestEmailVerification(req.auth!.email);
    res.json({ message: 'Token de verificación generado', token });
  } catch (err) {
    next(err);
  }
});

/** Confirma un token VERIFICACION_CORREO. */
router.post('/verify-email/confirm', async (req, res, next) => {
  try {
    const { token } = req.body as { token: string };
    await account.confirmEmailVerification(token);
    res.json({ message: 'Correo verificado correctamente' });
  } catch (err) {
    next(err);
  }
});

/** sp_solicitar_reset_password. */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = requestResetSchema.parse(req.body);
    const { token } = await account.requestPasswordReset(email);
    res.json({ message: 'Si el correo existe, recibirás un enlace para restablecer', token });
  } catch (err) {
    next(err);
  }
});

/** sp_confirmar_verificacion (RESET_PASSWORD) + actualiza credenciales. */
router.post('/reset-password/confirm', async (req, res, next) => {
  try {
    const { token, newPassword } = confirmResetSchema.parse(req.body);
    await account.confirmPasswordReset(token, newPassword);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
});

/** sp_cambiar_password (trg_auditoria_password en BD). */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await account.changePassword(req.auth!.userId, currentPassword, newPassword);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
});

export default router;
