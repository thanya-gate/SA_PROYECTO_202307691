import { Role } from '../../domain/enums/role';
import { DomainError } from '../../domain/errors/domain-error';
import { UserRepository } from '../ports/user-repository';
import { SolicitudEstado, SolicitudRol } from '../../domain/entities/solicitud-rol';

/**
 * Casos de uso de solicitudes de rol.
 * Un usuario solicita ser catedrático o auxiliar y el administrador la resuelve.
 * Al aprobar, el repositorio otorga el rol de forma atómica (sp_resolver_solicitud_rol).
 */
export class SolicitudService {
  constructor(private readonly users: UserRepository) {}

  async crearSolicitud(usuarioId: string, rolSolicitado: Role): Promise<SolicitudRol> {
    if (rolSolicitado !== Role.CATEDRATICO && rolSolicitado !== Role.AUXILIAR) {
      throw new DomainError('ROL_INVALIDO', 'Solo se puede solicitar el rol CATEDRATICO o AUXILIAR', 400);
    }
    const user = await this.users.findById(usuarioId);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    return this.users.crearSolicitudRol(usuarioId, rolSolicitado);
  }

  async listarSolicitudes(estado?: SolicitudEstado, usuarioId?: string): Promise<SolicitudRol[]> {
    return this.users.listarSolicitudesRol(estado, usuarioId);
  }

  async resolverSolicitud(
    solicitudId: string,
    aprobado: boolean,
    resueltoPor: string,
  ): Promise<SolicitudRol> {
    if (!solicitudId) {
      throw new DomainError('ENTRADA_INVALIDA', 'solicitudId es obligatorio', 400);
    }
    return this.users.resolverSolicitudRol(solicitudId, aprobado, resueltoPor);
  }
}
