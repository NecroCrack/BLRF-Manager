import { useState, type FormEvent } from "react"
import type { WaypointApi, WaypointKind } from "./StarMap"

const TYPES: { value: WaypointKind; label: string }[] = [
  { value: "BASE", label: "Base" },
  { value: "OBJECTIF", label: "Objectif" },
  { value: "RAVITAILLEMENT", label: "Ravitaillement" },
  { value: "AUTRE", label: "Autre" },
]

interface EdsmResult {
  name: string
  coordX: number
  coordY: number
  coordZ: number
}

export default function AddWaypointModal({ onClose, onCreated }: { onClose: () => void; onCreated: (wp: WaypointApi) => void }) {
  const [systemName, setSystemName] = useState("")
  const [type, setType] = useState<WaypointKind>("AUTRE")
  const [marker, setMarker] = useState("")
  const [found, setFound] = useState<EdsmResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFound(null)
    setSearching(true)
    try {
      const res = await fetch("/api/edsm/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ systemName }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de la recherche EDSM.")
        return
      }
      setFound(data)
    } finally {
      setSearching(false)
    }
  }

  async function handleConfirm() {
    if (!found) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/waypoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ systemName: found.name, type, marker: marker.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de la création du waypoint.")
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
        <div className="font-orbitron text-[12px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
          AJOUTER UN SYSTÈME
        </div>

        {!found ? (
          <form onSubmit={handleSearch}>
            <div className="mb-4">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                NOM DU SYSTÈME (EDSM)
              </label>
              <input
                type="text"
                value={systemName}
                onChange={e => setSystemName(e.target.value)}
                placeholder="Ex. Shinrarta Dezhra"
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
                disabled={searching}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
                style={{ color: "#2196f3", background: "rgba(33,150,243,0.12)", border: "1px solid rgba(33,150,243,0.35)" }}
              >
                {searching ? "RECHERCHE…" : "RECHERCHER →"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              className="font-jbmono text-[12px] mb-4 px-3 py-2 clip-corner-sm"
              style={{ color: "#0fc882", background: "rgba(15,200,130,0.08)", border: "1px solid rgba(15,200,130,0.25)" }}
            >
              Trouvé sur EDSM : <strong>{found.name}</strong><br />
              X {found.coordX.toFixed(1)} · Y {found.coordY.toFixed(1)} · Z {found.coordZ.toFixed(1)}
            </div>

            <div className="mb-4">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                TYPE
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as WaypointKind)}
                className="w-full font-jbmono text-[14px] px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
              >
                {TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>
                NOTES (OPTIONNEL)
              </label>
              <textarea
                value={marker}
                onChange={e => setMarker(e.target.value)}
                rows={3}
                className="w-full font-jbmono text-[13px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm resize-none"
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
                onClick={() => setFound(null)}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all"
                style={{ color: "#3d5878", background: "transparent", border: "1px solid #12223a" }}
              >
                ← RETOUR
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
              >
                {submitting ? "CRÉATION…" : "AJOUTER →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
