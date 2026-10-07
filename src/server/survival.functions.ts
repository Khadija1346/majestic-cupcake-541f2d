import { randomBytes } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import { games, runs } from '../../db/schema'
import { MODES, hashSeed, makeGameId, replayStrict, scoreRun } from '@/game/survival'
import { VERIFICATION_RULES } from '@/lib/config'
import { dayKey } from '@/lib/progression'
import type { TownEvent } from '@/lib/types'
import { loadCitizen, mutateCitizen, snapshot } from './citizen.server'
import { randomCode, requireCitizenId } from './session.server'

/** The server opens every run and picks its seed, so results can't be pre-computed with a chosen seed. */
export const startRun = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ mode: z.enum(['classic', 'harmattan', 'daily']) }))
  .handler(async ({ data }) => {
    const citizenId = await requireCitizenId()
    const dayAgo = new Date(Date.now() - 86400000).toISOString()
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(runs).where(and(eq(runs.citizenId, citizenId), gte(runs.startedAt, dayAgo)))
    if (Number(r?.n) >= VERIFICATION_RULES.maxRunsPerDay) throw new Error('You’ve played a lot today! Rest and come back tomorrow.')
    await db.update(runs).set({ status: 'abandoned' }).where(and(eq(runs.citizenId, citizenId), eq(runs.status, 'active')))
    const seed = data.mode === 'daily' ? hashSeed(`garri-daily-${dayKey()}`) : randomBytes(4).readUInt32BE(0)
    const id = crypto.randomUUID()
    await db.insert(runs).values({ id, citizenId, mode: data.mode, seed })
    return { runId: id, seed, mode: data.mode }
  })

export const submitRun = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      runId: z.string().uuid(),
      actions: z.array(z.string().max(48)).max(VERIFICATION_RULES.maxActions),
    }),
  )
  .handler(async ({ data }) => {
    const citizenId = await requireCitizenId()
    const [run] = await db.select().from(runs).where(and(eq(runs.id, data.runId), eq(runs.citizenId, citizenId))).limit(1)
    if (!run) throw new Error('This run wasn’t opened by the town ledger.')
    if (run.status === 'submitted') {
      const [g] = await db.select().from(games).where(eq(games.runId, run.id)).limit(1)
      if (g) return { gameId: g.gameId, snapshot: await snapshot(citizenId) }
    }
    if (run.status !== 'active') throw new Error('This run was replaced by a newer one and can’t be scored.')
    const startedAt = new Date(run.startedAt).getTime()
    if (Date.now() - startedAt > VERIFICATION_RULES.runTtlHours * 3600_000) throw new Error('This run expired before it was finished.')

    const mode = run.mode as keyof typeof MODES
    const replay = replayStrict(mode, Number(run.seed), data.actions)
    if (!replay.ok) {
      await db.update(runs).set({ status: 'rejected', submittedAt: new Date().toISOString() }).where(eq(runs.id, run.id))
      throw new Error(`Verification failed: ${replay.reason}. This run was not scored.`)
    }
    // Claim the run exactly once
    const claimed = await db
      .update(runs)
      .set({ status: 'submitted', submittedAt: new Date().toISOString() })
      .where(and(eq(runs.id, run.id), eq(runs.status, 'active')))
      .returning({ id: runs.id })
    if (!claimed.length) throw new Error('This run was already submitted.')

    const s = replay.state
    const result = scoreRun(s)
    const durationMs = Date.now() - startedAt
    const notes: string[] = []
    if (durationMs < data.actions.length * VERIFICATION_RULES.minMsPerAction) notes.push('Completed unusually fast')
    if (result.score >= VERIFICATION_RULES.reviewScoreAbove) notes.push('Exceptional score')
    const loaded = await loadCitizen(citizenId)
    if (loaded?.citizen.status !== 'active') notes.push('Citizen under review')
    const verification = notes.length ? 'pending' : 'verified'

    const [row] = await db
      .insert(games)
      .values({
        gameId: `TMP-${run.id}`,
        runId: run.id,
        citizenId,
        mode,
        score: result.score,
        xp: result.xp,
        won: s.status === 'won',
        daysSurvived: result.days,
        maxDays: s.maxDays,
        garriMade: s.stats.garriMade,
        reputationEarned: result.reputationEarned,
        seed: Number(run.seed),
        actions: data.actions,
        durationMs,
        verification,
        reviewNote: notes.length ? `${notes.join(' · ')} — awaiting moderator review` : null,
      })
      .returning({ id: games.id })
    const gameId = makeGameId(row.id, randomCode(5))
    await db.update(games).set({ gameId }).where(eq(games.id, row.id))

    const extra: TownEvent[] = [
      verification === 'verified'
        ? { icon: '✅', title: 'Run verified', body: `+${result.xp} XP · Game ID ${gameId}` }
        : { icon: '🔎', title: 'Run recorded · awaiting review', body: `+${result.xp} XP · a moderator will check it before it is ranked` },
    ]
    const { events } = await mutateCitizen(citizenId, (c) => ({
      patch: { xp: c.xp + result.xp, reputation: c.reputation + result.reputationEarned },
    }))
    return { gameId, snapshot: await snapshot(citizenId, [...extra, ...events]) }
  })

