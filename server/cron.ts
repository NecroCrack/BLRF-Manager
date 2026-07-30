// server/cron.ts
import cron from 'node-cron';
import type { PrismaClient } from '../generated/prisma/client';
import { decrypt } from './crypto';
import { fetchInaraProfile } from './inara';

const THROTTLE_MS = 5000; // quelques secondes entre chaque membre, jamais en parallèle

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runInaraSync(prisma: PrismaClient): Promise<void> {
  const targets = await prisma.externalSync.findMany({
    where: { inaraToken: { not: null }, inaraCommanderName: { not: null } },
  });

  console.log(`[Inara Sync] ${targets.length} membre(s) à synchroniser.`);

  // Séquentiel et volontairement throttlé : jamais Promise.all, pour respecter le rythme
  // de requêtes qu'impose un usage raisonnable de l'API Inara.
  for (const sync of targets) {
    try {
      const apiKey = decrypt(sync.inaraToken!);
      const profile = await fetchInaraProfile(apiKey, sync.inaraCommanderName!);

      if (profile) {
        await prisma.member.update({
          where: { id: sync.memberId },
          data: {
            combats: profile.combatRank,
            explorations: profile.explorationRank,
            commerce: profile.tradeRank,
          },
        });
      }

      await prisma.externalSync.update({
        where: { id: sync.id },
        data: { inaraLastSyncAt: new Date(), inaraLastSyncOk: profile !== null },
      });
    } catch (err) {
      // Mode dégradé : un échec (déchiffrement, API, DB) ne doit jamais interrompre la boucle.
      console.error(`[Inara Sync] Échec pour memberId=${sync.memberId}:`, err);
      await prisma.externalSync.update({
        where: { id: sync.id },
        data: { inaraLastSyncAt: new Date(), inaraLastSyncOk: false },
      }).catch(() => {});
    }

    await sleep(THROTTLE_MS);
  }
}

export function startInaraSyncCron(prisma: PrismaClient): void {
  // Toutes les 12h (à 00:00 et 12:00).
  cron.schedule('0 0,12 * * *', () => {
    runInaraSync(prisma).catch(err => console.error('[Inara Sync] Erreur inattendue:', err));
  });
}
