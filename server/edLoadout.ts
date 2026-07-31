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

// Best-effort sur le sous-objet "Engineering" d'un module de l'événement Loadout — absent si le
// module n'est pas ingénieré. Quality change à chaque réingénierie (même plan/grade) : l'inclure
// suffit à faire détecter tout changement d'ingénierie par la comparaison canonicalJson en aval,
// sans avoir à modéliser le tableau "Modifiers" complet.
function parseEngineering(raw: unknown): PublicLoadoutEngineering | null {
  if (!raw || typeof raw !== 'object') return null;
  const eng = raw as Record<string, unknown>;
  const blueprintName = typeof eng.BlueprintName === 'string' && eng.BlueprintName.trim() ? eng.BlueprintName : null;
  if (!blueprintName) return null;
  const experimentalLocalised = typeof eng.ExperimentalEffect_Localised === 'string' && eng.ExperimentalEffect_Localised.trim()
    ? eng.ExperimentalEffect_Localised
    : null;
  const experimentalRaw = typeof eng.ExperimentalEffect === 'string' && eng.ExperimentalEffect.trim() ? eng.ExperimentalEffect : null;
  return {
    blueprint: prettifyModuleItem(blueprintName),
    level: typeof eng.Level === 'number' ? eng.Level : 0,
    quality: typeof eng.Quality === 'number' ? eng.Quality : null,
    experimentalEffect: experimentalLocalised ?? (experimentalRaw ? prettifyModuleItem(experimentalRaw) : null),
  };
}

export interface PublicLoadoutEngineering {
  blueprint: string;
  level: number;
  quality: number | null;
  experimentalEffect: string | null;
}

export interface PublicLoadoutModule {
  slot: string;
  item: string;
  name: string;
  class: string | null;
  rating: string | null;
  on: boolean;
  priority: number | null;
  // Plan d'ingénierie appliqué (sous-objet "Engineering" du module dans l'événement Loadout).
  // null si le module n'est pas ingénieré. Inclus dans la comparaison canonicalJson côté appelant :
  // un changement de grade/qualité/effet expérimental doit repasser le build en "En attente".
  engineering: PublicLoadoutEngineering | null;
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
      engineering: parseEngineering(mod.Engineering),
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

export interface PublicColonisationResource {
  // Nom interne (ex. "aluminium") — sert de clé de correspondance avec les commodités EDSM lors
  // de la recherche de marché (voir /api/colonisation/:id/check-system).
  name: string;
  nameLocalised: string;
  required: number;
  provided: number;
}

// Best-effort sur le tableau ResourcesRequired de l'événement ColonisationConstructionDepot —
// jamais de plantage sur une entrée mal formée, elle est simplement ignorée.
export function parseResources(raw: unknown): PublicColonisationResource[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PublicColonisationResource[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const item = r as Record<string, unknown>;
    const name = typeof item.Name === 'string' && item.Name.trim() ? item.Name : null;
    if (!name) continue;
    out.push({
      name,
      nameLocalised: typeof item.Name_Localised === 'string' && item.Name_Localised.trim()
        ? item.Name_Localised
        : prettifyModuleItem(name),
      required: typeof item.RequiredAmount === 'number' ? item.RequiredAmount : 0,
      provided: typeof item.ProvidedAmount === 'number' ? item.ProvidedAmount : 0,
    });
  }
  return out.length > 0 ? out : null;
}
