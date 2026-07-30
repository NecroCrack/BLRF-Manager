import { useState, useEffect, type FormEvent } from "react"

interface RoleOption {
  id: string
  name: string
  rang: number
}

interface CreatedMember {
  matricule: string
  pseudo: string
  generatedPassword: string
}

export default function NewMemberModal({ onClose }: { onClose: () => void }) {
  const [matricule, setMatricule] = useState("")
  const [pseudo, setPseudo] = useState("")
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [roleId, setRoleId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<CreatedMember | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/roles", { credentials: "include" })
      .then(res => (res.ok ? res.json() : []))
      .then((data: RoleOption[]) => {
        setRoles(data)
        if (data.length > 0) setRoleId(data[0].id)
      })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ matricule, pseudo, roleId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de la création du membre.")
        return
      }
      setCreated({ matricule: data.matricule, pseudo: data.pseudo, generatedPassword: data.generatedPassword })
    } finally {
      setSubmitting(false)
    }
  }

  async function copyPassword() {
    if (!created) return
    await navigator.clipboard.writeText(created.generatedPassword)
    setCopied(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-md clip-corner p-6" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        {!created ? (
          <form onSubmit={handleSubmit}>
            <div className="font-orbitron text-[12px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
              NOUVEAU MEMBRE
            </div>

            <div className="mb-4">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                MATRICULE
              </label>
              <input
                type="text"
                value={matricule}
                onChange={e => setMatricule(e.target.value)}
                placeholder="BLRF-002"
                required
                className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
            </div>

            <div className="mb-4">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                PSEUDO
              </label>
              <input
                type="text"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                required
                className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
            </div>

            <div className="mb-5">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                RÔLE
              </label>
              <select
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                className="w-full font-jbmono text-[14px] px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div
                className="font-jbmono text-[12px] mb-4 px-3 py-2 clip-corner-sm"
                style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all"
                style={{ color: "#3d5878", background: "transparent", border: "1px solid #12223a" }}
              >
                ANNULER
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
              >
                {submitting ? "CRÉATION…" : "CRÉER →"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="font-orbitron text-[12px] tracking-widest mb-3" style={{ color: "#0fc882" }}>
              MEMBRE CRÉÉ : {created.matricule} — {created.pseudo}
            </div>
            <div
              className="font-jbmono text-[12px] mb-4 px-3 py-2 clip-corner-sm"
              style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}
            >
              Ce mot de passe ne sera plus jamais affiché. Transmettez-le au pilote maintenant, hors application.
            </div>
            <div
              className="font-jbmono text-sm mb-4 px-3 py-3 clip-corner-sm text-center tracking-wider"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.08)", border: "1px solid rgba(242,140,26,0.3)" }}
            >
              {created.generatedPassword}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyPassword}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all"
                style={{ color: "#8aabca", background: "transparent", border: "1px solid #12223a" }}
              >
                {copied ? "COPIÉ ✓" : "COPIER"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
              >
                FERMER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
