"""
Plugin EDMC pour le BLRF Squadron Manager.

Pousse plusieurs choses vers le backend de l'escadron, via le jeton personnel
(généré dans l'app : Paramètres de compte > Plugin EDMC) :
  1. Le système actuel du commandant (localisation, onglet Membres)
  2. La progression des chantiers de colonisation (onglet Colonisation)
  3. La configuration du vaisseau actuel (onglet Vaisseaux)
  4. L'influence des factions locales du système (onglet Influence)

Reste volontairement minimal : aucune dépendance externe (urllib de la
bibliothèque standard uniquement), jamais bloquant pour le jeu — toute erreur
réseau ou de format est avalée et journalisée, jamais levée.

Installation : copier ce dossier tel quel dans le dossier "plugins" d'EDMC
(Fichier > Paramètres > Plugins > Ouvrir le dossier des plugins), puis
redémarrer EDMC. Configuration dans l'onglet du plugin : URL du serveur et
jeton (voir README.md de ce dossier).
"""

import json
import logging
import threading
import tkinter as tk
from typing import Optional
from urllib import request, error

# Widgets de préférences EDMC : indispensable d'utiliser myNotebook (pas tkinter brut) pour que
# l'onglet de configuration s'affiche et se thème correctement dans la fenêtre Paramètres — voir
# PLUGINS.md officiel. Cause réelle trouvée par un membre (log EDMC : plugin chargé mais
# get_prefs plantait) : le champ de saisie s'appelle EntryMenu dans ce module, pas Entry — confirmé
# en désassemblant le myNotebook.pyc réellement embarqué dans l'installation EDMC de ce membre
# (Frame/Label/EntryMenu existent, pas de classe "Entry" nue).
import myNotebook as nb
from config import appname, config

PLUGIN_NAME = "BLRF Squadron Manager"

# Logger standard EDMC (visible dans logs/EDMarketConnector.log, Fichier > Statut dans EDMC) —
# avant ce correctif, aucune erreur d'envoi n'était tracée nulle part malgré ce qu'affirmait ce
# docstring : un jeton invalide, un 403 ou une panne réseau échouaient de façon totalement
# silencieuse. Le code envoyé (401/403/404/429...) est loggé, jamais le jeton ni le contenu.
logger = logging.getLogger(f'{appname}.{PLUGIN_NAME}')

CFG_SERVER_URL = "blrf_server_url"
CFG_TOKEN = "blrf_api_token"

# Événements journal signalant un changement de système.
LOCATION_EVENTS = {"FSDJump", "Location", "CarrierJump"}

# Ces trois événements portent le tableau "Factions" (influence par faction locale) — vérifié le
# 30/07/2026 : Docked ne le contient PAS (juste un StationFaction sans influence). CarrierJump le
# porte aussi, au même titre que FSDJump/Location (schéma communautaire EDCD) — initialement
# oublié ici le 30/07/2026 alors que LOCATION_EVENTS l'incluait déjà, corrigé le 31/07/2026.
FACTION_EVENTS = {"FSDJump", "Location", "CarrierJump"}

# Nom d'événement journal pour la progression d'un chantier de colonisation.
# Format confirmé (schéma communautaire EDCD + forums Frontier, 30/07/2026) : l'événement
# ne contient QUE MarketID/ConstructionProgress/ConstructionComplete/ConstructionFailed/
# ResourcesRequired — ni StarSystem ni StationName ni StationType. Ces trois derniers sont
# donc lus depuis `state` (suivi en continu par EDMC via l'événement Docked), pas depuis
# l'entrée elle-même. L'extraction de la progression reste défensive malgré tout (jamais
# de plantage sur un champ manquant ou renommé si Frontier fait évoluer le format).
COLONISATION_EVENT = "ColonisationConstructionDepot"

server_url_var = None
token_var = None


def _server_url() -> str:
    return (config.get_str(CFG_SERVER_URL) or "").rstrip("/")


def _token() -> str:
    return config.get_str(CFG_TOKEN) or ""


def _post(path: str, payload: dict) -> None:
    """POST best-effort en arrière-plan : ne bloque jamais le thread EDMC,
    n'interrompt jamais la partie en cas d'échec réseau."""
    base = _server_url()
    token = _token()
    if not base or not token:
        return

    def _send():
        try:
            data = json.dumps(payload).encode("utf-8")
            req = request.Request(
                f"{base}{path}",
                data=data,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                },
            )
            request.urlopen(req, timeout=10)
        except error.HTTPError as e:
            # Jeton invalide (401), permission refusée (403), système introuvable (404), quota EDSM
            # dépassé (429)... Jamais bloquant pour le jeu, mais désormais visible dans le log EDMC
            # plutôt que totalement invisible — sans réessai automatique, comme avant ce correctif.
            logger.warning(f"Échec de l'envoi vers {path} : HTTP {e.code}")
        except error.URLError as e:
            logger.warning(f"Serveur BLRF injoignable pour {path} : {e.reason}")
        except Exception as e:
            logger.warning(f"Erreur inattendue lors de l'envoi vers {path} : {e}")

    threading.Thread(target=_send, daemon=True).start()


