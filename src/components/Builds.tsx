import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import AddBuildModal from "./AddBuildModal"

export type ShipRoleKind = "COMBAT" | "EXPLORATION" | "MINAGE" | "TRANSPORT" | "MULTIROLE"
export type BuildStatusKind = "EN_ATTENTE" | "APPROUVE" | "REJETE"

export interface BuildCommentApi {
  id: string
  contenu: string
  date: string
  reviewer: string
}

export interface ShipBuildApi {
  id: string
  membreId: string
  membre: string
  nom: string
  vaisseauModele: string
  lienCoriolis: string
  role: ShipRoleKind
  portee: string | null
  notes: string | null
  status: BuildStatusKind
  dateImport: string
  comments: BuildCommentApi[]
}

const STATUS_CONFIG: Record<BuildStatusKind, { color: string; label: string }> = {
  EN_ATTENTE: { color: "#3d5878", label: "En attente" },
  APPROUVE:   { color: "#0fc882", label: "Approuvé" },
  REJETE:     { color: "#e53030", label: "Rejeté" },
}

const ROLE_CONFIG: Record<ShipRoleKind, { color: string; icon: string; label: string }> = {
  COMBAT:      { color: "#e53030", icon: "◈", label: "Combat" },
  EXPLORATION: { color: "#2196f3", icon: "◎", label: "Exploration" },
  MINAGE:      { color: "#a78bfa", icon: "◆", label: "Minage" },
  TRANSPORT:   { color: "#0fc882", icon: "◇", label: "Transport" },
  MULTIROLE:   { color: "#f28c1a", icon: "◉", label: "Multirôle" },
}

const ROLE_FILTERS: Array<ShipRoleKind | "Tous"> = ["Tous", "COMBAT", "EXPLORATION", "TRANSPORT", "MINAGE", "MULTIROLE"]

