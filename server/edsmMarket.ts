// server/edsmMarket.ts
//
// Recherche de marché EDSM pour la logistique de colonisation (voir Colonisation.tsx). Spansh
// aurait été plus riche (prix/dispo dédiés par produit) mais sa recherche de station est un
// moteur de filtres interne (Ember.js, recherche sauvegardée par GUID) sans format documenté —
// vérifié le 30/07/2026 en inspectant leur bundle JS, abandonné faute de format fiable. EDSM a
// une API publique documentée et déjà intégrée dans ce projet (voir lookupEdsmSystem).
//
// Bornage volontaire du coût en requêtes EDSM (quota partagé de 300/h, voir consumeEdsmQuota
// dans server/index.ts, déjà sollicité en continu par la localisation automatique et les recherches
// de système) : au plus 1 + MAX_STATIONS_CHECKED appels par vérification. Ce n'est donc PAS une
// recherche galactique comme Spansh — seulement "ce système que vous connaissez a-t-il ce qu'il
// faut ?", jamais "où est la station la plus proche dans toute la bulle ?".

const MAX_STATIONS_CHECKED = 8;

interface EdsmStationRaw {
  marketId?: number;
  name?: string;
  distanceToArrival?: number;
  haveMarket?: boolean;
}

export interface CommodityMatch {
  stationName: string;
  marketId: number;
  distanceToArrival: number;
  buyPrice: number;
  stock: number;
}

export interface CheckSystemResult {
  systemName: string;
  matches: Record<string, CommodityMatch[]>; // clé = le "name" interne de PublicColonisationResource
  stationsChecked: number;
  // true si le quota EDSM partagé a coupé la vérification avant d'avoir passé toutes les stations
  // du système — jamais une erreur, juste un résultat potentiellement incomplet.
  partial: boolean;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Best-effort : réseau ou format EDSM inattendu -> null (jamais de throw), sauf EDSM_RATE_LIMIT
// qui est levée volontairement pour laisser l'appelant répondre un 429 explicite comme partout
// ailleurs dans ce projet pour les appels EDSM.
export async function checkSystemForResources(
  systemName: string,
  resourceNames: string[],
  consumeEdsmQuota: () => boolean,
): Promise<CheckSystemResult | null> {
  if (!consumeEdsmQuota()) throw new Error('EDSM_RATE_LIMIT');

  const stationsRes = await fetch(`https://www.edsm.net/api-system-v1/stations?systemName=${encodeURIComponent(systemName)}`);
  if (!stationsRes.ok) return null;
  const stationsData = await stationsRes.json();
  if (!stationsData || !Array.isArray(stationsData.stations)) return null;

  const withMarket = (stationsData.stations as EdsmStationRaw[])
    .filter((s): s is Required<EdsmStationRaw> => !!s.haveMarket && typeof s.marketId === 'number' && typeof s.name === 'string')
    .sort((a, b) => (a.distanceToArrival ?? 0) - (b.distanceToArrival ?? 0))
    .slice(0, MAX_STATIONS_CHECKED);

  const wantedByKey = new Map(resourceNames.map(n => [normalizeKey(n), n]));
  const matches: Record<string, CommodityMatch[]> = {};
  let stationsChecked = 0;
  let partial = false;

  for (const station of withMarket) {
    if (!consumeEdsmQuota()) { partial = true; break; }
    stationsChecked++;
    try {
      const marketRes = await fetch(
        `https://www.edsm.net/api-system-v1/stations/market?systemName=${encodeURIComponent(systemName)}&marketId=${station.marketId}`,
      );
      if (!marketRes.ok) continue;
      const marketData = await marketRes.json();
      if (!Array.isArray(marketData?.commodities)) continue;
      for (const c of marketData.commodities) {
        if (!c || typeof c.id !== 'string') continue;
        const original = wantedByKey.get(normalizeKey(c.id));
        if (!original) continue;
        if (typeof c.buyPrice !== 'number' || c.buyPrice <= 0 || typeof c.stock !== 'number' || c.stock <= 0) continue;
        (matches[original] ??= []).push({
          stationName: station.name,
          marketId: station.marketId,
          distanceToArrival: station.distanceToArrival ?? 0,
          buyPrice: c.buyPrice,
          stock: c.stock,
        });
      }
    } catch {
      // Une station injoignable/mal formée ne bloque pas les autres.
    }
  }

  for (const key of Object.keys(matches)) {
    matches[key]!.sort((a, b) => a.buyPrice - b.buyPrice);
  }

  return {
    systemName: typeof stationsData.name === 'string' ? stationsData.name : systemName,
    matches,
    stationsChecked,
    partial,
  };
}
