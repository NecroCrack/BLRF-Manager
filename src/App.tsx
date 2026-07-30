import { useEffect, useState } from "react"
import Dashboard from "./components/Dashboard"
import StarMap from "./components/StarMap"
import Members from "./components/Members"
import Builds from "./components/Builds"
import Missions from "./components/Missions"
import Forum from "./components/Forum"
import Notes from "./components/Notes"
import Messages from "./components/Messages"
import Colonisation from "./components/Colonisation"
import RolesAdmin from "./components/RolesAdmin"
import Login from "./components/Login"
import ChangePasswordModal from "./components/ChangePasswordModal"
import AccountSettingsModal from "./components/AccountSettingsModal"
import { AuthProvider, useAuth } from "./context/AuthContext"

type Section = "dashboard" | "map" | "members" | "builds" | "missions" | "forum" | "notes" | "messages" | "colonisation" | "roles"

interface NavItem {
  id: Section
  label: string
  icon: React.ReactNode
  badge?: number
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function IconMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
      <line x1="8" y1="2" x2="8" y2="5" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="8" y1="11" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="2" y1="8" x2="5" y2="8" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="11" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function IconMembers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M10 14c0-2.21 1.34-4 3-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconBuilds() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 10L8 2l6 8H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <rect x="5" y="10" width="6" height="4" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function IconMissions() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="8" r="0.8" fill="currentColor"/>
    </svg>
  )
}
function IconForum() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3 11l-2 3 3-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="5" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 11.5L14 8l-3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
function IconKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="11" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.1 8.9L13.5 2.5M11.5 4.5l1.5 1.5M9.5 6.5L11 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
function IconMessages() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 3h14v8H5l-3 3v-3H1V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <line x1="4" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/>
      <line x1="4" y1="8.5" x2="9" y2="8.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}
function IconColonisation() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M8 5V11M5.5 6.5L10.5 9.5M10.5 6.5L5.5 9.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}
function IconRoles() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1l6 2.5v4c0 4-2.6 6.7-6 7.5-3.4-0.8-6-3.5-6-7.5v-4L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5.5 8l1.8 1.8L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconNotes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="12" cy="12" r="2.5" fill="#04070d" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M11.5 12h1M12 11.5v1" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}

const SECTION_TITLES: Record<Section, string> = {
  dashboard: "Tableau de Bord",
  map: "Carte Stellaire",
  members: "Membres de l'Escadron",
  builds: "Vaisseaux & Builds",
  missions: "Opérations",
  forum: "Forum de l'Escadron",
  notes: "Notes Personnelles",
  messages: "Messagerie",
  colonisation: "Colonisation",
  roles: "Rôles & Permissions",
}

interface SquadronApi {
  nom: string
  tag: string
}