def _extract_progress_pct(entry: dict) -> Optional[float]:
    """Best-effort : le format exact de ConstructionProgress n'est pas garanti
    par ce plugin (jamais confirmé contre une vraie sortie de jeu). Renvoie None
    si aucun champ reconnu n'est trouvé plutôt que de deviner une valeur."""
    if "ConstructionProgress" in entry:
        try:
            value = float(entry["ConstructionProgress"])
            return value * 100 if value <= 1 else value
        except (TypeError, ValueError):
            return None
    resources = entry.get("ResourcesRequired")
    if isinstance(resources, list) and resources:
        try:
            provided = sum(r.get("ProvidedAmount", 0) for r in resources)
            required = sum(r.get("RequiredAmount", 0) for r in resources)
            return (provided / required * 100) if required else None
        except (TypeError, ZeroDivisionError):
            return None
    return None


def plugin_start3(plugin_dir: str) -> str:
    return PLUGIN_NAME


def plugin_prefs(parent, cmdr, is_beta):
    global server_url_var, token_var
    frame = nb.Frame(parent)

    nb.Label(frame, text="URL du serveur BLRF (ex. https://blrf-squadron-manager.onrender.com)").grid(row=0, column=0, sticky="w", padx=5, pady=(8, 2))
    server_url_var = tk.StringVar(value=config.get_str(CFG_SERVER_URL) or "")
    nb.EntryMenu(frame, textvariable=server_url_var, width=45).grid(row=1, column=0, sticky="we", padx=5)

    nb.Label(frame, text="Jeton personnel (Paramètres de compte > Plugin EDMC)").grid(row=2, column=0, sticky="w", padx=5, pady=(8, 2))
    token_var = tk.StringVar(value=config.get_str(CFG_TOKEN) or "")
    nb.EntryMenu(frame, textvariable=token_var, width=45, show="•").grid(row=3, column=0, sticky="we", padx=5, pady=(0, 8))

    return frame


def prefs_changed(cmdr, is_beta):
    if server_url_var is not None:
        config.set(CFG_SERVER_URL, server_url_var.get().strip())
    if token_var is not None:
        config.set(CFG_TOKEN, token_var.get().strip())


def journal_entry(cmdr, is_beta, system, station, entry, state):
    event = entry.get("event")

    if event in LOCATION_EVENTS and entry.get("StarSystem"):
        _post("/api/plugin/location", {"systemName": entry["StarSystem"]})

    # Indépendant du bloc précédent (pas un elif) : FSDJump/Location doivent déclencher les DEUX
    # pushs (localisation ET influence des factions) — ce sont deux informations distinctes
    # portées par le même événement.
    if event in FACTION_EVENTS and entry.get("Factions"):
        system_faction = entry.get("SystemFaction") or {}
        _post("/api/plugin/factions", {
            "systemName": entry.get("StarSystem") or system,
            "factions": entry.get("Factions"),
            "controllingFactionName": system_faction.get("Name"),
        })

    if event == "Loadout":
        # L'événement contient déjà tout ce qu'il faut (Ship, ShipID, ShipName, ShipIdent,
        # Modules) — même forme que le format communautaire SLEF, transmis tel quel au serveur
        # qui le normalise (voir server/edLoadout.ts). Se déclenche à chaque montée à bord, achat
        # de module ou changement d'ingénierie.
        _post("/api/plugin/build", entry)

    elif event == COLONISATION_EVENT and (system or state.get("SystemName")):
        market_id = entry.get("MarketID") or state.get("MarketID")
        _post("/api/plugin/colonisation", {
            "systemName": system or state.get("SystemName"),
            "name": station or state.get("StationName") or "Site de colonisation",
            "siteType": state.get("StationType") or "Inconnu",
            "marketId": str(market_id) if market_id else None,
            "progressPct": _extract_progress_pct(entry),
            # Liste des matériaux restants telle que fournie par le jeu — transmise telle quelle,
            # le serveur la valide/normalise (voir server/edLoadout.ts:parseResources).
            "resources": entry.get("ResourcesRequired"),
            "statusText": "Terminé" if entry.get("ConstructionComplete") else None,
        })
