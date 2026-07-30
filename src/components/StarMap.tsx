import { useState, useRef, useCallback, useEffect, type WheelEvent, type MouseEvent } from "react"
import { useAuth } from "../context/AuthContext"
import AddWaypointModal from "./AddWaypointModal"

export type WaypointKind = "BASE" | "OBJECTIF" | "RAVITAILLEMENT" | "AUTRE"

export interface WaypointApi {
  id: string
  type: WaypointKind
  marker: string | null
  pinned: boolean
  timestamp: string
  createdBy: string
  system: {
    id: string
    name: string
    coordX: number
    coordY: number
    coordZ: number
  }
}

// Couleur d'étoile façon "vraie" carte galactique Elite Dangerous : dérivée du nom du
// système (stable, pas aléatoire à chaque rendu) plutôt qu'un point plat uniforme.
const STAR_HUES = [0, 30, 45, 200, 210, 260]
function starColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const hue = STAR_HUES[hash % STAR_HUES.length]
  return `hsl(${hue}, 85%, 68%)`
}

const TYPE_CONFIG: Record<WaypointKind, { color: string; label: string; radius: number }> = {
  BASE:          { color: "#f28c1a", label: "Base",          radius: 7 },
  OBJECTIF:      { color: "#e53030", label: "Objectif",      radius: 6 },
  RAVITAILLEMENT:{ color: "#0fc882", label: "Ravitaillement", radius: 5 },
  AUTRE:         { color: "#3d5878", label: "Autre",          radius: 4 },
}

const SVG_W = 780
const SVG_H = 540
const BASE_SCALE = 0.85 // px per ly

function distanceFromSol(sys: WaypointApi["system"]): string {
  const d = Math.sqrt(sys.coordX ** 2 + sys.coordY ** 2 + sys.coordZ ** 2)
  return `${d.toFixed(1)} al`
}

// Cadrage auto sur les systèmes épinglés (projection X/Z, comme le reste du rendu) ;
// Sol reste toujours dans le cadre comme repère. Sans épinglage, vue par défaut inchangée.
function computeFit(pinned: WaypointApi[]): { scale: number; pan: { x: number; y: number } } {
  if (pinned.length === 0) {
    return { scale: BASE_SCALE, pan: { x: SVG_W / 2, y: SVG_H / 2 - 40 } }
  }
  const xs = [0, ...pinned.map(w => w.system.coordX)]
  const zs = [0, ...pinned.map(w => w.system.coordZ)]
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const spanX = Math.max(maxX - minX, 20)
  const spanZ = Math.max(maxZ - minZ, 20)
  const padding = 70
  const scale = Math.min(12, Math.max(0.15, Math.min((SVG_W - padding * 2) / spanX, (SVG_H - padding * 2) / spanZ)))
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  return { scale, pan: { x: SVG_W / 2 - centerX * scale, y: SVG_H / 2 - centerZ * scale } }
}

function StarField() {
  const stars = [
    [34,56],[120,23],[234,89],[456,34],[678,145],[89,234],[345,289],[567,178],
    [123,456],[678,345],[234,512],[89,400],[456,267],[700,89],[12,300],[567,434],
    [300,23],[145,378],[489,511],[723,234],[67,120],[389,390],[512,67],[200,489],
    [634,312],[78,456],[423,134],[289,534],[156,289],[534,445],[714,178],[45,367],
    [378,78],[234,345],[567,234],[111,511],[456,89],[722,400],[300,289],[189,134],
    [623,456],[78,200],[456,378],[234,178],[567,89],[123,289],[389,512],[712,34],
    [45,145],[300,434],[178,234],[534,289],[67,390],[423,178],[289,89],[156,456],
    [634,89],[78,312],[423,534],[289,78],[156,390],[534,145],[714,289],[45,512],
  ]
  return (
    <>
      {stars.map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r={Math.random() < 0.3 ? 0.8 : 0.4} fill={`rgba(138,171,202,${0.1 + (i % 5) * 0.06})`} />
      ))}
    </>
  )
}