function AppShell() {
  const { user, loading, logout, hasPermission } = useAuth()
  const [section, setSection] = useState<Section>("dashboard")
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [squadron, setSquadron] = useState<SquadronApi | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [activeMissionsCount, setActiveMissionsCount] = useState(0)

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch("/api/squadron", { credentials: "include" }).then(r => r.json()),
      fetch("/api/members", { credentials: "include" }).then(r => r.json()),
      fetch("/api/missions", { credentials: "include" }).then(r => r.json()),
    ]).then(([sq, members, missions]) => {
      setSquadron(sq)
      setOnlineCount(Array.isArray(members) ? members.filter((m: { online: boolean }) => m.online).length : 0)
      setActiveMissionsCount(Array.isArray(missions) ? missions.filter((m: { status: string }) => m.status === "EN_COURS").length : 0)
    })
  }, [user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#04070d" }}>
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT…</span>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const navItems: NavItem[] = [
    { id: "dashboard", label: "TABLEAU DE BORD", icon: <IconDashboard /> },
    { id: "map",       label: "CARTE STELLAIRE", icon: <IconMap /> },
    { id: "members",   label: "MEMBRES",         icon: <IconMembers />, badge: onlineCount },
    { id: "builds",    label: "VAISSEAUX",        icon: <IconBuilds /> },
    { id: "missions",  label: "OPÉRATIONS",       icon: <IconMissions />, badge: activeMissionsCount },
    { id: "forum",     label: "FORUM",            icon: <IconForum /> },
    { id: "notes",     label: "NOTES PRIVÉES",    icon: <IconNotes /> },
    { id: "messages",  label: "MESSAGES",          icon: <IconMessages /> },
    { id: "colonisation", label: "COLONISATION",   icon: <IconColonisation /> },
    ...(hasPermission("roles.manage") ? [{ id: "roles" as const, label: "RÔLES & PERMISSIONS", icon: <IconRoles /> }] : []),
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#04070d" }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ background: "#060a14", borderColor: "#12223a" }}
      >
        {/* Squadron header */}
        <div className="px-4 py-5 border-b" style={{ borderColor: "#12223a" }}>
          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 flex items-center justify-center clip-corner flex-shrink-0"
              style={{ background: "rgba(242,140,26,0.15)", border: "1px solid rgba(242,140,26,0.5)" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1L16 14H2L9 1z" stroke="#f28c1a" strokeWidth="1.4" fill="none"/>
                <circle cx="9" cy="10" r="2" fill="#f28c1a"/>
              </svg>
            </div>
            <div>
              <div className="font-orbitron text-[10px] font-bold tracking-widest" style={{ color: "#f28c1a" }}>
                [{squadron?.tag ?? "…"}]
              </div>
              <div className="font-orbitron text-[11px] font-semibold tracking-wider leading-tight" style={{ color: "#8aabca" }}>
                {squadron?.nom ?? "Chargement…"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="pulse-dot w-1.5 h-1.5 rounded-full" style={{ background: "#0fc882" }} />
            <span className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
              {onlineCount} PILOTES EN LIGNE
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto scrollable">
          {navItems.map(item => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all relative group"
                style={{
                  color: active ? "#f28c1a" : "#3d5878",
                  background: active ? "rgba(242,140,26,0.07)" : "transparent",
                  borderLeft: active ? "2px solid #f28c1a" : "2px solid transparent",
                }}
              >
                <span style={{ color: active ? "#f28c1a" : "#3d5878" }}>{item.icon}</span>
                <span className="font-orbitron text-[9px] tracking-widest flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className="font-jbmono text-[9px] px-1.5 py-0.5 clip-corner-sm"
                    style={{
                      background: active ? "rgba(242,140,26,0.2)" : "rgba(30,143,255,0.15)",
                      color: active ? "#f28c1a" : "#2196f3",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {!active && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(242,140,26,0.03)", borderLeft: "2px solid rgba(242,140,26,0.2)" }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Commander info */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "#12223a" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center clip-corner-sm flex-shrink-0 font-orbitron text-[9px] font-bold"
              style={{ background: "rgba(242,140,26,0.12)", color: "#f28c1a", border: "1px solid rgba(242,140,26,0.3)" }}
            >
              {user.pseudo.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-orbitron text-[9px] font-semibold truncate" style={{ color: "#8aabca" }}>
                CMDR {user.pseudo}
              </div>
              <div className="font-jbmono text-[9px]" style={{ color: "#f28c1a" }}>
                {user.role.name}
              </div>
            </div>
            <button
              onClick={() => setShowAccountSettings(true)}
              title="Paramètres de compte"
              className="flex-shrink-0 p-1.5 transition-colors"
              style={{ color: "#3d5878" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
            >
              <IconSettings />
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              title="Changer mon mot de passe"
              className="flex-shrink-0 p-1.5 transition-colors"
              style={{ color: "#3d5878" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
            >
              <IconKey />
            </button>
            <button
              onClick={logout}
              title="Déconnexion"
              className="flex-shrink-0 p-1.5 transition-colors"
              style={{ color: "#3d5878" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#e53030")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showAccountSettings && <AccountSettingsModal onClose={() => setShowAccountSettings(false)} />}

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header
          className="h-11 flex-shrink-0 flex items-center justify-between px-6 border-b"
          style={{ background: "#060a14", borderColor: "#12223a" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-5" style={{ background: "#f28c1a" }} />
            <span className="font-orbitron text-xs font-semibold tracking-widest" style={{ color: "#8aabca" }}>
              {SECTION_TITLES[section].toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
              STARDATE 3308-01-14 · 14:32 GST
            </div>
            <div
              className="px-2 py-1 clip-corner-sm font-jbmono text-[9px] tracking-wider"
              style={{ background: "rgba(15,200,130,0.1)", color: "#0fc882", border: "1px solid rgba(15,200,130,0.25)" }}
            >
              SYSTÈMES NOMINAUX
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollable" style={{ background: "#04070d" }}>
          {section === "dashboard" && <Dashboard onNavigate={setSection} />}
          {section === "map"       && <StarMap />}
          {section === "members"   && <Members />}
          {section === "builds"    && <Builds />}
          {section === "missions"  && <Missions />}
          {section === "forum"     && <Forum />}
          {section === "notes"     && <Notes />}
          {section === "messages"  && <Messages />}
          {section === "colonisation" && <Colonisation />}
          {section === "roles"     && <RolesAdmin />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
