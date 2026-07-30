import { useEffect, useState, useCallback } from "react"
import { useAuth } from "../context/AuthContext"

interface ConversationApi {
  partnerId: string
  pseudo: string
  lastMessage: string
  lastDate: string
  unread: number
}

interface MessageApi {
  id: string
  senderId: string
  recipientId: string
  contenu: string
  date: string
  lu: boolean
}

interface RosterMember {
  id: string
  pseudo: string
}

export default function Messages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationApi[]>([])
  const [members, setMembers] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activePartner, setActivePartner] = useState<string | null>(null)
  const [thread, setThread] = useState<MessageApi[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [showNewConvo, setShowNewConvo] = useState(false)

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/messages/conversations", { credentials: "include" })
    if (res.ok) setConversations(await res.json())
  }, [])

  useEffect(() => {
    Promise.all([
      loadConversations(),
      fetch("/api/members", { credentials: "include" }).then(r => r.json()).then((data: Array<{ id: string; pseudo: string }>) => {
        setMembers(data.filter(m => m.id !== user?.id).map(m => ({ id: m.id, pseudo: m.pseudo })))
      }),
    ]).finally(() => setLoading(false))
  }, [loadConversations, user?.id])

  const loadThread = useCallback(async (partnerId: string) => {
    const res = await fetch(`/api/messages/with/${partnerId}`, { credentials: "include" })
    if (res.ok) {
      setThread(await res.json())
      loadConversations()
    }
  }, [loadConversations])

  function openConversation(partnerId: string) {
    setActivePartner(partnerId)
    setShowNewConvo(false)
    loadThread(partnerId)
  }

  async function sendMessage() {
    if (!activePartner || !draft.trim()) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientId: activePartner, contenu: draft }),
      })
      if (res.ok) {
        const created: MessageApi = await res.json()
        setThread(prev => [...prev, created])
        setDraft("")
        loadConversations()
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <span className="font-jbmono text-[11px]" style={{ color: "#3d5878" }}>CHARGEMENT DES MESSAGES…</span>
      </div>
    )
  }

  const activePseudo = conversations.find(c => c.partnerId === activePartner)?.pseudo
    ?? members.find(m => m.id === activePartner)?.pseudo
    ?? ""

  const membersWithoutConvo = members.filter(m => !conversations.some(c => c.partnerId === m.id))

  return (
    <div className="p-6 h-full flex gap-5">
      {/* Conversation list */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-px h-4" style={{ background: "#f28c1a" }} />
            <span className="font-orbitron text-[11px] tracking-widest" style={{ color: "#8aabca" }}>MESSAGES</span>
          </div>
          <button
            onClick={() => setShowNewConvo(v => !v)}
            className="font-orbitron text-[9px] px-2 py-1 clip-corner-sm transition-all"
            style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
          >
            + NOUVEAU
          </button>
        </div>

        {showNewConvo && (
          <div className="clip-corner-sm p-2 space-y-1 max-h-48 overflow-y-auto scrollable" style={{ background: "#070d1a", border: "1px solid #12223a" }}>
            {membersWithoutConvo.map(m => (
              <button
                key={m.id}
                onClick={() => openConversation(m.id)}
                className="w-full text-left px-2 py-1.5 font-jbmono text-[10px] clip-corner-sm transition-all"
                style={{ color: "#8aabca" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                CMDR {m.pseudo}
              </button>
            ))}
            {membersWithoutConvo.length === 0 && (
              <div className="font-jbmono text-[9px] px-2 py-1" style={{ color: "#1c3050" }}>Aucun autre membre.</div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollable space-y-1">
          {conversations.map(c => {
            const active = activePartner === c.partnerId
            return (
              <button
                key={c.partnerId}
                onClick={() => openConversation(c.partnerId)}
                className="w-full text-left px-3 py-2.5 clip-corner-sm transition-all"
                style={{
                  background: active ? "rgba(242,140,26,0.06)" : "#070d1a",
                  border: `1px solid ${active ? "rgba(242,140,26,0.35)" : "#12223a"}`,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-orbitron text-[10px] font-semibold truncate" style={{ color: active ? "#f28c1a" : "#8aabca" }}>
                    CMDR {c.pseudo}
                  </span>
                  {c.unread > 0 && (
                    <span className="font-jbmono text-[8px] px-1.5 py-0.5 clip-corner-sm flex-shrink-0" style={{ color: "#0fc882", background: "rgba(15,200,130,0.12)" }}>
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="font-jbmono text-[9px] truncate" style={{ color: "#3d5878" }}>{c.lastMessage}</div>
              </button>
            )
          })}
          {conversations.length === 0 && !showNewConvo && (
            <div className="font-jbmono text-[9px] text-center py-4" style={{ color: "#1c3050" }}>Aucune conversation.</div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {activePartner ? (
          <>
            <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: "1px solid #12223a" }}>
              <span className="font-orbitron text-sm font-bold" style={{ color: "#f28c1a" }}>CMDR {activePseudo}</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollable space-y-2 mb-3">
              {thread.map(m => {
                const mine = m.senderId === user?.id
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[70%] clip-corner-sm px-3 py-2"
                      style={{
                        background: mine ? "rgba(242,140,26,0.1)" : "#070d1a",
                        border: `1px solid ${mine ? "rgba(242,140,26,0.3)" : "#12223a"}`,
                      }}
                    >
                      <div className="font-jbmono text-[10px] leading-relaxed" style={{ color: "#8aabca" }}>{m.contenu}</div>
                      <div className="font-jbmono text-[8px] mt-1" style={{ color: "#3d5878" }}>
                        {new Date(m.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                )
              })}
              {thread.length === 0 && (
                <div className="font-jbmono text-[10px] text-center py-8" style={{ color: "#1c3050" }}>Aucun message pour l'instant.</div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage() }}
                placeholder="Votre message…"
                className="flex-1 font-jbmono text-[11px] bg-transparent outline-none px-3 py-2.5 clip-corner-sm"
                style={{ color: "#8aabca", border: "1px solid #12223a" }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !draft.trim()}
                className="font-orbitron text-[9px] px-4 clip-corner-sm transition-all disabled:opacity-50"
                style={{ color: "#f28c1a", border: "1px solid rgba(242,140,26,0.35)", background: "rgba(242,140,26,0.1)" }}
              >
                ENVOYER →
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center font-jbmono text-[11px]" style={{ color: "#3d5878" }}>
            Sélectionnez une conversation, ou démarrez-en une nouvelle.
          </div>
        )}
      </div>
    </div>
  )
}
