/**
 * Pure progression maths shared by the browser and the server. The server is
 * authoritative; the browser uses the same functions to render progress.
 */
import type { Citizen, GameRecord } from '@/lib/types'
import { ACHIEVEMENTS, QUESTS, type Metrics, type QuestDef } from './content'
import { CURRENT_SEASON } from '@/lib/config'
import { dayKey, levelFromXp, weekKey } from '@/lib/progression'

export function inSeason(iso: string) {
  const t = new Date(iso).getTime()
  return t >= new Date(CURRENT_SEASON.startsAt).getTime() && t <= new Date(CURRENT_SEASON.endsAt).getTime()
}

/** Flagged runs never count towards progress. */
export function computeMetrics(citizen: Citizen, allGames: GameRecord[]): Metrics {
  const mine = allGames.filter((g) => g.verification !== 'flagged')
  const today = dayKey()
  const week = weekKey()
  const t = mine.filter((g) => dayKey(new Date(g.playedAt)) === today)
  const w = mine.filter((g) => weekKey(new Date(g.playedAt)) === week)
  const s = mine.filter((g) => inSeason(g.playedAt))
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0)
  const seasonQuestIds = new Set(QUESTS.filter((q) => q.period !== 'once').map((q) => q.id))
  return {
    level: levelFromXp(citizen.xp),
    tutorialDone: citizen.tutorial.done,
    gamesPlayed: mine.length,
    wins: mine.filter((g) => g.won).length,
    classicWins: mine.filter((g) => g.won && g.mode === 'classic').length,
    gamesToday: t.length,
    dailyModeToday: t.filter((g) => g.mode === 'daily').length,
    bestDaysToday: max(t.map((g) => g.daysSurvived)),
    gamesWeek: w.length,
    winsWeek: w.filter((g) => g.won).length,
    bestScoreWeek: max(w.map((g) => g.score)),
    gamesSeason: s.length,
    harmattanWinsSeason: s.filter((g) => g.won && g.mode === 'harmattan').length,
    bestHarmattanScore: max(mine.filter((g) => g.mode === 'harmattan').map((g) => g.score)),
    bestScore: max(mine.map((g) => g.score)),
    totalGarriMade: mine.reduce((a, g) => a + g.garriMade, 0),
    districts: citizen.visited.length,
    secrets: citizen.secrets.length,
    npcs: citizen.npcsTalked.length,
    achievements: citizen.achievements.length,
    questsClaimed: Object.keys(citizen.questClaims).length,
    seasonQuestsClaimed: Object.entries(citizen.questClaims).filter(
      ([k, at]) => seasonQuestIds.has(k.split('@')[0]) && inSeason(at),
    ).length,
    qualifiedReferrals: citizen.qualifiedReferrals,
    walletLinked: citizen.wallet ? 1 : 0,
    garriHeld: citizen.wallet?.balance ? Math.floor(Number(citizen.wallet.balance)) : 0,
    communityActions: citizen.community.length,
    seasonRank: citizen.ranks.season ?? 0,
  }
}

export function questPeriodKey(q: QuestDef, now = new Date()) {
  if (q.period === 'daily') return `${q.id}@${dayKey(now)}`
  if (q.period === 'weekly') return `${q.id}@${weekKey(now)}`
  if (q.period === 'season') return `${q.id}@${CURRENT_SEASON.id}`
  return `${q.id}@once`
}

/** Achievements whose conditions are met but not yet unlocked. */
export function newAchievements(c: Citizen, games: GameRecord[]) {
  const m = computeMetrics(c, games)
  const have = new Set(c.achievements.map((a) => a.id))
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(m))
}