function BuildCard({ build, selected, onSelect }: { build: ShipBuildApi; selected: boolean; onSelect: () => void }) {
  const role = ROLE_CONFIG[build.role]
  const status = STATUS_CONFIG[build.status]

  return (
    <div
      onClick={onSelect}
      className="clip-corner p-4 cursor-pointer transition-all relative"
      style={{
        background: selected ? "rgba(242,140,26,0.06)" : "#070d1a",
        border: `1px solid ${selected ? "rgba(242,140,26,0.35)" : "#12223a"}`,
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "#1c3050"; e.currentTarget.style.background = "#080f1e" } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "#12223a"; e.currentTarget.style.background = "#070d1a" } }}
    >
      {selected && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, #f28c1a60, transparent)" }} />}

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="font-orbitron text-[11px] font-semibold truncate mb-0.5" style={{ color: selected ? "#f28c1a" : "#8aabca" }}>
            {build.nom}
          </div>
          <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>
            CMDR {build.membre}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-lg" style={{ color: role.color }}>{role.icon}</span>
          <span className="font-orbitron text-[7px] px-1 py-0.5 clip-corner-sm" style={{ color: status.color, background: `${status.color}12` }}>
            {status.label.toUpperCase()}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 clip-corner-sm mb-3"
        style={{ background: "#040810", border: "1px solid #0c1828" }}
      >
        <span className="text-base">🚀</span>
        <div>
          <div className="font-orbitron text-[10px]" style={{ color: "#8aabca" }}>{build.vaisseauModele}</div>
          {build.portee && (
            <div className="font-jbmono text-[9px]" style={{ color: "#2196f3" }}>
              PORTÉE MAX: {build.portee}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className="font-orbitron text-[8px] px-2 py-0.5 clip-corner-sm"
          style={{ color: role.color, background: `${role.color}12`, border: `1px solid ${role.color}35` }}
        >
          {role.label.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>{build.dateImport.slice(0, 10)}</span>
          <a
            href={build.lienCoriolis}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="font-orbitron text-[8px] px-2 py-0.5 clip-corner-sm transition-all"
            style={{ color: "#2196f3", border: "1px solid rgba(33,150,243,0.3)", background: "rgba(33,150,243,0.08)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(33,150,243,0.15)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(33,150,243,0.08)" }}
          >
            CORIOLIS ↗
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Builds() {
  const { user, hasPermission } = useAuth()
  const [builds, setBuilds] = useState<ShipBuildApi[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<ShipRoleKind | "Tous">("Tous")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [comment, setComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const canApprove = hasPermission("builds.approve")

  async function changeStatus(status: BuildStatusKind) {
    if (!selected) return
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/builds/${selected.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setBuilds(prev => prev.map(b => b.id === updated.id ? updated : b))
      }
    } finally {
      setChangingStatus(false)
    }
  }

  async function sendComment() {
    if (!selected || !comment.trim()) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/builds/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contenu: comment }),
      })
      if (res.ok) {
        const updated = await res.json()
        setBuilds(prev => prev.map(b => b.id === updated.id ? updated : b))
        setComment("")
      }
    } finally {
      setSubmittingComment(false)
    }
  }

  useEffect(() => {
    fetch("/api/builds", { credentials: "include" })
      .then(r => r.json())
      .then(setBuilds)
      .finally(() => setLoading(false))
  }, [])

  const selected = builds.find(b => b.id === selectedId) || null
  const filtered = builds.filter(b => roleFilter === "Tous" || b.role === roleFilter)
  const canDelete = selected && (selected.membreId === user?.id || hasPermission("builds.approve"))

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/builds/${selected.id}`, { method: "DELETE", credentials: "include" })
      if (res.ok) {
        setBuilds(prev => prev.filter(b => b.id !== selected.id))
        setSelectedId(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT DU HANGAR…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-px h-4" style={{ background: "#f28c1a" }} />
          <span className="font-orbitron text-[11px] tracking-widest" style={{ color: "#8aabca" }}>
            HANGAR DE L'ESCADRON
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
            {filtered.length} BUILD{filtered.length > 1 ? "S" : ""} RÉPERTORIÉ{filtered.length > 1 ? "S" : ""}
          </span>
          <button
            onClick={() => setShowAdd(true)}
            className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
            style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.18)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.1)" }}
          >
            + NOUVEAU BUILD
          </button>
        </div>
      </div>

      {/* Role filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {ROLE_FILTERS.map(role => {
          const active = roleFilter === role
          const cfg = role !== "Tous" ? ROLE_CONFIG[role] : null
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
              style={{
                color: active ? (cfg?.color || "#f28c1a") : "#3d5878",
                background: active ? `${cfg?.color || "#f28c1a"}12` : "#070d1a",
                border: `1px solid ${active ? (cfg?.color || "#f28c1a") + "50" : "#12223a"}`,
              }}
            >
              {role !== "Tous" && <span className="mr-1">{cfg?.icon}</span>}
              {role === "Tous" ? "TOUS" : cfg?.label.toUpperCase()}
            </button>
          )
        })}
      </div>

      <div className="flex gap-5">
        {/* Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
          {filtered.map(build => (
            <BuildCard
              key={build.id}
              build={build}
              selected={selectedId === build.id}
              onSelect={() => setSelectedId(selectedId === build.id ? null : build.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full clip-corner p-8 text-center font-jbmono text-[11px]" style={{ background: "#070d1a", border: "1px solid #12223a", color: "#3d5878" }}>
              AUCUN BUILD RÉPERTORIÉ
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0">
            <div
              className="clip-corner p-5 relative sticky top-0"
              style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.25)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, #f28c1a50, transparent)" }} />

              <button
                onClick={() => setSelectedId(null)}
                className="absolute top-4 right-4 font-orbitron text-[9px] transition-colors"
                style={{ color: "#3d5878" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
                onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
              >
                ✕
              </button>

              <div className="font-jbmono text-[9px] mb-1" style={{ color: "#3d5878" }}>FICHE BUILD</div>
              <div className="font-orbitron text-sm font-bold mb-1" style={{ color: "#f28c1a" }}>
                {selected.nom}
              </div>
              <div className="font-jbmono text-[9px] mb-4" style={{ color: "#3d5878" }}>
                par CMDR {selected.membre}
              </div>

              <div className="space-y-3 mb-4">
                {[
                  { label: "VAISSEAU", value: selected.vaisseauModele },
                  { label: "RÔLE", value: ROLE_CONFIG[selected.role].label },
                  ...(selected.portee ? [{ label: "PORTÉE", value: selected.portee }] : []),
                  { label: "IMPORTÉ LE", value: selected.dateImport.slice(0, 10) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center" style={{ borderBottom: "1px solid #0c1828", paddingBottom: "8px" }}>
                    <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>{label}</span>
                    <span className="font-jbmono text-[10px]" style={{ color: "#8aabca" }}>{value}</span>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div className="mb-4">
                  <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>NOTES</div>
                  <div
                    className="clip-corner-sm p-3 font-jbmono text-[10px] leading-relaxed"
                    style={{ background: "#040810", color: "#8aabca", border: "1px solid #0c1828" }}
                  >
                    {selected.notes}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>STATUT</div>
                  <span
                    className="font-orbitron text-[8px] px-2 py-0.5 clip-corner-sm"
                    style={{ color: STATUS_CONFIG[selected.status].color, background: `${STATUS_CONFIG[selected.status].color}12` }}
                  >
                    {STATUS_CONFIG[selected.status].label.toUpperCase()}
                  </span>
                </div>
                {canApprove && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => changeStatus("APPROUVE")}
                      disabled={changingStatus || selected.status === "APPROUVE"}
                      className="flex-1 font-orbitron text-[8px] py-1.5 clip-corner-sm transition-all disabled:opacity-40"
                      style={{ color: "#0fc882", border: "1px solid rgba(15,200,130,0.3)", background: "rgba(15,200,130,0.08)" }}
                    >
                      APPROUVER
                    </button>
                    <button
                      onClick={() => changeStatus("REJETE")}
                      disabled={changingStatus || selected.status === "REJETE"}
                      className="flex-1 font-orbitron text-[8px] py-1.5 clip-corner-sm transition-all disabled:opacity-40"
                      style={{ color: "#e53030", border: "1px solid rgba(229,48,48,0.3)", background: "rgba(229,48,48,0.08)" }}
                    >
                      REJETER
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>
                  RETOURS ({selected.comments.length})
                </div>
                <div className="space-y-2 mb-2 max-h-40 overflow-y-auto scrollable">
                  {selected.comments.map(c => (
                    <div key={c.id} className="clip-corner-sm p-2.5" style={{ background: "#040810", border: "1px solid #0c1828" }}>
                      <div className="font-jbmono text-[9px] mb-1" style={{ color: "#f28c1a" }}>{c.reviewer}</div>
                      <div className="font-jbmono text-[10px] leading-relaxed" style={{ color: "#8aabca" }}>{c.contenu}</div>
                    </div>
                  ))}
                  {selected.comments.length === 0 && (
                    <div className="font-jbmono text-[9px] py-1" style={{ color: "#1c3050" }}>Aucun retour pour l'instant.</div>
                  )}
                </div>
                {canApprove && (
                  <div className="flex gap-2">
                    <input
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Retour au créateur…"
                      className="flex-1 font-jbmono text-[10px] bg-transparent outline-none px-2 py-1.5 clip-corner-sm"
                      style={{ color: "#8aabca", border: "1px solid #12223a" }}
                    />
                    <button
                      onClick={sendComment}
                      disabled={submittingComment || !comment.trim()}
                      className="font-orbitron text-[8px] px-3 clip-corner-sm transition-all disabled:opacity-40"
                      style={{ color: "#f28c1a", border: "1px solid rgba(242,140,26,0.35)", background: "rgba(242,140,26,0.1)" }}
                    >
                      ENVOYER
                    </button>
                  </div>
                )}
              </div>

              <a
                href={selected.lienCoriolis}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center font-orbitron text-[9px] py-2.5 clip-corner-sm tracking-widest transition-all mb-2"
                style={{ color: "#2196f3", border: "1px solid rgba(33,150,243,0.35)", background: "rgba(33,150,243,0.08)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(33,150,243,0.15)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(33,150,243,0.08)" }}
              >
                OUVRIR DANS CORIOLIS ↗
              </a>

              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full font-orbitron text-[9px] py-2 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
                  style={{ color: "#e53030", border: "1px solid rgba(229,48,48,0.3)", background: "rgba(229,48,48,0.08)" }}
                >
                  {deleting ? "SUPPRESSION…" : "SUPPRIMER LE BUILD"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddBuildModal
          onClose={() => setShowAdd(false)}
          onCreated={b => { setBuilds(prev => [b, ...prev]); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
