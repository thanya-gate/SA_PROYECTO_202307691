/**
 * Roles del sistema (RF-06 - RBAC).
 * Un usuario puede tener varios perfiles/roles simultáneamente (multiperfil).
 */
export enum Role {
  ESTUDIANTE = 'ESTUDIANTE',
  CATEDRATICO = 'CATEDRATICO',
  AUXILIAR = 'AUXILIAR',
  ADMIN = 'ADMIN',
}

export const DEFAULT_ROLE: Role = Role.ESTUDIANTE;

/**
 * Matriz RBAC: recurso -> acción -> roles permitidos.
 * Fuente: YoUSAC.md (RF-06). Cuando exista BD, esta matriz vive en
 * permiso_rbac y se evalúa con fn_tiene_permiso.
 */
export const RBAC_MATRIX: Record<string, Record<string, Role[]>> = {
  usuario: {
    leer: [Role.ESTUDIANTE, Role.CATEDRATICO, Role.AUXILIAR, Role.ADMIN],
    crear: [Role.ADMIN],
    actualizar_rol: [Role.ADMIN],
  },
  rol: {
    gestionar: [Role.ADMIN],
  },
  curso: {
    leer: [Role.ESTUDIANTE, Role.CATEDRATICO, Role.AUXILIAR, Role.ADMIN],
    inscribir: [Role.ESTUDIANTE],
    asignar: [Role.ADMIN],
  },
  catalogo: {
    leer: [Role.ESTUDIANTE, Role.CATEDRATICO, Role.AUXILIAR, Role.ADMIN],
    publicar: [Role.ADMIN, Role.CATEDRATICO],
  },
  analitica: {
    leer: [Role.ESTUDIANTE, Role.ADMIN],
  },
  reproduccion: {
    reproducir: [Role.ESTUDIANTE],
  },
  sesion: {
    cerrar: [Role.ESTUDIANTE, Role.CATEDRATICO, Role.AUXILIAR, Role.ADMIN],
  },
};

export function rolesPermiten(
  roles: Role[],
  resource: string,
  action: string,
): boolean {
  const permitidos = RBAC_MATRIX[resource]?.[action];
  if (!permitidos) return false;
  return roles.some((r) => permitidos.includes(r));
}
