import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"

interface FactionSummaryApi {
  factionId: string
  nom: string
  allegeance: string | null
  gouvernement: string | null
  influence: number
  etat: string
  humeur: string | null
  controle: boolean
  estEscadron: boolean
  // Distinct d'estEscadron : true seulement si confirmé par le jeu lui-même (SquadronFaction).
  // Ce flag n'est jamais rétrogradé par le serveur — un retrait manuel serait un no-op silencieux
  // si on tentait de l'appliquer dessus, d'où la distinction faite dans l'UI (bouton ci-dessous).
  estEscadronConfirmeParLeJeu: boolean
  source: "PLUGIN" | "EDSM"
  dateMaj: string
  tendance: number | null
}

interface FactionDetailApi extends FactionSummaryApi {
  historique: { influence: number; etat: string; date: string; source: "PLUGIN" | "EDSM" }[]
}

interface SystemFactionsApi {
  systeme: { id: string; name: string; coordX: number; coordY: number; coordZ: number }
  dateMaj: string
  factions: FactionSummaryApi[]
}

interface SystemDetailApi {
  systeme: { id: string; name: string; coordX: number; coordY: number; coordZ: number }
  factions: FactionDetailApi[]
}

const SQUADRON_COLOR = "#f28c1a"
const NEUTRAL_COLOR = "#8aabca"
const CONTROL_COLOR = "#0fc882"

function influenceColor(f: FactionSummaryApi): string {
  if (f.estEscadron) return SQUADRON_COLOR
  if (f.controle) return CONTROL_COLOR
  return NEUTRAL_COLOR
}

function TrendBadge({ tendance }: { tendance: number | null }) {
  if (tendance === null || Math.abs(tendance) < 0.001) return null
  const up = tendance > 0
  return (
    <span className="font-jbmono text-[10px]" style={{ color: up ? "#0fc882" : "#e53030" }}>
      {up ? "▲" : "▼"} {Math.abs(tendance * 100).toFixed(1)}%
    </span>
  )
}

