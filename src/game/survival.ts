/**
 * GARRI SURVIVAL — pure, deterministic game engine.
 *
 * Every run is fully described by (mode, seed, actions[]). The same inputs
 * always produce the same outcome, so a server can replay the action log to
 * verify a submitted score (see PLAN.md, server-side verification).
 */
import type { SurvivalMode } from '@/lib/types'

// ─── seeded RNG (mulberry32) ────────────────────────────────────────────────
function next(s: SurvivalState) {
  s.rng = (s.rng + 0x6d2b79f5) | 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const roll = (s: SurvivalState, min: number, max: number) => min + Math.floor(next(s) * (max - min + 1))
const chance = (s: SurvivalState, p: number) => next(s) < p

export function hashSeed(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

// ─── types ──────────────────────────────────────────────────────────────────
export type Weather = 'sunny' | 'rain' | 'harmattan'
export const SLOTS = ['Morning', 'Afternoon', 'Evening'] as const

export interface LogEntry {
  day: number
  text: string
  tone: 'good' | 'bad' | 'info'
}

export interface SurvivalState {
  mode: SurvivalMode
  seed: number
  rng: number
  day: number
  slot: number
  maxDays: number
  hp: number
  satiety: number
  water: number
  energy: number
  naira: number
  cassava: number
  garri: number
  batches: number[] // day each fermenting batch becomes ready
  rep: number
  price: number
  weather: Weather
  eventId: string | null
  eventDoneToday: boolean
  status: 'playing' | 'won' | 'lost'
  causeOfEnd: string | null
  log: LogEntry[]
  actions: string[]
  stats: { garriMade: number; garriSold: number; helped: number; events: number }
}

export const MODES: Record<SurvivalMode, { name: string; tagline: string; days: number; drain: number; mult: number }> = {
  classic: { name: 'Classic', tagline: 'Survive 10 days in town.', days: 10, drain: 1, mult: 1 },
  harmattan: { name: 'Harmattan', tagline: 'Dry winds. Harsher thirst. 1.5× score.', days: 10, drain: 1.3, mult: 1.5 },
  daily: { name: 'Daily Challenge', tagline: 'Same seed for every Citizen today. 7 days.', days: 7, drain: 1.1, mult: 1.2 },
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))
const say = (s: SurvivalState, text: string, tone: LogEntry['tone'] = 'info') => s.log.unshift({ day: s.day, text, tone })

function rollDay(s: SurvivalState) {
  const r = next(s)
  s.weather = s.mode === 'harmattan' ? (r < 0.65 ? 'harmattan' : r < 0.85 ? 'sunny' : 'rain') : r < 0.5 ? 'sunny' : r < 0.8 ? 'rain' : 'harmattan'
  const base = 120 + (s.weather === 'harmattan' ? 30 : 0)
  s.price = Math.round((base * (0.7 + next(s) * 0.9)) / 5) * 5
  s.eventDoneToday = false
}

export function newGame(mode: SurvivalMode, seed: number): SurvivalState {
  const s: SurvivalState = {
    mode, seed, rng: seed, day: 1, slot: 0, maxDays: MODES[mode].days,
    hp: 100, satiety: 80, water: 70, energy: 90, naira: 800, cassava: 3, garri: 2, batches: [],
    rep: 0, price: 120, weather: 'sunny', eventId: null, eventDoneToday: false,
    status: 'playing', causeOfEnd: null, log: [], actions: [],
    stats: { garriMade: 0, garriSold: 0, helped: 0, events: 0 },
  }
  rollDay(s)
  say(s, 'You wake in your small house at the edge of town. The farm, the market and the stream are all within reach.')
  return s
}

// ─── actions ────────────────────────────────────────────────────────────────
export interface ActionDef {
  id: string
  name: string
  icon: string
  energy: number
  blurb: string
  can: (s: SurvivalState) => string | null // returns reason if unavailable
  run: (s: SurvivalState) => void
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'farm', name: 'Farm cassava', icon: '🌱', energy: 25, blurb: '+2–5 cassava. Rain helps.',
    can: () => null,
    run: (s) => {
      let n = roll(s, 2, 4) + (s.weather === 'rain' ? 1 : 0) - (s.weather === 'harmattan' ? 1 : 0)
      n = Math.max(1, n)
      s.cassava += n
      say(s, `You dug ${n} cassava tubers${s.weather === 'rain' ? ' from soft, rain-fed soil' : ''}.`, 'good')
    },
  },
  {
    id: 'process', name: 'Peel & ferment', icon: '🔪', energy: 20, blurb: 'Uses 3 cassava. Ready to fry tomorrow.',
    can: (s) => (s.cassava < 3 ? 'Need 3 cassava' : null),
    run: (s) => {
      s.cassava -= 3
      s.batches.push(s.day + 1)
      say(s, 'Peeled, grated and bagged the mash. It will ferment overnight.')
    },
  },
  {
    id: 'fry', name: 'Fry garri', icon: '🍳', energy: 20, blurb: 'Fry a ready batch. Uses 10 water.',
    can: (s) => (!s.batches.some((d) => d <= s.day) ? 'No fermented batch ready' : s.water < 10 ? 'Need 10 water' : null),
    run: (s) => {
      const i = s.batches.findIndex((d) => d <= s.day)
      s.batches.splice(i, 1)
      s.water = clamp(s.water - 10)
      const n = 4 + roll(s, 0, 2)
      s.garri += n
      s.stats.garriMade += n
      say(s, `The pan crackles. You fry ${n} cups of crisp golden garri.`, 'good')
    },
  },
  {
    id: 'water', name: 'Fetch water', icon: '💧', energy: 15, blurb: '+45 water from the stream.',
    can: () => null,
    run: (s) => {
      const n = s.weather === 'harmattan' ? 30 : 45
      s.water = clamp(s.water + n)
      say(s, s.weather === 'harmattan' ? 'The stream runs low in the harmattan. You bring back what you can.' : 'You carry a full bucket back from the stream.', 'good')
    },
  },
  {
    id: 'eat', name: 'Soak & eat garri', icon: '🥣', energy: 0, blurb: '−1 garri, −8 water, +32 food.',
    can: (s) => (s.garri < 1 ? 'No garri' : s.water < 8 ? 'Need 8 water' : null),
    run: (s) => {
      s.garri -= 1
      s.water = clamp(s.water - 8)
      s.satiety = clamp(s.satiety + 32)
      say(s, 'Cold water, sugar and groundnut. Simple, filling, perfect.', 'good')
    },
  },
  {
    id: 'sell', name: 'Sell at market', icon: '🧺', energy: 10, blurb: 'Sell up to 3 cups at today’s price.',
    can: (s) => (s.garri < 1 ? 'No garri to sell' : null),
    run: (s) => {
      const n = Math.min(3, s.garri)
      const earned = n * s.price
      s.garri -= n
      s.naira += earned
      s.stats.garriSold += n
      say(s, `Sold ${n} cups at ₦${s.price} each. +₦${earned}.`, 'good')
    },
  },
  {
    id: 'buy', name: 'Eat at Mama Put', icon: '🍛', energy: 0, blurb: '₦400 → +45 food.',
    can: (s) => (s.naira < 400 ? 'Need ₦400' : null),
    run: (s) => {
      s.naira -= 400
      s.satiety = clamp(s.satiety + 45)
      say(s, 'Rice, stew and a piece of meat at Mama Put. Your belly thanks you.', 'good')
    },
  },
  {
    id: 'medicine', name: 'Visit chemist', icon: '💊', energy: 0, blurb: '₦600 → +30 health.',
    can: (s) => (s.naira < 600 ? 'Need ₦600' : s.hp >= 100 ? 'Already healthy' : null),
    run: (s) => {
      s.naira -= 600
      s.hp = clamp(s.hp + 30)
      say(s, 'The chemist sorts you out with medicine and advice.', 'good')
    },
  },
  {
    id: 'help', name: 'Help a neighbour', icon: '🤝', energy: 20, blurb: '+Reputation. They may return the favour.',
    can: () => null,
    run: (s) => {
      s.rep += 2
      s.stats.helped++
      if (chance(s, 0.45)) {
        if (chance(s, 0.5)) {
          s.cassava += 2
          say(s, 'You helped Iya Basira with her roof. She pressed 2 cassava into your hands.', 'good')
        } else {
          s.naira += 300
          say(s, 'You helped carry goods to the motor park. The trader tipped you ₦300.', 'good')
        }
      } else say(s, 'You spent the time helping a neighbour. The town remembers kindness.')
    },
  },
  {
    id: 'rest', name: 'Rest', icon: '😴', energy: 0, blurb: '+30 energy, +4 health.',
    can: () => null,
    run: (s) => {
      s.energy = clamp(s.energy + 30)
      s.hp = clamp(s.hp + 4)
      say(s, 'You lie on the mat under the fan (when NEPA allows) and recover.')
    },
  },
]

