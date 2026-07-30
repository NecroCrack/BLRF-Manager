import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import NewPostModal from "./NewPostModal"

export type ForumCategorieKind = "OPERATIONS" | "TACTIQUE" | "INGENIERIE" | "GENERAL" | "ANNONCES"
// Nom de rôle en texte libre : les rôles sont désormais personnalisables (voir RolesAdmin).
type Role = string

export interface ForumCommentApi {
  id: string
  contenu: string
  date: string
  auteur: string
  auteurRole: Role
}

export interface ForumPostApi {
  id: string
  titre: string
  contenu: string
  categorie: ForumCategorieKind
  epingle: boolean
  vues: number
  dateCreation: string
  auteur: string
  auteurRole: Role
  nbCommentaires: number
  comments: ForumCommentApi[]
}

const RANK_CONFIG: Record<string, { color: string; short: string }> = {
  COMMANDANT: { color: "#f28c1a", short: "CMD" },
  OFFICIER:   { color: "#2196f3", short: "OFF" },
  PILOTE:     { color: "#8aabca", short: "PLT" },
  RECRUE:     { color: "#3d5878", short: "REC" },
}
const DEFAULT_RANK = { color: "#8aabca", short: "???" }
function rankCfg(role: Role) {
  return RANK_CONFIG[role] ?? DEFAULT_RANK
}

const CAT_COLOR: Record<ForumCategorieKind, string> = {
  ANNONCES: "#e53030",
  OPERATIONS: "#f28c1a",
  TACTIQUE: "#2196f3",
  INGENIERIE: "#a78bfa",
  GENERAL: "#8aabca",
}

const CAT_LABEL: Record<ForumCategorieKind, string> = {
  ANNONCES: "Annonces",
  OPERATIONS: "Opérations",
  TACTIQUE: "Tactique",
  INGENIERIE: "Ingénierie",
  GENERAL: "Général",
}

const CATEGORIES: Array<ForumCategorieKind | "Toutes"> = ["Toutes", "ANNONCES", "OPERATIONS", "TACTIQUE", "INGENIERIE", "GENERAL"]

function Avatar({ pseudo, role }: { pseudo: string; role: Role }) {
  const cfg = rankCfg(role)
  return (
    <div
      className="w-8 h-8 flex-shrink-0 clip-corner-sm flex items-center justify-center font-orbitron text-[9px] font-bold"
      style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
    >
      {pseudo.slice(0, 2).toUpperCase()}
    </div>
  )
}

