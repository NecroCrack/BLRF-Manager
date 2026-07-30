import { useEffect, useState, type FormEvent } from "react"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const { login } = useAuth()
  const [matricule, setMatricule] = useState("")
  const [motDePasse, setMotDePasse] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [squadron, setSquadron] = useState<{ nom: string; tag: string } | null>(null)

  useEffect(() => {
    fetch("/api/squadron")
      .then(r => r.json())
      .then(setSquadron)
      .catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(matricule, motDePasse)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la connexion.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#04070d" }}>
      <div className="w-full max-w-md">
        {/* Squadron header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 flex items-center justify-center clip-corner"
            style={{ background: "rgba(242,140,26,0.15)", border: "1px solid rgba(242,140,26,0.5)" }}
          >
            <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L16 14H2L9 1z" stroke="#f28c1a" strokeWidth="1.4" fill="none" />
              <circle cx="9" cy="10" r="2" fill="#f28c1a" />
            </svg>
          </div>
          <div className="text-center">
            <div className="font-orbitron text-[12px] font-bold tracking-widest" style={{ color: "#f28c1a" }}>
              [{squadron?.tag ?? "…"}]
            </div>
            <div className="font-orbitron text-sm font-semibold tracking-wider" style={{ color: "#8aabca" }}>
              {squadron?.nom ?? ""}
            </div>
          </div>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="clip-corner p-6 scan-line"
          style={{ background: "#070d1a", border: "1px solid #12223a" }}
        >
          <div className="font-orbitron text-[12px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
            AUTHENTIFICATION REQUISE
          </div>

          <div className="mb-4">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
              MATRICULE
            </label>
            <input
              type="text"
              value={matricule}
              onChange={e => setMatricule(e.target.value)}
              placeholder="BLRF-001"
              autoComplete="username"
              required
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-5">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
              MOT DE PASSE
            </label>
            <input
              type="password"
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              autoComplete="current-password"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
            style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
          >
            {submitting ? "CONNEXION EN COURS…" : "SE CONNECTER →"}
          </button>
        </form>
      </div>
    </div>
  )
}