// ─── events ─────────────────────────────────────────────────────────────────
export interface EventDef {
  id: string
  title: string
  icon: string
  text: string
  when?: (s: SurvivalState) => boolean
  choices: { id: string; label: string; hint: string; run: (s: SurvivalState) => void }[]
}

export const EVENTS: EventDef[] = [
  {
    id: 'storm', title: 'Rainstorm', icon: '⛈️', text: 'Thunder rolls in. Water drips through a gap in your roof straight onto your garri bag.',
    when: (s) => s.weather === 'rain',
    choices: [
      { id: 'patch', label: 'Patch the roof', hint: '−15 energy', run: (s) => { s.energy = clamp(s.energy - 15); say(s, 'You climb up in the rain and patch the roof. Everything stays dry.', 'good') } },
      { id: 'ignore', label: 'Move the bag and hope', hint: 'Risky', run: (s) => {
        if (chance(s, 0.5) && s.garri > 0) { const n = Math.min(s.garri, 2); s.garri -= n; say(s, `The water found the bag anyway. ${n} cups ruined.`, 'bad') }
        else say(s, 'Luck is with you — the bag stays dry.', 'good')
      } },
    ],
  },
  {
    id: 'nepa', title: 'NEPA Took Light', icon: '🕯️', text: 'The power goes out. The neighbour’s generator roars. Your food will spoil without the freezer.',
    choices: [
      { id: 'share', label: 'Share food with neighbours', hint: '+Rep, −10 food', run: (s) => { s.satiety = clamp(s.satiety - 10); s.rep += 2; say(s, 'You share before it spoils. The compound eats well tonight.', 'good') } },
      { id: 'eat', label: 'Eat it all yourself', hint: '+15 food, −5 health', run: (s) => { s.satiety = clamp(s.satiety + 15); s.hp = clamp(s.hp - 5); say(s, 'You eat far too much. Your stomach protests.', 'bad') } },
    ],
  },
  {
    id: 'thief', title: 'Footsteps at Night', icon: '🌒', text: 'Someone is creeping around your storehouse.',
    when: (s) => s.garri > 0 || s.cassava > 0,
    choices: [
      { id: 'guard', label: 'Stay up and guard', hint: '−20 energy', run: (s) => { s.energy = clamp(s.energy - 20); say(s, 'You sit by the door with a torch until dawn. Nothing is taken.', 'good') } },
      { id: 'sleep', label: 'Lock up and sleep', hint: 'Risky', run: (s) => {
        if (chance(s, 0.45)) { const g = Math.min(s.garri, roll(s, 1, 3)); const c = Math.min(s.cassava, 2); s.garri -= g; s.cassava -= c; say(s, `Morning reveals the lock forced. Lost ${g} garri and ${c} cassava.`, 'bad') }
        else say(s, 'A dog barks, the footsteps run off. You sleep soundly.', 'good')
      } },
    ],
  },
  {
    id: 'festival', title: 'Town Festival', icon: '🥁', text: 'Drums from the plaza. The whole town is dancing tonight.',
    choices: [
      { id: 'join', label: 'Join the celebration', hint: '−₦300, +3 Rep, +10 health', run: (s) => { if (s.naira >= 300) { s.naira -= 300; s.rep += 3; s.hp = clamp(s.hp + 10); say(s, 'You dance, eat suya and laugh until midnight.', 'good') } else { s.rep += 1; say(s, 'No money, but you dance anyway. People love the energy.') } } },
      { id: 'sell', label: 'Sell garri to the crowd', hint: 'Price ×1.5', run: (s) => { const n = Math.min(s.garri, 3); const p = Math.round(s.price * 1.5); s.garri -= n; s.naira += n * p; s.stats.garriSold += n; say(s, n ? `Festival crowds pay ₦${p} a cup. Sold ${n}.` : 'You have nothing to sell. Maybe next time.', n ? 'good' : 'info') } },
    ],
  },
  {
    id: 'sick', title: 'Neighbour’s Child Is Sick', icon: '🤒', text: 'Mama Tobi knocks, worried. Her son has not eaten all day.',
    choices: [
      { id: 'give', label: 'Give 2 cups of garri', hint: '+4 Rep', run: (s) => { if (s.garri >= 2) { s.garri -= 2; s.rep += 4; say(s, 'Mama Tobi blesses you. Word spreads about your kindness.', 'good') } else { s.rep += 1; say(s, 'You have little, but you sit with them. It matters.') } } },
      { id: 'money', label: 'Give ₦400 for medicine', hint: '+5 Rep', run: (s) => { if (s.naira >= 400) { s.naira -= 400; s.rep += 5; say(s, 'The chemist sees the boy in time. The town will not forget.', 'good') } else say(s, 'You cannot afford it. You apologise.', 'bad') } },
      { id: 'decline', label: 'Decline politely', hint: 'Nothing changes', run: (s) => say(s, 'You close the door. The night feels heavier.') },
    ],
  },
  {
    id: 'pests', title: 'Grasscutters in the Farm', icon: '🐀', text: 'Grasscutters are digging up your cassava rows.',
    when: (s) => s.cassava > 0,
    choices: [
      { id: 'trap', label: 'Set traps', hint: '−15 energy', run: (s) => { s.energy = clamp(s.energy - 15); if (chance(s, 0.4)) { s.naira += 500; say(s, 'Caught one! You sell the bushmeat for ₦500.', 'good') } else say(s, 'The traps keep them away.', 'good') } },
      { id: 'leave', label: 'Leave it', hint: 'Lose some cassava', run: (s) => { const n = Math.min(s.cassava, roll(s, 1, 3)); s.cassava -= n; say(s, `They took ${n} tubers.`, 'bad') } },
    ],
  },
  {
    id: 'okada', title: 'Okada Offer', icon: '🏍️', text: 'Emeka slows his okada. “Make I carry you go market? Na ₦200.”',
    choices: [
      { id: 'ride', label: 'Hop on', hint: '−₦200, +20 energy', run: (s) => { if (s.naira >= 200) { s.naira -= 200; s.energy = clamp(s.energy + 20); say(s, 'Wind in your face. You save your legs for work.', 'good') } else say(s, 'You check your pocket. Empty. You walk.') } },
      { id: 'walk', label: 'Walk', hint: 'Save money', run: (s) => say(s, 'You wave him on and walk in the sun.') },
    ],
  },
  {
    id: 'trader', title: 'Bulk Buyer Arrives', icon: '🚐', text: 'A danfo pulls up. A trader from the city wants garri in bulk — today only.',
    when: (s) => s.garri >= 3,
    choices: [
      { id: 'sellall', label: 'Sell everything', hint: 'Good price, no food stock', run: (s) => { const p = Math.round(s.price * 1.3); const n = s.garri; s.naira += n * p; s.garri = 0; s.stats.garriSold += n; say(s, `Sold all ${n} cups at ₦${p}. +₦${n * p}.`, 'good') } },
      { id: 'keep', label: 'Keep your stock', hint: 'Stay safe', run: (s) => say(s, 'You keep your garri. Food first.') },
    ],
  },
  {
    id: 'dust', title: 'Harmattan Haze', icon: '🌫️', text: 'Dust fills the air. Your throat is dry and your lips crack.',
    when: (s) => s.weather === 'harmattan',
    choices: [
      { id: 'drink', label: 'Drink extra water', hint: '−15 water', run: (s) => { s.water = clamp(s.water - 15); say(s, 'You drink deeply and cover your face with a scarf.', 'good') } },
      { id: 'endure', label: 'Push through', hint: '−10 health', run: (s) => { s.hp = clamp(s.hp - 10); say(s, 'You cough through the night.', 'bad') } },
    ],
  },
  {
    id: 'elder', title: 'Baba Agba’s Advice', icon: '👴🏾', text: 'The elder stops you at the plaza. “Plant before you are hungry, my child.”',
    choices: [
      { id: 'listen', label: 'Sit and listen', hint: '−10 energy, +1 Rep, gift', run: (s) => { s.energy = clamp(s.energy - 10); s.rep += 1; s.cassava += 2; say(s, 'He gives you 2 cassava cuttings from his own farm.', 'good') } },
      { id: 'rush', label: 'Excuse yourself', hint: 'Nothing changes', run: (s) => say(s, 'He smiles. “The young are always in a hurry.”') },
    ],
  },
]

