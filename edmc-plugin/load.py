"""
Plugin EDMC pour le BLRF Squadron Manager.

Pousse deux choses vers le backend de l'escadron, via le jeton personnel
(généré dans l'app : Paramètres de compte > Plugin EDMC) :
  1. Le système actuel du commandant (localisation, onglet Membres)
  2. La progression des chantiers de colonisation (onglet Colonisation)

Reste volontairement minimal : aucune dépendance externe (urllib de la
bibliothèque standard uniquement), jamais bloquant pour le jeu — toute erreur
réseau ou de format est avalée et journalisée, jamais levée.

Installation : copier ce dossier tel quel dans le dossier "plugins" d'EDMC
(Fichier > Paramètres > Plugins > Ouvrir le dossier des plugins), puis
redémarrer EDMC. Configuration dans l'onglet du plugin : URL du serveur et
jeton (voir README.md de ce dossier).
"""

import json
import threading
import tkinter as tk
from urllib import request, error

from config import config

PLUGIN_NAME = "BLRF Squadron Manager"

CFG_SERVER_URL = "blrf_server_url"
CFG_TOKEN = "blrf_api_token"

# Événements journal signalant un changement de système.
LOCATION_EVENTS = {"FSDJump", "Location", "CarrierJump"}

# Nom d'événement journal pour la progression d'un chantier de colonisation.
# À vérifier/ajuster si Frontier fait évoluer le format — l'extraction ci-dessous
# reste défensive (jamais de plantage sur un champ manquant ou renommé).
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
        except error.URLError:
            pass  # Serveur injoignable : ignoré, réessaiera au prochain événement.
        except Exception:
            pass  # Ne jamais remonter d'exception dans le thread EDMC.

    threading.Thread(target=_send, daemon=True).start()


def _extract_progress_pct(entry: dict) -> float | None:
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
    frame = tk.Frame(parent)

    tk.Label(frame, text="URL du serveur BLRF (ex. https://blrf.onrender.com)").grid(row=0, column=0, sticky="w", padx=5, pady=(8, 2))
    server_url_var = tk.StringVar(value=config.get_str(CFG_SERVER_URL) or "")
    tk.Entry(frame, textvariable=server_url_var, width=45).grid(row=1, column=0, sticky="we", padx=5)

    tk.Label(frame, text="Jeton personnel (Paramètres de compte > Plugin EDMC)").grid(row=2, column=0, sticky="w", padx=5, pady=(8, 2))
    token_var = tk.StringVar(value=config.get_str(CFG_TOKEN) or "")
    tk.Entry(frame, textvariable=token_var, width=45, show="•").grid(row=3, column=0, sticky="we", padx=5, pady=(0, 8))

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

    elif event == COLONISATION_EVENT and (system or entry.get("StarSystem")):
        _post("/api/plugin/colonisation", {
            "systemName": system or entry.get("StarSystem"),
            "name": station or entry.get("StationName") or "Site de colonisation",
            "siteType": entry.get("StationType") or "Inconnu",
            "progressPct": _extract_progress_pct(entry),
            "statusText": "Terminé" if entry.get("ConstructionComplete") else None,
        })
