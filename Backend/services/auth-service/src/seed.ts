import { createUser } from './domain/entities/user';
import { Role } from './domain/enums/role';
import { Container } from './container';

// IDs fijos de los usuarios demo: deben coincidir con los usados por el
// seed de inscripcion-service (estudiante ...0101, catedratico ...0201,
// auxiliar ...0301) para que el demo del panel de asignaciones funcione.
const SEED_USERS: Array<{
  userId: string;
  email: string;
  password: string;
  roles: Role[];
}> = [
  {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@ing.usac.edu.gt',
    password: 'AdminUsac2026!',
    roles: [Role.ADMIN],
  },
  {
    userId: '00000000-0000-0000-0000-000000000201',
    email: 'catedratico@ing.usac.edu.gt',
    password: 'Catedratico2026!',
    roles: [Role.CATEDRATICO],
  },
  {
    userId: '00000000-0000-0000-0000-000000000301',
    email: 'auxiliar@ing.usac.edu.gt',
    password: 'Auxiliar2026!',
    roles: [Role.ESTUDIANTE, Role.AUXILIAR],
  },
  {
    userId: '00000000-0000-0000-0000-000000000101',
    email: 'estudiante@ingenieria.usac.edu.gt',
    password: 'Estudiante2026!',
    roles: [Role.ESTUDIANTE],
  },
  // multiperfil REVISAR
  {
    userId: '00000000-0000-0000-0000-000000000401',
    email: 'multiperfil@ingenieria.usac.edu.gt',
    password: 'Multiperfil2026!',
    roles: [Role.ESTUDIANTE, Role.AUXILIAR],
  },
];

export async function seedDevData(c: Container): Promise<void> {
  for (const seed of SEED_USERS) {
    const existing = await c.userRepository.findByEmail(seed.email);
    if (existing) continue;
    const passwordHash = await c.passwordService.hash(seed.password);
    await c.userRepository.save(
      createUser({
        userId: seed.userId,
        email: seed.email,
        passwordHash,
        emailVerified: true,
        roles: seed.roles,
      }),
    );
  }
}