// ─── flow ───────────────────────────────────────────────────────────────────
export function availableEvents(s: SurvivalState) {
  return EVENTS.filter((e) => !e.when || e.when(s))
}

function clone(s: SurvivalState): SurvivalState {
  return { ...s, batches: [...s.batches], log: [...s.log], actions: [...s.actions], stats: { ...s.stats } }
}

function endDay(s: SurvivalState) {
  const d = MODES[s.mode].drain
  const thirst = Math.round((s.weather === 'harmattan' ? 32 : 24) * d)
  s.satiety = clamp(s.satiety - Math.round(22 * d))
  s.water = clamp(s.water - thirst)
  if (s.satiety <= 0) { s.hp = clamp(s.hp - 18); say(s, 'You go to bed hungry. −18 health.', 'bad') }
  if (s.water <= 0) { s.hp = clamp(s.hp - 22); say(s, 'Your body aches from thirst. −22 health.', 'bad') }
  if (s.satiety > 60 && s.water > 60) s.hp = clamp(s.hp + 5)
  s.energy = clamp(s.energy + 40)
  if (s.hp <= 0) {
    s.status = 'lost'
    s.causeOfEnd = s.water <= 0 ? 'Thirst' : s.satiety <= 0 ? 'Hunger' : 'Exhaustion'
    say(s, `Day ${s.day}: your strength gives out. The town carries you home.`, 'bad')
    return
  }
  if (s.day >= s.maxDays) {
    s.status = 'won'
    say(s, `You survived all ${s.maxDays} days. The town knows your name.`, 'good')
    return
  }
  s.day++
  s.slot = 0
  rollDay(s)
  say(s, `Day ${s.day} dawns — ${s.weather === 'rain' ? 'grey skies and rain' : s.weather === 'harmattan' ? 'dusty harmattan winds' : 'bright sun'}. Garri sells for ₦${s.price} a cup.`)
}

