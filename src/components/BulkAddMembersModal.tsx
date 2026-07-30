import { useState, type FormEvent } from "react"

interface BulkResult {
  line: number
  pseudo: string
  matricule: string | null
  generatedPassword: string | null
  error: string | null
}

export default function BulkAddMembersModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [raw, setRaw] = useState("")
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResults(null)

    const members = raw
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [pseudo, roleName] = line.split("|").map(s => s?.trim())
        return { pseudo, roleName }
      })

    if (members.length === 0) {
      setError("Au moins une ligne au format Pseudo | Rôle est requise.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ members }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de l'import.")
        return
      }
      setResults(data.results)
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  async function copyAll() {
    if (!results) return
    const text = results
      .filter(r => !r.error)
      .map(r => `${r.matricule}\t${r.pseudo}\t${r.generatedPassword}`)
      .join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  const succeeded = results?.filter(r => !r.error) ?? []
  const failed = results?.filter(r => r.error) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-2xl clip-corner p-6 max-h-[85vh] overflow-y-auto scrollable" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        <div className="font-orbitron text-[12px] tracking-widest mb-1" style={{ color: "#3d5878" }}>
          IMPORT EN MASSE
        </div>

        {!results ? (
          <form onSubmit={handleSubmit}>
            <div className="font-jbmono text-[11px] mb-4 leading-relaxed" style={{ color: "#3d5878" }}>
              Une ligne par membre : <span style={{ color: "#8aabca" }}>Pseudo | Nom du rôle</span> (nom exact d'un des 16 grades). Le matricule est généré automatiquement.
            </div>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              rows={14}
              placeholder={"Regosha | Amiral\nHelliora | Vice amiral\nCorbin | Capitaine de frégate"}
              className="w-full font-jbmono text-[12px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm resize-none"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />

            {error && (
              <div className="font-jbmono text-[12px] mt-3 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
                {error}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onClose} className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all" style={{ color: "#3d5878", background: "transparent", border: "1px solid #12223a" }}>
                ANNULER
              </button>
              <button
                type="submit"
                disabled={submitting || !raw.trim()}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
              >
                {submitting ? "IMPORT…" : "IMPORTER →"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="font-orbitron text-[12px] tracking-widest mb-3" style={{ color: succeeded.length > 0 ? "#0fc882" : "#e53030" }}>
              {succeeded.length} CRÉÉ{succeeded.length > 1 ? "S" : ""} · {failed.length} ÉCHOUÉ{failed.length > 1 ? "S" : ""}
            </div>

            {succeeded.length > 0 && (
              <div className="mb-4">
                <div className="font-jbmono text-[12px] mb-2 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
                  Ces mots de passe ne seront plus jamais affichés. Copiez-les et transmettez-les maintenant, hors application.
                </div>
                <div className="clip-corner-sm p-3 mb-2 max-h-64 overflow-y-auto scrollable" style={{ background: "#040810", border: "1px solid #0c1828" }}>
                  {succeeded.map(r => (
                    <div key={r.line} className="font-jbmono text-[11px] mb-1.5 grid grid-cols-3 gap-2" style={{ color: "#8aabca" }}>
                      <span style={{ color: "#3d5878" }}>{r.matricule}</span>
                      <span>{r.pseudo}</span>
                      <span style={{ color: "#f28c1a" }}>{r.generatedPassword}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={copyAll}
                  className="w-full font-orbitron text-[11px] py-2 clip-corner-sm transition-all"
                  style={{ color: "#8aabca", background: "transparent", border: "1px solid #12223a" }}
                >
                  {copied ? "COPIÉ ✓" : "COPIER TOUT (matricule / pseudo / mot de passe)"}
                </button>
              </div>
            )}

            {failed.length > 0 && (
              <div className="mb-4">
                <div className="font-jbmono text-[11px] mb-2" style={{ color: "#3d5878" }}>LIGNES ÉCHOUÉES (corrigez et réessayez seulement celles-ci)</div>
                {failed.map(r => (
                  <div key={r.line} className="font-jbmono text-[11px] mb-1 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.06)", border: "1px solid rgba(229,48,48,0.2)" }}>
                    ligne {r.line} ({r.pseudo || "?"}) — {r.error}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
            >
              FERMER
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
