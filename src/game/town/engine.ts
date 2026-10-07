import type { Avatar } from '@/lib/types'
import {
  BUILDINGS, GARDENS, NPCS, PLAZA, POND, QUEST_BOARD, ROADS, SECRET_SPOTS, T, WORLD_H, WORLD_W, ZONES,
  type Building, type NpcDef, type Rect,
} from './map'

export type Focus =
  | { kind: 'door'; id: string; label: string; sub: string; route: string }
  | { kind: 'board'; id: 'questboard'; label: string; sub: string; route: string }
  | { kind: 'npc'; id: string; label: string; sub: string; npc: NpcDef }

export interface EngineCallbacks {
  onFocus: (f: Focus | null) => void
  onInteract: (f: Focus) => void
  onDistrict: (id: string) => void
  onSecret: (id: string) => void
  onMoved: () => void
  onPos: (x: number, y: number) => void
}

const GRASS = 0, ROAD = 1, PLAZA_T = 2, GARDEN = 3

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inRect = (x: number, y: number, r: Rect, pad = 0) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad

interface Tree { x: number; y: number; kind: 'palm' | 'round' | 'bush'; s: number }
interface Npc { def: NpcDef; x: number; y: number; tx: number; ty: number; wait: number; dir: number; phase: number; moving: boolean }
interface Decor { kind: 'lamp' | 'danfo' | 'flowers'; x: number; y: number; c?: string }

export class TownEngine {
  private ctx: CanvasRenderingContext2D
  private raf = 0
  private last = 0
  private tiles = new Uint8Array(WORLD_W * WORLD_H)
  private solids: Rect[] = [] // in pixels
  private trees: Tree[] = []
  private decor: Decor[] = []
  private npcs: Npc[] = []
  private keys = new Set<string>()
  private focus: Focus | null = null
  private visited = new Set<string>()
  private moved = false
  private posTimer = 0
  private dust: { x: number; y: number; v: number; a: number }[] = []
  private time = 0
  private vw = 0
  private vh = 0
  private zoom = 1.5
  private cam = { x: 0, y: 0 }

  player = { x: 0, y: 0, dir: 0, phase: 0, moving: false }
  stick = { dx: 0, dy: 0 }
  paused = false

  constructor(
    private canvas: HTMLCanvasElement,
    private avatar: Avatar,
    private name: string,
    private found: Set<string>,
    spawn: { x: number; y: number },
    private cb: EngineCallbacks,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.player.x = spawn.x * T
    this.player.y = spawn.y * T
    this.buildWorld()
    for (let i = 0; i < 40; i++) this.dust.push({ x: Math.random(), y: Math.random(), v: 0.2 + Math.random() * 0.6, a: 0.05 + Math.random() * 0.12 })
  }

  setAvatar(a: Avatar, name: string) { this.avatar = a; this.name = name }
  setFound(f: Set<string>) { this.found = f }

  // ─── world construction ──────────────────────────────────────────────────
  private buildWorld() {
    for (let y = 0; y < WORLD_H; y++)
      for (let x = 0; x < WORLD_W; x++) {
        let t = GRASS
        if (inRect(x, y, GARDENS)) t = GARDEN
        if (ROADS.some((r) => inRect(x, y, r))) t = ROAD
        if (Math.hypot(x + 0.5 - PLAZA.cx, y + 0.5 - PLAZA.cy) < PLAZA.r) t = PLAZA_T
        this.tiles[y * WORLD_W + x] = t
      }

    for (const b of BUILDINGS) this.solids.push({ x: b.x * T, y: b.y * T + T * 0.6, w: b.w * T, h: b.h * T - T * 0.6 })
    this.solids.push({ x: (QUEST_BOARD.x - 1.3) * T, y: (QUEST_BOARD.y - 0.2) * T, w: 2.6 * T, h: 0.5 * T })
    this.solids.push({ x: (PLAZA.cx - 1.5) * T, y: (PLAZA.cy - 1.2) * T, w: 3 * T, h: 2.4 * T })
    this.solids.push({ x: (POND.cx - POND.rx) * T, y: (POND.cy - POND.ry * 0.8) * T, w: POND.rx * 2 * T, h: POND.ry * 1.6 * T })

    // Lamps around the plaza
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      this.decor.push({ kind: 'lamp', x: (PLAZA.cx + Math.cos(a) * (PLAZA.r - 0.4)) * T, y: (PLAZA.cy + Math.sin(a) * (PLAZA.r - 0.4)) * T })
    }
    this.decor.push({ kind: 'danfo', x: 58 * T, y: 24.3 * T })
    this.solids.push({ x: 56.3 * T, y: 23.6 * T, w: 3.4 * T, h: 0.9 * T })
    const fc = ['#f2b632', '#d4552a', '#fdf4e1', '#c64b8c']
    const rnd = seeded(77)
    for (let i = 0; i < 40; i++) this.decor.push({ kind: 'flowers', x: (GARDENS.x + 1 + rnd() * (GARDENS.w - 2)) * T, y: (GARDENS.y + 0.5 + rnd() * (GARDENS.h - 1)) * T, c: fc[i % 4] })