function advanceSlot(s: SurvivalState) {
  s.slot++
  // One event per day, triggered after the afternoon (75% chance)
  if (s.slot === 2 && !s.eventDoneToday) {
    s.eventDoneToday = true
    if (next(s) < 0.75) {
      const pool = availableEvents(s)
      s.eventId = pool[Math.floor(next(s) * pool.length)].id
      return
    }
  }
  if (s.slot >= 3) endDay(s)
}

export function act(prev: SurvivalState, actionId: string): SurvivalState {
  if (prev.status !== 'playing' || prev.eventId) return prev
  const a = ACTIONS.find((x) => x.id === actionId)
  if (!a || a.can(prev) || prev.energy < a.energy) return prev
  const s = clone(prev)
  s.actions.push(`a:${actionId}`)
  s.energy = clamp(s.energy - a.energy)
  a.run(s)
  advanceSlot(s)
  return s
}

export function choose(prev: SurvivalState, choiceId: string): SurvivalState {
  if (!prev.eventId) return prev
  const e = EVENTS.find((x) => x.id === prev.eventId)!
  const c = e.choices.find((x) => x.id === choiceId)
  if (!c) return prev
  const s = clone(prev)
  s.actions.push(`e:${e.id}:${choiceId}`)
  s.stats.events++
  c.run(s)
  s.eventId = null
  if (s.hp <= 0) {
    s.status = 'lost'
    s.causeOfEnd = 'Misfortune'
    return s
  }
  if (s.slot >= 3) endDay(s)
  return s
}