export default function StarMap() {
  const { hasPermission } = useAuth()
  const canEditMap = hasPermission("map.edit")

  const [waypoints, setWaypoints] = useState<WaypointApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddWaypoint, setShowAddWaypoint] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [scale, setScale] = useState(BASE_SCALE)
  const [pan, setPan] = useState({ x: SVG_W / 2, y: SVG_H / 2 - 40 })
  const [dragging, setDragging] = useState(false)
  const [dragLast, setDragLast] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState<WaypointApi | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)

  const loadWaypoints = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/waypoints", { credentials: "include" })
      if (!res.ok) throw new Error("Échec du chargement des waypoints.")
      const data: WaypointApi[] = await res.json()
      setWaypoints(data)
      const fit = computeFit(data.filter(w => w.pinned))
      setScale(fit.scale)
      setPan(fit.pan)
    } catch {
      setError("Impossible de charger la carte depuis le serveur.")
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleTogglePin(waypoint: WaypointApi) {
    const res = await fetch(`/api/waypoints/${waypoint.id}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pinned: !waypoint.pinned }),
    })
    if (res.ok) {
      const updated: WaypointApi = await res.json()
      setWaypoints(prev => prev.map(w => w.id === updated.id ? updated : w))
      setSelected(sel => (sel?.id === updated.id ? updated : sel))
    }
  }

  useEffect(() => {
    loadWaypoints()
  }, [loadWaypoints])

  async function handleDelete(waypointId: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/waypoints/${waypointId}`, { method: "DELETE", credentials: "include" })
      if (res.ok) {
        setWaypoints(prev => prev.filter(w => w.id !== waypointId))
        setSelected(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  const toSVG = (sys: WaypointApi["system"]) => ({
    x: pan.x + sys.coordX * scale,
    y: pan.y + sys.coordZ * scale,
  })

  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    setScale(s => Math.min(12, Math.max(0.15, s * (e.deltaY < 0 ? 1.12 : 0.89))))
  }, [])

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    setDragging(true)
    setDragLast({ x: e.clientX, y: e.clientY })
  }
  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!dragging) return
    const dx = e.clientX - dragLast.x
    const dy = e.clientY - dragLast.y
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
    setDragLast({ x: e.clientX, y: e.clientY })
  }
  const handleMouseUp = () => setDragging(false)

  const resetView = () => {
    const fit = computeFit(waypoints.filter(w => w.pinned))
    setScale(fit.scale)
    setPan(fit.pan)
  }

  return (
    <div className="p-6 h-full flex gap-5">

      {/* Map area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-px h-4" style={{ background: "#2196f3" }} />
            <span className="font-orbitron text-[11px] tracking-widest" style={{ color: "#8aabca" }}>
              PROJECTION GALACTIQUE — PLAN X/Z
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-jbmono text-[10px]" style={{ color: "#3d5878" }}>
              ZOOM {(scale / BASE_SCALE * 100).toFixed(0)}%
            </span>
            {canEditMap && (
              <button
                onClick={() => setShowAddWaypoint(true)}
                className="font-orbitron text-[9px] px-3 py-1.5 clip-corner-sm tracking-wider transition-all"
                style={{ color: "#f28c1a", background: "rgba(242,140,26,0.1)", border: "1px solid rgba(242,140,26,0.3)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(242,140,26,0.18)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(242,140,26,0.1)" }}
              >
                + AJOUTER UN SYSTÈME
              </button>
            )}
            <button
              onClick={resetView}
              className="font-orbitron text-[9px] px-2.5 py-1 clip-corner-sm transition-all"
              style={{ border: "1px solid #12223a", color: "#3d5878", background: "#070d1a" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f28c1a"; e.currentTarget.style.borderColor = "rgba(242,140,26,0.4)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "#3d5878"; e.currentTarget.style.borderColor = "#12223a" }}
            >
              RECENTRER
            </button>
          </div>
        </div>

        {/* SVG map */}
        <div
          className="flex-1 clip-corner overflow-hidden relative"
          style={{ background: "#040810", border: "1px solid #12223a" }}
        >
          {/* Coordinate hint */}
          <div className="absolute top-3 left-3 z-10 font-jbmono text-[9px]" style={{ color: "#1c3050" }}>
            GLISSEZ POUR DÉPLACER · MOLETTE POUR ZOOMER
          </div>
          {/* Axis labels */}
          <div className="absolute bottom-3 right-4 z-10 flex gap-4 font-jbmono text-[9px]" style={{ color: "#1c3050" }}>
            <span>X ↔</span>
            <span>Z ↕</span>
          </div>

          {(loading || error) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center font-jbmono text-[11px]" style={{ color: error ? "#e53030" : "#3d5878" }}>
              {error || "CHARGEMENT DE LA CARTE…"}
            </div>
          )}

          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className={dragging ? "cursor-grabbing" : "cursor-grab"}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <radialGradient id="nebula" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#1a2e50" stopOpacity="0.5" />
                <stop offset="45%" stopColor="#0d1a30" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#040810" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nebula2" cx="70%" cy="75%" r="65%">
                <stop offset="0%" stopColor="#2a1030" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#040810" stopOpacity="0" />
              </radialGradient>
              <filter id="starGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Fond nébuleuse */}
            <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#nebula)" />
            <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#nebula2)" />

            {/* Background stars */}
            <StarField />

            {/* Grid */}
            {[-400,-200,0,200,400].map(v => (
              <g key={v}>
                <line
                  x1={pan.x + v * scale} y1={0} x2={pan.x + v * scale} y2={SVG_H}
                  stroke="#0e1e32" strokeWidth="0.5"
                />
                <line
                  x1={0} y1={pan.y + v * scale} x2={SVG_W} y2={pan.y + v * scale}
                  stroke="#0e1e32" strokeWidth="0.5"
                />
              </g>
            ))}

            {/* Axis */}
            <line x1={pan.x} y1={0} x2={pan.x} y2={SVG_H} stroke="#1a2e48" strokeWidth="0.8" strokeDasharray="4 4" />
            <line x1={0} y1={pan.y} x2={SVG_W} y2={pan.y} stroke="#1a2e48" strokeWidth="0.8" strokeDasharray="4 4" />

            {/* Distance rings from Sol */}
            {[50, 100, 200, 350].map(r => (
              <circle
                key={r}
                cx={pan.x} cy={pan.y}
                r={r * scale}
                fill="none" stroke="#0d1f36" strokeWidth="0.6" strokeDasharray="6 6"
              />
            ))}

            {/* Distance ring labels */}
            {[50, 100, 200, 350].map(r => (
              <text
                key={r}
                x={pan.x + r * scale + 4} y={pan.y - 4}
                fontSize="8" fill="#1c3050" fontFamily="JetBrains Mono"
              >
                {r}al
              </text>
            ))}

            {/* Systems */}
            {waypoints.map(wp => {
              const cfg = TYPE_CONFIG[wp.type]
              const pos = toSVG(wp.system)
              const isHovered = hoverId === wp.id
              const isSelected = selected?.id === wp.id
              const isSol = wp.system.name === "Sol"

              return (
                <g
                  key={wp.id}
                  onClick={() => setSelected(selected?.id === wp.id ? null : wp)}
                  onMouseEnter={() => setHoverId(wp.id)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Glow ring for active/hovered */}
                  {(isHovered || isSelected) && (
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={(cfg.radius + 6) * (scale > 1 ? Math.min(1.5, scale) : 1)}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  )}

                  {/* Sol special outer ring */}
                  {isSol && (
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={(cfg.radius + 12) * (scale > 1 ? Math.min(1.5, scale) : 1)}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth="0.6"
                      opacity="0.2"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Halo façon étoile réelle (couleur dérivée du nom, sous le point coloré par type) */}
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={(cfg.radius + 3) * (scale > 2 ? Math.min(2, scale * 0.6) : 1)}
                    fill={starColor(wp.system.name)}
                    opacity={0.25}
                    filter="url(#starGlow)"
                  />

                  {/* System dot */}
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={cfg.radius * (scale > 2 ? Math.min(2, scale * 0.6) : 1)}
                    fill={cfg.color}
                    opacity={isHovered || isSelected ? 1 : 0.85}
                  />

                  {/* Marqueur épinglé */}
                  {wp.pinned && (
                    <text
                      x={pos.x - cfg.radius - 9}
                      y={pos.y + 3}
                      fontSize="9"
                    >
                      📌
                    </text>
                  )}

                  {/* Label */}
                  {(scale > 0.5 || isSol) && (
                    <text
                      x={pos.x + cfg.radius + 4}
                      y={pos.y + 4}
                      fontSize={isSol ? 10 : 8}
                      fill={isSelected || isHovered ? cfg.color : "#3d5878"}
                      fontFamily="Orbitron"
                      fontWeight={isSol ? "700" : "400"}
                    >
                      {wp.system.name}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Sol crosshair */}
            <line x1={pan.x - 10} y1={pan.y} x2={pan.x + 10} y2={pan.y} stroke="#f28c1a" strokeWidth="0.8" opacity="0.5" />
            <line x1={pan.x} y1={pan.y - 10} x2={pan.x} y2={pan.y + 10} stroke="#f28c1a" strokeWidth="0.8" opacity="0.5" />
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-5">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
              <span className="font-orbitron text-[9px] tracking-wider" style={{ color: "#3d5878" }}>
                {cfg.label.toUpperCase()}
              </span>
            </div>
          ))}
          <div className="ml-auto font-jbmono text-[9px]" style={{ color: "#1c3050" }}>
            {waypoints.length} SYSTÈMES RÉPERTORIÉS
          </div>
        </div>
      </div>

      {/* System list / detail panel */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-3">

        {/* Selected system detail */}
        {selected ? (
          <div
            className="clip-corner p-4 relative"
            style={{ background: "#070d1a", border: "1px solid rgba(242,140,26,0.3)" }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, #f28c1a60, transparent)" }} />
            <div className="font-jbmono text-[9px] mb-1" style={{ color: "#3d5878" }}>SYSTÈME SÉLECTIONNÉ</div>
            <div className="font-orbitron text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: "#f28c1a" }}>
              {selected.pinned && <span className="text-xs">📌</span>}
              {selected.system.name}
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 clip-corner-sm mb-3"
              style={{
                background: `${TYPE_CONFIG[selected.type].color}15`,
                border: `1px solid ${TYPE_CONFIG[selected.type].color}40`,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_CONFIG[selected.type].color }} />
              <span className="font-orbitron text-[8px]" style={{ color: TYPE_CONFIG[selected.type].color }}>
                {TYPE_CONFIG[selected.type].label.toUpperCase()}
              </span>
            </div>
            <div className="space-y-1.5">
              <div>
                <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>COORDONNÉES</div>
                <div className="font-jbmono text-[10px]" style={{ color: "#8aabca" }}>
                  X {selected.system.coordX.toFixed(1)} · Y {selected.system.coordY.toFixed(1)} · Z {selected.system.coordZ.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>DISTANCE DE SOL</div>
                <div className="font-jbmono text-[10px]" style={{ color: "#8aabca" }}>{distanceFromSol(selected.system)}</div>
              </div>
              {selected.marker && (
                <div>
                  <div className="font-jbmono text-[9px] mb-1" style={{ color: "#3d5878" }}>NOTES</div>
                  <div className="font-jbmono text-[10px] leading-relaxed" style={{ color: "#8aabca" }}>{selected.marker}</div>
                </div>
              )}
              <div>
                <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>AJOUTÉ PAR</div>
                <div className="font-jbmono text-[10px]" style={{ color: "#8aabca" }}>CMDR {selected.createdBy}</div>
              </div>
            </div>
            {canEditMap && (
              <button
                onClick={() => handleTogglePin(selected)}
                className="mt-3 w-full font-orbitron text-[9px] py-1.5 clip-corner-sm transition-all"
                style={{
                  border: `1px solid ${selected.pinned ? "rgba(242,140,26,0.4)" : "#12223a"}`,
                  color: selected.pinned ? "#f28c1a" : "#8aabca",
                  background: selected.pinned ? "rgba(242,140,26,0.1)" : "transparent",
                }}
              >
                {selected.pinned ? "📌 ÉPINGLÉ — RETIRER" : "ÉPINGLER SUR LE DASHBOARD"}
              </button>
            )}
            {canEditMap && (
              <button
                onClick={() => handleDelete(selected.id)}
                disabled={deleting}
                className="mt-2 w-full font-orbitron text-[9px] py-1.5 clip-corner-sm transition-all disabled:opacity-50"
                style={{ border: "1px solid rgba(229,48,48,0.3)", color: "#e53030", background: "rgba(229,48,48,0.08)" }}
              >
                {deleting ? "SUPPRESSION…" : "SUPPRIMER LE WAYPOINT"}
              </button>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-2 w-full font-orbitron text-[9px] py-1.5 clip-corner-sm transition-all"
              style={{ border: "1px solid #12223a", color: "#3d5878", background: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f28c1a"; e.currentTarget.style.borderColor = "rgba(242,140,26,0.3)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "#3d5878"; e.currentTarget.style.borderColor = "#12223a" }}
            >
              DÉSÉLECTIONNER
            </button>
          </div>
        ) : (
          <div
            className="clip-corner p-4"
            style={{ background: "#070d1a", border: "1px solid #12223a" }}
          >
            <div className="font-jbmono text-[10px] text-center" style={{ color: "#1c3050" }}>
              Cliquez sur un système<br />pour voir les détails
            </div>
          </div>
        )}

        {/* System list */}
        <div className="flex items-center gap-2 mt-1">
          <div className="w-px h-4" style={{ background: "#2196f3" }} />
          <span className="font-orbitron text-[10px] tracking-widest" style={{ color: "#8aabca" }}>SYSTÈMES</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollable space-y-1">
          {waypoints.map(wp => {
            const cfg = TYPE_CONFIG[wp.type]
            const isSelected = selected?.id === wp.id
            return (
              <button
                key={wp.id}
                onClick={() => setSelected(isSelected ? null : wp)}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 clip-corner-sm transition-all"
                style={{
                  background: isSelected ? `${cfg.color}10` : "#070d1a",
                  border: `1px solid ${isSelected ? `${cfg.color}40` : "#12223a"}`,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "#1c3050" }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "#12223a" }}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <div className="min-w-0 flex-1">
                  <div className="font-orbitron text-[9px] truncate flex items-center gap-1" style={{ color: isSelected ? cfg.color : "#8aabca" }}>
                    {wp.pinned && <span>📌</span>}
                    {wp.system.name}
                  </div>
                  <div className="font-jbmono text-[9px]" style={{ color: "#3d5878" }}>
                    {distanceFromSol(wp.system)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {showAddWaypoint && (
        <AddWaypointModal
          onClose={() => setShowAddWaypoint(false)}
          onCreated={wp => {
            setWaypoints(prev => [wp, ...prev])
            setShowAddWaypoint(false)
          }}
        />
      )}
    </div>
  )
}
