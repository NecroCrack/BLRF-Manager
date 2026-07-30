import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"

type MissionStatus = "EN_COURS" | "COMPLETE" | "ARCHIVE"
type MissionType = "COMBAT" | "EXPLORATION" | "LOGISTIQUE" | "ESCORTE" | "INTERNE"

interface MissionAssignee {
  id: string
  pseudo: string
  online: boolean
}

interface MissionApi {
  id: string
  title: string
  description: string
  status: MissionStatus
  priorite: 1 | 2 | 3
  type: MissionType
  systeme: string | null
  systemId: string | null
  responsable: string | null
  createdAt: string
  dateCompletion: string | null
  showEdsmPanel: boolean | null
  showMemberStatusPanel: boolean | null
  assignees: MissionAssignee[]
}

interface RosterMember {
  id: string
  pseudo: string
}

const STATUS_CONFIG: Record<MissionStatus, { color: string; label: string; bg: string }> = {
  EN_COURS: { color: "#f28c1a", label: "EN COURS",   bg: "rgba(242,140,26,0.12)" },
  COMPLETE: { color: "#0fc882", label: "COMPLÈTE",   bg: "rgba(15,200,130,0.1)" },
  ARCHIVE:  { color: "#3d5878", label: "ARCHIVÉE",   bg: "rgba(61,88,120,0.1)" },
}

const PRIORITY_CONFIG = {
  1: { color: "#e53030", label: "CRITIQUE", icon: "▲▲▲" },
  2: { color: "#f28c1a", label: "HAUTE",    icon: "▲▲" },
  3: { color: "#2196f3", label: "NORMALE",  icon: "▲" },
}

const TYPE_CONFIG: Record<MissionType, { color: string; icon: string; label: string }> = {
  COMBAT:      { color: "#e53030", icon: "◈", label: "Combat" },
  EXPLORATION: { color: "#2196f3", icon: "◎", label: "Exploration" },
  LOGISTIQUE:  { color: "#0fc882", icon: "◇", label: "Logistique" },
  ESCORTE:     { color: "#a78bfa", icon: "◉", label: "Escorte" },
  INTERNE:     { color: "#3d5878", icon: "◌", label: "Interne" },
}

