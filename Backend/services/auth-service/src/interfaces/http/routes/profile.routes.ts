import { Router } from 'express';
import { container } from '../../../container';
import { assignRoleSchema, checkPermissionSchema } from '../../../application/dto/auth-schemas';
import { Role } from '../../../domain/enums/role';
import { createAuthenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();
const profiles = container.profileService;
const authenticate = createAuthenticate(container);

/** Consulta los perfiles/roles activos del usuario autenticado (multiperfil). */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const view = await profiles.getProfiles(req.auth!.userId);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

/** CDU0002.4 - Admin asigna un rol adicional a un usuario (multiperfil). */
router.patch('/:userId/roles', authenticate, requireRole('usuario', 'actualizar_rol'), async (req, res, next) => {
  try {
    const { role } = assignRoleSchema.parse(req.body);
    const view = await profiles.assignRole(req.params.userId, role);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

/** Admin elimina un rol de un usuario. */
router.delete('/:userId/roles/:role', authenticate, requireRole('usuario', 'actualizar_rol'), async (req, res, next) => {
  try {
    const role = req.params.role as Role;
    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ error: { code: 'ROL_INVALIDO', message: 'Rol inválido' } });
    }
    const view = await profiles.removeRole(req.params.userId, role);
    return res.json(view);
  } catch (err) {
    return next(err);
  }
});

/** Cambio de perfil activo: revoca la sesión actual para re-emitir JWT con el rol elegido. */
router.post('/switch', authenticate, async (req, res, next) => {
  try {
    const { role } = assignRoleSchema.parse(req.body);
    await profiles.switchActiveProfile(req.auth!.userId, role, req.auth!.sessionId);
    res.status(200).json({
      message: 'Perfil cambiado. Inicia sesión de nuevo para obtener el nuevo token.',
      pendingRole: role,
    });
  } catch (err) {
    next(err);
  }
});

/** Evaluación de permisos RBAC para el usuario autenticado (CDU0002.3). */
router.post('/permission', authenticate, async (req, res, next) => {
  try {
    const { resource, action } = checkPermissionSchema.parse(req.body);
    const allowed = await profiles.checkPermission(req.auth!.userId, resource, action);
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

export default router;
