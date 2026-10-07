import { sql } from 'drizzle-orm'
import { db } from '../../db/index'
import { CURRENT_SEASON } from '@/lib/config'
import { levelFromXp } from '@/lib/progression'
import type { Avatar, LeaderboardPeriod } from '@/lib/types'

export interface BoardRow {
  rank: number
  citizenId: string
  name: string
  garriId: string
  avatar: Avatar
  level: number
  xp: number
  score: number
  games: number
  wins: number
  bestGameId: string
}

export function periodRange(period: LeaderboardPeriod, now = new Date()) {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (period === 'daily') return { from: new Date(dayStart), to: new Date(dayStart + 86400000) }
  if (period === 'weekly') {
    const dow = (now.getUTCDay() + 6) % 7 // Monday = 0
    const start = dayStart - dow * 86400000
    return { from: new Date(start), to: new Date(start + 7 * 86400000) }
  }
  if (period === 'season') return { from: new Date(CURRENT_SEASON.startsAt), to: new Date(CURRENT_SEASON.endsAt) }
  return { from: new Date(0), to: new Date('9999-12-31T00:00:00Z') }
}

const rowsOf = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? (r as unknown[])) as Record<string, any>[]

/**
 * Ranks Citizens by their best *verified* score in the period. Flagged
 * Citizens and pending/flagged runs never appear.
 */
export async function leaderboard(period: LeaderboardPeriod, opts: { limit?: number; citizenId?: string | null } = {}) {
  const { from, to } = periodRange(period)
  const limit = opts.limit ?? 100
  const me = opts.citizenId ?? ''
  const result = await db.execute(sql`
    with best as (
      select distinct on (g.citizen_id) g.citizen_id, g.score, g.game_id, g.played_at
      from games g
      where g.verification = 'verified' and g.played_at >= ${from.toISOString()} and g.played_at < ${to.toISOString()}
      order by g.citizen_id, g.score desc, g.played_at asc
    ), agg as (
      select citizen_id, count(*)::int as games, (count(*) filter (where won))::int as wins
      from games
      where verification = 'verified' and played_at >= ${from.toISOString()} and played_at < ${to.toISOString()}
      group by citizen_id
    ), ranked as (
      select c.id, c.name, c.garri_id, c.avatar, c.xp, b.score, b.game_id, a.games, a.wins,
        (row_number() over (order by b.score desc, a.wins desc, b.played_at asc))::int as rank
      from best b
      join agg a on a.citizen_id = b.citizen_id
      join citizens c on c.id = b.citizen_id
      where c.status = 'active'
    )
    select * from ranked where rank <= ${limit} or id = ${me} order by rank
  `)
  const rows: BoardRow[] = rowsOf(result).map((r) => ({
    rank: Number(r.rank),
    citizenId: r.id,
    name: r.name,
    garriId: r.garri_id,
    avatar: r.avatar,
    level: levelFromXp(Number(r.xp)),
    xp: Number(r.xp),
    score: Number(r.score),
    games: Number(r.games),
    wins: Number(r.wins),
    bestGameId: r.game_id,
  }))
  const mine = rows.find((r) => r.citizenId === me) ?? null
  return { rows: rows.filter((r) => r.rank <= limit), mine }
}

export async function ranksFor(citizenId: string) {
  const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'season', 'all']
  const results = await Promise.all(periods.map((p) => leaderboard(p, { limit: 0, citizenId })))
  return Object.fromEntries(periods.map((p, i) => [p, results[i].mine?.rank ?? null])) as Record<LeaderboardPeriod, number | null>
}