function PostCard({ post, onOpen }: { post: ForumPostApi; onOpen: () => void }) {
  const catColor = CAT_COLOR[post.categorie]
  const rankCfgValue = rankCfg(post.auteurRole)

  return (
    <div
      onClick={onOpen}
      className="clip-corner p-4 cursor-pointer transition-all group relative"
      style={{ background: "#070d1a", border: "1px solid #12223a" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#1c3050"; e.currentTarget.style.background = "#080f1e" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#12223a"; e.currentTarget.style.background = "#070d1a" }}
    >
      {post.epingle && (
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, ${catColor}60, transparent)` }} />
      )}

      <div className="flex items-start gap-3">
        <Avatar pseudo={post.auteur} role={post.auteurRole} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {post.epingle && (
                  <span className="font-orbitron text-[8px] px-1.5 py-0.5 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
                    📌 ÉPINGLÉ
                  </span>
                )}
                <span
                  className="font-orbitron text-[8px] px-1.5 py-0.5 clip-corner-sm"
                  style={{ color: catColor, background: `${catColor}10`, border: `1px solid ${catColor}30` }}
                >
                  {CAT_LABEL[post.categorie].toUpperCase()}
                </span>
              </div>
              <div className="font-orbitron text-[11px] font-semibold" style={{ color: "#8aabca" }}>
                {post.titre}
              </div>
            </div>
          </div>

          <div className="font-jbmono text-[10px] line-clamp-2 mb-2" style={{ color: "#3d5878" }}>
            {post.contenu.slice(0, 120)}…
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-jbmono text-[9px]" style={{ color: rankCfgValue.color }}>CMDR {post.auteur}</span>
              <span
                className="font-orbitron text-[8px] px-1 clip-corner-sm"
                style={{ color: rankCfgValue.color, background: `${rankCfgValue.color}10` }}
              >
                {rankCfgValue.short}
              </span>
            </div>
            <span className="font-jbmono text-[9px]" style={{ color: "#1c3050" }}>·</span>
            <span className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>{post.dateCreation.slice(0, 10)}</span>
            <span className="font-jbmono text-[9px] ml-auto" style={{ color: "#3d5878" }}>
              💬 {post.nbCommentaires} · 👁 {post.vues}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PostDetail({ post, onClose, onCommentAdded }: { post: ForumPostApi; onClose: () => void; onCommentAdded: (p: ForumPostApi) => void }) {
  const { user } = useAuth()
  const catColor = CAT_COLOR[post.categorie]
  const [reply, setReply] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/forum/posts/${post.id}/view`, { method: "POST", credentials: "include" })
  }, [post.id])

  async function sendReply() {
    if (!reply.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/forum/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contenu: reply }),
      })
      if (res.ok) {
        onCommentAdded(await res.json())
        setReply("")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 font-orbitron text-[9px] tracking-wider transition-colors"
        style={{ color: "#3d5878" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#f28c1a")}
        onMouseLeave={e => (e.currentTarget.style.color = "#3d5878")}
      >
        ← RETOUR À LA LISTE
      </button>

      {/* Post */}
      <div
        className="clip-corner p-5 relative"
        style={{ background: "#070d1a", border: "1px solid #1c3050" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, ${catColor}50, transparent)` }} />

        <div className="flex items-start gap-2 mb-1 flex-wrap">
          {post.epingle && (
            <span className="font-orbitron text-[8px] px-1.5 py-0.5 clip-corner-sm" style={{ color: "#e53030", background: "rgba(229,48,48,0.1)", border: "1px solid rgba(229,48,48,0.25)" }}>
              📌 ÉPINGLÉ
            </span>
          )}
          <span
            className="font-orbitron text-[8px] px-1.5 py-0.5 clip-corner-sm"
            style={{ color: catColor, background: `${catColor}10`, border: `1px solid ${catColor}30` }}
          >
            {CAT_LABEL[post.categorie].toUpperCase()}
          </span>
        </div>
        <div className="font-orbitron text-base font-bold mb-3" style={{ color: "#8aabca" }}>
          {post.titre}
        </div>

        <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid #0c1828" }}>
          <Avatar pseudo={post.auteur} role={post.auteurRole} />
          <div>
            <div className="font-jbmono text-[10px]" style={{ color: rankCfg(post.auteurRole).color }}>
              CMDR {post.auteur}
            </div>
            <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>
              {post.auteurRole} · {new Date(post.dateCreation).toLocaleString("fr-FR")}
            </div>
          </div>
        </div>

        <div className="font-jbmono text-[11px] leading-relaxed whitespace-pre-line" style={{ color: "#8aabca" }}>
          {post.contenu}
        </div>
      </div>

      {/* Comments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-px h-4" style={{ background: "#2196f3" }} />
          <span className="font-orbitron text-[10px] tracking-widest" style={{ color: "#8aabca" }}>
            RÉPONSES ({post.comments.length})
          </span>
        </div>
        <div className="space-y-3 pl-4" style={{ borderLeft: "1px solid #0c1828" }}>
          {post.comments.map(comment => {
            const cfg = rankCfg(comment.auteurRole)
            return (
              <div
                key={comment.id}
                className="clip-corner-sm p-4"
                style={{ background: "#060b16", border: "1px solid #0c1828" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Avatar pseudo={comment.auteur} role={comment.auteurRole} />
                  <div>
                    <div className="font-jbmono text-[10px]" style={{ color: cfg.color }}>
                      CMDR {comment.auteur}
                    </div>
                    <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>
                      {comment.auteurRole} · {new Date(comment.date).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                <div className="font-jbmono text-[10px] leading-relaxed pl-10" style={{ color: "#8aabca" }}>
                  {comment.contenu}
                </div>
              </div>
            )
          })}
          {post.comments.length === 0 && (
            <div className="font-jbmono text-[10px] py-2" style={{ color: "#3d5878" }}>Aucune réponse pour l'instant.</div>
          )}
        </div>
      </div>

      {/* Reply box */}
      <div
        className="clip-corner p-4"
        style={{ background: "#070d1a", border: "1px solid #12223a" }}
      >
        <div className="font-jbmono text-[9px] mb-2" style={{ color: "#3d5878" }}>VOTRE RÉPONSE (CMDR {user?.pseudo})</div>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          className="w-full font-jbmono text-[11px] bg-transparent resize-none outline-none"
          rows={3}
          style={{ color: "#8aabca", borderBottom: "1px solid #12223a" }}
          placeholder="Votre message…"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={sendReply}
            disabled={submitting || !reply.trim()}
            className="font-orbitron text-[9px] px-4 py-2 clip-corner-sm tracking-wider transition-all disabled:opacity-50"
            style={{ color: "#f28c1a", background: "rgba(242,140,26,0.12)", border: "1px solid rgba(242,140,26,0.35)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.2)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.12)" }}
          >
            {submitting ? "ENVOI…" : "ENVOYER →"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Forum() {
  const [posts, setPosts] = useState<ForumPostApi[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState<ForumCategorieKind | "Toutes">("Toutes")
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNewPost, setShowNewPost] = useState(false)

  useEffect(() => {
    fetch("/api/forum/posts", { credentials: "include" })
      .then(r => r.json())
      .then(setPosts)
      .finally(() => setLoading(false))
  }, [])

  const openPost = posts.find(p => p.id === openId) || null
  const filtered = posts.filter(p => catFilter === "Toutes" || p.categorie === catFilter)

  function handlePostUpdated(updated: ForumPostApi) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT DU FORUM…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {!openPost && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-px h-4" style={{ background: "#f28c1a" }} />
              <span className="font-orbitron text-[11px] tracking-widest" style={{ color: "#8aabca" }}>
                FORUM DE L'ESCADRON
              </span>
            </div>
            <button
              onClick={() => setShowNewPost(true)}
              className="font-orbitron text-[9px] px-3 py-2 clip-corner-sm tracking-wider transition-all"
              style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.18)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.1)" }}
            >
              + NOUVEAU POST
            </button>
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {CATEGORIES.map(cat => {
              const active = catFilter === cat
              const color = cat !== "Toutes" ? CAT_COLOR[cat] : "#f28c1a"
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
                  style={{
                    color: active ? color : "#3d5878",
                    background: active ? `${color}10` : "#070d1a",
                    border: `1px solid ${active ? color + "45" : "#12223a"}`,
                  }}
                >
                  {cat === "Toutes" ? "TOUTES" : CAT_LABEL[cat].toUpperCase()}
                </button>
              )
            })}
          </div>

          {/* Posts */}
          <div className="space-y-3">
            {filtered.map(post => (
              <PostCard key={post.id} post={post} onOpen={() => setOpenId(post.id)} />
            ))}
            {filtered.length === 0 && (
              <div className="clip-corner p-8 text-center font-jbmono text-[11px]" style={{ background: "#070d1a", border: "1px solid #12223a", color: "#3d5878" }}>
                AUCUN POST DANS CETTE CATÉGORIE
              </div>
            )}
          </div>
        </>
      )}

      {openPost && (
        <PostDetail post={openPost} onClose={() => setOpenId(null)} onCommentAdded={handlePostUpdated} />
      )}

      {showNewPost && (
        <NewPostModal
          onClose={() => setShowNewPost(false)}
          onCreated={p => { setPosts(prev => [p, ...prev]); setShowNewPost(false) }}
        />
      )}
    </div>
  )
}
