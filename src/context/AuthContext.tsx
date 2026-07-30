import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

// Dupliqué depuis server/permissions.ts (PERMISSION_KEYS) : le front ne peut pas importer
// le code serveur. Les rôles eux-mêmes sont désormais dynamiques (créés par le commandant),
// seul ce catalogue de droits reste un ensemble fixe défini en code.
export type PermissionKey =
  | "map.edit"
  | "missions.manage"
  | "squadron.manage"
  | "members.administer"
  | "forum.moderate"
  | "stats.view"
  | "builds.approve"
  | "roles.manage"
  | "dashboard.manage"
  | "colonisation.add"

export interface AuthRole {
  id: string
  name: string
  appellation: string
  rang: number
  protege: boolean
}

export interface AuthUser {
  id: string
  matricule: string
  pseudo: string
  role: AuthRole
  permissions: PermissionKey[]
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (matricule: string, motDePasse: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (key: PermissionKey) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => (res.ok ? res.json() : null))
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  // Battement de coeur de présence : "en ligne" est dérivé de lastSeenAt côté serveur,
  // pas d'un canal temps réel — voir la discussion Socket.io dans le guide de développement.
  useEffect(() => {
    if (!user) return
    const ping = () => fetch("/api/members/me/heartbeat", { method: "POST", credentials: "include" })
    ping()
    const interval = setInterval(ping, 60_000)
    return () => clearInterval(interval)
  }, [user])

  async function login(matricule: string, motDePasse: string) {
    setError(null)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ matricule, motDePasse }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const message = data?.error || "Échec de la connexion."
      setError(message)
      throw new Error(message)
    }

    setUser(await res.json())
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    setUser(null)
  }

  function hasPermission(key: PermissionKey): boolean {
    return user?.permissions.includes(key) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider")
  return ctx
}