/** Replays a run from its seed and action log — the basis for server verification. */
export function replay(mode: SurvivalMode, seed: number, actions: string[]) {
  let s = newGame(mode, seed)
  for (const a of actions) {
    const [kind, id, choice] = a.split(':')
    s = kind === 'a' ? act(s, id) : choose(s, choice)
  }
  return s
}

export function scoreRun(s: SurvivalState) {
  const days = s.status === 'won' ? s.maxDays : s.day - 1
  const raw =
    days * 120 +
    s.garri * 15 +
    Math.floor(s.naira / 20) +
    s.rep * 25 +
    s.stats.garriMade * 6 +
    (s.status === 'won' ? 500 + s.hp * 3 : 0)
  const score = Math.round(raw * MODES[s.mode].mult)
  const xp = Math.round(score / 8) + (s.status === 'won' ? 50 : 10)
  return { score, xp, days, reputationEarned: Math.min(10, Math.floor(s.rep / 2)) }
}

/**
 * Strict replay used by the server: every recorded choice must have been a
 * legal move at that moment, and the run must have actually ended.
 */
export function replayStrict(mode: SurvivalMode, seed: number, actions: string[]) {
  let s = newGame(mode, seed)
  for (const a of actions) {
    if (s.status !== 'playing') return { ok: false as const, reason: 'Moves recorded after the run ended', state: s }
    const [kind, id, choice] = a.split(':')
    const nextState = kind === 'a' ? act(s, id) : kind === 'e' && id === s.eventId ? choose(s, choice) : s
    if (nextState === s) return { ok: false as const, reason: `Illegal move "${a}"`, state: s }
    s = nextState
  }
  if (s.status === 'playing') return { ok: false as const, reason: 'Run has not finished', state: s }
  return { ok: true as const, state: s }
}

/** Public Game ID, e.g. GRS-8F42K-000001. The number is the ledger's sequence. */
export function makeGameId(sequence: number, tag: string) {
  return `GRS-${tag}-${String(sequence).padStart(6, '0')}`
}
