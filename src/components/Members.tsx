import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../context/AuthContext"
import NewMemberModal from "./NewMemberModal"
import BulkAddMembersModal from "./BulkAddMembersModal"

interface MemberRole {
  id: string
  name: string
  appellation: string
  rang: number
}

interface MemberApi {
  id: string
  matricule: string
  pseudo: string
  role: MemberRole
  actif: boolean
  online: boolean
  localisation: string | null
  localisationAuto: boolean
  localisationUpdatedAt: string | null
  vaisseau: string | null
  vaisseauModele: string | null
  specialite: string | null
  combats: number
  explorations: number
  commerce: number
  dateJoin: string
}

// Style par appellation (titre affiché devant le pseudo, partagé par plusieurs
// grades) — un style neutre de repli couvre toute appellation personnalisée
// ajoutée ensuite par un membre habilité à gérer les rôles.
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
const DEFAULT_RANK_COLOR = "#8aabca"

function rankConfigFor(role: MemberRole) {
  const color = APPELLATION_COLOR[role.appellation] ?? DEFAULT_RANK_COLOR
  return { color, short: role.appellation.slice(0, 3).toUpperCase(), bg: `${color}1f`, label: role.appellation }
}

function MemberRow({ member, selected, onSelect }: { member: MemberApi; selected: boolean; onSelect: () => void }) {
  const cfg = rankConfigFor(member.role)
  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer transition-all"
      style={{ borderBottom: "1px solid #0c1828", background: selected ? "rgba(242,140,26,0.04)" : "transparent" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.01)" }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent" }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-8 h-8 clip-corner-sm flex items-center justify-center font-orbitron text-[11px] font-bold"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
            >
              {member.pseudo.slice(0, 2).toUpperCase()}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border"
              style={{
                background: member.online ? "#0fc882" : "#3d5878",
                borderColor: "#04070d",
                boxShadow: member.online ? "0 0 4px #0fc88260" : "none",
              }}
            />
          </div>
          <div>
            <div className="font-orbitron text-[13px] font-semibold" style={{ color: selected ? "#f28c1a" : "#8aabca" }}>
              CMDR {member.pseudo}
            </div>
            <div className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>{member.matricule}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className="font-orbitron text-[11px] px-2 py-1 clip-corner-sm"
          style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
          title={member.role.name}
        >
          {member.role.appellation}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-jbmono text-[12px]" style={{ color: "#8aabca" }}>{member.vaisseauModele || "—"}</div>
        {member.vaisseau && <div className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>«{member.vaisseau}»</div>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full" style={{ background: member.online ? "#0fc882" : "#3d5878" }} />
          <span className="font-jbmono text-[12px]" style={{ color: "#8aabca" }}>{member.localisation || "—"}</span>
          {member.localisationAuto && (
            <span className="font-orbitron text-[9px] px-1 clip-corner-sm" style={{ color: "#0fc882", background: "rgba(15,200,130,0.1)" }}>AUTO</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>{member.specialite || "—"}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span
          className="font-orbitron text-[11px] px-1.5 py-0.5 clip-corner-sm"
          style={{ color: member.online ? "#0fc882" : "#3d5878", background: member.online ? "rgba(15,200,130,0.1)" : "rgba(61,88,120,0.1)" }}
        >
          {member.online ? "EN LIGNE" : "HORS LIGNE"}
        </span>
      </td>
    </tr>
  )
}

function MemberDetail({ member, isSelf, canAdminister, onClose, onUpdated }: { member: MemberApi; isSelf: boolean; canAdminister: boolean; onClose: () => void; onUpdated: (m: MemberApi) => void }) {
  const { hasPermission } = useAuth()
  const canSeeStats = isSelf || hasPermission("stats.view")
  const cfg = rankConfigFor(member.role)
  const maxStat = Math.max(member.combats, member.explorations, member.commerce) || 1

  const [editing, setEditing] = useState(false)
  const [localisation, setLocalisation] = useState(member.localisation || "")
  const [vaisseau, setVaisseau] = useState(member.vaisseau || "")
  const [vaisseauModele, setVaisseauModele] = useState(member.vaisseauModele || "")
  const [specialite, setSpecialite] = useState(member.specialite || "")
  const [saving, setSaving] = useState(false)

  const [roleOptions, setRoleOptions] = useState<MemberRole[]>([])
  const [changingRole, setChangingRole] = useState(false)

  useEffect(() => {
    if (!canAdminister) return
    fetch("/api/roles", { credentials: "include" })
      .then(r => (r.ok ? r.json() : []))
      .then((data: Array<MemberRole & { protege: boolean }>) => setRoleOptions(data))
  }, [canAdminister])

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch("/api/members/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ localisation, vaisseau, vaisseauModele, specialite }),
      })
      if (res.ok) {
        onUpdated(await res.json())
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function changeRole(roleId: string) {
    setChangingRole(true)
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roleId }),
      })
      if (res.ok) onUpdated(await res.json())
    } finally {
      setChangingRole(false)
    }
  }

  return (
    <div
      className="clip-corner p-5 relative"
      style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.25)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, #f28c1a50, transparent)" }} />

      <button
        onClick={onClose}
        className="absolute top-4 right-4 font-orbitron text-[11px] transition-colors"
        style={{ color: "#3d5878" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
        onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
      >
        ✕ FERMER
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-14 h-14 clip-corner flex items-center justify-center font-orbitron text-lg font-bold flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
        >
          {member.pseudo.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-orbitron text-base font-bold mb-1" style={{ color: "#8aabca" }}>
            CMDR {member.pseudo}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-orbitron text-[11px] px-2 py-0.5 clip-corner-sm"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
            >
              {member.role.appellation}
            </span>
            {member.role.name !== member.role.appellation && (
              <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>({member.role.name})</span>
            )}
            <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>{member.matricule}</span>
          </div>
        </div>
      </div>

      {canAdminister && roleOptions.length > 0 && (
        <div className="mb-4">
          <div className="font-jbmono text-[11px] mb-1" style={{ color: "#3d5878" }}>ASSIGNER UN RÔLE</div>
          <select
            value={member.role.id}
            disabled={changingRole}
            onChange={e => changeRole(e.target.value)}
            className="w-full font-jbmono text-[12px] px-2 py-1.5 clip-corner-sm disabled:opacity-50"
            style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
          >
            {roleOptions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {editing ? (
        <div className="space-y-2 mb-4">
          {member.localisationAuto && (
            <div className="font-jbmono text-[11px] px-2 py-1.5 clip-corner-sm" style={{ color: "#0fc882", background: "rgba(15,200,130,0.08)" }}>
              Localisation gérée automatiquement par le plugin EDMC.
            </div>
          )}
          {[
            ...(member.localisationAuto ? [] : [{ label: "LOCALISATION", value: localisation, set: setLocalisation }]),
            { label: "VAISSEAU (CALLSIGN)", value: vaisseau, set: setVaisseau },
            { label: "MODÈLE DE VAISSEAU", value: vaisseauModele, set: setVaisseauModele },
            { label: "SPÉCIALITÉ", value: specialite, set: setSpecialite },
          ].map(f => (
            <div key={f.label}>
              <div className="font-jbmono text-[11px] mb-0.5" style={{ color: "#3d5878" }}>{f.label}</div>
              <input
                value={f.value}
                onChange={e => f.set(e.target.value)}
                className="w-full font-jbmono text-[12px] bg-transparent outline-none px-2 py-1.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 font-orbitron text-[11px] py-1.5 clip-corner-sm transition-all"
              style={{ border: "1px solid #12223a", color: "#3d5878", background: "transparent" }}
            >
              ANNULER
            </button>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex-1 font-orbitron text-[11px] py-1.5 clip-corner-sm transition-all disabled:opacity-50"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
            >
              {saving ? "…" : "ENREGISTRER"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "VAISSEAU", value: member.vaisseauModele || "—" },
              { label: "CALLSIGN", value: member.vaisseau ? `«${member.vaisseau}»` : "—" },
              { label: member.localisationAuto ? "LOCALISATION (AUTO)" : "LOCALISATION", value: member.localisation || "—" },
              { label: "REJOINT", value: member.dateJoin.slice(0, 10) },
              { label: "SPÉCIALITÉ", value: member.specialite || "—" },
              { label: "STATUT", value: member.online ? "EN LIGNE" : "HORS LIGNE" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="font-jbmono text-[11px] mb-0.5" style={{ color: "#3d5878" }}>{label}</div>
                <div className="font-jbmono text-[12px]" style={{ color: "#8aabca" }}>{value}</div>
              </div>
            ))}
          </div>

          {isSelf && (
            <button
              onClick={() => setEditing(true)}
              className="w-full mb-4 font-orbitron text-[11px] py-1.5 clip-corner-sm transition-all"
              style={{ border: "1px solid #12223a", color: "#8aabca", background: "transparent" }}
            >
              MODIFIER MON PROFIL
            </button>
          )}

          {/* Stats bars — réservées à soi-même ou aux membres avec la permission stats.view */}
          {canSeeStats ? (
            <div className="space-y-2">
              <div className="font-jbmono text-[11px] mb-2" style={{ color: "#3d5878" }}>STATISTIQUES DE CARRIÈRE</div>
              {[
                { label: "COMBAT",      value: member.combats, color: "#e53030" },
                { label: "EXPLORATION", value: member.explorations, color: "#2196f3" },
                { label: "COMMERCE",    value: member.commerce, color: "#0fc882" },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="flex justify-between mb-1">
                    <span className="font-orbitron text-[11px]" style={{ color: "#3d5878" }}>{stat.label}</span>
                    <span className="font-jbmono text-[11px]" style={{ color: stat.color }}>
                      {stat.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-sm overflow-hidden" style={{ background: "#0c1828" }}>
                    <div
                      className="h-full transition-all"
                      style={{ width: `${(stat.value / maxStat) * 100}%`, background: stat.color, opacity: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-jbmono text-[11px] text-center py-3" style={{ color: "#1c3050" }}>
              🔒 Statistiques de carrière réservées
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Members() {
  const { user, hasPermission } = useAuth()
  const canAdminister = hasPermission("members.administer")

  const [members, setMembers] = useState<MemberApi[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("Tous")
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewMember, setShowNewMember] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)

  function fetchMembers() {
    return fetch("/api/members", { credentials: "include" })
      .then(r => r.json())
      .then(setMembers)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  const selected = members.find(m => m.id === selectedId) || null

  // Filtres construits dynamiquement depuis les rôles réellement présents dans le roster
  // (les rôles étant désormais personnalisables, on ne peut plus se fier à une liste figée).
  const roleFilters = useMemo(() => {
    const seen = new Map<string, MemberRole>()
    for (const m of members) seen.set(m.role.name, m.role)
    return Array.from(seen.values()).sort((a, b) => b.rang - a.rang)
  }, [members])

  const filtered = members.filter(m =>
    (filter === "Tous" || m.role.name === filter) &&
    (!onlineOnly || m.online)
  )

  const onlineCount = members.filter(m => m.online).length

  function handleUpdated(updated: MemberApi) {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[13px]" style={{ color: "#3d5878" }}>CHARGEMENT DU ROSTER…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-px h-4" style={{ background: "#f28c1a" }} />
            <span className="font-orbitron text-[13px] tracking-widest" style={{ color: "#8aabca" }}>
              ROSTER DE L'ESCADRON
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-jbmono text-[12px]" style={{ color: "#3d5878" }}>
              {onlineCount} EN LIGNE · {members.length} TOTAL
            </span>
            {canAdminister && (
              <>
                <button
                  onClick={() => setShowBulkAdd(true)}
                  className="font-orbitron text-[11px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
                  style={{ color: "#2196f3", background: "rgba(33,150,243,0.1)", border: "1px solid rgba(33,150,243,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(33,150,243,0.18)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(33,150,243,0.1)" }}
                >
                  IMPORT EN MASSE
                </button>
                <button
                  onClick={() => setShowNewMember(true)}
                  className="font-orbitron text-[11px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
                  style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.18)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.1)" }}
                >
                  + NOUVEAU MEMBRE
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter("Tous")}
            className="font-orbitron text-[11px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
            style={{
              color: filter === "Tous" ? "#f28c1a" : "#3d5878",
              background: filter === "Tous" ? "rgba(242,140,26,0.12)" : "#070d1a",
              border: `1px solid ${filter === "Tous" ? "#f28c1a50" : "#12223a"}`,
            }}
          >
            TOUS
          </button>
          {roleFilters.map(role => {
            const active = filter === role.name
            const cfg = rankConfigFor(role)
            return (
              <button
                key={role.id}
                onClick={() => setFilter(role.name)}
                className="font-orbitron text-[11px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
                style={{
                  color: active ? cfg.color : "#3d5878",
                  background: active ? cfg.bg : "#070d1a",
                  border: `1px solid ${active ? cfg.color + "50" : "#12223a"}`,
                }}
              >
                {role.name}
              </button>
            )
          })}
          <button
            onClick={() => setOnlineOnly(!onlineOnly)}
            className="font-orbitron text-[11px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all ml-2"
            style={{
              color: onlineOnly ? "#0fc882" : "#3d5878",
              background: onlineOnly ? "rgba(15,200,130,0.1)" : "#070d1a",
              border: `1px solid ${onlineOnly ? "rgba(15,200,130,0.35)" : "#12223a"}`,
            }}
          >
            ● EN LIGNE SEULEMENT
          </button>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div
            className="clip-corner overflow-hidden"
            style={{ border: "1px solid #12223a", background: "#07101e" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #12223a" }}>
                  {["COMMANDANT", "RANG", "VAISSEAU", "LOCALISATION", "SPÉCIALITÉ", "STATUT"].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-orbitron text-[11px] tracking-widest"
                      style={{ color: "#3d5878", background: "#060b17" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    selected={selectedId === member.id}
                    onSelect={() => setSelectedId(selectedId === member.id ? null : member.id)}
                  />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-8 text-center font-jbmono text-[13px]" style={{ color: "#3d5878" }}>
                AUCUN MEMBRE NE CORRESPOND AUX FILTRES
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-64 flex-shrink-0">
            <MemberDetail
              member={selected}
              isSelf={selected.id === user?.id}
              canAdminister={canAdminister}
              onClose={() => setSelectedId(null)}
              onUpdated={handleUpdated}
            />
          </div>
        )}
      </div>

      {showNewMember && <NewMemberModal onClose={() => setShowNewMember(false)} />}
      {showBulkAdd && <BulkAddMembersModal onClose={() => setShowBulkAdd(false)} onCreated={fetchMembers} />}
    </div>
  )
}
