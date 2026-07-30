import { useState, type FormEvent } from "react"
import type { ShipBuildApi, ShipRoleKind } from "./Builds"

const ROLES: { value: ShipRoleKind; label: string }[] = [
  { value: "COMBAT", label: "Combat" },
  { value: "EXPLORATION", label: "Exploration" },
  { value: "MINAGE", label: "Minage" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "MULTIROLE", label: "Multirôle" },
]

export default function AddBuildModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: ShipBuildApi) => void }) {
  const [nom, setNom] = useState("")
  const [vaisseauModele, setVaisseauModele] = useState("")
  const [lienCoriolis, setLienCoriolis] = useState("")
  const [role, setRole] = useState<ShipRoleKind>("MULTIROLE")
  const [portee, setPortee] = useState("")
  const [notes, setNotes] = useState("")
  const [showSlef, setShowSlef] = useState(false)
  const [slefText, setSlefText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    let loadout: unknown
    if (showSlef && slefText.trim()) {
      try {
        loadout = JSON.parse(slefText)
      } catch {
        setError("Le loadout SLEF collé n'est pas un JSON valide.")
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nom,
          vaisseauModele: vaisseauModele || undefined,
          lienCoriolis: lienCoriolis || undefined,
          role,
          portee: portee || undefined,
          notes: notes || undefined,
          loadout,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de la création du build.")
        return
      }
      onCreated(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-md clip-corner p-6" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        <form onSubmit={handleSubmit}>
          <div className="font-orbitron text-[12px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
            NOUVEAU BUILD
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>NOM DU BUILD</label>
            <input
              value={nom} onChange={e => setNom(e.target.value)} required
              placeholder="Ex. Leviathan - Combat Build"
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
              MODÈLE DE VAISSEAU{showSlef && slefText.trim() ? " (OPTIONNEL — déduit du loadout)" : ""}
            </label>
            <input
              value={vaisseauModele} onChange={e => setVaisseauModele(e.target.value)} required={!(showSlef && slefText.trim())}
              placeholder="Ex. Anaconda"
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
              LIEN CORIOLIS{showSlef ? " (OPTIONNEL)" : ""}
            </label>
            <input
              value={lienCoriolis} onChange={e => setLienCoriolis(e.target.value)} required={!showSlef} type="url"
              placeholder="https://coriolis.io/outfit/..."
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowSlef(v => !v)}
              className="font-orbitron text-[10px] tracking-widest transition-colors"
              style={{ color: showSlef ? "#f28c1a" : "#3d5878" }}
            >
              {showSlef ? "▾" : "▸"} OU IMPORTER UN LOADOUT (SLEF, EXPORTÉ DE CORIOLIS/EDSY)
            </button>
            {showSlef && (
              <div className="mt-2">
                <textarea
                  value={slefText} onChange={e => setSlefText(e.target.value)} rows={5}
                  placeholder='{"Ship": "anaconda", "Modules": [...]}'
                  className="w-full font-jbmono text-[11px] bg-transparent outline-none px-3 py-2 clip-corner-sm resize-none"
                  style={{ color: "#8aabca", border: "1px solid #12223a" }}
                />
                <div className="font-jbmono text-[10px] mt-1" style={{ color: "#3d5878" }}>
                  Remplit le modèle de vaisseau et la liste de modules automatiquement. Le lien Coriolis reste optionnel dans ce cas.
                </div>
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>RÔLE</label>
            <select
              value={role} onChange={e => setRole(e.target.value as ShipRoleKind)}
              className="w-full font-jbmono text-[14px] px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>PORTÉE (OPTIONNEL)</label>
            <input
              value={portee} onChange={e => setPortee(e.target.value)}
              placeholder="Ex. 74.3 al"
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-5">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>NOTES (OPTIONNEL)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full font-jbmono text-[13px] bg-transparent outline-none px-3 py-2 clip-corner-sm resize-none"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          {error && (
            <div className="font-jbmono text-[12px] mb-4 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all" style={{ color: "#3d5878", background: "transparent", border: "1px solid #12223a" }}>
              ANNULER
            </button>
            <button type="submit" disabled={submitting} className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50" style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}>
              {submitting ? "IMPORT…" : "IMPORTER →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
