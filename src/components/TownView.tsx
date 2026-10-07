import { Link, useNavigate } from '@tanstack/react-router'
import { Map as MapIcon, ScrollText, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TownEngine, type Focus } from '@/game/town/engine'
import { BUILDINGS, GARDENS, PLAZA, QUEST_BOARD, ROADS, SPAWN, WORLD_H, WORLD_W, type NpcDef } from '@/game/town/map'
import { DISTRICTS, QUESTS, questState } from '@/game/content'
import {
  computeMetrics, findSecret, getTown, questPeriodKey, talkedTo, tutorialStep, useTown, visitDistrict,
} from '@/lib/store'
import { levelProgress, rankForLevel } from '@/lib/progression'
import { AvatarBadge } from './Avatar'
import { CitizenCreate } from './CitizenCreate'
import { Joystick } from './Joystick'
import { Toasts } from './Toasts'

const SPAWN_KEY = 'garri.spawn'
const DEFAULT_AVATAR = { outfit: '#d4552a', skin: '#6b4226', cap: 'fila' as const }

export function TownView() {
  const town = useTown()
  const { citizen } = town
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TownEngine | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [dialog, setDialog] = useState<{ npc: NpcDef; line: number } | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [pos, setPos] = useState(SPAWN)
  const [touch, setTouch] = useState(false)

  // Boot the engine once on the client
  useEffect(() => {
    const canvas = canvasRef.current!
    let spawn = SPAWN
    try {
      const s = sessionStorage.getItem(SPAWN_KEY)
      if (s) spawn = JSON.parse(s)
    } catch {}
    const c = getTown().citizen
    const engine = new TownEngine(canvas, c?.avatar ?? DEFAULT_AVATAR, c?.name ?? 'Visitor', new Set(c?.secrets ?? []), spawn, {
      onFocus: setFocus,
      onInteract: (f) => interactRef.current(f),
      onDistrict: (id) => {
        if (!getTown().citizen) return
        visitDistrict(id)
        if (id === 'questboard') tutorialStep('visitedBoard')
      },
      onSecret: (id) => findSecret(id),
      onMoved: () => tutorialStep('moved'),
      onPos: (x, y) => setPos({ x, y }),
    })
    engineRef.current = engine
    const resize = () => engine.resize(canvas.clientWidth, canvas.clientHeight)
    resize()
    window.addEventListener('resize', resize)
    engine.start()
    setTouch(window.matchMedia('(pointer: coarse)').matches)
    return () => {
      engine.stop()
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Keep engine in sync with the Citizen
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    e.paused = !citizen || !!dialog || showMap
    if (citizen) {
      e.setAvatar(citizen.avatar, citizen.name)
      e.setFound(new Set(citizen.secrets))
    }
  }, [citizen, dialog, showMap])

  const enter = (route: string, buildingId?: string) => {
    const b = BUILDINGS.find((x) => x.id === buildingId)
    if (b) {
      const out = b.door.y > b.y + b.h / 2 ? 0.7 : -0.7
      sessionStorage.setItem(SPAWN_KEY, JSON.stringify({ x: b.door.x, y: b.door.y + out }))
    } else if (buildingId === 'questboard') {
      sessionStorage.setItem(SPAWN_KEY, JSON.stringify({ x: QUEST_BOARD.x, y: QUEST_BOARD.y + 1.4 }))
    }
    if (b?.district) visitDistrict(b.district)
    navigate({ to: route })
  }

  const interact = (f: Focus) => {
    if (!getTown().citizen) return
    if (f.kind === 'npc') {
      setDialog({ npc: f.npc, line: 0 })
      talkedTo(f.npc.id)
      if (f.npc.id === 'elder') tutorialStep('talkedElder')
      return
    }
    if (f.kind === 'board') {
      tutorialStep('visitedBoard')
      return enter(f.route, 'questboard')
    }
    enter(f.route, f.id)
  }
  const interactRef = useRef(interact)
  interactRef.current = interact

  const claimable = useMemo(() => {
    if (!citizen) return 0
    const m = computeMetrics(citizen, town.games)
    return QUESTS.filter((q) => questState(q, m, !!citizen.questClaims[questPeriodKey(q)]) === 'CLAIMABLE').length
  }, [citizen, town.games])

  const lp = citizen ? levelProgress(citizen.xp) : null
  const tut = citizen?.tutorial

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-night">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_rgba(11,10,31,0.75)]" />
      <Toasts />

      {/* HUD — citizen */}
      {citizen && lp && (
        <Link to="/citizen" className="panel absolute left-3 top-3 flex items-center gap-3 !rounded-2xl py-2 pl-2 pr-4 sm:left-5 sm:top-5">
          <AvatarBadge avatar={citizen.avatar} size={44} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="max-w-28 truncate font-bold leading-tight">{citizen.name}</span>
              <span className="chip bg-gold text-ink">LV {lp.level}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-cream/55">{rankForLevel(lp.level)} · Rep {citizen.reputation}</div>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-cream/10">
              <div className="h-full bg-gold transition-all duration-700" style={{ width: `${lp.pct * 100}%` }} />
            </div>
          </div>
        </Link>
      )}

      {/* HUD — actions */}
      <div className="absolute right-3 top-3 flex gap-2 sm:right-5 sm:top-5">
        <Link to="/quests" className="panel relative grid h-12 w-12 place-items-center !rounded-2xl" aria-label="Quests">
          <ScrollText size={20} />
          {claimable > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-ink">{claimable}</span>}
        </Link>
        <button onClick={() => setShowMap(true)} className="panel grid h-12 w-12 place-items-center !rounded-2xl" aria-label="Town map">
          <MapIcon size={20} />
        </button>
      </div>

      {/* Tutorial */}
      {citizen && tut && !tut.done && (
        <div className="panel rise absolute left-1/2 top-20 w-[min(92vw,420px)] -translate-x-1/2 px-4 py-3 sm:top-5">
          <div className="font-display text-[10px] tracking-[0.3em] text-gold">TUTORIAL</div>
          <ol className="mt-1 space-y-1 text-sm">
            {[
              [tut.moved, touch ? 'Drag the joystick to walk' : 'Walk with WASD or the arrow keys'],
              [tut.talkedElder, 'Greet Baba Agba on the plaza'],
              [tut.visitedBoard, 'Visit the Quest Board beside the fountain'],
            ].map(([done, text], i) => (
              <li key={i} className={`flex items-center gap-2 ${done ? 'text-cream/40 line-through' : ''}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${done ? 'bg-palm text-cream' : 'bg-cream/10'}`}>{done ? '✓' : i + 1}</span>
                {text as string}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Interaction prompt */}
      {citizen && focus && !dialog && (
        <button
          onClick={() => interact(focus)}
          className="pop absolute bottom-40 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border-2 border-gold bg-night/90 px-5 py-3 shadow-2xl sm:bottom-10"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-display text-sm text-ink">{touch ? '✋' : 'E'}</span>
          <span className="text-left">
            <span className="block font-display text-sm">
              {focus.kind === 'npc' ? `Talk to ${focus.label}` : `Enter ${focus.label}`}
            </span>
            <span className="block text-xs text-cream/60">{focus.sub}</span>
          </span>
        </button>
      )}

      {/* Controls */}
      {citizen && touch && !dialog && (
        <>
          <div className="absolute bottom-6 left-5">
            <Joystick onMove={(dx, dy) => { if (engineRef.current) engineRef.current.stick = { dx, dy } }} />
          </div>
          <button
            onClick={() => engineRef.current?.interact()}
            className={`absolute bottom-10 right-6 grid h-20 w-20 place-items-center rounded-full font-display text-xl text-ink shadow-[0_5px_0_#9a6b0b] transition ${focus ? 'bg-gold' : 'bg-gold/40'}`}
          >
            ✋
          </button>
        </>
      )}
      {citizen && !touch && (
        <div className="absolute bottom-4 left-5 text-xs text-cream/50">
          <kbd className="rounded bg-cream/10 px-1.5 py-0.5">WASD</kbd> / arrows to walk · <kbd className="rounded bg-cream/10 px-1.5 py-0.5">E</kbd> to interact · <kbd className="rounded bg-cream/10 px-1.5 py-0.5">M</kbd> map
        </div>
      )}
      <MapHotkey onToggle={() => setShowMap((v) => !v)} />

      {/* NPC dialog */}
      {dialog && (
        <div className="absolute inset-x-0 bottom-0 z-40 p-3 sm:bottom-6">
          <div className="panel rise mx-auto max-w-xl p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: dialog.npc.outfit }}>
                {dialog.npc.id === 'elder' ? '👴🏾' : dialog.npc.cap === 'gele' ? '👩🏾' : '🧑🏾'}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-gold">{dialog.npc.name}</span>
                  <span className="text-xs text-cream/50">{dialog.npc.role}</span>
                </div>
                <p className="mt-1 text-lg leading-snug">{dialog.npc.lines[dialog.line]}</p>
              </div>
              <button onClick={() => setDialog(null)} className="text-cream/50" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {dialog.line < dialog.npc.lines.length - 1 ? (
                <button autoFocus className="btn btn-gold" onClick={() => setDialog({ ...dialog, line: dialog.line + 1 })}>Next ›</button>
              ) : (
                <button autoFocus className="btn btn-gold" onClick={() => setDialog(null)}>See you around</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showMap && <TownMap pos={pos} visited={citizen?.visited ?? []} onClose={() => setShowMap(false)} onGo={(r, id) => { setShowMap(false); enter(r, id) }} />}

      {town.ready && !citizen && <CitizenCreate />}
    </div>
  )
}

function MapHotkey({ onToggle }: { onToggle: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key.toLowerCase() === 'm') onToggle()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onToggle])
  return null
}

function TownMap({ pos, visited, onClose, onGo }: { pos: { x: number; y: number }; visited: string[]; onClose: () => void; onGo: (route: string, id: string) => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="panel rise w-full max-w-3xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-display text-[10px] tracking-[0.3em] text-gold">TOWN MAP</div>
            <div className="text-sm text-cream/60">Districts discovered: {visited.length}/{DISTRICTS.length}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost !p-2" aria-label="Close map"><X size={18} /></button>
        </div>
        <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} className="w-full rounded-xl" style={{ background: '#6c9a3b' }}>
          <rect x={GARDENS.x} y={GARDENS.y} width={GARDENS.w} height={GARDENS.h} fill="#4f9446" rx="1" />
          {ROADS.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#c06536" />)}
          <circle cx={PLAZA.cx} cy={PLAZA.cy} r={PLAZA.r} fill="#e9d4a6" />
          <circle cx={PLAZA.cx} cy={PLAZA.cy} r={1.6} fill="#3d7fc4" />
          <ellipse cx="54" cy="43" rx="3.2" ry="1.8" fill="#2b5d9a" />
          <g className="cursor-pointer" onClick={() => onGo(QUEST_BOARD.route, 'questboard')}>
            <rect x={QUEST_BOARD.x - 1.3} y={QUEST_BOARD.y - 1} width="2.6" height="1.4" fill="#8b5a2b" stroke="#f2b632" strokeWidth=".15" />
            <text x={QUEST_BOARD.x} y={QUEST_BOARD.y - 1.4} fontSize="1" textAnchor="middle" fill="#120f2e" fontWeight="800">QUESTS</text>
          </g>
          {BUILDINGS.map((b) => (
            <g key={b.id} className="cursor-pointer" onClick={() => onGo(b.route, b.id)}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx=".6" fill={b.wall} stroke={b.trim} strokeWidth=".2" opacity={!b.district || visited.includes(b.district) ? 1 : 0.55} />
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 0.4} fontSize="1.1" textAnchor="middle" fill={b.style === 'bank' ? '#120f2e' : '#fdf4e1'} fontWeight="800" style={{ fontFamily: 'Unbounded' }}>{b.name}</text>
            </g>
          ))}
          <text x={GARDENS.x + 3} y={GARDENS.y + 1.6} fontSize="1.1" fill="#fdf4e1" fontWeight="800" style={{ fontFamily: 'Unbounded' }}>GARDENS</text>
          <text x={PLAZA.cx} y={PLAZA.cy + 3.4} fontSize="1" textAnchor="middle" fill="#2f3f9e" fontWeight="800" style={{ fontFamily: 'Unbounded' }}>CENTRAL PLAZA</text>
          <circle cx={pos.x} cy={pos.y} r="1.6" fill="#f2b632" opacity=".35"><animate attributeName="r" values="1;2.2;1" dur="1.6s" repeatCount="indefinite" /></circle>
          <circle cx={pos.x} cy={pos.y} r=".7" fill="#f2b632" stroke="#120f2e" strokeWidth=".2" />
        </svg>
        <p className="mt-3 text-center text-xs text-cream/50">Tap a building to head straight there.</p>
      </div>
    </div>
  )
}
