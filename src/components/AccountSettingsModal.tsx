import { useEffect, useState, type FormEvent } from "react"

interface SyncStatus {
  inaraConfigured: boolean
  inaraCommanderName: string | null
  inaraLastSyncAt: string | null
  inaraLastSyncOk: boolean | null
}

interface PluginTokenStatus {
  configured: boolean
  lastUsedAt: string | null
}

export default function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [commanderName, setCommanderName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [pluginStatus, setPluginStatus] = useState<PluginTokenStatus | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

  useEffect(() => {
    fetch("/api/members/me/sync", { credentials: "include" })
      .then(r => r.json())
      .then((s: SyncStatus) => {
        setStatus(s)
        if (s.inaraCommanderName) setCommanderName(s.inaraCommanderName)
      })
    fetch("/api/members/me/api-token", { credentials: "include" })
      .then(r => r.json())
      .then(setPluginStatus)
  }, [])

  async function generateToken() {
    setGeneratingToken(true)
    setTokenCopied(false)
    try {
      const res = await fetch("/api/members/me/api-token", { method: "POST", credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setNewToken(data.token)
        setPluginStatus({ configured: true, lastUsedAt: null })
      }
    } finally {
      setGeneratingToken(false)
    }
  }

  async function copyToken() {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setTokenCopied(true)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/members/me/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inaraApiKey: apiKey, inaraCommanderName: commanderName }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de l'enregistrement.")
        return
      }
      setStatus(data)
      setApiKey("")
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setSaving(true)
    try {
      const res = await fetch("/api/members/me/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inaraApiKey: null }),
      })
      if (res.ok) {
        setStatus(await res.json())
        setCommanderName("")
        setApiKey("")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-sm clip-corner p-6 max-h-[85vh] overflow-y-auto scrollable" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        <div className="font-orbitron text-[10px] tracking-widest mb-1" style={{ color: "#3d5878" }}>
          PARAMÈTRES DE COMPTE
        </div>
        <div className="font-jbmono text-[9px] mb-5" style={{ color: "#3d5878" }}>
          Synchronisation Inara
        </div>

        {status && (
          <div
            className="font-jbmono text-[10px] mb-4 px-3 py-2 clip-corner-sm"
            style={{
              color: status.inaraConfigured ? "#0fc882" : "#3d5878",
              background: status.inaraConfigured ? "rgba(15,200,130,0.08)" : "rgba(61,88,120,0.08)",
              border: `1px solid ${status.inaraConfigured ? "rgba(15,200,130,0.25)" : "#12223a"}`,
            }}
          >
            {status.inaraConfigured ? (
              <>
                Clé configurée pour CMDR {status.inaraCommanderName}.<br />
                {status.inaraLastSyncAt
                  ? `Dernière synchro : ${new Date(status.inaraLastSyncAt).toLocaleString("fr-FR")} (${status.inaraLastSyncOk ? "réussie" : "échouée"})`
                  : "Pas encore synchronisée — attente du prochain cycle (toutes les 12h)."}
              </>
            ) : (
              "Aucune clé Inara configurée."
            )}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="mb-3">
            <label className="font-orbitron text-[9px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
              NOM DE COMMANDANT INARA
            </label>
            <input
              value={commanderName}
              onChange={e => setCommanderName(e.target.value)}
              placeholder="Peut différer de votre pseudo"
              className="w-full font-jbmono text-[12px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-5">
            <label className="font-orbitron text-[9px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
              CLÉ API INARA
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={status?.inaraConfigured ? "••••••••• (déjà enregistrée)" : "Générée depuis votre profil Inara"}
              autoComplete="off"
              className="w-full font-jbmono text-[12px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
            <div className="font-jbmono text-[9px] mt-1.5 leading-relaxed" style={{ color: "#3d5878" }}>
              Chiffrée avant stockage, jamais réaffichée. Disponible dans vos paramètres de compte sur inara.cz.
            </div>
          </div>

          {error && (
            <div className="font-jbmono text-[10px] mb-4 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-5">
            <button type="button" onClick={onClose} className="flex-1 font-orbitron text-[10px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all" style={{ color: "#3d5878", background: "transparent", border: "1px solid #12223a" }}>
              FERMER
            </button>
            {status?.inaraConfigured && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={saving}
                className="flex-1 font-orbitron text-[10px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
                style={{ color: "#e53030", border: "1px solid rgba(229,48,48,0.3)", background: "rgba(229,48,48,0.08)" }}
              >
                DÉCONNECTER
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !apiKey.trim() || !commanderName.trim()}
              className="flex-1 font-orbitron text-[10px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
            >
              {saving ? "…" : "ENREGISTRER"}
            </button>
          </div>
        </form>

        <div className="pt-4" style={{ borderTop: "1px solid #12223a" }}>
          <div className="font-jbmono text-[9px] mb-3" style={{ color: "#3d5878" }}>
            Plugin EDMC (localisation &amp; colonisation)
          </div>

          {pluginStatus?.configured && !newToken && (
            <div className="font-jbmono text-[10px] mb-3 px-3 py-2 clip-corner-sm" style={{ color: "#0fc882", background: "rgba(15,200,130,0.08)", border: "1px solid rgba(15,200,130,0.25)" }}>
              Jeton configuré.{" "}
              {pluginStatus.lastUsedAt
                ? `Dernière utilisation : ${new Date(pluginStatus.lastUsedAt).toLocaleString("fr-FR")}`
                : "Jamais encore utilisé par le plugin."}
            </div>
          )}

          {newToken ? (
            <div className="mb-3">
              <div className="font-jbmono text-[9px] mb-2 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
                Ce jeton ne sera plus jamais affiché. Copiez-le dans la configuration du plugin maintenant.
              </div>
              <div
                className="font-jbmono text-[10px] mb-2 px-3 py-2 clip-corner-sm break-all"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.08)", border: "1px solid rgba(242,140,26,0.3)" }}
              >
                {newToken}
              </div>
              <button
                type="button"
                onClick={copyToken}
                className="w-full font-orbitron text-[9px] py-2 clip-corner-sm transition-all"
                style={{ color: "#8aabca", background: "transparent", border: "1px solid #12223a" }}
              >
                {tokenCopied ? "COPIÉ ✓" : "COPIER LE JETON"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={generateToken}
              disabled={generatingToken}
              className="w-full font-orbitron text-[9px] py-2 clip-corner-sm transition-all disabled:opacity-50"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
            >
              {generatingToken ? "…" : pluginStatus?.configured ? "RÉGÉNÉRER LE JETON" : "GÉNÉRER UN JETON"}
            </button>
          )}
          <div className="font-jbmono text-[9px] mt-2 leading-relaxed" style={{ color: "#3d5878" }}>
            À coller dans la configuration du plugin EDMC fourni (dossier edmc-plugin/ du dépôt). Régénérer invalide l'ancien jeton.
          </div>
        </div>
      </div>
    </div>
  )
}
