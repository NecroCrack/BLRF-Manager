import { useState, type FormEvent } from "react"
import type { ForumPostApi, ForumCategorieKind } from "./Forum"

const CATEGORIES: { value: ForumCategorieKind; label: string }[] = [
  { value: "ANNONCES", label: "Annonces" },
  { value: "OPERATIONS", label: "Opérations" },
  { value: "TACTIQUE", label: "Tactique" },
  { value: "INGENIERIE", label: "Ingénierie" },
  { value: "GENERAL", label: "Général" },
]

export default function NewPostModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: ForumPostApi) => void }) {
  const [titre, setTitre] = useState("")
  const [contenu, setContenu] = useState("")
  const [categorie, setCategorie] = useState<ForumCategorieKind>("GENERAL")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ titre, contenu, categorie }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de la publication.")
        return
      }
      onCreated(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-lg clip-corner p-6" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        <form onSubmit={handleSubmit}>
          <div className="font-orbitron text-[12px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
            NOUVEAU POST
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>TITRE</label>
            <input
              value={titre} onChange={e => setTitre(e.target.value)} required
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>CATÉGORIE</label>
            <select
              value={categorie} onChange={e => setCategorie(e.target.value as ForumCategorieKind)}
              className="w-full font-jbmono text-[14px] px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="mb-5">
            <label className="font-orbitron text-[11px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>CONTENU</label>
            <textarea
              value={contenu} onChange={e => setContenu(e.target.value)} required rows={6}
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
              {submitting ? "PUBLICATION…" : "PUBLIER →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
