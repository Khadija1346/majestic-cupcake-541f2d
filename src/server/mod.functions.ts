import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import { citizens, games, modActions, modRequests, nftClaims, referrals, rewardLedger, staff } from '../../db/schema'
import { levelFromXp } from '@/lib/progression'
import { leaderboard } from './leaderboard.server'
import { maybeQualifyReferral, mutateCitizen } from './citizen.server'
import { currentStaff, logAction, requireAdmin, requireModerator } from './staff.server'

// ─── access ────────────────────────────────────────────────────────────────
export const getStaffStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const s = await currentStaff()
  if (!s) return { signedIn: false as const }
  const [req] = await db.select().from(modRequests).where(eq(modRequests.identityUserId, s.id)).limit(1)
  return {
    signedIn: true as const,
    email: s.email,
    role: s.role,
    request: req ? { status: req.status, createdAt: new Date(req.createdAt).toISOString() } : null,
  }
})

/** Records a request for the admin. It never grants anything by itself. */
export const requestModAccess = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ garriId: z.string().trim().max(20).optional(), note: z.string().trim().max(280).optional() }))
  .handler(async ({ data }) => {
    const s = await currentStaff()
    if (!s) throw new Error('Sign in first so the administrator knows who is asking.')
    if (s.role !== 'none') return { status: 'approved' }
    await db
      .insert(modRequests)
      .values({ identityUserId: s.id, email: s.email, garriId: data.garriId || null, note: data.note || null })
      .onConflictDoUpdate({
        target: modRequests.identityUserId,
        set: { garriId: data.garriId || null, note: data.note || null, status: 'pending', createdAt: new Date().toISOString() },
        setWhere: sql`${modRequests.status} <> 'approved'`,
      })
    return { status: 'pending' }
  })

// ─── data views ────────────────────────────────────────────────────────────
const gameCols = {
  id: games.id,
  gameId: games.gameId,
  citizenId: games.citizenId,
  name: citizens.name,
  garriId: citizens.garriId,
  wallet: citizens.walletAddress,
  mode: games.mode,
  score: games.score,
  xp: games.xp,
  won: games.won,
  days: games.daysSurvived,
  maxDays: games.maxDays,
  durationMs: games.durationMs,
  moves: sql<number>`jsonb_array_length(${games.actions})::int`,
  playedAt: games.playedAt,
  verification: games.verification,
  reviewNote: games.reviewNote,
  reviewedBy: games.reviewedBy,
}

const citizenCols = {
  id: citizens.id,
  name: citizens.name,
  garriId: citizens.garriId,
  wallet: citizens.walletAddress,
  xp: citizens.xp,
  reputation: citizens.reputation,
  status: citizens.status,
  statusNote: citizens.statusNote,
  referralCode: citizens.referralCode,
  createdAt: citizens.createdAt,
  games: sql<number>`(select count(*)::int from games g where g.citizen_id = ${citizens.id} and g.verification <> 'flagged')`,
  wins: sql<number>`(select count(*)::int from games g where g.citizen_id = ${citizens.id} and g.won and g.verification <> 'flagged')`,
  best: sql<number>`(select coalesce(max(score), 0)::int from games g where g.citizen_id = ${citizens.id} and g.verification = 'verified')`,
}

const withLevel = <T extends { xp: number }>(r: T) => ({ ...r, level: levelFromXp(r.xp) })
const iso = <T extends Record<string, any>>(r: T, keys: (keyof T)[]) => {
  const out: any = { ...r }
  for (const k of keys) if (out[k]) out[k] = new Date(out[k]).toISOString()
  return out as T
}

