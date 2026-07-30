// server/edLoadout.ts
//
// Normalisation de l'événement journal "Loadout" d'Elite Dangerous (le même format que le
// standard communautaire SLEF, calqué dessus) — utilisé à la fois par le plugin EDMC (push
// automatique) et par l'import manuel (coller un JSON exporté depuis Coriolis/EDSY) dans
// l'onglet Builds. Les deux passent par le même parseur/normalisateur ci-dessous.
//
// Tables de référence vendues statiquement depuis server/data/ (générées le 30/07/2026 à partir
// de https://github.com/EDCD/FDevIDs/blob/master/shipyard.csv et outfitting.csv — projet
// communautaire de référence, pas d'appel réseau à l'exécution). Toute clé absente retombe sur
// un affichage dégradé (jamais de plantage sur un vaisseau/module inconnu ou ajouté depuis).
import edShips from './data/ed-ships.json';
import edModules from './data/ed-modules.json';

const SHIP_NAMES: Record<string, string> = edShips;
const MODULE_INFO: Record<string, { name: string; class: string | null; rating: string | null; mount: string | null }> = edModules;

export function shipDisplayName(internalName: string): string {
  const known = SHIP_NAMES[internalName.toLowerCase()];
  if (known) return known;
  // Repli défensif : jamais bloquant pour un vaisseau pas encore répertorié (ex. sortie très récente).
  return internalName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function prettifyModuleItem(item: string): string {
  return item.replace(/^(int|hpt)_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export interface PublicLoadoutModule {
  slot: string;
  item: string;
  name: string;
  class: string | null;
  rating: string | null;
  on: boolean;
  priority: number | null;
}

// JSONB Postgres ne préserve pas l'ordre des clés d'un objet (contrairement à JSON.stringify sur
// une valeur JS fraîchement construite) — un JSON.stringify naïf entre une valeur relue en base
// et une valeur tout juste construite peut donc différer alors que le contenu est identique.
// Cette version canonique (clés triées) rend la comparaison fiable dans les deux sens.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface ParsedLoadout {
  shipInternalName: string;
  shipDisplayName: string;
  shipId: number | null;
  shipName: string | null;
  shipIdent: string | null;
  modules: PublicLoadoutModule[];
}

// Best-effort : accepte l'événement Loadout tel quel (plugin EDMC) ou un export SLEF collé à la
// main (même forme). Retourne null plutôt que de lever une exception sur un format inattendu —
// à l'appelant de répondre une erreur 400 propre.
export function parseLoadout(raw: unknown): ParsedLoadout | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const ship = obj.Ship;
  const modulesRaw = obj.Modules;
  if (typeof ship !== 'string' || !ship.trim() || !Array.isArray(modulesRaw)) return null;

  const modules: PublicLoadoutModule[] = [];
  for (const m of modulesRaw) {
    if (!m || typeof m !== 'object') continue;
    const mod = m as Record<string, unknown>;
    const item = typeof mod.Item === 'string' ? mod.Item : null;
    const slot = typeof mod.Slot === 'string' ? mod.Slot : null;
    if (!item || !slot) continue;
    const info = MODULE_INFO[item.toLowerCase()];
    modules.push({
      slot,
      item,
      name: info?.name ?? prettifyModuleItem(item),
      class: info?.class ?? null,
      rating: info?.rating ?? null,
      on: typeof mod.On === 'boolean' ? mod.On : true,
      priority: typeof mod.Priority === 'number' ? mod.Priority : null,
    });
  }

  return {
    shipInternalName: ship,
    shipDisplayName: shipDisplayName(ship),
    shipId: typeof obj.ShipID === 'number' ? obj.ShipID : null,
    shipName: typeof obj.ShipName === 'string' && obj.ShipName.trim() ? obj.ShipName : null,
    shipIdent: typeof obj.ShipIdent === 'string' && obj.ShipIdent.trim() ? obj.ShipIdent : null,
    modules,
  };
}
