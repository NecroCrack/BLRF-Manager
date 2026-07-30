import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateStrongPassword } from '../server/passwords';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.squadron.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      nom: '1st Black Lotus Raider Fleet',
      tag: 'BLRF',
      description: "Escadron d'élite spécialisé en exploration, combat défensif et opérations logistiques dans la Bulle Humaine et au-delà.",
      fondation: '3303-08-15',
    },
  });

  const existing = await prisma.member.findUnique({ where: { matricule: 'BLRF-001' } });
  if (existing) {
    console.log('[SEED] BLRF-001 existe déjà — aucun changement (le mot de passe existant est conservé).');
    return;
  }

  // Rôle protégé seedé par la migration "dynamic_roles_permissions" — toujours présent.
  const commandantRole = await prisma.role.findUniqueOrThrow({ where: { name: 'COMMANDANT' } });

  // Généré à chaque exécution : jamais de mot de passe par défaut prévisible, jamais stocké en clair.
  const password = process.env.SEED_COMMANDANT_PASSWORD || generateStrongPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.member.create({
    data: {
      matricule: 'BLRF-001',
      pseudo: 'Vorthrak',
      passwordHash,
      roleId: commandantRole.id,
    },
  });

  console.log(`[SEED SUCCESS] Utilisateur créé ! Matricule : ${admin.matricule}`);
  console.log(`[SEED] Mot de passe (affiché une seule fois, non stocké) : ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