    // Trees — avoid roads, buildings, plaza, doors and points of interest
    const avoid = (tx: number, ty: number) => {
      const tile = this.tiles[Math.floor(ty) * WORLD_W + Math.floor(tx)]
      if (tile === ROAD || tile === PLAZA_T) return true
      if (Math.hypot(tx - PLAZA.cx, ty - PLAZA.cy) < PLAZA.r + 1.2) return true
      if (BUILDINGS.some((b) => inRect(tx, ty, { x: b.x, y: b.y - 1, w: b.w, h: b.h + 1 }, 1.2))) return true
      if (BUILDINGS.some((b) => Math.hypot(tx - b.door.x, ty - b.door.y) < 2.5)) return true
      if (Math.hypot(tx - POND.cx, ty - POND.cy) < 4.5) return true
      if (Object.values(SECRET_SPOTS).some((s) => Math.hypot(tx - s.x, ty - s.y) < 1.5)) return true
      if (NPCS.some((n) => Math.hypot(tx - n.x, ty - n.y) < 2)) return true
      if (Math.hypot(tx - QUEST_BOARD.x, ty - QUEST_BOARD.y) < 3) return true
      return this.trees.some((t) => Math.hypot(t.x - tx, t.y - ty) < 1.8)
    }
    const r = seeded(4663)
    for (let i = 0; i < 900 && this.trees.length < 120; i++) {
      const tx = 0.8 + r() * (WORLD_W - 1.6)
      const ty = 1 + r() * (WORLD_H - 1.6)
      if (avoid(tx, ty)) continue
      const inGarden = inRect(tx, ty, GARDENS)
      this.trees.push({ x: tx, y: ty, kind: inGarden ? (r() < 0.5 ? 'round' : 'bush') : r() < 0.7 ? 'palm' : r() < 0.6 ? 'round' : 'bush', s: 0.8 + r() * 0.45 })
    }
    for (const t of this.trees) if (t.kind !== 'bush') this.solids.push({ x: t.x * T - 6, y: t.y * T - 6, w: 12, h: 8 })