export default function Missions() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("missions.manage")
  const canManageDashboard = hasPermission("dashboard.manage")

  const [missions, setMissions] = useState<MissionApi[]>([])
  const [members, setMembers] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<MissionStatus | "Toutes">("Toutes")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [savingAssignees, setSavingAssignees] = useState(false)
  const [savingPanels, setSavingPanels] = useState(false)

  useEffect(() => {
    fetch("/api/missions", { credentials: "include" })
      .then(r => r.json())
      .then(setMissions)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!canManage) return
    fetch("/api/members", { credentials: "include" })
      .then(r => r.json())
      .then((data: Array<{ id: string; pseudo: string }>) => setMembers(data.map(m => ({ id: m.id, pseudo: m.pseudo }))))
  }, [canManage])

  function updateMission(updated: MissionApi) {
    setMissions(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  async function toggleAssignee(mission: MissionApi, memberId: string) {
    const current = mission.assignees.map(a => a.id)
    const next = current.includes(memberId) ? current.filter(id => id !== memberId) : [...current, memberId]
    setSavingAssignees(true)
    try {
      const res = await fetch(`/api/missions/${mission.id}/assignees`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberIds: next }),
      })
      if (res.ok) updateMission(await res.json())
    } finally {
      setSavingAssignees(false)
    }
  }

  async function togglePanel(mission: MissionApi, panel: "showEdsmPanel" | "showMemberStatusPanel") {
    setSavingPanels(true)
    try {
      const res = await fetch(`/api/missions/${mission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [panel]: !mission[panel] }),
      })
      if (res.ok) updateMission(await res.json())
    } finally {
      setSavingPanels(false)
    }
  }

  const filtered = missions.filter(m => statusFilter === "Toutes" || m.status === statusFilter)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT DES OPÉRATIONS…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-px h-4" style={{ background: "#f28c1a" }} />
          <span className="font-orbitron text-[11px] tracking-widest" style={{ color: "#8aabca" }}>
            TABLEAU DES OPÉRATIONS
          </span>
        </div>
        <div className="flex items-center gap-3">
          {(["Toutes", "EN_COURS", "COMPLETE", "ARCHIVE"] as const).map(s => {
            const active = statusFilter === s
            const cfg = s !== "Toutes" ? STATUS_CONFIG[s] : null
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
                style={{
                  color: active ? (cfg?.color || "#f28c1a") : "#3d5878",
                  background: active ? (cfg?.bg || "rgba(242,140,26,0.1)") : "#070d1a",
                  border: `1px solid ${active ? (cfg?.color || "#f28c1a") + "45" : "#12223a"}`,
                }}
              >
                {s === "Toutes" ? "TOUTES" : cfg?.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(["EN_COURS", "COMPLETE", "ARCHIVE"] as MissionStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s]
          const count = missions.filter(m => m.status === s).length
          return (
            <div
              key={s}
              className="clip-corner-sm p-3 flex items-center justify-between"
              style={{ background: "#07101e", border: "1px solid #12223a" }}
            >
              <span className="font-orbitron text-[9px] tracking-wider" style={{ color: "#3d5878" }}>{cfg.label}</span>
              <span className="font-orbitron text-xl font-bold" style={{ color: cfg.color }}>{count}</span>
            </div>
          )
        })}
      </div>

      {/* Mission list */}
      <div className="space-y-2">
        {filtered.map(mission => {
          const status = STATUS_CONFIG[mission.status]
          const priority = PRIORITY_CONFIG[mission.priorite]
          const type = TYPE_CONFIG[mission.type]
          const isExpanded = expanded === mission.id

          return (
            <div key={mission.id} className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: priority.color }} />

              <div
                className="ml-1 clip-corner-sm transition-all"
                style={{
                  background: isExpanded ? "rgba(242,140,26,0.04)" : "#070d1a",
                  border: `1px solid ${isExpanded ? "rgba(242,140,26,0.2)" : "#12223a"}`,
                }}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : mission.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-4"
                >
                  <span className="text-base flex-shrink-0" style={{ color: type.color }}>{type.icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="font-orbitron text-[11px] font-semibold truncate" style={{ color: isExpanded ? "#f28c1a" : "#8aabca" }}>
                      {mission.title}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {mission.systeme && (
                        <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>◎ {mission.systeme}</span>
                      )}
                      {mission.responsable && (
                        <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>CMDR {mission.responsable}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="font-orbitron text-[8px] px-2 py-0.5 clip-corner-sm"
                      style={{ color: priority.color, background: `${priority.color}12`, border: `1px solid ${priority.color}35` }}
                    >
                      {priority.label}
                    </span>
                    <span
                      className="font-orbitron text-[8px] px-2 py-0.5 clip-corner-sm"
                      style={{ color: status.color, background: status.bg, border: `1px solid ${status.color}35` }}
                    >
                      {status.label}
                    </span>
                    <span
                      className="font-orbitron text-[9px] transition-transform"
                      style={{ color: "#3d5878", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      ▾
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4" style={{ borderTop: "1px solid #0c1828" }}>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>BRIEFING OPÉRATION</div>
                        <div
                          className="clip-corner-sm p-3 font-jbmono text-[10px] leading-relaxed"
                          style={{ background: "#040810", color: "#8aabca", border: "1px solid #0c1828" }}
                        >
                          {mission.description}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: "TYPE", value: type.label, color: type.color },
                          { label: "PRIORITÉ", value: priority.label, color: priority.color },
                          { label: "STATUT", value: status.label, color: status.color },
                          ...(mission.systeme ? [{ label: "SYSTÈME CIBLE", value: mission.systeme, color: "#8aabca" }] : []),
                          ...(mission.responsable ? [{ label: "OFFICIER RESP.", value: "CMDR " + mission.responsable, color: "#f28c1a" }] : []),
                          { label: "CRÉÉE LE", value: mission.createdAt.slice(0, 10), color: "#8aabca" },
                          ...(mission.dateCompletion ? [{ label: "COMPLÉTÉE LE", value: mission.dateCompletion.slice(0, 10), color: "#0fc882" }] : []),
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex justify-between" style={{ borderBottom: "1px solid #0c1828", paddingBottom: "6px" }}>
                            <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>{label}</span>
                            <span className="font-jbmono text-[10px]" style={{ color }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Membres assignés */}
                    <div className="mt-4">
                      <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>
                        MEMBRES ASSIGNÉS ({mission.assignees.length})
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {mission.assignees.map(a => (
                          <span
                            key={a.id}
                            className="font-jbmono text-[9px] px-2 py-1 clip-corner-sm flex items-center gap-1.5"
                            style={{ background: "#040810", border: "1px solid #0c1828", color: "#8aabca" }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.online ? "#0fc882" : "#3d5878" }} />
                            {a.pseudo}
                          </span>
                        ))}
                        {mission.assignees.length === 0 && (
                          <span className="font-jbmono text-[9px]" style={{ color: "#1c3050" }}>Aucun membre assigné.</span>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex flex-wrap gap-1.5">
                          {members.map(m => {
                            const active = mission.assignees.some(a => a.id === m.id)
                            return (
                              <button
                                key={m.id}
                                disabled={savingAssignees}
                                onClick={() => toggleAssignee(mission, m.id)}
                                className="font-orbitron text-[8px] px-2 py-1 clip-corner-sm transition-all disabled:opacity-50"
                                style={{
                                  color: active ? "#f28c1a" : "#3d5878",
                                  background: active ? "rgba(242,140,26,0.1)" : "transparent",
                                  border: `1px solid ${active ? "rgba(242,140,26,0.35)" : "#12223a"}`,
                                }}
                              >
                                {active ? "✓ " : "+ "}{m.pseudo}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Panneaux live du tableau de bord */}
                    {canManageDashboard && (
                      <div className="mt-4 pt-3" style={{ borderTop: "1px solid #0c1828" }}>
                        <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>
                          PANNEAUX LIVE SUR LE TABLEAU DE BORD
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!mission.showEdsmPanel}
                              disabled={savingPanels}
                              onChange={() => togglePanel(mission, "showEdsmPanel")}
                            />
                            <span className="font-jbmono text-[9px]" style={{ color: "#8aabca" }}>État EDSM du système</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!mission.showMemberStatusPanel}
                              disabled={savingPanels}
                              onChange={() => togglePanel(mission, "showMemberStatusPanel")}
                            />
                            <span className="font-jbmono text-[9px]" style={{ color: "#8aabca" }}>Statut des membres assignés</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center font-jbmono text-[11px]" style={{ color: "#3d5878" }}>
          AUCUNE OPÉRATION NE CORRESPOND AUX FILTRES
        </div>
      )}
    </div>
  )
}
