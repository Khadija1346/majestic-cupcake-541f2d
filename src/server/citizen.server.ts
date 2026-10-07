import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import { citizens, games, nftClaims, questClaims, referrals, rewardLedger } from '../../db/schema'
import { ACHIEVEMENTS } from '@/game/content'
import { computeMetrics, newAchievements } from '@/game/metrics'
import { REFERRAL_RULES } from '@/lib/config'
import { levelFromXp } from '@/lib/progression'
import type { Citizen, CitizenSnapshot, GameRecord, ReferralState, SurvivalMode, TownEvent } from '@/lib/types'
import { ranksFor } from './leaderboard.server'

type CitizenRow = typeof citizens.$inferSelect
type GameRow = typeof games.$inferSelect

export function toGameRecord(g: GameRow, c: { name: string; garriId: string }): GameRecord {
  return {
    gameId: g.gameId,
    citizenId: g.citizenId,
    citizenName: c.name,
    garriId: c.garriId,
    game: 'survival',
    mode: g.mode as SurvivalMode,
    score: g.score,
    xp: g.xp,
    won: g.won,
    daysSurvived: g.daysSurvived,
    maxDays: g.maxDays,
    garriMade: g.garriMade,
    reputationEarned: g.reputationEarned,
    playedAt: new Date(g.playedAt).toISOString(),
    verification: g.verification as GameRecord['verification'],
    reviewNote: g.reviewNote,
  }
}

interface Loaded {
  row: CitizenRow
  citizen: Citizen
  games: GameRecord[]
}

async function qualifiedReferralCount(citizenId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(referrals)
    .where(and(eq(referrals.referrerId, citizenId), inArray(referrals.status, ['QUALIFIED', 'REWARDED']), isNull(referrals.flag)))
  return Number(r?.n ?? 0)
}

export async function loadCitizen(id: string, opts: { ranks?: boolean } = {}): Promise<Loaded | null> {
  const [row] = await db.select().from(citizens).where(eq(citizens.id, id)).limit(1)
  if (!row) return null
  const [gameRows, claims, nfts, qualified, ranks] = await Promise.all([
    db.select().from(games).where(eq(games.citizenId, id)).orderBy(desc(games.playedAt)).limit(500),
    db.select().from(questClaims).where(eq(questClaims.citizenId, id)),
    db.select().from(nftClaims).where(eq(nftClaims.citizenId, id)),
    qualifiedReferralCount(id),
    opts.ranks ? ranksFor(id) : Promise.resolve({ daily: null, weekly: null, season: null, all: null }),
  ])
  const citizen: Citizen = {
    id: row.id,
    garriId: row.garriId,
    name: row.name,
    avatar: row.avatar,
    createdAt: new Date(row.createdAt).toISOString(),
    xp: row.xp,
    reputation: row.reputation,
    rewardPoints: row.rewardPoints,
    referralCode: row.referralCode,
    tutorial: row.tutorial,
    visited: row.visited,
    secrets: row.secrets,
    npcsTalked: row.npcs,
    community: row.community,
    achievements: row.achievements,
    inventory: row.inventory,
    questClaims: Object.fromEntries(claims.map((q) => [q.questKey, new Date(q.claimedAt).toISOString()])),
    nftClaims: Object.fromEntries(
      nfts.map((n) => [n.nftId, { at: new Date(n.claimedAt).toISOString(), review: n.review as 'pending', mintTx: n.mintTx }]),
    ),
    wallet: row.walletAddress
      ? {
          address: row.walletAddress,
          connectedAt: new Date(row.walletLinkedAt ?? row.updatedAt).toISOString(),
          balance: row.garriBalance,
          checkedAt: row.balanceCheckedAt ? new Date(row.balanceCheckedAt).toISOString() : null,
          holdingSince: row.holdingSince ? new Date(row.holdingSince).toISOString() : null,
        }
      : null,
    status: row.status as Citizen['status'],
    qualifiedReferrals: qualified,
    ranks,
  }
  return { row, citizen, games: gameRows.map((g) => toGameRecord(g, row)) }
}

export type Patch = Partial<
  Pick<
    CitizenRow,
    | 'xp' | 'reputation' | 'rewardPoints' | 'tutorial' | 'visited' | 'secrets' | 'npcs' | 'community'
    | 'achievements' | 'inventory' | 'avatar' | 'walletAddress' | 'walletLinkedAt' | 'garriBalance'
    | 'balanceCheckedAt' | 'holdingSince' | 'status' | 'statusNote'
  >
>

/**
 * Applies a change to a Citizen with optimistic locking, then unlocks any
 * achievements the new state earns. `fn` returns null for "no change".
 */
