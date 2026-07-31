import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"

interface Props {
  onNavigate: (s: "missions" | "members" | "map" | "forum") => void
}

interface SquadronApi {
  nom: string
  tag: string
  description: string
  fondation: string
  commandant: string | null
  totalMembres: number
}

interface MissionAssignee {
  id: string
  pseudo: string
  online: boolean
}

interface MissionApi {
  id: string
  title: string
  description: string
  status: "EN_COURS" | "COMPLETE" | "ARCHIVE"
  priorite: 1 | 2 | 3
  type: "COMBAT" | "EXPLORATION" | "LOGISTIQUE" | "ESCORTE" | "INTERNE"
  systeme: string | null
  systemId: string | null
  responsable: string | null
  createdAt: string
  dateCompletion: string | null
  showEdsmPanel: boolean | null
  showMemberStatusPanel: boolean | null
  assignees: MissionAssignee[]
}

interface MemberApi {
  id: string
  pseudo: string
  role: { id: string; name: string; appellation: string; rang: number }
  online: boolean
  localisation: string | null
}

interface WaypointApi {
  id: string
  system: { id: string; name: string }
}

interface DashboardPrefsApi {
  pinnedMissionIds: string[]
  pinnedSystemIds: string[]
}

interface EdsmPanelData {
  systeme: string
  faction: string | null
  allegiance: string | null
  government: string | null
  security: string | null
  population: number | null
}

interface ActivityEvent {
  id: string
  membre: string
  action: string
  detail: string
  date: string
  type: "nav" | "forum" | "build"
}

const PRIORITY_LABEL = ["", "CRITIQUE", "HAUTE", "NORMALE"]
const PRIORITY_COLOR = ["", "#e53030", "#f28c1a", "#2196f3"]

const TYPE_ICON: Record<string, string> = {
  COMBAT: "◈",
  EXPLORATION: "◎",
  LOGISTIQUE: "◇",
  ESCORTE: "◉",
  INTERNE: "◌",
}

// Style par appellation (titre affiché devant le pseudo) — voir Members.tsx pour
// le même mapping, dupliqué ici volontairement (petit composant, pas de module partagé).
const APPELLATION_COLOR: Record<string, string> = {
  "Ingénieur":       "#06b6d4",
  "Amiral":          "#f28c1a",
  "Commandant":      "#e53030",
  "Capitaine":       "#a78bfa",
  "Lieutenant":      "#2196f3",
  "Second":          "#0fc882",
  "Commando":        "#0fc882",
  "Quartier maitre": "#8aabca",
  "Matelot":         "#8aabca",
  "Moussaillon":     "#3d5878",
}

function roleBadgeFor(appellation: string) {
  const color = APPELLATION_COLOR[appellation] ?? "#8aabca"
  return { color, bg: `${color}1f`, short: appellation.slice(0, 3).toUpperCase() }
}

const ACTIVITY_TYPE_COLOR: Record<ActivityEvent["type"], string> = {
  nav: "#2196f3",
  forum: "#8aabca",
  build: "#a78bfa",
}

