// server/edFactions.ts
//
// Normalisation du tableau "Factions" des événements journal FSDJump/Location d'Elite Dangerous.
// Vérifié le 30/07/2026 (schéma communautaire) : Docked NE contient PAS ce tableau (seulement un
// StationFaction, sans influence ni liste des autres factions) — contrairement à ce qu'on pensait
// au départ. Seuls FSDJump et Location le portent, c'est ce que le plugin EDMC écoute désormais.
//
// Le champ SquadronFaction (booléen) est fourni directement par Frontier dans le journal : pas
// besoin de configurer à la main quelle faction est celle de l'escadron, le jeu le dit — avec un
// repli manuel (Faction.isSquadronManual) si l'escadron n'a pas de faction Squadron liée en jeu.

export interface PublicFactionEntry {
  name: string;
  allegiance: string | null;
  government: string | null;
  influence: number;
  state: string;
  happiness: string | null;
  activeStates: unknown;
  recoveringStates: unknown;
  pendingStates: unknown;
  isSquadronFaction: boolean;
}

// Best-effort sur le tableau Factions du journal — une entrée sans Name/Influence exploitable est
// simplement ignorée, jamais de plantage.
export function parseFactions(raw: unknown): PublicFactionEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PublicFactionEntry[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const item = f as Record<string, unknown>;
    const name = typeof item.Name === 'string' && item.Name.trim() ? item.Name : null;
    const influence = typeof item.Influence === 'number' ? item.Influence : null;
    if (!name || influence === null) continue;
    out.push({
      name,
      allegiance: typeof item.Allegiance === 'string' ? item.Allegiance : null,
      government: typeof item.Government === 'string' ? item.Government : null,
      influence,
      state: typeof item.FactionState === 'string' && item.FactionState ? item.FactionState : 'None',
      happiness: typeof item.Happiness_Localised === 'string' ? item.Happiness_Localised
        : typeof item.Happiness === 'string' ? item.Happiness : null,
      activeStates: Array.isArray(item.ActiveStates) ? item.ActiveStates : null,
      recoveringStates: Array.isArray(item.RecoveringStates) ? item.RecoveringStates : null,
      pendingStates: Array.isArray(item.PendingStates) ? item.PendingStates : null,
      isSquadronFaction: item.SquadronFaction === true,
    });
  }
  return out.length > 0 ? out : null;
}

// Même normalisation côté EDSM (api-system-v1/factions), pour alimenter les mêmes snapshots
// quand aucun membre équipé du plugin n'est passé récemment dans le système. EDSM n'a pas
// d'équivalent à SquadronFaction — isSquadronFaction reste toujours false ici, sans conséquence
// puisque Faction.isSquadron n'est jamais rétrogradé une fois vrai (voir server/index.ts).
export function parseEdsmFactions(raw: unknown): PublicFactionEntry[] | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).factions)) return null;
  const out: PublicFactionEntry[] = [];
  for (const f of (raw as Record<string, unknown>).factions as unknown[]) {
    if (!f || typeof f !== 'object') continue;
    const item = f as Record<string, unknown>;
    const name = typeof item.name === 'string' && item.name.trim() ? item.name : null;
    const influence = typeof item.influence === 'number' ? item.influence : null;
    if (!name || influence === null) continue;
    out.push({
      name,
      allegiance: typeof item.allegiance === 'string' ? item.allegiance : null,
      government: typeof item.government === 'string' ? item.government : null,
      influence,
      state: typeof item.state === 'string' && item.state ? item.state : 'None',
      happiness: typeof item.happiness === 'string' ? item.happiness : null,
      activeStates: Array.isArray(item.activeStates) ? item.activeStates : null,
      recoveringStates: Array.isArray(item.recoveringStates) ? item.recoveringStates : null,
      pendingStates: Array.isArray(item.pendingStates) ? item.pendingStates : null,
      isSquadronFaction: false,
    });
  }
  return out.length > 0 ? out : null;
}

export function edsmControllingFactionName(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const cf = (raw as Record<string, unknown>).controllingFaction;
  if (!cf || typeof cf !== 'object') return null;
  const name = (cf as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim() ? name : null;
}
