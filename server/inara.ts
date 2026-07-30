// server/inara.ts
//
// Intégration API Inara (https://inara.cz/inapi/v1/), format "header" + "events".
//
// Validé contre l'API réelle (avec une vraie clé personnelle) le 30/07/2026 :
// - Le endpoint, la structure header/events et les noms de propriétés sont corrects
//   (Inara répond avec un eventStatus structuré, pas une erreur de parsing générique).
// - Requête bloquée à "This application has no access allowed." — confirmé par la doc
//   officielle Inara (section Dev guide) : l'app doit être whitelistée manuellement par
//   l'admin Inara avant de fonctionner, quelle que soit la clé utilisée. Démarche humaine,
//   pas un bug de ce fichier. Voir le message à envoyer à l'admin Inara (nom d'app, ce
//   qu'elle fait, description courte, URL) dans les notes de la Phase 4 du guide.
//
// Le format exact de la réponse de "getCommanderProfile" (notamment la forme de
// "commanderRanksPilot") n'est pas garanti à 100% : la documentation fournie ne comprend
// pas les exemples JSON de sortie. Le parsing reste donc défensif — toute déviation doit
// aboutir à un échec propre (null), jamais à un throw non catché.


const INARA_ENDPOINT = 'https://inara.cz/inapi/v1/';
const APP_NAME = 'BLRF Squadron Manager';
const APP_VERSION = '1.0.0';

export interface InaraProfileStats {
  combatRank: number;
  explorationRank: number;
  tradeRank: number;
}

interface InaraRank {
  rankName?: string;
  rankValue?: number;
}

function extractRank(ranks: InaraRank[] | undefined, name: string): number {
  const found = ranks?.find(r => r.rankName?.toLowerCase() === name.toLowerCase());
  return typeof found?.rankValue === 'number' ? found.rankValue : 0;
}

// Ne lance jamais d'exception : toute erreur (réseau, whitelisting, format inattendu) → null.
export async function fetchInaraProfile(apiKey: string, commanderName: string): Promise<InaraProfileStats | null> {
  try {
    const res = await fetch(INARA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        header: {
          appName: APP_NAME,
          appVersion: APP_VERSION,
          isBeingDeveloped: true,
          APIkey: apiKey,
          commanderName,
        },
        events: [
          {
            eventName: 'getCommanderProfile',
            eventTimestamp: new Date().toISOString(),
            eventData: { searchName: commanderName },
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const event = data?.events?.[0];
    // eventStatus 200 = succès selon la doc Inara ; tout le reste est traité comme un échec.
    if (!event || event.eventStatus !== 200) return null;

    const ranks: InaraRank[] | undefined = event.eventData?.commanderRanksPilot;
    return {
      combatRank: extractRank(ranks, 'combat'),
      explorationRank: extractRank(ranks, 'explore'), // nom canonique Inara : "explore", pas "exploration"
      tradeRank: extractRank(ranks, 'trade'),
    };
  } catch {
    return null;
  }
}