export const modOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const me = await requireModerator()
  const [[g], [c], [r], [n], [q]] = await Promise.all([
    db
      .select({
        pending: sql<number>`(count(*) filter (where ${games.verification} = 'pending'))::int`,
        flagged: sql<number>`(count(*) filter (where ${games.verification} = 'flagged'))::int`,
        verified: sql<number>`(count(*) filter (where ${games.verification} = 'verified'))::int`,
      })
      .from(games),
    db
      .select({ total: sql<number>`count(*)::int`, flagged: sql<number>`(count(*) filter (where ${citizens.status} = 'flagged'))::int` })
      .from(citizens),
    db
      .select({ held: sql<number>`(count(*) filter (where ${referrals.flag} is not null))::int`, total: sql<number>`count(*)::int` })
      .from(referrals),
    db.select({ pending: sql<number>`(count(*) filter (where ${nftClaims.review} = 'pending'))::int` }).from(nftClaims),
    db.select({ pending: sql<number>`(count(*) filter (where ${modRequests.status} = 'pending'))::int` }).from(modRequests),
  ])
  return { me, games: g, citizens: c, referrals: r, nfts: n, requests: me.role === 'admin' ? q.pending : null }
})

export const modSearch = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ q: z.string().trim().min(2).max(64) }))
  .handler(async ({ data }) => {
    await requireModerator()
    const q = data.q
    const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`
    const citizenWhere = /^0x[0-9a-f]{4,}/i.test(q)
      ? ilike(citizens.walletAddress, `${q.toLowerCase()}%`)
      : or(ilike(citizens.name, like), ilike(citizens.garriId, like), ilike(citizens.referralCode, like))
    const [foundCitizens, foundGames] = await Promise.all([
      db.select(citizenCols).from(citizens).where(citizenWhere).limit(25),
      db
        .select(gameCols)
        .from(games)
        .innerJoin(citizens, eq(citizens.id, games.citizenId))
        .where(/^GRS-/i.test(q) ? ilike(games.gameId, like) : citizenWhere)
        .orderBy(desc(games.playedAt))
        .limit(50),
    ])
    return {
      citizens: foundCitizens.map((r) => iso(withLevel(r), ['createdAt'])),
      games: foundGames.map((r) => iso(r, ['playedAt'])),
    }
  })

export const modGames = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ status: z.enum(['pending', 'verified', 'flagged', 'all']) }))
  .handler(async ({ data }) => {
    await requireModerator()
    const rows = await db
      .select(gameCols)
      .from(games)
      .innerJoin(citizens, eq(citizens.id, games.citizenId))
      .where(data.status === 'all' ? undefined : eq(games.verification, data.status))
      .orderBy(desc(games.playedAt))
      .limit(100)
    return rows.map((r) => iso(r, ['playedAt']))
  })

export const modCitizens = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ status: z.enum(['active', 'flagged', 'all']) }))
  .handler(async ({ data }) => {
    await requireModerator()
    const rows = await db
      .select(citizenCols)
      .from(citizens)
      .where(data.status === 'all' ? undefined : eq(citizens.status, data.status))
      .orderBy(desc(citizens.xp))
      .limit(100)
    return rows.map((r) => iso(withLevel(r), ['createdAt']))
  })

export const modReferrals = createServerFn({ method: 'GET' }).handler(async () => {
  await requireModerator()
  const referrer = sql<string>`(select name from citizens r where r.id = ${referrals.referrerId})`
  const rows = await db
    .select({
      id: referrals.id,
      code: referrals.code,
      status: referrals.status,
      flag: referrals.flag,
      createdAt: referrals.createdAt,
      referrer,
      referred: citizens.name,
      referredGarriId: citizens.garriId,
    })
    .from(referrals)
    .innerJoin(citizens, eq(citizens.id, referrals.referredId))
    .orderBy(sql`${referrals.flag} is null`, desc(referrals.createdAt))
    .limit(150)
  return rows.map((r) => iso(r, ['createdAt']))
})

export const modNfts = createServerFn({ method: 'GET' }).handler(async () => {
  await requireModerator()
  const rows = await db
    .select({ id: nftClaims.id, nftId: nftClaims.nftId, review: nftClaims.review, reviewNote: nftClaims.reviewNote, claimedAt: nftClaims.claimedAt, mintTx: nftClaims.mintTx, name: citizens.name, garriId: citizens.garriId, wallet: citizens.walletAddress })
    .from(nftClaims)
    .innerJoin(citizens, eq(citizens.id, nftClaims.citizenId))
    .orderBy(sql`${nftClaims.review} <> 'pending'`, desc(nftClaims.claimedAt))
    .limit(150)
  return rows.map((r) => iso(r, ['claimedAt']))
})

export const modRewards = createServerFn({ method: 'GET' }).handler(async () => {
  await requireModerator()
  const [ledger, referralRewards] = await Promise.all([
    db
      .select({ id: rewardLedger.id, programme: rewardLedger.programme, amount: rewardLedger.amount, status: rewardLedger.status, txHash: rewardLedger.txHash, createdAt: rewardLedger.createdAt, name: citizens.name, wallet: rewardLedger.walletAddress })
      .from(rewardLedger)
      .innerJoin(citizens, eq(citizens.id, rewardLedger.citizenId))
      .orderBy(desc(rewardLedger.createdAt))
      .limit(100),
    db
      .select({ id: referrals.id, rewardedAt: referrals.rewardedAt, referrer: sql<string>`(select name from citizens r where r.id = ${referrals.referrerId})`, referred: citizens.name })
      .from(referrals)
      .innerJoin(citizens, eq(citizens.id, referrals.referredId))
      .where(eq(referrals.status, 'REWARDED'))
      .orderBy(desc(referrals.rewardedAt))
      .limit(100),
  ])
  return { ledger: ledger.map((r) => iso(r, ['createdAt'])), referralRewards: referralRewards.map((r) => iso(r, ['rewardedAt'])) }
})

export const modLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ period: z.enum(['daily', 'weekly', 'season', 'all']) }))
  .handler(async ({ data }) => {
    await requireModerator()
    return (await leaderboard(data.period, { limit: 50 })).rows
  })

export const modActivity = createServerFn({ method: 'GET' }).handler(async () => {
  await requireModerator()
  const rows = await db.select().from(modActions).orderBy(desc(modActions.at)).limit(60)
  return rows.map((r) => iso(r, ['at']))
})

// ─── decisions ─────────────────────────────────────────────────────────────
const Note = z.string().trim().max(280).optional()

/** Verifying or flagging a run. Flagging removes it from boards and takes back its XP/Rep. */
export const modReviewGame = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ gameId: z.string().max(40), decision: z.enum(['verified', 'flagged']), note: Note }))
  .handler(async ({ data }) => {
    const me = await requireModerator()
    const [g] = await db.select().from(games).where(eq(games.gameId, data.gameId)).limit(1)
    if (!g) throw new Error('Game not found.')
    if (g.verification === data.decision) return { ok: true }
    const updated = await db
      .update(games)
      .set({ verification: data.decision, reviewNote: data.note || (data.decision === 'verified' ? 'Verified by moderator' : 'Flagged by moderator'), reviewedBy: me.email, reviewedAt: new Date().toISOString() })
      .where(and(eq(games.id, g.id), eq(games.verification, g.verification)))
      .returning({ id: games.id })
    if (!updated.length) throw new Error('Someone else just reviewed this game. Refresh and try again.')
    const sign = data.decision === 'flagged' ? -1 : g.verification === 'flagged' ? 1 : 0
    if (sign) {
      await mutateCitizen(g.citizenId, (c) => ({
        patch: { xp: Math.max(0, c.xp + sign * g.xp), reputation: Math.max(0, c.reputation + sign * g.reputationEarned) },
      }))
    }
    await logAction(me.email, data.decision === 'verified' ? 'verify' : 'flag', 'game', g.gameId, data.note)
    return { ok: true }
  })

export const modReviewCitizen = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ citizenId: z.string().max(64), decision: z.enum(['active', 'flagged']), note: Note }))
  .handler(async ({ data }) => {
    const me = await requireModerator()
    await mutateCitizen(data.citizenId, () => ({ patch: { status: data.decision, statusNote: data.decision === 'flagged' ? data.note || 'Flagged by moderator' : null } }))
    await logAction(me.email, data.decision === 'active' ? 'clear' : 'flag', 'citizen', data.citizenId, data.note)
    return { ok: true }
  })

export const modReviewReferral = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), decision: z.enum(['clear', 'flag']), note: Note }))
  .handler(async ({ data }) => {
    const me = await requireModerator()
    const [ref] = await db
      .update(referrals)
      .set({ flag: data.decision === 'flag' ? data.note || 'Flagged by moderator' : null, reviewedBy: me.email })
      .where(eq(referrals.id, data.id))
      .returning()
    if (!ref) throw new Error('Referral not found.')
    if (data.decision === 'clear') await maybeQualifyReferral(ref.referredId)
    await logAction(me.email, data.decision, 'referral', String(ref.id), data.note)
    return { ok: true }
  })

export const modReviewNft = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), decision: z.enum(['verified', 'flagged']), note: Note }))
  .handler(async ({ data }) => {
    const me = await requireModerator()
    const [row] = await db.update(nftClaims).set({ review: data.decision, reviewNote: data.note || null }).where(eq(nftClaims.id, data.id)).returning()
    if (!row) throw new Error('Eligibility record not found.')
    await logAction(me.email, data.decision === 'verified' ? 'verify' : 'flag', 'nft', `${row.nftId}#${row.id}`, data.note)
    return { ok: true }
  })

