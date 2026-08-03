import { randomUUID } from 'crypto';
import { createUser } from './domain/entities/user';
import { Role } from './domain/enums/role';
import { Container } from './container';


const SEED_USERS: Array<{
  email: string;
  password: string;
  roles: Role[];
}> = [
  {
    email: 'admin@ing.usac.edu.gt',
    password: 'AdminUsac2026!',
    roles: [Role.ADMIN],
  },
  {
    email: 'catedratico@ing.usac.edu.gt',
    password: 'Catedratico2026!',
    roles: [Role.CATEDRATICO],
  },
  {
    email: 'auxiliar@ing.usac.edu.gt',
    password: 'Auxiliar2026!',
    roles: [Role.AUXILIAR],
  },
  {
    email: 'estudiante@ingenieria.usac.edu.gt',
    password: 'Estudiante2026!',
    roles: [Role.ESTUDIANTE],
  },
  // multiperfil REVISAR
  {
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
        userId: randomUUID(),
        email: seed.email,
        passwordHash,
        emailVerified: true,
        roles: seed.roles,
      }),
    );
  }
}
