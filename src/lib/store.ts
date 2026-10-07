/**
 * Citizen store — the one module every screen reads progression through.
 * The server ledger (Netlify Database) is the source of truth: every action
 * is sent to a server function, which validates it and returns the Citizen's
 * fresh snapshot. Nothing here can grant XP, scores or rewards by itself.
 */
import { useSyncExternalStore } from 'react'
import type { Avatar, Citizen, CitizenSnapshot, GameRecord, ReferralRow, RewardEntry, TownEvent } from './types'
import type { QuestDef } from '@/game/content'
import * as api from '@/server/town.functions'

export { computeMetrics, questPeriodKey } from '@/game/metrics'

const LEGACY_KEY = 'garri.town.v1'
const DEVICE_KEY = 'garri.device.v2'

export interface Toast {
  id: number
  icon: string
  title: string
  body?: string
}

interface State {
  ready: boolean
  /** Couldn't reach the ledger on boot. */
  offline: boolean
  citizen: Citizen | null
  games: GameRecord[]
  referrals: ReferralRow[]
  invitedBy: CitizenSnapshot['invitedBy']
  rewards: RewardEntry[]
  toasts: Toast[]
}

const EMPTY: State = { ready: false, offline: false, citizen: null, games: [], referrals: [], invitedBy: null, rewards: [], toasts: [] }
let state: State = EMPTY
let booted = false
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

function boot() {
  if (booted || typeof window === 'undefined') return
  booted = true
  refreshMe()
}

export async function refreshMe() {
  try {
    const snap = await api.getMe()
    if (snap) applySnapshot(snap)
    else set({ ...EMPTY, toasts: state.toasts, ready: true })
  } catch {
    set({ ready: true, offline: true })
  }
}

function subscribe(l: () => void) {
  boot()
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTown() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

export const getTown = () => state

// ─── helpers ────────────────────────────────────────────────────────────────
let toastId = 1
export function toast(icon: string, title: string, body?: string) {
  const t = { id: toastId++, icon, title, body }
  set({ toasts: [...state.toasts, t] })
  setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 4200)
}

export function errorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e ?? 'Something went wrong')
  try {
    const parsed = JSON.parse(msg)
    if (Array.isArray(parsed) && parsed[0]?.message) return String(parsed[0].message)
  } catch {}
  return msg || 'Something went wrong'
}

export function applySnapshot(snap: CitizenSnapshot) {
  set({
    ready: true,
    offline: false,
    citizen: snap.citizen,
    games: snap.games,
    referrals: snap.referrals,
    invitedBy: snap.invitedBy,
    rewards: snap.rewards,
  })
  showEvents(snap.events)
}

function showEvents(events: TownEvent[]) {
  events.forEach((e, i) => setTimeout(() => toast(e.icon, e.title, e.body), i * 350))
}

// Server calls run one at a time so a fast walk across town can't race itself.
let queue: Promise<unknown> = Promise.resolve()
const inflight = new Set<string>()

/** Runs a ledger call; resolves true on success. Errors become a toast. */
function call(key: string | null, fn: () => Promise<CitizenSnapshot | null>, opts: { quiet?: boolean } = {}) {
  if (key && inflight.has(key)) return Promise.resolve(false)
  if (key) inflight.add(key)
  const p = queue.then(async () => {
    try {
      const snap = await fn()
      if (snap) applySnapshot(snap)
      return true
    } catch (e) {
      if (!opts.quiet) toast('⚠️', 'The town ledger said no', errorMessage(e))
      return false
    } finally {
      if (key) inflight.delete(key)
    }
  })
  queue = p
  return p
}

export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/** A Citizen saved on-device by the earlier preview build (unverified, so not imported). */
export function legacyCitizen(): { name: string; avatar: Avatar } | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    const c = raw ? JSON.parse(raw).citizen : null
    return c?.name && c?.avatar ? { name: c.name, avatar: c.avatar } : null
  } catch {
    return null
  }
}

// ─── actions ────────────────────────────────────────────────────────────────
/** Returns an error message, or null on success. */
export async function createCitizen(input: { name: string; avatar: Avatar; referral: string | null }) {
  try {
    const snap = await api.createCitizen({ data: { ...input, referral: input.referral?.trim().toUpperCase() || null, deviceId: deviceId() } })
    localStorage.removeItem(LEGACY_KEY)
    applySnapshot(snap)
    return null
  } catch (e) {
    return errorMessage(e)
  }
}

const has = <T,>(arr: T[] | undefined, v: T) => !!arr?.includes(v)

export function tutorialStep(step: 'moved' | 'talkedElder' | 'visitedBoard') {
  const c = state.citizen
  if (!c || c.tutorial[step]) return
  call(`t:${step}`, () => api.tutorialStep({ data: { step } }), { quiet: true })
}

export function visitDistrict(id: string) {
  if (!state.citizen || has(state.citizen.visited, id)) return
  call(`d:${id}`, () => api.visitDistrict({ data: { id } }), { quiet: true })
}

export function talkedTo(npcId: string) {
  if (!state.citizen || has(state.citizen.npcsTalked, npcId)) return
  call(`n:${npcId}`, () => api.talkedTo({ data: { npcId } }), { quiet: true })
}

export function findSecret(id: string) {
  if (!state.citizen || has(state.citizen.secrets, id)) return
  call(`s:${id}`, () => api.findSecret({ data: { id } }))
}

export function communityAction(id: 'x' | 'telegram') {
  if (!state.citizen || has(state.citizen.community, id)) return
  call(`c:${id}`, () => api.communityAction({ data: { id } }), { quiet: true })
}

export function claimQuest(q: QuestDef) {
  return call(`q:${q.id}`, () => api.claimQuest({ data: { questId: q.id } }))
}

/** Claims NFT eligibility. Nothing is minted until the official on-chain mint opens. */
export function reserveNft(id: string) {
  return call(`nft:${id}`, () => api.reserveNft({ data: { nftId: id } }))
}

export function claimReferral(referralId: number) {
  return call(`ref:${referralId}`, () => api.claimReferral({ data: { referralId } }))
}

export function updateAvatar(avatar: Avatar) {
  if (!state.citizen) return
  set({ citizen: { ...state.citizen, avatar } })
  call(null, () => api.updateAvatar({ data: { avatar } }))
}

/** Signs this device out. The Citizen stays on the ledger and can be restored with a linked wallet. */
export async function signOutCitizen() {
  await api.signOut()
  set({ ...EMPTY, ready: true, toasts: state.toasts })
}

/** Runs any snapshot-returning server call through the same queue. */
export function ledger(key: string | null, fn: () => Promise<CitizenSnapshot | null>, opts?: { quiet?: boolean }) {
  return call(key, fn, opts)
}

export function findGame(gameId: string) {
  return state.games.find((g) => g.gameId === gameId) ?? null
}
