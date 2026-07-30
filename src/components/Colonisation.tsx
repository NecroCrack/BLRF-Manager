import { useEffect, useState, type FormEvent } from "react"
import { useAuth } from "../context/AuthContext"

interface ColonisationResourceApi {
  name: string
  nameLocalised: string
  required: number
  provided: number
}

interface ColonisationSiteApi {
  id: string
  nom: string
  type: string
  progression: number | null
  statut: string | null
  dateMaj: string
  ajoutePar: string
  systeme: { id: string; name: string; coordX: number; coordY: number; coordZ: number }
  ressources: ColonisationResourceApi[] | null
}

interface MarketMatch {
  stationName: string
  marketId: number
  distanceToArrival: number
  buyPrice: number
  stock: number
}

interface CheckSystemResult {
  systemName: string
  matches: Record<string, MarketMatch[]>
  stationsChecked: number
  partial: boolean
}

function MarketSearch({ site }: { site: ColonisationSiteApi }) {
  const [open, setOpen] = useState(false)
  const [systemName, setSystemName] = useState("")
  const [result, setResult] = useState<CheckSystemResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const outstanding = (site.ressources ?? []).filter(r => r.provided < r.required)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setSearching(true)
    try {
      const res = await fetch(`/api/colonisation/${site.id}/check-system?systemName=${encodeURIComponent(systemName)}`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de la recherche.")
        return
      }
      setResult(data)
    } finally {
      setSearching(false)
    }
  }

  if (!site.ressources || outstanding.length === 0) return null

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid #0c1828" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>MATÉRIAUX RESTANTS</span>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="font-orbitron text-[10px] tracking-wider transition-colors"
          style={{ color: open ? "#f28c1a" : "#2196f3" }}
        >
          {open ? "▾ FERMER" : "▸ VÉRIFIER UN SYSTÈME"}
        </button>
      </div>
      <div className="space-y-1 mb-2">
        {outstanding.map(r => (
          <div key={r.name} className="flex items-center justify-between px-2 py-1 clip-corner-sm" style={{ background: "#040810", border: "1px solid #0c1828" }}>
            <span className="font-jbmono text-[11px]" style={{ color: "#8aabca" }}>{r.nameLocalised}</span>
            <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>{r.provided} / {r.required}</span>
          </div>
        ))}
      </div>

      {open && (
        <div>
          <form onSubmit={handleSearch} className="flex gap-2 mb-2">
            <input
              value={systemName}
              onChange={e => setSystemName(e.target.value)}
              placeholder="Système à vérifier (ex. Deciat)"
              required
              className="flex-1 font-jbmono text-[12px] bg-transparent outline-none px-2 py-1.5 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
            <button
              type="submit"
              disabled={searching}
              className="font-orbitron text-[10px] px-3 clip-corner-sm transition-all disabled:opacity-40"
              style={{ color: "#2196f3", border: "1px solid rgba(33,150,243,0.35)", background: "rgba(33,150,243,0.1)" }}
            >
              {searching ? "…" : "CHERCHER"}
            </button>
          </form>

          {error && (
            <div className="font-jbmono text-[11px] mb-2 px-2 py-1.5 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {outstanding.map(r => {
                const stations = result.matches[r.name] ?? []
                return (
                  <div key={r.name}>
                    <div className="font-jbmono text-[10px] mb-1" style={{ color: "#3d5878" }}>{r.nameLocalised}</div>
                    {stations.length === 0 ? (
                      <div className="font-jbmono text-[11px] pl-2" style={{ color: "#1c3050" }}>Pas en vente à {result.systemName}.</div>
                    ) : (
                      stations.map(s => (
                        <div key={s.marketId} className="flex items-center justify-between pl-2 pr-2 py-1 font-jbmono text-[11px]" style={{ color: "#0fc882" }}>
                          <span>{s.stationName}</span>
                          <span>{s.buyPrice.toLocaleString("fr-FR")} cr · stock {s.stock.toLocaleString("fr-FR")}</span>
                        </div>
                      ))
                    )}
                  </div>
                )
              })}
              {result.partial && (
                <div className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
                  Vérification partielle ({result.stationsChecked} station{result.stationsChecked > 1 ? "s" : ""} contrôlée{result.stationsChecked > 1 ? "s" : ""}, quota EDSM atteint).
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddSiteForm({ onClose, onCreated }: { onClose: () => void; onCreated: (s: ColonisationSiteApi) => void }) {
  const [systemName, setSystemName] = useState("")
  const [name, setName] = useState("")
  const [siteType, setSiteType] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/colonisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ systemName, name, siteType }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de l'ajout du site.")
        return
      }
      onCreated(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="clip-corner-sm p-4 mb-4" style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.25)" }}>
      <div className="font-jbmono text-[11px] mb-3" style={{ color: "#3d5878" }}>NOUVEAU SITE À SUIVRE</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <input
          value={systemName}
          onChange={e => setSystemName(e.target.value)}
          placeholder="Système (ex. Deciat)"
          required
          className="font-jbmono text-[13px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
          style={{ color: "#8aabca", border: "1px solid #12223a" }}
        />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom du site"
          required
          className="font-jbmono text-[13px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
          style={{ color: "#8aabca", border: "1px solid #12223a" }}
        />
        <input
          value={siteType}
          onChange={e => setSiteType(e.target.value)}
          placeholder="Type (ex. Starport orbital)"
          required
          className="font-jbmono text-[13px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
          style={{ color: "#8aabca", border: "1px solid #12223a" }}
        />
      </div>
      <div className="font-jbmono text-[11px] mb-3 leading-relaxed" style={{ color: "#3d5878" }}>
        La progression sera importée automatiquement dès qu'un membre équipé du plugin EDMC se rendra sur place.
      </div>
      {error && (
        <div className="font-jbmono text-[12px] mb-3 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 font-orbitron text-[11px] py-2 clip-corner-sm transition-all" style={{ border: "1px solid #12223a", color: "#3d5878", background: "transparent" }}>
          ANNULER
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 font-orbitron text-[11px] py-2 clip-corner-sm transition-all disabled:opacity-50"
          style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
        >
          {submitting ? "…" : "AJOUTER →"}
        </button>
      </div>
    </form>
  )
}

export default function Colonisation() {
  const { hasPermission } = useAuth()
  const canAdd = hasPermission("colonisation.add")
  const [sites, setSites] = useState<ColonisationSiteApi[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetch("/api/colonisation", { credentials: "include" })
      .then(r => r.json())
      .then(setSites)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[13px]" style={{ color: "#3d5878" }}>CHARGEMENT DE LA COLONISATION…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-px h-4" style={{ background: "#f28c1a" }} />
          <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>
            COLONISATION DE L'ESCADRON
          </span>
        </div>
        {canAdd && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="font-orbitron text-[11px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
            style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
          >
            + NOUVEAU SITE
          </button>
        )}
      </div>

      {showAdd && (
        <AddSiteForm
          onClose={() => setShowAdd(false)}
          onCreated={s => { setSites(prev => [s, ...prev]); setShowAdd(false) }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map(site => (
          <div key={site.id} className="clip-corner p-4" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
            <div className="font-orbitron text-[13px] font-semibold mb-0.5" style={{ color: "#8aabca" }}>{site.nom}</div>
            <div className="font-jbmono text-[11px] mb-3" style={{ color: "#3d5878" }}>{site.systeme.name} · {site.type}</div>

            {site.progression !== null ? (
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>PROGRESSION</span>
                  <span className="font-jbmono text-[11px]" style={{ color: "#0fc882" }}>{site.progression.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: "#0c1828" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, site.progression))}%`, background: "#0fc882" }} />
                </div>
              </div>
            ) : (
              <div className="font-jbmono text-[11px] mb-3" style={{ color: "#1c3050" }}>
                En attente de données du plugin EDMC…
              </div>
            )}

            {site.statut && (
              <div className="font-jbmono text-[12px] mb-3" style={{ color: "#8aabca" }}>{site.statut}</div>
            )}

            <div className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
              ajouté par CMDR {site.ajoutePar} · maj {new Date(site.dateMaj).toLocaleString("fr-FR")}
            </div>

            <MarketSearch site={site} />
          </div>
        ))}
        {sites.length === 0 && (
          <div className="col-span-full clip-corner p-8 text-center font-jbmono text-[13px]" style={{ background: "#070d1a", border: "1px solid #12223a", color: "#3d5878" }}>
            AUCUN SITE DE COLONISATION SUIVI
          </div>
        )}
      </div>
    </div>
  )
}
