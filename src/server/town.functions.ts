import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import { citizens, games, nftClaims, questClaims, referrals } from '../../db/schema'
import { DISTRICTS, NFTS, QUESTS, SECRETS, nftState, questState } from '@/game/content'
import { computeMetrics, questPeriodKey } from '@/game/metrics'
import { NPCS } from '@/game/town/map'
import { REFERRAL_RULES } from '@/lib/config'
import type { TownEvent } from '@/lib/types'
import { loadCitizen, mutateCitizen, nameKey, nameTaken, snapshot, toGameRecord } from './citizen.server'
import { clientIpHash, endSession, fingerprint, randomCode, requireCitizenId, sessionCitizenId, startSession } from './session.server'

const AvatarSchema = z.object({
  outfit: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cap: z.enum(['fila', 'gele', 'none']),
})

export const NAME_RE = /^[\p{L}\p{N} _.-]{3,18}$/u
export const REFERRAL_RE = /^GARRI-[A-Z0-9]{3,12}$/

export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  const id = await sessionCitizenId()
  if (!id) return null
  try {
    return await snapshot(id)
  } catch {
    return null
  }
})

async function uniqueReferralCode(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const candidates = base.length >= 3 ? [base, ...Array.from({ length: 4 }, () => `${base.slice(0, 8)}${randomCode(2)}`)] : []
  candidates.push(randomCode(6), randomCode(7))
  for (const c of candidates) {
    const code = `GARRI-${c}`
    const [hit] = await db.select({ id: citizens.id }).from(citizens).where(eq(citizens.referralCode, code)).limit(1)
    if (!hit) return code
  }
  return `GARRI-${randomCode(8)}`
}

export const createCitizen = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().trim().regex(NAME_RE, 'Use 3–18 letters, numbers, spaces, dots, dashes or underscores.'),
      avatar: AvatarSchema,
      referral: z.string().trim().toUpperCase().regex(REFERRAL_RE, 'Referral codes look like GARRI-DEEJA.').nullable(),
      deviceId: z.string().min(8).max(64),
    }),
  )
  .handler(async ({ data }) => {
    const existing = await sessionCitizenId()
    if (existing) return snapshot(existing)

    if (await nameTaken(data.name)) throw new Error('That Citizen name is already taken. Pick another.')
    const ipHash = clientIpHash()
    const deviceHash = fingerprint(data.deviceId)
    const dayAgo = new Date(Date.now() - 86400000).toISOString()
    if (ipHash) {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(citizens).where(and(eq(citizens.ipHash, ipHash), gte(citizens.createdAt, dayAgo)))
      if (Number(r?.n) >= 20) throw new Error('Too many Citizens were created from this network today. Try again tomorrow.')
    }

    let referrer: typeof citizens.$inferSelect | null = null
    if (data.referral) {
      ;[referrer] = await db.select().from(citizens).where(eq(citizens.referralCode, data.referral)).limit(1)
      if (!referrer) throw new Error('That referral code doesn’t belong to any Citizen. Check it or leave it empty.')
    }

    let garriId = ''
    for (let i = 0; i < 5; i++) {
      garriId = `GID-${randomCode(4)}-${randomCode(4)}`
      const [hit] = await db.select({ id: citizens.id }).from(citizens).where(eq(citizens.garriId, garriId)).limit(1)
      if (!hit) break
    }
    const [priorOnDevice] = deviceHash
      ? await db.select({ id: citizens.id }).from(citizens).where(eq(citizens.deviceHash, deviceHash)).limit(1)
      : []

    const id = crypto.randomUUID()
    try {
      await db.insert(citizens).values({
        id,
        garriId,
        name: data.name,
        nameKey: nameKey(data.name),
        avatar: data.avatar,
        referralCode: await uniqueReferralCode(data.name),
        tutorial: { moved: false, talkedElder: false, visitedBoard: false, done: false },
        inventory: [{ id: 'starter-cup', name: 'Enamel Cup', icon: '🥣', qty: 1 }],
        deviceHash,
        ipHash,
      })
    } catch {
      throw new Error('That Citizen name was just taken. Pick another.')
    }

    if (referrer) {
      let flag: string | null = null
      if (deviceHash && referrer.deviceHash === deviceHash) flag = 'Self-referral: same device as the referring Citizen.'
      else if (priorOnDevice) flag = 'This device already created another Citizen.'
      else if (ipHash && referrer.ipHash === ipHash) flag = 'Same network as the referring Citizen.'
      else if (ipHash) {
        const [r] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(referrals)
          .innerJoin(citizens, eq(citizens.id, referrals.referredId))
          .where(and(eq(referrals.referrerId, referrer.id), eq(citizens.ipHash, ipHash), gte(referrals.createdAt, dayAgo)))
        if (Number(r?.n) >= 3) flag = 'Several sign-ups for this code from one network in 24h.'
      }
      await db.insert(referrals).values({ referrerId: referrer.id, referredId: id, code: data.referral!, flag }).onConflictDoNothing()
    }

    await startSession(id)
    const { events } = await mutateCitizen(id, () => ({ patch: {} }))
    return snapshot(id, [{ icon: '🎉', title: `Welcome to town, ${data.name}!`, body: `Your GARRI ID is ${garriId}` }, ...events])
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await endSession()
  return { ok: true }
})

