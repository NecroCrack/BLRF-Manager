import { useState, type FormEvent } from "react"

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [ancienMotDePasse, setAncien] = useState("")
  const [nouveauMotDePasse, setNouveau] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (nouveauMotDePasse !== confirmation) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/members/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ancienMotDePasse, nouveauMotDePasse }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || "Échec du changement de mot de passe.")
        return
      }

      setSuccess(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-md clip-corner p-6" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        {success ? (
          <div>
            <div className="font-orbitron text-[12px] tracking-widest mb-4" style={{ color: "#0fc882" }}>
              MOT DE PASSE MIS À JOUR
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
            >
              FERMER
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="font-orbitron text-[12px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
              CHANGER MON MOT DE PASSE
            </div>

            <div className="mb-4">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                MOT DE PASSE ACTUEL
              </label>
              <input
                type="password"
                value={ancienMotDePasse}
                onChange={e => setAncien(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
            </div>

            <div className="mb-4">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                NOUVEAU MOT DE PASSE
              </label>
              <input
                type="password"
                value={nouveauMotDePasse}
                onChange={e => setNouveau(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
            </div>

            <div className="mb-5">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                CONFIRMER LE NOUVEAU MOT DE PASSE
              </label>
              <input
                type="password"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
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
                {submitting ? "ENVOI…" : "VALIDER →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
