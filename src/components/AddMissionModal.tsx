import { useState, type FormEvent } from "react"

export type MissionTypeKind = "COMBAT" | "EXPLORATION" | "LOGISTIQUE" | "ESCORTE" | "INTERNE"
export type MissionStatusKind = "EN_COURS" | "COMPLETE" | "ARCHIVE"

export interface MissionFormApi {
  id: string
  title: string
  description: string
  status: MissionStatusKind
  priorite: 1 | 2 | 3
  type: MissionTypeKind
  systeme: string | null
  responsableId: string | null
}

interface RosterMemberOption {
  id: string
  pseudo: string
}

const TYPES: { value: MissionTypeKind; label: string }[] = [
  { value: "COMBAT", label: "Combat" },
  { value: "EXPLORATION", label: "Exploration" },
  { value: "LOGISTIQUE", label: "Logistique" },
  { value: "ESCORTE", label: "Escorte" },
  { value: "INTERNE", label: "Interne" },
]

const STATUSES: { value: MissionStatusKind; label: string }[] = [
  { value: "EN_COURS", label: "En cours" },
  { value: "COMPLETE", label: "Complète" },
  { value: "ARCHIVE", label: "Archivée" },
]

export default function AddMissionModal({
  mission, members, onClose, onSaved,
}: {
  mission?: MissionFormApi | null
  members: RosterMemberOption[]
  onClose: () => void
  onSaved: (m: unknown) => void
}) {
  const isEdit = !!mission

  const [title, setTitle] = useState(mission?.title ?? "")
  const [description, setDescription] = useState(mission?.description ?? "")
  const [type, setType] = useState<MissionTypeKind>(mission?.type ?? "INTERNE")
  const [status, setStatus] = useState<MissionStatusKind>(mission?.status ?? "EN_COURS")
  const [priorite, setPriorite] = useState<1 | 2 | 3>(mission?.priorite ?? 3)
  const [systeme, setSysteme] = useState(mission?.systeme ?? "")
  const [responsableId, setResponsableId] = useState(mission?.responsableId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        title, description, type, priorite,
        systeme: systeme || null,
        responsableId: responsableId || null,
      }
      if (isEdit) body.status = status

      const res = await fetch(isEdit ? `/api/missions/${mission!.id}` : "/api/missions", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Échec de l'enregistrement de l'opération.")
        return
      }
      onSaved(data)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(4,7,13,0.85)" }}>
      <div className="w-full max-w-md clip-corner p-6 max-h-[85vh] overflow-y-auto scrollable" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
        <form onSubmit={handleSubmit}>
          <div className="font-orbitron text-[13px] tracking-widest mb-5" style={{ color: "#3d5878" }}>
            {isEdit ? "MODIFIER L'OPÉRATION" : "NOUVELLE OPÉRATION"}
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>TITRE</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Ex. Opération Bouclier"
              className="w-full font-jbmono text-[15px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-3">
            <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>BRIEFING</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} required rows={4}
              className="w-full font-jbmono text-[14px] bg-transparent outline-none px-3 py-2 clip-corner-sm resize-none"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>TYPE</label>
              <select
                value={type} onChange={e => setType(e.target.value as MissionTypeKind)}
                className="w-full font-jbmono text-[14px] px-3 py-2 clip-corner-sm"
                style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
              >
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>PRIORITÉ</label>
              <select
                value={priorite} onChange={e => setPriorite(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full font-jbmono text-[14px] px-3 py-2 clip-corner-sm"
                style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
              >
                <option value={1}>Critique</option>
                <option value={2}>Haute</option>
                <option value={3}>Normale</option>
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="mb-3">
              <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>STATUT</label>
              <select
                value={status} onChange={e => setStatus(e.target.value as MissionStatusKind)}
                className="w-full font-jbmono text-[14px] px-3 py-2 clip-corner-sm"
                style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}

          <div className="mb-3">
            <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>SYSTÈME CIBLE (OPTIONNEL)</label>
            <input
              value={systeme} onChange={e => setSysteme(e.target.value)}
              placeholder="Ex. Deciat"
              className="w-full font-jbmono text-[15px] bg-transparent outline-none px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", border: "1px solid #12223a" }}
            />
          </div>

          <div className="mb-5">
            <label className="font-orbitron text-[12px] tracking-widest block mb-1.5" style={{ color: "#3d5878" }}>OFFICIER RESPONSABLE (OPTIONNEL)</label>
            <select
              value={responsableId} onChange={e => setResponsableId(e.target.value)}
              className="w-full font-jbmono text-[14px] px-3 py-2 clip-corner-sm"
              style={{ color: "#8aabca", background: "#070d1a", border: "1px solid #12223a" }}
            >
              <option value="">— Aucun —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.pseudo}</option>)}
            </select>
          </div>

          {error && (
            <div className="font-jbmono text-[13px] mb-4 px-3 py-2 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all" style={{ color: "#3d5878", background: "transparent", border: "1px solid #12223a" }}>
              ANNULER
            </button>
            <button type="submit" disabled={submitting} className="flex-1 font-orbitron text-[12px] px-4 py-2.5 clip-corner-sm tracking-widest transition-all disabled:opacity-50" style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}>
              {submitting ? "…" : isEdit ? "ENREGISTRER →" : "CRÉER →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