const done = async (id: string, extra: TownEvent[], events: TownEvent[]) => snapshot(id, [...extra, ...events])

export const tutorialStep = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ step: z.enum(['moved', 'talkedElder', 'visitedBoard']) }))
  .handler(async ({ data }) => {
    const id = await requireCitizenId()
    const extra: TownEvent[] = []
    const { events } = await mutateCitizen(id, (c) => {
      if (c.tutorial[data.step]) return null
      const t = { ...c.tutorial, [data.step]: true }
      if (!t.done && t.moved && t.talkedElder && t.visitedBoard) {
        t.done = true
        extra.push({ icon: '👣', title: 'Tutorial complete', body: 'The whole town is open to you now.' })
      }
      return { patch: { tutorial: t } }
    })
    return done(id, extra, events)
  })

export const visitDistrict = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().max(32) }))
  .handler(async ({ data }) => {
    const d = DISTRICTS.find((x) => x.id === data.id)
    if (!d) throw new Error('Unknown district.')
    const id = await requireCitizenId()
    const extra: TownEvent[] = []
    const { events } = await mutateCitizen(id, (c) => {
      if (c.visited.includes(d.id)) return null
      extra.push({ icon: d.icon, title: `Discovered: ${d.name}`, body: '+10 XP' })
      return { patch: { visited: [...c.visited, d.id], xp: c.xp + 10 } }
    })
    return done(id, extra, events)
  })

export const talkedTo = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ npcId: z.string().max(32) }))
  .handler(async ({ data }) => {
    if (!NPCS.some((n) => n.id === data.npcId)) throw new Error('Unknown townsperson.')
    const id = await requireCitizenId()
    const { events } = await mutateCitizen(id, (c) =>
      c.npcsTalked.includes(data.npcId) ? null : { patch: { npcs: [...c.npcsTalked, data.npcId], xp: c.xp + 5 } },
    )
    return done(id, [], events)
  })

export const findSecret = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().max(32) }))
  .handler(async ({ data }) => {
    const s = SECRETS.find((x) => x.id === data.id)
    if (!s) throw new Error('Unknown secret.')
    const id = await requireCitizenId()
    const extra: TownEvent[] = []
    const { events } = await mutateCitizen(id, (c) => {
      if (c.secrets.includes(s.id)) return null
      extra.push({ icon: s.icon, title: `Secret found: ${s.name}`, body: '+75 XP · added to your inventory' })
      return {
        patch: {
          secrets: [...c.secrets, s.id],
          xp: c.xp + 75,
          inventory: [...c.inventory, { id: `secret-${s.id}`, name: s.name, icon: s.icon, qty: 1 }],
        },
      }
    })
    return done(id, extra, events)
  })

export const communityAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.enum(['x', 'telegram']) }))
  .handler(async ({ data }) => {
    const id = await requireCitizenId()
    const { events } = await mutateCitizen(id, (c) => (c.community.includes(data.id) ? null : { patch: { community: [...c.community, data.id] } }))
    return done(id, [], events)
  })

export const updateAvatar = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ avatar: AvatarSchema }))
  .handler(async ({ data }) => {
    const id = await requireCitizenId()
    const { events } = await mutateCitizen(id, () => ({ patch: { avatar: data.avatar } }))
    return done(id, [], events)
  })

