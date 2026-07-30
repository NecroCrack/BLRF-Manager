import { useEffect, useState } from "react"

interface NoteApi {
  id: string
  titre: string
  categorie: string
  contenu: string
  dateCreation: string
  dateMaj: string
}

const CAT_COLOR: Record<string, string> = {
  Ingénierie:    "#a78bfa",
  Renseignement: "#e53030",
  Navigation:    "#2196f3",
  Personnel:     "#0fc882",
}

const CATEGORIES = ["Personnel", "Ingénierie", "Renseignement", "Navigation"]

export default function Notes() {
  const [notes, setNotes] = useState<NoteApi[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [editTitre, setEditTitre] = useState("")
  const [editCategorie, setEditCategorie] = useState("Personnel")
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/notes", { credentials: "include" })
      .then(r => r.json())
      .then(list => {
        setNotes(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const selected = notes.find(n => n.id === selectedId) || null

  const startEdit = () => {
    if (!selected) return
    setEditContent(selected.contenu)
    setEditTitre(selected.titre)
    setEditCategorie(selected.categorie)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ titre: editTitre, categorie: editCategorie, contenu: editContent }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  const startCreate = () => {
    setCreating(true)
    setEditTitre("")
    setEditContent("")
    setEditCategorie("Personnel")
    setSelectedId(null)
    setEditing(false)
  }

  const saveCreate = async () => {
    if (!editTitre.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ titre: editTitre, categorie: editCategorie, contenu: editContent }),
      })
      if (res.ok) {
        const created = await res.json()
        setNotes(prev => [created, ...prev])
        setSelectedId(created.id)
        setCreating(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT DES NOTES…</span>
      </div>
    )
  }

  return (
    <div className="p-6 h-full max-w-7xl mx-auto">
      <div className="flex gap-5" style={{ height: "calc(100vh - 140px)" }}>

        {/* Note list */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-px h-4" style={{ background: "#a78bfa" }} />
              <span className="font-orbitron text-[10px] tracking-widest" style={{ color: "#8aabca" }}>
                MES NOTES
              </span>
            </div>
            <button
              onClick={startCreate}
              className="font-orbitron text-[9px] px-2 py-1 clip-corner-sm transition-all"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.18)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.1)" }}
            >
              + NOUVELLE
            </button>
          </div>

          {/* Privacy notice */}
          <div
            className="clip-corner-sm px-3 py-2 flex items-center gap-2"
            style={{ background: "rgba(15,200,130,0.05)", border: "1px solid rgba(15,200,130,0.2)" }}
          >
            <span style={{ color: "#0fc882", fontSize: "12px" }}>🔒</span>
            <span className="font-jbmono text-[9px]" style={{ color: "#0fc882" }}>
              PRIVÉ · VISIBLE PAR VOUS SEULEMENT
            </span>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto scrollable space-y-2">
            {notes.map(note => {
              const isSelected = selectedId === note.id
              const catColor = CAT_COLOR[note.categorie] || "#3d5878"
              return (
                <button
                  key={note.id}
                  onClick={() => { setSelectedId(note.id); setEditing(false); setCreating(false) }}
                  className="w-full text-left clip-corner-sm p-3 transition-all"
                  style={{
                    background: isSelected ? "rgba(242,140,26,0.06)" : "#070d1a",
                    border: `1px solid ${isSelected ? "rgba(242,140,26,0.3)" : "#12223a"}`,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "#1c3050" }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "#12223a" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div
                      className="font-orbitron text-[9px] font-semibold truncate"
                      style={{ color: isSelected ? "#f28c1a" : "#8aabca" }}
                    >
                      {note.titre}
                    </div>
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                      style={{ background: catColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="font-orbitron text-[8px] px-1.5 py-0.5 clip-corner-sm"
                      style={{ color: catColor, background: `${catColor}10` }}
                    >
                      {note.categorie.toUpperCase()}
                    </span>
                    <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>{note.dateMaj.slice(0, 10)}</span>
                  </div>
                </button>
              )
            })}
            {notes.length === 0 && (
              <div className="py-8 text-center font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
                AUCUNE NOTE
              </div>
            )}
          </div>
        </div>

        {/* Editor / viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {creating ? (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="font-orbitron text-[10px] tracking-widest" style={{ color: "#f28c1a" }}>
                  NOUVELLE NOTE
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={editCategorie}
                    onChange={e => setEditCategorie(e.target.value)}
                    className="font-jbmono text-[10px] px-2 py-1 clip-corner-sm"
                    style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={() => setCreating(false)}
                    className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm transition-all"
                    style={{ color: "#3d5878", border: "1px solid #12223a", background: "#070d1a" }}
                  >
                    ANNULER
                  </button>
                  <button
                    onClick={saveCreate}
                    disabled={saving}
                    className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm transition-all disabled:opacity-50"
                    style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.2)" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.12)" }}
                  >
                    ENREGISTRER
                  </button>
                </div>
              </div>
              <input
                value={editTitre}
                onChange={e => setEditTitre(e.target.value)}
                className="font-orbitron text-lg bg-transparent outline-none w-full"
                style={{ color: "#8aabca", borderBottom: "1px solid #1c3050", paddingBottom: "8px" }}
                placeholder="Titre de la note…"
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 font-jbmono text-[11px] bg-transparent outline-none resize-none"
                style={{ color: "#8aabca" }}
                placeholder="Contenu de la note…"
              />
            </div>
          ) : selected ? (
            <div className="flex-1 flex flex-col gap-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLOR[selected.categorie] || "#3d5878" }} />
                  <span
                    className="font-orbitron text-[9px] px-2 py-0.5 clip-corner-sm"
                    style={{
                      color: CAT_COLOR[selected.categorie] || "#3d5878",
                      background: `${CAT_COLOR[selected.categorie] || "#3d5878"}10`,
                    }}
                  >
                    {selected.categorie.toUpperCase()}
                  </span>
                  <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>
                    Mis à jour le {selected.dateMaj.slice(0, 10)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <select
                        value={editCategorie}
                        onChange={e => setEditCategorie(e.target.value)}
                        className="font-jbmono text-[10px] px-2 py-1 clip-corner-sm"
                        style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button
                        onClick={() => setEditing(false)}
                        className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm transition-all"
                        style={{ color: "#3d5878", border: "1px solid #12223a", background: "#070d1a" }}
                      >
                        ANNULER
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm transition-all disabled:opacity-50"
                        style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.2)" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.12)" }}
                      >
                        ENREGISTRER
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={startEdit}
                        className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm transition-all"
                        style={{ color: "#8aabca", border: "1px solid #12223a", background: "#070d1a" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#f28c1a"; e.currentTarget.style.borderColor = "rgba(242,140,26,0.3)" }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#8aabca"; e.currentTarget.style.borderColor = "#12223a" }}
                      >
                        MODIFIER
                      </button>
                      <button
                        onClick={() => deleteNote(selected.id)}
                        className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm transition-all"
                        style={{ color: "#e53030", border: "1px solid rgba(229,48,48,0.2)", background: "#070d1a" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(229,48,48,0.08)" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#070d1a" }}
                      >
                        SUPPRIMER
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Note content */}
              <div
                className="flex-1 clip-corner p-5 flex flex-col"
                style={{ background: "#070d1a", border: "1px solid #12223a" }}
              >
                {editing ? (
                  <>
                    <input
                      value={editTitre}
                      onChange={e => setEditTitre(e.target.value)}
                      className="font-orbitron text-lg bg-transparent outline-none mb-4 w-full"
                      style={{ color: "#8aabca", borderBottom: "1px solid #1c3050", paddingBottom: "8px" }}
                    />
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="flex-1 font-jbmono text-[11px] bg-transparent outline-none resize-none"
                      style={{ color: "#8aabca" }}
                    />
                  </>
                ) : (
                  <>
                    <h2 className="font-orbitron text-base font-bold mb-4" style={{ color: "#8aabca", borderBottom: "1px solid #0c1828", paddingBottom: "12px" }}>
                      {selected.titre}
                    </h2>
                    <div className="flex-1 overflow-y-auto scrollable font-jbmono text-[11px] leading-relaxed whitespace-pre-line" style={{ color: "#8aabca" }}>
                      {selected.contenu}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex-1 clip-corner flex items-center justify-center flex-col gap-3"
              style={{ background: "#070d1a", border: "1px solid #12223a" }}
            >
              <div className="font-orbitron text-[28px]" style={{ color: "#0c1828" }}>🔒</div>
              <div className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>
                Sélectionnez une note ou créez-en une nouvelle
              </div>
              <button
                onClick={startCreate}
                className="font-orbitron text-[9px] px-4 py-2 clip-corner-sm mt-2 transition-all tracking-wider"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.18)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.1)" }}
              >
                + NOUVELLE NOTE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