export async function mutateCitizen(
  id: string,
  fn: (c: Citizen, row: CitizenRow, gameList: GameRecord[]) => { patch: Patch; events?: TownEvent[] } | null,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = await loadCitizen(id)
    if (!loaded) throw new Error('Citizen not found.')
    const res = fn(loaded.citizen, loaded.row, loaded.games)
    if (!res) return { events: [] as TownEvent[] }
    const events = [...(res.events ?? [])]
    const patch: Patch = { ...res.patch }

    // Unlock achievements against the patched state (loop: XP may unlock level ones)
    const before = loaded.citizen.xp
    let next: Citizen = applyPatch(loaded.citizen, patch)
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const fresh = newAchievements(next, loaded.games)
      if (!fresh.length) break
      const at = new Date().toISOString()
      next = {
        ...next,
        xp: next.xp + fresh.reduce((a, x) => a + x.xp, 0),
        achievements: [...next.achievements, ...fresh.map((a) => ({ id: a.id, at }))],
      }
      for (const a of fresh) events.push({ icon: a.icon, title: `Achievement: ${a.name}`, body: a.xp ? `+${a.xp} XP` : undefined })
    }
    if (next.achievements.length !== loaded.citizen.achievements.length) {
      patch.achievements = next.achievements
      patch.xp = next.xp
    }
    const lvBefore = levelFromXp(before)
    const lvAfter = levelFromXp(next.xp)
    if (lvAfter > lvBefore) events.push({ icon: '⭐', title: `Level ${lvAfter}!`, body: 'New quests may be unlocked.' })

    const updated = await db
      .update(citizens)
      .set({ ...patch, version: loaded.row.version + 1, updatedAt: new Date().toISOString() })
      .where(and(eq(citizens.id, id), eq(citizens.version, loaded.row.version)))
      .returning({ id: citizens.id })
    if (updated.length) {
      await maybeQualifyReferral(id)
      return { events }
    }
  }
  throw new Error('The town ledger is busy. Please try again.')
}

function applyPatch(c: Citizen, p: Patch): Citizen {
  return {
    ...c,
    xp: p.xp ?? c.xp,
    reputation: p.reputation ?? c.reputation,
    rewardPoints: p.rewardPoints ?? c.rewardPoints,
    tutorial: p.tutorial ?? c.tutorial,
    visited: p.visited ?? c.visited,
    secrets: p.secrets ?? c.secrets,
    npcsTalked: p.npcs ?? c.npcsTalked,
    community: p.community ?? c.community,
    inventory: p.inventory ?? c.inventory,
    wallet: (() => {
      const address = p.walletAddress !== undefined ? p.walletAddress : (c.wallet?.address ?? null)
      if (!address) return null
      const pick = <K extends 'garriBalance' | 'balanceCheckedAt' | 'holdingSince'>(k: K, prev: string | null | undefined) =>
        p[k] !== undefined ? (p[k] as string | null) : (prev ?? null)
      return {
        address,
        connectedAt: p.walletLinkedAt ?? c.wallet?.connectedAt ?? new Date().toISOString(),
        balance: pick('garriBalance', c.wallet?.balance),
        checkedAt: pick('balanceCheckedAt', c.wallet?.checkedAt),
        holdingSince: pick('holdingSince', c.wallet?.holdingSince),
      }
    })(),
  }
}

/** PENDING → QUALIFIED once the referred Citizen meets REFERRAL_RULES. Flagged referrals wait for a moderator. */
export async function maybeQualifyReferral(referredId: string) {
  const [ref] = await db.select().from(referrals).where(eq(referrals.referredId, referredId)).limit(1)
  if (!ref || ref.status !== 'PENDING' || ref.flag) return
  const loaded = await loadCitizen(referredId)
  if (!loaded) return
  const m = computeMetrics(loaded.citizen, loaded.games)
  const ok = (!REFERRAL_RULES.tutorial || m.tutorialDone) && m.gamesPlayed >= REFERRAL_RULES.minGames && m.level >= REFERRAL_RULES.minLevel
  if (!ok || loaded.citizen.status !== 'active') return
  await db
    .update(referrals)
    .set({ status: 'QUALIFIED', qualifiedAt: new Date().toISOString() })
    .where(and(eq(referrals.id, ref.id), eq(referrals.status, 'PENDING'), isNull(referrals.flag)))
}

export async function snapshot(id: string, events: TownEvent[] = []): Promise<CitizenSnapshot> {
  const loaded = await loadCitizen(id, { ranks: true })
  if (!loaded) throw new Error('Citizen not found.')
  const [mine, invited, rewards] = await Promise.all([
    db
      .select({ id: referrals.id, status: referrals.status, flag: referrals.flag, createdAt: referrals.createdAt, name: citizens.name, garriId: citizens.garriId })
      .from(referrals)
      .innerJoin(citizens, eq(citizens.id, referrals.referredId))
      .where(eq(referrals.referrerId, id))
      .orderBy(desc(referrals.createdAt)),
    db.select().from(referrals).where(eq(referrals.referredId, id)).limit(1),
    db.select().from(rewardLedger).where(eq(rewardLedger.citizenId, id)).orderBy(desc(rewardLedger.createdAt)),
  ])
  return {
    citizen: loaded.citizen,
    games: loaded.games,
    referrals: mine.map((r) => ({
      id: r.id,
      name: r.name,
      garriId: r.garriId,
      status: r.status as ReferralState,
      flagged: !!r.flag,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    invitedBy: invited[0] ? { code: invited[0].code, status: invited[0].status as ReferralState, flagged: !!invited[0].flag } : null,
    rewards: rewards.map((r) => ({
      id: r.id,
      programme: r.programme,
      amount: r.amount,
      status: r.status as 'pending' | 'claimed',
      txHash: r.txHash,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    events,
  }
}

/** Case-insensitive name key used for uniqueness. */
export const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

export async function nameTaken(name: string, exceptId?: string) {
  const [r] = await db
    .select({ id: citizens.id })
    .from(citizens)
    .where(exceptId ? and(eq(citizens.nameKey, nameKey(name)), ne(citizens.id, exceptId)) : eq(citizens.nameKey, nameKey(name)))
    .limit(1)
  return !!r
}