export const claimQuest = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ questId: z.string().max(40) }))
  .handler(async ({ data }) => {
    const q = QUESTS.find((x) => x.id === data.questId)
    if (!q) throw new Error('Unknown quest.')
    const id = await requireCitizenId()
    const loaded = await loadCitizen(id, { ranks: true })
    if (!loaded) throw new Error('Citizen not found.')
    const key = questPeriodKey(q)
    const m = computeMetrics(loaded.citizen, loaded.games)
    const state = questState(q, m, !!loaded.citizen.questClaims[key])
    if (state !== 'CLAIMABLE') throw new Error(state === 'CLAIMED' ? 'Quest already claimed.' : 'This quest isn’t complete yet.')
    const inserted = await db.insert(questClaims).values({ citizenId: id, questKey: key }).onConflictDoNothing().returning({ id: questClaims.id })
    if (!inserted.length) throw new Error('Quest already claimed.')
    const { events } = await mutateCitizen(id, (c) => ({
      patch: { xp: c.xp + q.reward.xp, reputation: c.reputation + q.reward.rep, rewardPoints: c.rewardPoints + q.reward.rp },
    }))
    return done(id, [{ icon: '📜', title: `Quest claimed: ${q.title}`, body: `+${q.reward.xp} XP · +${q.reward.rep} Rep · +${q.reward.rp} RP` }], events)
  })

/** Reserves NFT eligibility. Nothing is minted — `mint_tx` stays empty until a real mint. */
export const reserveNft = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ nftId: z.string().max(40) }))
  .handler(async ({ data }) => {
    const n = NFTS.find((x) => x.id === data.nftId)
    if (!n) throw new Error('Unknown collectible.')
    const id = await requireCitizenId()
    const loaded = await loadCitizen(id, { ranks: true })
    if (!loaded) throw new Error('Citizen not found.')
    if (loaded.citizen.status !== 'active') throw new Error('Your Citizen is under moderator review.')
    const m = computeMetrics(loaded.citizen, loaded.games)
    if (nftState(n, m, !!loaded.citizen.nftClaims[n.id]) !== 'CLAIMABLE') throw new Error('You aren’t eligible for this collectible yet.')
    await db.insert(nftClaims).values({ citizenId: id, nftId: n.id }).onConflictDoNothing()
    return snapshot(id, [{ icon: '🖼️', title: `${n.name} eligibility claimed`, body: 'Saved to your GARRI ID. Nothing is minted until the official mint opens.' }])
  })

/** QUALIFIED → REWARDED, exactly once (conditional update). */
export const claimReferral = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ referralId: z.number().int() }))
  .handler(async ({ data }) => {
    const id = await requireCitizenId()
    const won = await db
      .update(referrals)
      .set({ status: 'REWARDED', rewardedAt: new Date().toISOString() })
      .where(and(eq(referrals.id, data.referralId), eq(referrals.referrerId, id), eq(referrals.status, 'QUALIFIED'), sql`${referrals.flag} is null`))
      .returning({ id: referrals.id })
    if (!won.length) throw new Error('This referral isn’t ready to claim.')
    const r = REFERRAL_RULES.reward
    const { events } = await mutateCitizen(id, (c) => ({
      patch: { xp: c.xp + r.xp, reputation: c.reputation + r.rep, rewardPoints: c.rewardPoints + r.rp },
    }))
    return done(id, [{ icon: '🏘️', title: 'Referral rewarded', body: `+${r.xp} XP · +${r.rep} Rep · +${r.rp} RP` }], events)
  })

/** Public Score Card lookup. Never exposes action logs or private data. */
export const getPublicGame = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ gameId: z.string().max(40) }))
  .handler(async ({ data }) => {
    const [row] = await db
      .select({ g: games, name: citizens.name, garriId: citizens.garriId })
      .from(games)
      .innerJoin(citizens, eq(citizens.id, games.citizenId))
      .where(eq(games.gameId, data.gameId.toUpperCase()))
      .limit(1)
    if (!row) return null
    const rec = toGameRecord(row.g, row)
    delete rec.citizenId
    return rec
  })

/** Real, aggregate town activity for the Community Hub. */
export const getTownPulse = createServerFn({ method: 'GET' }).handler(async () => {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const [[c], [g]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(citizens),
    db
      .select({
        verified: sql<number>`(count(*) filter (where ${games.verification} = 'verified'))::int`,
        today: sql<number>`(count(*) filter (where ${games.verification} = 'verified' and ${games.playedAt} >= ${today.toISOString()}))::int`,
        garri: sql<number>`coalesce(sum(${games.garriMade}) filter (where ${games.verification} = 'verified'), 0)::int`,
      })
      .from(games),
  ])
  return { citizens: Number(c?.n ?? 0), verifiedGames: Number(g?.verified ?? 0), gamesToday: Number(g?.today ?? 0), garriMade: Number(g?.garri ?? 0) }
})