function FactionRow({ f, dense }: { f: FactionSummaryApi; dense?: boolean }) {
  const color = influenceColor(f)
  return (
    <div className={dense ? "mb-2" : "mb-3"}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {f.estEscadron && <span title="Faction de l'escadron" style={{ color: SQUADRON_COLOR }}>★</span>}
          <span className="font-jbmono text-[12px] truncate" style={{ color: "#8aabca" }}>{f.nom}</span>
          {f.controle && (
            <span className="font-orbitron text-[8px] px-1 py-0.5 clip-corner-sm flex-shrink-0" style={{ color: CONTROL_COLOR, background: "rgba(15,200,130,0.1)" }}>
              CONTRÔLE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TrendBadge tendance={f.tendance} />
          <span className="font-jbmono text-[12px]" style={{ color }}>{(f.influence * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: "#0c1828" }}>
        <div className="h-full transition-all" style={{ width: `${Math.min(100, f.influence * 100)}%`, background: color }} />
      </div>
      {!dense && (
        <div className="font-jbmono text-[10px] mt-1" style={{ color: "#3d5878" }}>
          {f.etat}{f.humeur ? ` · ${f.humeur}` : ""} · {f.source === "PLUGIN" ? "plugin" : "EDSM"}
        </div>
      )}
    </div>
  )
}

function SystemDetailPanel({ systemId, onClose }: { systemId: string; onClose: () => void }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("squadron.manage")
  const [detail, setDetail] = useState<SystemDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch(`/api/factions/system/${systemId}`, { credentials: "include" })
      .then(r => r.json())
      .then(setDetail)
      .finally(() => setLoading(false))
  }

  useEffect(load, [systemId])

  async function refreshEdsm() {
    setRefreshError(null)
    setRefreshing(true)
    try {
      const res = await fetch(`/api/factions/system/${systemId}/refresh-edsm`, { method: "POST", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setRefreshError(data?.error || "Échec de l'actualisation EDSM.")
        return
      }
      load()
    } finally {
      setRefreshing(false)
    }
  }

  async function toggleSquadron(factionId: string, current: boolean) {
    const res = await fetch(`/api/factions/${factionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isSquadronManual: !current }),
    })
    if (res.ok) load()
  }

  return (
    <div className="w-80 flex-shrink-0">
      <div className="clip-corner p-5 relative sticky top-0" style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.25)" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, #f28c1a50, transparent)" }} />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 font-orbitron text-[11px] transition-colors"
          style={{ color: "#3d5878" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
          onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
        >
          ✕
        </button>

        <div className="font-jbmono text-[11px] mb-1" style={{ color: "#3d5878" }}>SYSTÈME</div>
        <div className="font-orbitron text-sm font-bold mb-4" style={{ color: "#f28c1a" }}>{detail?.systeme.name ?? "…"}</div>

        {loading && <div className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>Chargement…</div>}

        {!loading && detail && (
          <>
            <div className="space-y-4 mb-4 max-h-[420px] overflow-y-auto scrollable pr-1">
              {detail.factions.map(f => (
                <div key={f.factionId} className="pb-3" style={{ borderBottom: "1px solid #0c1828" }}>
                  <FactionRow f={f} />
                  {f.historique.length > 1 && (
                    <div className="font-jbmono text-[10px] space-y-0.5 mt-1" style={{ color: "#1c3050" }}>
                      {f.historique.slice(-5).reverse().map((h, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{new Date(h.date).toLocaleDateString("fr-FR")}</span>
                          <span>{(h.influence * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {canManage && (
                    f.estEscadronConfirmeParLeJeu ? (
                      <div
                        className="font-jbmono text-[9px] mt-1.5"
                        style={{ color: "#3d5878" }}
                        title="Le jeu lui-même confirme cette faction comme liée au Squadron (SquadronFaction) — non modifiable manuellement."
                      >
                        ★ Confirmée par le jeu — non modifiable
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleSquadron(f.factionId, f.estEscadron)}
                        className="font-orbitron text-[9px] mt-1.5 tracking-wider transition-colors"
                        style={{ color: f.estEscadron ? "#e53030" : "#3d5878" }}
                      >
                        {f.estEscadron ? "✕ RETIRER \"NOTRE FACTION\"" : "★ MARQUER COMME NOTRE FACTION"}
                      </button>
                    )
                  )}
                </div>
              ))}
              {detail.factions.length === 0 && (
                <div className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>Aucune faction connue pour ce système.</div>
              )}
            </div>

            {refreshError && (
              <div className="font-jbmono text-[11px] mb-3 px-2 py-1.5 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
                {refreshError}
              </div>
            )}

            <button
              onClick={refreshEdsm}
              disabled={refreshing}
              className="w-full font-orbitron text-[11px] py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
              style={{ color: "#2196f3", border: "1px solid rgba(33,150,243,0.35)", background: "rgba(33,150,243,0.08)" }}
            >
              {refreshing ? "…" : "ACTUALISER DEPUIS EDSM"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Factions() {
  const [systems, setSystems] = useState<SystemFactionsApi[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/factions", { credentials: "include" })
      .then(r => r.json())
      .then(setSystems)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[13px]" style={{ color: "#3d5878" }}>CHARGEMENT DE L'INFLUENCE…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-px h-4" style={{ background: "#f28c1a" }} />
          <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>
            INFLUENCE DES FACTIONS (BGS)
          </span>
        </div>
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>
          Alimenté automatiquement par le plugin EDMC à chaque saut
        </span>
      </div>

      <div className="flex gap-5">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
          {systems.map(s => (
            <div
              key={s.systeme.id}
              onClick={() => setSelectedId(selectedId === s.systeme.id ? null : s.systeme.id)}
              className="clip-corner p-4 cursor-pointer transition-all"
              style={{
                background: selectedId === s.systeme.id ? "rgba(242,140,26,0.06)" : "#070d1a",
                border: `1px solid ${selectedId === s.systeme.id ? "rgba(242,140,26,0.35)" : "#12223a"}`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-orbitron text-[13px] font-semibold" style={{ color: "#8aabca" }}>{s.systeme.name}</span>
                <span className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>{new Date(s.dateMaj).toLocaleDateString("fr-FR")}</span>
              </div>
              {s.factions.slice(0, 4).map(f => <FactionRow key={f.factionId} f={f} dense />)}
              {s.factions.length > 4 && (
                <div className="font-jbmono text-[10px]" style={{ color: "#1c3050" }}>+ {s.factions.length - 4} autre{s.factions.length - 4 > 1 ? "s" : ""}</div>
              )}
            </div>
          ))}
          {systems.length === 0 && (
            <div className="col-span-full clip-corner p-8 text-center font-jbmono text-[13px]" style={{ background: "#070d1a", border: "1px solid #12223a", color: "#3d5878" }}>
              AUCUNE DONNÉE D'INFLUENCE — jouez avec le plugin EDMC actif pour commencer à en collecter.
            </div>
          )}
        </div>

        {selectedId && <SystemDetailPanel systemId={selectedId} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}
