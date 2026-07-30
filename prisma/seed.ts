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

  // Idempotence basée sur "un membre existe déjà", pas sur un matricule figé : BLRF-001 a été
  // renommé en BLRF-143 lors de la refonte des rôles, et comme preDeployCommand relance ce seed
  // à CHAQUE déploiement (pas seulement au premier), chercher BLRF-001 littéralement ne retrouvait
  // plus rien après ce renommage → le seed retombait dans le chemin "création initiale" et
  // plantait plus loin. Voir aussi le rôle protégé ci-dessous, même raisonnement.
  const anyMember = await prisma.member.findFirst();
  if (anyMember) {
    console.log('[SEED] Des membres existent déjà — aucun changement.');
    return;
  }

  // Rôle protégé (garanti unique et indestructible, voir schema.prisma) — peu importe son nom
  // actuel : il a été renommé COMMANDANT -> Ingénieur par le CO depuis Rôles & Permissions.
  // Chercher par nom figé cassait pour la même raison que ci-dessus ; le flag "protege" est
  // l'identifiant stable voulu par le schéma, jamais rebaptisable.
  const commandantRole = await prisma.role.findFirstOrThrow({ where: { protege: true } });

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