function EdsmPanel({ missionId }: { missionId: string }) {
  const [data, setData] = useState<EdsmPanelData | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/missions/${missionId}/edsm-panel`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
  }, [missionId])

  if (data === undefined) {
    return <div className="font-jbmono text-[11px]" style={{ color: "#1c3050" }}>Chargement EDSM…</div>
  }
  if (!data) {
    return <div className="font-jbmono text-[11px]" style={{ color: "#1c3050" }}>Système introuvable sur EDSM.</div>
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {[
        ["Faction", data.faction],
        ["Allégeance", data.allegiance],
        ["Gouvernement", data.government],
        ["Sécurité", data.security],
        ["Population", data.population?.toLocaleString() ?? null],
      ].filter(([, v]) => v).map(([label, value]) => (
        <div key={label as string}>
          <div className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>{label}</div>
          <div className="font-jbmono text-[11px]" style={{ color: "#8aabca" }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function PinnedMissionCard({ mission }: { mission: MissionApi }) {
  return (
    <div className="clip-corner-sm p-3" style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.25)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[11px]">📌</span>
        <span className="font-orbitron text-[12px] font-semibold" style={{ color: "#f28c1a" }}>{mission.title}</span>
      </div>
      {mission.showEdsmPanel && mission.systemId && (
        <div className="mb-2 pb-2" style={{ borderBottom: "1px solid #0c1828" }}>
          <EdsmPanel missionId={mission.id} />
        </div>
      )}
      {mission.showMemberStatusPanel && (
        <div>
          <div className="font-jbmono text-[10px] mb-1" style={{ color: "#3d5878" }}>MEMBRES ASSIGNÉS</div>
          <div className="flex flex-wrap gap-1.5">
            {mission.assignees.map(a => (
              <span key={a.id} className="font-jbmono text-[11px] px-1.5 py-0.5 clip-corner-sm flex items-center gap-1" style={{ background: "#040810", border: "1px solid #0c1828", color: "#8aabca" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.online ? "#0fc882" : "#3d5878" }} />
                {a.pseudo}
              </span>
            ))}
            {mission.assignees.length === 0 && (
              <span className="font-jbmono text-[11px]" style={{ color: "#1c3050" }}>Aucun membre assigné.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color = "#f28c1a" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      className="clip-corner p-4 flex flex-col gap-1 relative"
      style={{ background: "#07101e", border: "1px solid #12223a" }}
    >
      <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(90deg, ${color}50, transparent)` }} />
      <div className="font-orbitron text-[11px] tracking-widest mb-1" style={{ color: "#3d5878" }}>{label}</div>
      <div className="font-orbitron text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ onNavigate }: Props) {
  const { hasPermission } = useAuth()
  const canManagePins = hasPermission("dashboard.manage")

  const [squadron, setSquadron] = useState<SquadronApi | null>(null)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [savingDescription, setSavingDescription] = useState(false)
  const [missions, setMissions] = useState<MissionApi[]>([])
  const [members, setMembers] = useState<MemberApi[]>([])
  const [waypoints, setWaypoints] = useState<WaypointApi[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [prefs, setPrefs] = useState<DashboardPrefsApi>({ pinnedMissionIds: [], pinnedSystemIds: [] })
  const [loading, setLoading] = useState(true)
  const [savingPins, setSavingPins] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/squadron", { credentials: "include" }).then(r => r.json()),
      fetch("/api/missions", { credentials: "include" }).then(r => r.json()),
      fetch("/api/members", { credentials: "include" }).then(r => r.json()),
      fetch("/api/waypoints", { credentials: "include" }).then(r => r.json()),
      fetch("/api/activity", { credentials: "include" }).then(r => r.json()),
      fetch("/api/dashboard/preferences", { credentials: "include" }).then(r => r.json()),
    ])
      .then(([sq, mi, me, wp, ac, pr]) => {
        setSquadron(sq)
        setMissions(mi)
        setMembers(me)
        setWaypoints(Array.isArray(wp) ? wp : [])
        setActivity(ac)
        setPrefs(pr)
      })
      .finally(() => setLoading(false))
  }, [])

  const activeMissions = missions.filter(m => m.status === "EN_COURS")
  const closedMissions = missions.filter(m => m.status === "COMPLETE" || m.status === "ARCHIVE")
  const onlineMembers = members.filter(m => m.online)
  const systemCount = waypoints.length
  const pinnedMissions = missions.filter(m => prefs.pinnedMissionIds.includes(m.id))
  const pinnedSystems = waypoints.filter(w => prefs.pinnedSystemIds.includes(w.system.id))

  function startEditingDescription() {
    setDescriptionDraft(squadron?.description ?? "")
    setEditingDescription(true)
  }

  async function saveDescription() {
    setSavingDescription(true)
    try {
      const res = await fetch("/api/squadron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: descriptionDraft }),
      })
      if (res.ok) {
        setSquadron(await res.json())
        setEditingDescription(false)
      }
    } finally {
      setSavingDescription(false)
    }
  }

  async function togglePin(list: "pinnedMissionIds" | "pinnedSystemIds", id: string) {
    const current = prefs[list]
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    setSavingPins(true)
    try {
      const res = await fetch("/api/dashboard/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [list]: next }),
      })
      if (res.ok) setPrefs(await res.json())
    } finally {
      setSavingPins(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <span className="font-jbmono text-[13px]" style={{ color: "#3d5878" }}>CHARGEMENT DU TABLEAU DE BORD…</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Squadron banner */}
      {squadron && (
        <div
          className="clip-corner p-5 relative overflow-hidden scan-line"
          style={{ background: "linear-gradient(135deg, #070e1c 0%, #0a1428 100%)", border: "1px solid #1c3050" }}
        >
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: "repeating-linear-gradient(0deg, #f28c1a 0, #f28c1a 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, #f28c1a 0, #f28c1a 1px, transparent 1px, transparent 24px)",
          }} />
          <div className="relative z-10">
            <div className="font-jbmono text-[12px] mb-1" style={{ color: "#3d5878" }}>ESCADRON ACTIF · SECTOR BUBBLE</div>
            <div className="font-orbitron text-xl font-bold mb-1 text-glow-amber" style={{ color: "#f28c1a" }}>
              [{squadron.tag}] {squadron.nom.toUpperCase()}
            </div>
            {editingDescription ? (
              <div className="mt-1">
                <textarea
                  value={descriptionDraft}
                  onChange={e => setDescriptionDraft(e.target.value)}
                  rows={2}
                  className="w-full font-jbmono text-xs bg-transparent outline-none px-2 py-1.5 clip-corner-sm resize-none"
                  style={{ color: "#8aabca", border: "1px solid #1c3050" }}
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={saveDescription}
                    disabled={savingDescription || !descriptionDraft.trim()}
                    className="font-orbitron text-[10px] px-2.5 py-1 clip-corner-sm tracking-wider transition-all disabled:opacity-50"
                    style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
                  >
                    {savingDescription ? "…" : "ENREGISTRER"}
                  </button>
                  <button
                    onClick={() => setEditingDescription(false)}
                    className="font-orbitron text-[10px] px-2.5 py-1 clip-corner-sm tracking-wider transition-all"
                    style={{ color: "#3d5878", border: "1px solid #12223a", background: "transparent" }}
                  >
                    ANNULER
                  </button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2">
                <div className="font-jbmono text-xs" style={{ color: "#8aabca" }}>{squadron.description}</div>
                {canManagePins && (
                  <button
                    onClick={startEditingDescription}
                    className="opacity-0 group-hover:opacity-100 transition-opacity font-orbitron text-[10px] flex-shrink-0"
                    style={{ color: "#3d5878" }}
                    title="Modifier la description"
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
            <div className="mt-3 flex gap-6">
              <div><span className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>FONDÉ · </span><span className="font-jbmono text-[12px]" style={{ color: "#8aabca" }}>{squadron.fondation}</span></div>
              <div><span className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>COMMANDANT · </span><span className="font-jbmono text-[12px]" style={{ color: "#f28c1a" }}>CMDR {squadron.commandant ?? "—"}</span></div>
              <div><span className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>EFFECTIF · </span><span className="font-jbmono text-[12px]" style={{ color: "#8aabca" }}>{squadron.totalMembres} PILOTES</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="MISSIONS ACTIVES" value={activeMissions.length} sub="opérations en cours" color="#f28c1a" />
        <StatCard label="PILOTES EN LIGNE" value={onlineMembers.length} sub={`sur ${members.length} membres actifs`} color="#0fc882" />
        <StatCard label="SYSTÈMES CARTOGRAPHIÉS" value={systemCount} sub="dans la base de données" color="#2196f3" />
        <StatCard label="MISSIONS COMPLÈTES" value={closedMissions.length} sub="total historique" color="#8aabca" />
      </div>

      {/* Épinglés */}
      {(pinnedMissions.length > 0 || pinnedSystems.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-px h-4" style={{ background: "#f28c1a" }} />
            <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>ÉPINGLÉ</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedMissions.map(m => <PinnedMissionCard key={m.id} mission={m} />)}
            {pinnedSystems.map(w => (
              <div key={w.id} className="clip-corner-sm p-3 flex items-center gap-2" style={{ background: "#070d1a", border: "1px solid rgba(33,150,243,0.25)" }}>
                <span className="text-[11px]">📌</span>
                <span className="font-orbitron text-[12px]" style={{ color: "#2196f3" }}>{w.system.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin : gestion des épinglages */}
      {canManagePins && (
        <div className="clip-corner-sm p-4" style={{ background: "#07101e", border: "1px solid #12223a" }}>
          <div className="font-jbmono text-[11px] mb-3" style={{ color: "#3d5878" }}>ÉPINGLER SUR LE TABLEAU DE BORD</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="font-jbmono text-[10px] mb-1.5" style={{ color: "#1c3050" }}>MISSIONS</div>
              <div className="flex flex-wrap gap-1.5">
                {missions.map(m => {
                  const active = prefs.pinnedMissionIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      disabled={savingPins}
                      onClick={() => togglePin("pinnedMissionIds", m.id)}
                      className="font-orbitron text-[10px] px-2 py-1 clip-corner-sm transition-all disabled:opacity-50"
                      style={{
                        color: active ? "#f28c1a" : "#3d5878",
                        background: active ? "rgba(242,140,26,0.1)" : "transparent",
                        border: `1px solid ${active ? "rgba(242,140,26,0.35)" : "#12223a"}`,
                      }}
                    >
                      {active ? "📌 " : ""}{m.title}
                    </button>
                  )
                })}
                {missions.length === 0 && <span className="font-jbmono text-[11px]" style={{ color: "#1c3050" }}>Aucune mission.</span>}
              </div>
            </div>
            <div>
              <div className="font-jbmono text-[10px] mb-1.5" style={{ color: "#1c3050" }}>SYSTÈMES</div>
              <div className="flex flex-wrap gap-1.5">
                {waypoints.map(w => {
                  const active = prefs.pinnedSystemIds.includes(w.system.id)
                  return (
                    <button
                      key={w.id}
                      disabled={savingPins}
                      onClick={() => togglePin("pinnedSystemIds", w.system.id)}
                      className="font-orbitron text-[10px] px-2 py-1 clip-corner-sm transition-all disabled:opacity-50"
                      style={{
                        color: active ? "#2196f3" : "#3d5878",
                        background: active ? "rgba(33,150,243,0.1)" : "transparent",
                        border: `1px solid ${active ? "rgba(33,150,243,0.35)" : "#12223a"}`,
                      }}
                    >
                      {active ? "📌 " : ""}{w.system.name}
                    </button>
                  )
                })}
                {waypoints.length === 0 && <span className="font-jbmono text-[11px]" style={{ color: "#1c3050" }}>Aucun système.</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Mission board */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-px h-4" style={{ background: "#f28c1a" }} />
              <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>OPÉRATIONS ACTIVES</span>
            </div>
            <button
              onClick={() => onNavigate("missions")}
              className="font-orbitron text-[11px] tracking-wider transition-colors"
              style={{ color: "#3d5878" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
            >
              VOIR TOUT →
            </button>
          </div>
          {activeMissions.length === 0 && (
            <div className="clip-corner-sm p-6 text-center font-jbmono text-[12px]" style={{ background: "#070d1a", border: "1px solid #12223a", color: "#3d5878" }}>
              AUCUNE OPÉRATION ACTIVE
            </div>
          )}
          {activeMissions.map(mission => (
            <div
              key={mission.id}
              className="clip-corner-sm p-4 transition-all cursor-pointer group"
              style={{ background: "#070d1a", border: "1px solid #12223a" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#1c3050")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#12223a")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-lg mt-0.5 flex-shrink-0" style={{ color: PRIORITY_COLOR[mission.priorite] }}>
                    {TYPE_ICON[mission.type]}
                  </span>
                  <div className="min-w-0">
                    <div className="font-orbitron text-[13px] font-semibold truncate mb-1" style={{ color: "#8aabca" }}>
                      {mission.title}
                    </div>
                    <div className="font-jbmono text-[12px] line-clamp-2" style={{ color: "#3d5878" }}>
                      {mission.description.slice(0, 100)}…
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span
                    className="font-orbitron text-[10px] tracking-wider px-2 py-0.5 clip-corner-sm"
                    style={{
                      color: PRIORITY_COLOR[mission.priorite],
                      background: `${PRIORITY_COLOR[mission.priorite]}18`,
                      border: `1px solid ${PRIORITY_COLOR[mission.priorite]}40`,
                    }}
                  >
                    {PRIORITY_LABEL[mission.priorite]}
                  </span>
                  <span className="font-jbmono text-[11px]" style={{ color: "#2196f3" }}>{mission.type}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 pt-2" style={{ borderTop: "1px solid #12223a" }}>
                {mission.systeme && (
                  <div className="font-jbmono text-[12px]">
                    <span style={{ color: "#3d5878" }}>SYS · </span>
                    <span style={{ color: "#8aabca" }}>{mission.systeme}</span>
                  </div>
                )}
                {mission.responsable && (
                  <div className="font-jbmono text-[12px]">
                    <span style={{ color: "#3d5878" }}>CMDR · </span>
                    <span style={{ color: "#f28c1a" }}>{mission.responsable}</span>
                  </div>
                )}
                <div className="font-jbmono text-[12px] ml-auto" style={{ color: "#3d5878" }}>{mission.createdAt.slice(0, 10)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Online members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-px h-4" style={{ background: "#0fc882" }} />
                <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>PILOTES EN LIGNE</span>
              </div>
              <button
                onClick={() => onNavigate("members")}
                className="font-orbitron text-[11px] tracking-wider transition-colors"
                style={{ color: "#3d5878" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
                onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
              >
                ROSTER →
              </button>
            </div>
            <div className="space-y-2">
              {onlineMembers.length === 0 && (
                <div className="font-jbmono text-[12px] text-center py-3" style={{ color: "#3d5878" }}>AUCUN PILOTE EN LIGNE</div>
              )}
              {onlineMembers.map(member => {
                const badge = roleBadgeFor(member.role.appellation)
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-3 py-2 clip-corner-sm"
                    style={{ background: "#070d1a", border: "1px solid #12223a" }}
                  >
                    <span className="pulse-dot w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#0fc882" }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-orbitron text-[12px] font-semibold truncate" style={{ color: "#8aabca" }}>
                        {member.pseudo}
                      </div>
                      <div className="font-jbmono text-[11px] truncate" style={{ color: "#3d5878" }}>
                        {member.localisation || "—"}
                      </div>
                    </div>
                    <div
                      className="font-orbitron text-[10px] px-1.5 py-0.5 clip-corner-sm flex-shrink-0"
                      style={{ color: badge.color, background: badge.bg }}
                    >
                      {badge.short}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity feed */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-px h-4" style={{ background: "#2196f3" }} />
              <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>ACTIVITÉ RÉCENTE</span>
            </div>
            <div className="space-y-2">
              {activity.length === 0 && (
                <div className="font-jbmono text-[12px] text-center py-3" style={{ color: "#3d5878" }}>AUCUNE ACTIVITÉ RÉCENTE</div>
              )}
              {activity.map(log => (
                <div key={log.id} className="flex items-start gap-2.5 py-1.5" style={{ borderBottom: "1px solid #0c1828" }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: ACTIVITY_TYPE_COLOR[log.type] || "#3d5878" }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-orbitron text-[11px] font-semibold" style={{ color: "#f28c1a" }}>{log.membre}</span>
                      <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>{log.action.toLowerCase()}</span>
                    </div>
                    <div className="font-jbmono text-[11px] truncate" style={{ color: "#8aabca" }}>{log.detail}</div>
                  </div>
                  <span className="font-jbmono text-[11px] flex-shrink-0" style={{ color: "#3d5878" }}>
                    {new Date(log.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