// ─── admin: moderator access ───────────────────────────────────────────────
export const adminAccess = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const [requests, team] = await Promise.all([
    db.select().from(modRequests).orderBy(sql`${modRequests.status} <> 'pending'`, desc(modRequests.createdAt)).limit(100),
    db.select().from(staff).where(isNull(staff.revokedAt)).orderBy(desc(staff.grantedAt)),
  ])
  return { requests: requests.map((r) => iso(r, ['createdAt', 'decidedAt'])), team: team.map((r) => iso(r, ['grantedAt'])) }
})

export const adminDecide = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ requestId: z.number().int(), approve: z.boolean() }))
  .handler(async ({ data }) => {
    const me = await requireAdmin()
    const [req] = await db
      .update(modRequests)
      .set({ status: data.approve ? 'approved' : 'declined', decidedBy: me.email, decidedAt: new Date().toISOString() })
      .where(eq(modRequests.id, data.requestId))
      .returning()
    if (!req) throw new Error('Request not found.')
    if (data.approve) {
      await db
        .insert(staff)
        .values({ identityUserId: req.identityUserId, email: req.email, role: 'moderator', grantedBy: me.email })
        .onConflictDoUpdate({ target: staff.identityUserId, set: { role: 'moderator', grantedBy: me.email, grantedAt: new Date().toISOString(), revokedAt: null } })
    }
    await logAction(me.email, data.approve ? 'grant-moderator' : 'decline-request', 'staff', req.email)
    return { ok: true }
  })

export const adminRevoke = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ identityUserId: z.string().max(64) }))
  .handler(async ({ data }) => {
    const me = await requireAdmin()
    if (data.identityUserId === me.id) throw new Error('You can’t revoke your own access.')
    const [row] = await db
      .update(staff)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(staff.identityUserId, data.identityUserId), isNull(staff.revokedAt)))
      .returning()
    if (!row) throw new Error('Moderator not found.')
    await db.update(modRequests).set({ status: 'declined', decidedBy: me.email, decidedAt: new Date().toISOString() }).where(eq(modRequests.identityUserId, data.identityUserId))
    await logAction(me.email, 'revoke-moderator', 'staff', row.email)
    return { ok: true }
  })
