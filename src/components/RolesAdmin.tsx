import { useEffect, useState } from "react"
import type { PermissionKey } from "../context/AuthContext"

interface PermissionApi {
  key: PermissionKey
  label: string
  category: string
}

interface RoleApi {
  id: string
  name: string
  rang: number
  protege: boolean
  permissions: PermissionKey[]
  membresCount: number
}

const EMPTY_FORM = { name: "", rang: 0, permissions: new Set<PermissionKey>() }

export default function RolesAdmin() {
  const [roles, setRoles] = useState<RoleApi[]>([])
  const [permissions, setPermissions] = useState<PermissionApi[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch("/api/roles", { credentials: "include" }).then(r => r.json()),
      fetch("/api/permissions", { credentials: "include" }).then(r => r.json()),
    ]).then(([rolesData, permsData]) => {
      setRoles(rolesData)
      setPermissions(permsData)
    }).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const selectedRole = selectedId && selectedId !== "new" ? roles.find(r => r.id === selectedId) ?? null : null

  function selectRole(role: RoleApi) {
    setSelectedId(role.id)
    setForm({ name: role.name, rang: role.rang, permissions: new Set(role.permissions) })
    setError(null)
  }

  function startNew() {
    setSelectedId("new")
    setForm({ name: "", rang: 0, permissions: new Set() })
    setError(null)
  }

  function togglePermission(key: PermissionKey) {
    setForm(f => {
      const next = new Set(f.permissions)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...f, permissions: next }
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const body = { name: form.name, rang: form.rang, permissions: Array.from(form.permissions) }
      const res = await fetch(
        selectedId === "new" ? "/api/roles" : `/api/roles/${selectedId}`,
        {
          method: selectedId === "new" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de l'enregistrement du rôle.")
        return
      }
      setSelectedId(null)
      setForm(EMPTY_FORM)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function remove(role: RoleApi) {
    setError(null)
    const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE", credentials: "include" })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error || "Échec de la suppression du rôle.")
      return
    }
    setSelectedId(null)
    load()
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT DES RÔLES…</span>
      </div>
    )
  }

  const categories = Array.from(new Set(permissions.map(p => p.category)))
  const editing = selectedId !== null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-px h-4" style={{ background: "#f28c1a" }} />
          <span className="font-orbitron text-[11px] tracking-widest" style={{ color: "#8aabca" }}>
            RÔLES & PERMISSIONS
          </span>
        </div>
        <button
          onClick={startNew}
          className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
          style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
        >
          + NOUVEAU RÔLE
        </button>
      </div>

      <div className="flex gap-5">
        {/* Role list */}
        <div className="w-64 flex-shrink-0 space-y-2">
          {roles.map(role => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className="w-full text-left px-3 py-2.5 clip-corner-sm transition-all"
              style={{
                background: selectedId === role.id ? "rgba(242,140,26,0.06)" : "#070d1a",
                border: `1px solid ${selectedId === role.id ? "rgba(242,140,26,0.35)" : "#12223a"}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-orbitron text-[10px] font-semibold" style={{ color: "#8aabca" }}>
                  {role.name}
                </span>
                {role.protege && (
                  <span className="font-jbmono text-[8px]" style={{ color: "#f28c1a" }}>🔒</span>
                )}
              </div>
              <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>
                rang {role.rang} · {role.membresCount} membre{role.membresCount > 1 ? "s" : ""}
              </div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {!editing ? (
            <div className="clip-corner p-8 text-center font-jbmono text-[11px]" style={{ background: "#070d1a", border: "1px solid #12223a", color: "#3d5878" }}>
              Sélectionnez un rôle à gauche, ou créez-en un nouveau.
            </div>
          ) : (
            <div className="clip-corner p-5" style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.25)" }}>
              {selectedRole?.protege && (
                <div className="font-jbmono text-[10px] mb-4 px-3 py-2 clip-corner-sm" style={{ color: "#f28c1a", background: "rgba(242,140,26,0.08)", border: "1px solid rgba(242,140,26,0.25)" }}>
                  🔒 Rôle protégé — garantit toujours au moins un super-admin, non modifiable/supprimable.
                </div>
              )}

              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <div className="font-jbmono text-[9px] mb-1" style={{ color: "#3d5878" }}>NOM DU RÔLE</div>
                  <input
                    value={form.name}
                    disabled={!!selectedRole?.protege}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full font-jbmono text-[11px] bg-transparent outline-none px-3 py-2 clip-corner-sm disabled:opacity-50"
                    style={{ color: "#8aabca", border: "1px solid #12223a" }}
                  />
                </div>
                <div className="w-24">
                  <div className="font-jbmono text-[9px] mb-1" style={{ color: "#3d5878" }}>RANG</div>
                  <input
                    type="number"
                    value={form.rang}
                    disabled={!!selectedRole?.protege}
                    onChange={e => setForm(f => ({ ...f, rang: Number(e.target.value) }))}
                    className="w-full font-jbmono text-[11px] bg-transparent outline-none px-3 py-2 clip-corner-sm disabled:opacity-50"
                    style={{ color: "#8aabca", border: "1px solid #12223a" }}
                  />
                </div>
              </div>

              <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>DROITS ACCORDÉS</div>
              <div className="space-y-3 mb-5 max-h-80 overflow-y-auto scrollable pr-1">
                {categories.map(cat => (
                  <div key={cat}>
                    <div className="font-orbitron text-[8px] tracking-widest mb-1.5" style={{ color: "#1c3050" }}>
                      {cat.toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      {permissions.filter(p => p.category === cat).map(p => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 px-2 py-1.5 clip-corner-sm cursor-pointer transition-all"
                          style={{ background: form.permissions.has(p.key) ? "rgba(242,140,26,0.06)" : "transparent" }}
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions.has(p.key)}
                            disabled={!!selectedRole?.protege}
                            onChange={() => togglePermission(p.key)}
                          />
                          <span className="font-jbmono text-[10px]" style={{ color: "#8aabca" }}>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="font-jbmono text-[10px] mb-4 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedId(null); setForm(EMPTY_FORM) }}
                  className="flex-1 font-orbitron text-[9px] py-2 clip-corner-sm transition-all"
                  style={{ border: "1px solid #12223a", color: "#3d5878", background: "transparent" }}
                >
                  ANNULER
                </button>
                {selectedRole && !selectedRole.protege && (
                  <button
                    onClick={() => remove(selectedRole)}
                    className="flex-1 font-orbitron text-[9px] py-2 clip-corner-sm transition-all"
                    style={{ color: "#e53030", border: "1px solid rgba(229,48,48,0.3)", background: "rgba(229,48,48,0.08)" }}
                  >
                    SUPPRIMER
                  </button>
                )}
                {!selectedRole?.protege && (
                  <button
                    onClick={save}
                    disabled={saving || !form.name.trim()}
                    className="flex-1 font-orbitron text-[9px] py-2 clip-corner-sm transition-all disabled:opacity-50"
                    style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
                  >
                    {saving ? "…" : "ENREGISTRER"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