    this.npcs = NPCS.map((def) => ({ def, x: def.x * T, y: def.y * T, tx: def.x * T, ty: def.y * T, wait: Math.random() * 2, dir: 0, phase: 0, moving: false }))
  }

  // ─── lifecycle ───────────────────────────────────────────────────────────
  start() {
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    this.last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000)
      this.last = t
      this.update(dt)
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  resize(w: number, h: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.vw = w
    this.vh = h
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    const across = w < 640 ? 12 : w < 1100 ? 17 : 22
    this.zoom = Math.max(1, Math.min(2.6, w / (across * T)))
  }

  interact() {
    if (this.focus && !this.paused) this.cb.onInteract(this.focus)
  }

  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const k = e.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
    if ((k === 'e' || k === 'enter' || k === ' ') && !e.repeat) this.interact()
    this.keys.add(k)
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
  private onBlur = () => this.keys.clear()

  // ─── simulation ──────────────────────────────────────────────────────────
  private collides(x: number, y: number) {
    const fx = x - 7, fy = y - 5, fw = 14, fh = 8
    if (fx < T * 0.3 || fy < T * 0.6 || fx + fw > WORLD_W * T - T * 0.3 || fy + fh > WORLD_H * T - 4) return true
    for (const s of this.solids) if (fx < s.x + s.w && fx + fw > s.x && fy < s.y + s.h && fy + fh > s.y) return true
    return false
  }

  private update(dt: number) {
    this.time += dt
    const p = this.player
    let dx = 0, dy = 0
    if (!this.paused) {
      const k = this.keys
      if (k.has('arrowleft') || k.has('a')) dx -= 1
      if (k.has('arrowright') || k.has('d')) dx += 1
      if (k.has('arrowup') || k.has('w')) dy -= 1
      if (k.has('arrowdown') || k.has('s')) dy += 1
      if (!dx && !dy) { dx = this.stick.dx; dy = this.stick.dy }
    }
    const len = Math.hypot(dx, dy)
    p.moving = len > 0.1
    if (p.moving) {
      const sp = 150 * Math.min(1, len) * dt
      const nx = (dx / len) * sp, ny = (dy / len) * sp
      if (!this.collides(p.x + nx, p.y)) p.x += nx
      if (!this.collides(p.x, p.y + ny)) p.y += ny
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2
      p.phase += dt * 10
      if (!this.moved) { this.moved = true; this.cb.onMoved() }
    }

    for (const n of this.npcs) {
      const near = Math.hypot(n.x - p.x, n.y - p.y) < T * 1.8
      if (near || this.paused) { n.moving = false; continue }
      if (n.wait > 0) { n.wait -= dt; n.moving = false; continue }
      const ddx = n.tx - n.x, ddy = n.ty - n.y, d = Math.hypot(ddx, ddy)
      if (d < 2) {
        n.wait = 1.5 + Math.random() * 3
        const a = Math.random() * Math.PI * 2, r = Math.random() * n.def.range * T
        n.tx = n.def.x * T + Math.cos(a) * r
        n.ty = n.def.y * T + Math.sin(a) * r
        continue
      }
      const sp = 38 * dt
      const nx = n.x + (ddx / d) * sp, ny = n.y + (ddy / d) * sp
      if (this.collides(nx, ny)) { n.tx = n.x; n.ty = n.y; continue }
      n.x = nx; n.y = ny; n.moving = true; n.phase += dt * 8
      n.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 1 : 3) : ddy > 0 ? 0 : 2
    }

    // Focus: nearest interactable in reach
    const tx = p.x / T, ty = p.y / T
    let best: Focus | null = null
    let bestD = Infinity
    for (const b of BUILDINGS) {
      const d = Math.hypot(tx - b.door.x, ty - b.door.y)
      if (d < 1.6 && d < bestD) { bestD = d; best = { kind: 'door', id: b.id, label: b.name, sub: b.sub, route: b.route } }
      if (d < 2.2 && b.district) this.visit(b.district)
    }
    const db = Math.hypot(tx - QUEST_BOARD.x, ty - (QUEST_BOARD.y + 0.8))
    if (db < 1.8 && db < bestD) { bestD = db; best = { kind: 'board', id: 'questboard', label: 'QUEST BOARD', sub: 'Daily · Weekly · Seasonal', route: QUEST_BOARD.route } }
    if (db < 2.6) this.visit('questboard')
    for (const n of this.npcs) {
      const d = Math.hypot(tx - n.x / T, ty - n.y / T)
      if (d < 1.5 && d < bestD) { bestD = d; best = { kind: 'npc', id: n.def.id, label: n.def.name, sub: n.def.role, npc: n.def } }
    }
    if (best?.id !== this.focus?.id) { this.focus = best; this.cb.onFocus(best) }

    for (const z of ZONES) {
      if (z.rect && inRect(tx, ty, z.rect)) this.visit(z.district)
      if (z.circle && Math.hypot(tx - z.circle.cx, ty - z.circle.cy) < z.circle.r) this.visit(z.district)
    }
    for (const [id, s] of Object.entries(SECRET_SPOTS)) {
      if (!this.found.has(id) && Math.hypot(tx - s.x, ty - s.y) < 0.8) { this.found.add(id); this.cb.onSecret(id) }
    }

    this.posTimer -= dt
    if (this.posTimer <= 0) { this.posTimer = 0.25; this.cb.onPos(tx, ty) }
  }

  private visit(id: string) {
    if (this.visited.has(id)) return
    this.visited.add(id)
    this.cb.onDistrict(id)
  }

  // ─── rendering ───────────────────────────────────────────────────────────
  private render() {
    const { ctx, vw, vh, zoom: z } = this
    const dpr = this.canvas.width / Math.max(1, vw)
    const halfW = vw / 2 / z, halfH = vh / 2 / z
    const worldW = WORLD_W * T, worldH = WORLD_H * T
    const tx = Math.max(halfW, Math.min(worldW - halfW, this.player.x))
    const ty = Math.max(halfH, Math.min(worldH - halfH, this.player.y - 10))
    this.cam.x += (tx - this.cam.x) * 0.15
    this.cam.y += (ty - this.cam.y) * 0.15
    if (!this.cam.x) { this.cam.x = tx; this.cam.y = ty }
    const cx = this.cam.x, cy = this.cam.y

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#2d4a1f'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cx * z), dpr * (vh / 2 - cy * z))

    const x0 = Math.max(0, Math.floor((cx - halfW) / T) - 1), x1 = Math.min(WORLD_W, Math.ceil((cx + halfW) / T) + 1)
    const y0 = Math.max(0, Math.floor((cy - halfH) / T) - 1), y1 = Math.min(WORLD_H, Math.ceil((cy + halfH) / T) + 3)
    this.drawGround(x0, x1, y0, y1)
    this.drawPlaza()
    this.drawPond()

    const view = { l: cx - halfW - 4 * T, r: cx + halfW + 4 * T, t: cy - halfH - 4 * T, b: cy + halfH + 8 * T }
    const visible = (x: number, y: number) => x > view.l && x < view.r && y > view.t && y < view.b
    const items: { y: number; draw: () => void }[] = []
    for (const b of BUILDINGS) items.push({ y: (b.y + b.h) * T, draw: () => this.drawBuilding(b) })
    items.push({ y: (QUEST_BOARD.y + 0.2) * T, draw: () => this.drawQuestBoard() })
    for (const t of this.trees) if (visible(t.x * T, t.y * T)) items.push({ y: t.y * T, draw: () => this.drawTree(t) })
    for (const d of this.decor) if (visible(d.x, d.y)) items.push({ y: d.y, draw: () => this.drawDecor(d) })
    for (const n of this.npcs) if (visible(n.x, n.y)) items.push({ y: n.y, draw: () => this.drawNpc(n) })
    items.push({ y: this.player.y, draw: () => this.drawPlayer() })
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.draw()

    this.drawSecrets()
    this.drawFocusMarker()

    // Harmattan dust in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const d of this.dust) {
      d.x = (d.x + d.v * 0.0008) % 1
      d.y = (d.y + Math.sin(this.time + d.v * 10) * 0.0003 + 1) % 1
      ctx.fillStyle = `rgba(247,227,176,${d.a})`
      ctx.beginPath()
      ctx.arc(d.x * vw, d.y * vh, 1.2 + d.v * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawGround(x0: number, x1: number, y0: number, y1: number) {
    const ctx = this.ctx
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const t = this.tiles[y * WORLD_W + x]
        const h = hash(x, y)
        const px = x * T, py = y * T
        if (t === ROAD) {
          ctx.fillStyle = h < 0.33 ? '#c06536' : h < 0.66 ? '#c96d3b' : '#b85e31'
          ctx.fillRect(px, py, T + 0.5, T + 0.5)
          ctx.fillStyle = 'rgba(80,30,10,0.18)'
          ctx.fillRect(px + h * 24, py + ((h * 7) % 1) * 24, 3, 2)
          ctx.fillRect(px + ((h * 13) % 1) * 26, py + ((h * 3) % 1) * 26, 2, 2)
        } else if (t === PLAZA_T) {
          ctx.fillStyle = (x + y) % 2 ? '#e9d4a6' : '#e2cb9a'
          ctx.fillRect(px, py, T + 0.5, T + 0.5)
        } else {
          const g = t === GARDEN
          ctx.fillStyle = g ? (h < 0.5 ? '#4f9446' : '#57a04c') : h < 0.33 ? '#6c9a3b' : h < 0.66 ? '#74a240' : '#68953a'
          ctx.fillRect(px, py, T + 0.5, T + 0.5)
          ctx.fillStyle = g ? 'rgba(20,70,30,0.35)' : 'rgba(40,80,20,0.35)'
          for (let i = 0; i < 3; i++) {
            const hx = hash(x * 3 + i, y * 7 - i)
            ctx.fillRect(px + hx * 28, py + ((hx * 17) % 1) * 28, 2, 4)
          }
          if (h > 0.93) { ctx.fillStyle = '#f2d16b'; ctx.fillRect(px + 10, py + 14, 3, 3) }
        }
        // Road edges
        if (t === ROAD) {
          ctx.fillStyle = 'rgba(70,40,10,0.25)'
          if (this.tiles[(y - 1) * WORLD_W + x] === GRASS) ctx.fillRect(px, py, T, 3)
          if (this.tiles[(y + 1) * WORLD_W + x] === GRASS) ctx.fillRect(px, py + T - 3, T, 3)
          if (this.tiles[y * WORLD_W + x - 1] === GRASS) ctx.fillRect(px, py, 3, T)
          if (this.tiles[y * WORLD_W + x + 1] === GRASS) ctx.fillRect(px + T - 3, py, 3, T)
        }
      }
  }

  private drawPlaza() {
    const ctx = this.ctx
    const cx = PLAZA.cx * T, cy = PLAZA.cy * T, r = PLAZA.r * T
    ctx.save()
    ctx.strokeStyle = '#2f3f9e'
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.55
    for (const rr of [r - 8, r * 0.72, r * 0.46]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke() }
    ctx.setLineDash([6, 8])
    ctx.lineWidth = 2
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48)
      ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10))
      ctx.stroke()
    }
    ctx.setLineDash([])
    // Adire dots ring
    ctx.fillStyle = '#2f3f9e'
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()

    // Fountain with Garri pot
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, 56, 34, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#b8935a'
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, 54, 34, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#3d7fc4'
    ctx.beginPath(); ctx.ellipse(cx, cy, 46, 27, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 3; i++) {
      const k = ((this.time * 0.5 + i / 3) % 1)
      ctx.globalAlpha = 1 - k
      ctx.beginPath(); ctx.ellipse(cx, cy, 14 + k * 30, 8 + k * 18, 0, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1
    // Pot
    ctx.fillStyle = '#2b1d14'
    ctx.beginPath(); ctx.ellipse(cx, cy - 10, 18, 16, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f2b632'
    ctx.beginPath(); ctx.ellipse(cx, cy - 22, 14, 5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f7e3b0'
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx - 8 + i * 3.2, cy - 25 - (i % 2) * 2, 2.2, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.ellipse(cx, cy - 8, 18, 5, 0, 0, Math.PI); ctx.stroke()
  }

  private drawPond() {
    const ctx = this.ctx
    const x = POND.cx * T, y = POND.cy * T
    ctx.fillStyle = '#3b6b35'
    ctx.beginPath(); ctx.ellipse(x, y + 4, POND.rx * T + 6, POND.ry * T + 6, 0, 0, Math.PI * 2); ctx.fill()
    const g = ctx.createRadialGradient(x - 20, y - 10, 10, x, y, POND.rx * T)
    g.addColorStop(0, '#5aa6d8'); g.addColorStop(1, '#2b5d9a')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(x, y, POND.rx * T, POND.ry * T, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#3f9a52'
    for (const [ox, oy] of [[-40, -10], [30, 14], [50, -18]]) { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, 9, 6, 0.3, 0.3, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#f7a8c8'
    ctx.beginPath(); ctx.arc(x + 30, y + 12, 3, 0, Math.PI * 2); ctx.fill()
  }

  private sign(text: string, sub: string, x: number, y: number, trim: string) {
    const ctx = this.ctx
    ctx.font = '700 11px Unbounded, sans-serif'
    const w = Math.max(ctx.measureText(text).width + 18, 70)
    ctx.fillStyle = '#120f2e'
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 26, 5); ctx.fill()
    ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = trim
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y - 2)
    ctx.font = '500 7px "Bricolage Grotesque", sans-serif'
    ctx.fillStyle = '#fdf4e1'
    ctx.fillText(sub.toUpperCase(), x, y + 8)
  }

  private drawBuilding(b: Building) {
    const ctx = this.ctx
    const px = b.x * T, py = b.y * T, pw = b.w * T, ph = b.h * T
    ctx.fillStyle = 'rgba(10,20,5,0.28)'
    ctx.beginPath(); ctx.roundRect(px + 6, py + ph * 0.3 + 8, pw, ph * 0.7, 8); ctx.fill()

    if (b.style === 'arena') return this.drawArena(b)
    if (b.style === 'stalls') return this.drawMarket(b)

    const wallTop = py + ph * 0.32
    const wallH = ph - ph * 0.32
    ctx.fillStyle = b.wall
    ctx.fillRect(px, wallTop, pw, wallH)
    // Base trim with zigzag
    ctx.fillStyle = b.trim
    ctx.fillRect(px, py + ph - 8, pw, 8)
    ctx.fillStyle = b.wall
    for (let i = 0; i < pw; i += 10) { ctx.beginPath(); ctx.moveTo(px + i, py + ph - 8); ctx.lineTo(px + i + 5, py + ph - 3); ctx.lineTo(px + i + 10, py + ph - 8); ctx.fill() }

    // Windows
    const glass = b.style === 'gallery' || b.style === 'hub'
    const winY = wallTop + wallH * 0.28
    const nWin = Math.max(2, Math.floor(b.w / 2.2))
    for (let i = 0; i < nWin; i++) {
      const wx = px + (pw / (nWin + 1)) * (i + 1) - 9
      if (Math.abs(wx + 9 - (px + pw / 2)) < 26) continue
      ctx.fillStyle = glass ? (b.style === 'gallery' ? '#f2b632' : '#9fe0c0') : '#1d1a4d'
      ctx.globalAlpha = glass ? 0.85 + Math.sin(this.time * 2 + i) * 0.1 : 1
      ctx.fillRect(wx, winY, 18, 22)
      ctx.globalAlpha = 1
      ctx.strokeStyle = b.trim; ctx.lineWidth = 2; ctx.strokeRect(wx, winY, 18, 22)
      if (b.style === 'gallery') { ctx.fillStyle = '#120f2e'; ctx.fillRect(wx + 4, winY + 4, 10, 14) ; ctx.fillStyle = ['#d4552a', '#2f3f9e', '#1f8a5b'][i % 3]; ctx.fillRect(wx + 6, winY + 6, 6, 10) }
    }

    if (b.style === 'bank') {
      ctx.fillStyle = '#fffaf0'
      for (let i = 0; i < 6; i++) {
        const cxp = px + 14 + i * ((pw - 28) / 5)
        ctx.fillRect(cxp - 4, wallTop + 4, 8, wallH - 14)
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(cxp + 2, wallTop + 4, 2, wallH - 14); ctx.fillStyle = '#fffaf0'
      }
    }

    // Door
    const dw = 30, dh = 34
    const dx = b.door.x * T - dw / 2, dy = py + ph - 8 - dh
    ctx.fillStyle = '#2b1d14'
    ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, [12, 12, 0, 0]); ctx.fill()
    ctx.fillStyle = b.trim
    ctx.fillRect(dx - 3, dy + dh - 2, dw + 6, 3)
    ctx.fillStyle = 'rgba(242,182,50,0.25)'
    ctx.beginPath(); ctx.roundRect(dx + 4, dy + 4, dw - 8, dh - 4, [9, 9, 0, 0]); ctx.fill()

    // Roof
    const over = 10
    const roofTop = py - (b.style === 'house' ? 18 : 10)
    const roofBot = wallTop + 10
    ctx.fillStyle = b.roof
    if (b.style === 'bank') {
      ctx.beginPath(); ctx.moveTo(px - over, roofBot); ctx.lineTo(px + pw / 2, roofTop - 14); ctx.lineTo(px + pw + over, roofBot); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = b.trim; ctx.lineWidth = 3; ctx.stroke()
      ctx.fillStyle = b.trim; ctx.beginPath(); ctx.arc(px + pw / 2, roofBot - 22, 9, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = b.roof; ctx.font = '900 10px Unbounded'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('G', px + pw / 2, roofBot - 21)
    } else if (b.style === 'community') {
      // Thatch
      ctx.fillStyle = '#c9a24a'
      ctx.beginPath(); ctx.moveTo(px - over, roofBot); ctx.quadraticCurveTo(px + pw / 2, roofTop - 40, px + pw + over, roofBot); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#8a6a22'; ctx.lineWidth = 1.5
      for (let i = 0; i < 14; i++) { const x = px - over + ((pw + over * 2) / 14) * i; ctx.beginPath(); ctx.moveTo(x, roofBot); ctx.lineTo(px + pw / 2 + (x - px - pw / 2) * 0.3, roofTop - 10); ctx.stroke() }
    } else {
      ctx.beginPath()
      ctx.moveTo(px - over, roofBot)
      ctx.lineTo(px + 8, roofTop)
      ctx.lineTo(px + pw - 8, roofTop)
      ctx.lineTo(px + pw + over, roofBot)
      ctx.closePath(); ctx.fill()
      // Corrugated stripes
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2
      for (let x = px; x < px + pw; x += 8) { ctx.beginPath(); ctx.moveTo(x, roofBot); ctx.lineTo(x + (x - px - pw / 2) * 0.05, roofTop + 2); ctx.stroke() }
      ctx.fillStyle = b.trim; ctx.fillRect(px - over, roofBot - 4, pw + over * 2, 4)
      if (b.style === 'house') { ctx.fillStyle = '#5e3a1a'; ctx.fillRect(px + pw - 26, roofTop - 14, 10, 18) }
    }

    if (b.style === 'community') {
      for (const ox of [-46, 46]) {
        const x = b.door.x * T + ox, y = py + ph - 14
        ctx.fillStyle = '#5e1714'; ctx.beginPath(); ctx.roundRect(x - 7, y - 16, 14, 18, 3); ctx.fill()
        ctx.fillStyle = '#f7e3b0'; ctx.beginPath(); ctx.ellipse(x, y - 16, 7, 3, 0, 0, Math.PI * 2); ctx.fill()
      }
    }

    this.sign(b.name, b.sub, b.door.x * T, wallTop + 6, b.trim)
  }

  private drawArena(b: Building) {
    const ctx = this.ctx
    const cx = (b.x + b.w / 2) * T, cy = (b.y + b.h / 2) * T + 10
    const rx = (b.w / 2) * T, ry = (b.h / 2) * T
    ctx.fillStyle = '#8f4a26'
    ctx.beginPath(); ctx.ellipse(cx, cy + 22, rx, ry - 8, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = b.wall
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry - 8, 0, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? '#a3322c' : '#e0a86a'; ctx.lineWidth = 6
      ctx.beginPath(); ctx.ellipse(cx, cy, rx - 12 - i * 12, ry - 18 - i * 9, 0, 0, Math.PI * 2); ctx.stroke()
    }
    // Crowd dots
    const rc = seeded(9)
    for (let i = 0; i < 70; i++) {
      const a = rc() * Math.PI * 2, k = 0.72 + rc() * 0.22
      ctx.fillStyle = ['#f2b632', '#fdf4e1', '#2f3f9e', '#1f8a5b', '#d4552a'][i % 5]
      ctx.fillRect(cx + Math.cos(a) * (rx - 10) * k, cy + Math.sin(a) * (ry - 14) * k + Math.sin(this.time * 6 + i) * 0.8, 3, 3)
    }
    ctx.fillStyle = '#4f9446'
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.45, ry * 0.32, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fdf4e1'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.12, ry * 0.12, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx, cy - ry * 0.32); ctx.lineTo(cx, cy + ry * 0.32); ctx.stroke()
    // Flags
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI
      const fx = cx + Math.cos(a) * rx * 0.98, fy = cy + Math.sin(a) * (ry - 8)
      ctx.strokeStyle = '#2b1d14'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 26); ctx.stroke()
      const wv = Math.sin(this.time * 4 + i) * 3
      ctx.fillStyle = i % 2 ? '#1f8a5b' : '#f2b632'
      ctx.beginPath(); ctx.moveTo(fx, fy - 26); ctx.lineTo(fx + 14, fy - 22 + wv); ctx.lineTo(fx, fy - 17); ctx.fill()
    }
    // Gate
    const gx = b.door.x * T
    ctx.fillStyle = '#2b1d14'
    ctx.beginPath(); ctx.roundRect(gx - 22, cy + ry - 38, 44, 36, [18, 18, 0, 0]); ctx.fill()
    ctx.strokeStyle = b.trim; ctx.lineWidth = 3; ctx.stroke()
    this.sign('ARENA', 'Leaderboards', gx, cy + ry - 52, b.trim)
  }

  private drawMarket(b: Building) {
    const ctx = this.ctx
    const px = b.x * T, py = b.y * T, pw = b.w * T, ph = b.h * T
    const n = 4
    const sw = pw / n
    const colors = [['#d4552a', '#fdf4e1'], ['#1f8a5b', '#f2b632'], ['#2f3f9e', '#fdf4e1'], ['#f2b632', '#a3322c']]
    const produce = ['#f2b632', '#d4552a', '#1f8a5b', '#f7e3b0', '#8b2e2a']
    for (let i = 0; i < n; i++) {
      const sx = px + i * sw + 4, sy = py + ph * 0.25
      ctx.fillStyle = '#7a4a22'
      ctx.fillRect(sx + 4, sy + 26, sw - 16, ph * 0.5)
      ctx.fillStyle = '#5e3a1a'
      ctx.fillRect(sx + 2, sy + 10, 4, ph * 0.65); ctx.fillRect(sx + sw - 14, sy + 10, 4, ph * 0.65)
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = produce[(i * 3 + j) % 5]
        ctx.beginPath(); ctx.arc(sx + 12 + (j % 4) * ((sw - 30) / 3), sy + 30 + Math.floor(j / 4) * 8, 5, 0, Math.PI * 2); ctx.fill()
      }
      // Striped awning
      const [c1, c2] = colors[i]
      const stripes = 6
      for (let k = 0; k < stripes; k++) {
        ctx.fillStyle = k % 2 ? c2 : c1
        ctx.beginPath()
        const ax = sx - 2 + ((sw - 4) / stripes) * k
        ctx.moveTo(ax, sy - 8); ctx.lineTo(ax + (sw - 4) / stripes, sy - 8)
        ctx.lineTo(ax + (sw - 4) / stripes, sy + 14); ctx.lineTo(ax, sy + 14); ctx.fill()
      }
      ctx.fillStyle = c1
      for (let k = 0; k < stripes; k++) { ctx.beginPath(); ctx.arc(sx - 2 + ((sw - 4) / stripes) * (k + 0.5), sy + 14, (sw - 4) / stripes / 2, 0, Math.PI); ctx.fill() }
    }
    this.sign(b.name, b.sub, b.door.x * T, py + 2, '#f2b632')
  }

  private drawQuestBoard() {
    const ctx = this.ctx
    const x = QUEST_BOARD.x * T, y = QUEST_BOARD.y * T
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(x, y + 6, 44, 8, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5e3a1a'
    ctx.fillRect(x - 36, y - 40, 6, 46); ctx.fillRect(x + 30, y - 40, 6, 46)
    ctx.fillStyle = '#8b5a2b'
    ctx.beginPath(); ctx.roundRect(x - 42, y - 64, 84, 40, 4); ctx.fill()
    ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 2; ctx.stroke()
    const papers = ['#fdf4e1', '#f7e3b0', '#fdf4e1', '#f2d16b', '#fdf4e1']
    papers.forEach((c, i) => {
      ctx.save()
      ctx.translate(x - 32 + i * 16, y - 56 + (i % 2) * 6)
      ctx.rotate((i % 2 ? 1 : -1) * 0.08)
      ctx.fillStyle = c; ctx.fillRect(0, 0, 12, 16)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(2, 4, 8, 1.5); ctx.fillRect(2, 8, 6, 1.5)
      ctx.fillStyle = '#a3322c'; ctx.beginPath(); ctx.arc(6, 1, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    })
    ctx.fillStyle = '#a3322c'
    ctx.beginPath(); ctx.moveTo(x - 46, y - 64); ctx.lineTo(x, y - 80); ctx.lineTo(x + 46, y - 64); ctx.fill()
    ctx.font = '700 7px Unbounded'; ctx.fillStyle = '#f2b632'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('QUESTS', x, y - 70)
    const bob = Math.sin(this.time * 3) * 2
    ctx.fillStyle = '#f2b632'
    ctx.beginPath(); ctx.arc(x, y - 92 + bob, 7, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#120f2e'; ctx.font = '900 9px Unbounded'; ctx.fillText('!', x, y - 91 + bob)
  }

  private drawTree(t: Tree) {
    const ctx = this.ctx
    const x = t.x * T, y = t.y * T, s = t.s
    ctx.fillStyle = 'rgba(10,30,5,0.3)'
    ctx.beginPath(); ctx.ellipse(x + 4, y + 2, 16 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill()
    if (t.kind === 'palm') {
      const sway = Math.sin(this.time * 1.2 + t.x) * 2
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8 * s, y - 26 * s, x + 4 * s + sway, y - 52 * s); ctx.stroke()
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5
      for (let i = 1; i < 6; i++) { const k = i / 6; ctx.beginPath(); ctx.moveTo(x - 3 * s + 8 * s * k, y - 52 * s * k); ctx.lineTo(x + 4 * s + 8 * s * k, y - 52 * s * k); ctx.stroke() }
      const tx = x + 4 * s + sway, ty = y - 52 * s
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + Math.sin(this.time + i) * 0.05
        ctx.fillStyle = i % 2 ? '#2f7d3a' : '#3c9446'
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(a)
        ctx.beginPath(); ctx.ellipse(16 * s, 4 * s, 18 * s, 5 * s, 0.35, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
      ctx.fillStyle = '#5e3a1a'
      ctx.beginPath(); ctx.arc(tx - 3, ty + 4, 3 * s, 0, Math.PI * 2); ctx.arc(tx + 3, ty + 5, 3 * s, 0, Math.PI * 2); ctx.fill()
    } else if (t.kind === 'round') {
      ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 4 * s, y - 20 * s, 8 * s, 20 * s)
      ctx.fillStyle = '#2b6e33'
      ctx.beginPath(); ctx.arc(x, y - 30 * s, 20 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#3a8a40'
      ctx.beginPath(); ctx.arc(x - 6 * s, y - 34 * s, 13 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#f2b632'
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 10 * s + i * 7 * s, y - 26 * s + (i % 2) * 6, 2.5 * s, 0, Math.PI * 2); ctx.fill() }
    } else {
      ctx.fillStyle = '#356f2c'
      ctx.beginPath(); ctx.arc(x - 6 * s, y - 6 * s, 9 * s, 0, Math.PI * 2); ctx.arc(x + 6 * s, y - 7 * s, 10 * s, 0, Math.PI * 2); ctx.arc(x, y - 13 * s, 9 * s, 0, Math.PI * 2); ctx.fill()
    }
  }

  private drawDecor(d: Decor) {
    const ctx = this.ctx
    if (d.kind === 'lamp') {
      ctx.fillStyle = '#2b1d14'; ctx.fillRect(d.x - 2, d.y - 34, 4, 34)
      ctx.fillStyle = '#f2b632'
      ctx.globalAlpha = 0.25 + Math.sin(this.time * 2 + d.x) * 0.05
      ctx.beginPath(); ctx.arc(d.x, d.y - 36, 12, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(d.x, d.y - 36, 4.5, 0, Math.PI * 2); ctx.fill()
    } else if (d.kind === 'flowers') {
      ctx.fillStyle = d.c!
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(d.x + i * 5 - 5, d.y - (i % 2) * 3, 2.4, 0, Math.PI * 2); ctx.fill() }
    } else if (d.kind === 'danfo') {
      const x = d.x - 56, y = d.y - 40
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 60, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#f2b632'; ctx.beginPath(); ctx.roundRect(x, y, 112, 38, [14, 8, 4, 4]); ctx.fill()
      ctx.fillStyle = '#120f2e'; ctx.fillRect(x, y + 22, 112, 4); ctx.fillRect(x, y + 29, 112, 3)
      ctx.fillStyle = '#9fd0e8'
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 10 + i * 22, y + 5, 17, 13)
      ctx.fillStyle = '#120f2e'
      ctx.beginPath(); ctx.arc(x + 24, y + 38, 8, 0, Math.PI * 2); ctx.arc(x + 88, y + 38, 8, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(x + 24, y + 38, 3, 0, Math.PI * 2); ctx.arc(x + 88, y + 38, 3, 0, Math.PI * 2); ctx.fill()
      ctx.font = '700 6px Unbounded'; ctx.fillStyle = '#120f2e'; ctx.textAlign = 'center'
      ctx.fillText('NO SHAKING', x + 56, y + 34)
    }
  }

  private drawCharacter(x: number, y: number, outfit: string, skin: string, cap: string, dir: number, phase: number, moving: boolean) {
    const ctx = this.ctx
    const step = moving ? Math.sin(phase) : 0
    const bob = moving ? Math.abs(Math.sin(phase)) * 1.5 : 0
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath(); ctx.ellipse(x, y, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill()
    // Legs
    ctx.fillStyle = '#1a1530'
    ctx.fillRect(x - 5, y - 9 + step * 1.5, 4, 9 - step * 1.5)
    ctx.fillRect(x + 1, y - 9 - step * 1.5, 4, 9 + step * 1.5)
    const by = y - 9 - bob
    // Body (agbada-style tunic)
    ctx.fillStyle = outfit
    ctx.beginPath(); ctx.roundRect(x - 8, by - 15, 16, 17, [5, 5, 3, 3]); ctx.fill()
    // Ankara dots
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 4 + (i % 2) * 8, by - 11 + Math.floor(i / 2) * 7, 1.6, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 8, by - 2, 16, 2)
    // Arms
    ctx.fillStyle = skin
    ctx.fillRect(x - 10, by - 12 - step, 3, 9)
    ctx.fillRect(x + 7, by - 12 + step, 3, 9)
    // Head
    ctx.beginPath(); ctx.arc(x, by - 21, 6.5, 0, Math.PI * 2); ctx.fill()
    if (dir !== 2) {
      ctx.fillStyle = '#120f2e'
      const off = dir === 1 ? 2 : dir === 3 ? -2 : 0
      ctx.fillRect(x - 3 + off, by - 22, 1.6, 2); ctx.fillRect(x + 1.6 + off, by - 22, 1.6, 2)
    }
    if (cap === 'fila') {
      ctx.fillStyle = outfit
      ctx.beginPath(); ctx.moveTo(x - 7, by - 24); ctx.lineTo(x + 7, by - 24); ctx.lineTo(x + 9, by - 31); ctx.lineTo(x - 4, by - 30); ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 7, by - 25, 14, 1.5)
    } else if (cap === 'gele') {
      ctx.fillStyle = outfit
      ctx.beginPath(); ctx.ellipse(x, by - 28, 10, 6, -0.2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.beginPath(); ctx.ellipse(x + 3, by - 30, 5, 2.5, -0.5, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = '#120f2e'
      ctx.beginPath(); ctx.arc(x, by - 23, 6.5, Math.PI, 0); ctx.fill()
    }
  }

  private label(text: string, x: number, y: number, color = '#fdf4e1') {
    const ctx = this.ctx
    ctx.font = '700 8px "Bricolage Grotesque", sans-serif'
    const w = ctx.measureText(text).width + 10
    ctx.fillStyle = 'rgba(18,15,46,0.8)'
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 7, w, 13, 6); ctx.fill()
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
  }

  private drawNpc(n: Npc) {
    this.drawCharacter(n.x, n.y, n.def.outfit, '#6b4226', n.def.cap, n.dir, n.phase, n.moving)
    const near = Math.hypot(n.x - this.player.x, n.y - this.player.y) < T * 4
    if (near) this.label(n.def.name, n.x, n.y - 46, '#f2b632')
    else {
      const bob = Math.sin(this.time * 3 + n.x) * 1.5
      this.ctx.fillStyle = '#fdf4e1'
      this.ctx.font = '700 9px sans-serif'; this.ctx.textAlign = 'center'
      this.ctx.fillText('…', n.x, n.y - 42 + bob)
    }
  }

  private drawPlayer() {
    const p = this.player
    this.drawCharacter(p.x, p.y, this.avatar.outfit, this.avatar.skin, this.avatar.cap, p.dir, p.phase, p.moving)
    this.label(this.name, p.x, p.y - 48, '#fdf4e1')
  }

  private drawSecrets() {
    const ctx = this.ctx
    for (const [id, s] of Object.entries(SECRET_SPOTS)) {
      if (this.found.has(id)) continue
      const x = s.x * T, y = s.y * T
      const d = Math.hypot(x - this.player.x, y - this.player.y) / T
      if (d > 6) continue
      const a = (1 - d / 6) * (0.5 + Math.sin(this.time * 5 + s.x) * 0.5)
      ctx.save()
      ctx.globalAlpha = a
      ctx.translate(x, y - 6)
      ctx.rotate(this.time)
      ctx.fillStyle = '#fff6c8'
      ctx.beginPath()
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 2 : 7; const ang = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) }
      ctx.fill()
      ctx.restore()
    }
  }

  private drawFocusMarker() {
    const f = this.focus
    if (!f || f.kind === 'npc') return
    const ctx = this.ctx
    const b = f.kind === 'door' ? BUILDINGS.find((x) => x.id === f.id)! : null
    const x = b ? b.door.x * T : QUEST_BOARD.x * T
    const y = b ? b.door.y * T : (QUEST_BOARD.y + 0.8) * T
    const k = (Math.sin(this.time * 5) + 1) / 2
    ctx.strokeStyle = `rgba(242,182,50,${0.5 + k * 0.5})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.ellipse(x, y, 16 + k * 3, 6 + k, 0, 0, Math.PI * 2); ctx.stroke()
  }
}
