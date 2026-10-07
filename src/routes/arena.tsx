import { Link, createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AvatarBadge } from '@/components/Avatar'
import { PageShell } from '@/components/PageShell'
import { useTown } from '@/lib/store'
import { formatNumber } from '@/lib/progression'
import type { LeaderboardPeriod } from '@/lib/types'
import { getLeaderboard } from '@/server/wallet.functions'

export const Route = createFileRoute('/arena')({
  component: Arena,
  head: () => ({ meta: [{ title: 'Arena Leaderboards · GARRI' }] }),
})

const TABS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'season', label: 'Season' },
  { id: 'all', label: 'All-Time' },
]

type Board = Awaited<ReturnType<typeof getLeaderboard>>

function Arena() {
  const { citizen, games } = useTown()
  const [tab, setTab] = useState<LeaderboardPeriod>('weekly')
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async (period: LeaderboardPeriod) => {
    setLoading(true)
    try {
      setBoard(await getLeaderboard({ data: { period } }))
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh on tab change, when this Citizen records a new game, every 30s and on focus.
  useEffect(() => { load(tab) }, [tab, games.length, load])
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && load(tab)
    const t = setInterval(tick, 30_000)
    window.addEventListener('focus', tick)
    return () => { clearInterval(t); window.removeEventListener('focus', tick) }
  }, [tab, load])

  const rows = board?.rows ?? []
  const top = rows.slice(0, 3)
  const mine = board?.mine ?? null
  const pending = games.filter((g) => g.verification === 'pending').length

  return (
    <PageShell kicker="ARENA" title="Leaderboards" icon="🏟️" accent="#a3322c">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl bg-ink/50 p-1" role="tablist" aria-label="Leaderboard period">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition sm:px-4 ${tab === t.id ? 'bg-gold text-ink' : 'text-cream/70 hover:text-cream'}`}>{t.label}</button>
          ))}
        </div>
        <button onClick={() => load(tab)} className="btn btn-ghost ml-auto !px-3 !py-2 text-xs" aria-label="Refresh leaderboard">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {citizen && (
        <div className="panel mb-6 flex flex-wrap items-center gap-4 p-4">
          <AvatarBadge avatar={citizen.avatar} size={44} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-cream/50">Your rank · {TABS.find((t) => t.id === tab)!.label}</div>
            <div className="font-display text-xl text-gold">{loading && !board ? '…' : mine ? `YOUR RANK: #${mine.rank}` : 'NOT RANKED YET'}</div>
            {!mine && !loading && (
              <div className="text-xs text-cream/55">
                {pending ? `${pending} run${pending > 1 ? 's' : ''} awaiting moderator review.` : 'Finish a verified GARRI SURVIVAL run in this period to enter the board.'}
              </div>
            )}
          </div>
          {mine && <div className="text-right"><div className="font-display text-lg">{formatNumber(mine.score)}</div><div className="text-[10px] uppercase tracking-widest text-cream/50">Best score</div></div>}
          <Link to="/survival" className="btn btn-gold !py-2 text-sm">Play</Link>
        </div>
      )}

      {top.length > 0 && (
        <div className="mb-8 grid grid-cols-3 items-end gap-2 sm:gap-3">
          {[top[1], top[0], top[2]].map((r, i) =>
            r ? (
              <div key={r.citizenId} className={`rise panel min-w-0 p-3 text-center sm:p-4 ${i === 1 ? 'pb-8 ring-2 ring-gold' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
                <div className="text-3xl">{i === 1 ? '👑' : i === 0 ? '🥈' : '🥉'}</div>
                <div className="mt-2 truncate font-bold">{r.name}</div>
                <div className="font-display text-lg text-gold sm:text-2xl">{formatNumber(r.score)}</div>
                <div className="text-[10px] uppercase tracking-widest text-cream/50">LV {r.level} · {r.wins} wins</div>
              </div>
            ) : <div key={i} />,
          )}
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-cream/10 px-4 py-3 text-xs uppercase tracking-widest text-cream/50">
          <span>{TABS.find((t) => t.id === tab)!.label} · GARRI SURVIVAL · verified runs</span>
          {board && <span className="hidden sm:inline">Updated {new Date(board.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {loading && !board ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-cream/5" />)}</div>
        ) : error && !board ? (
          <div className="p-10 text-center">
            <div className="text-4xl">📡</div>
            <p className="mt-3 text-cream/70">Couldn’t reach the Arena ledger.</p>
            <button onClick={() => load(tab)} className="btn btn-ghost mt-4">Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl">🏟️</div>
            <p className="mt-3 font-display text-sm text-cream/80">NO CITIZENS HAVE ENTERED THE LEADERBOARD YET.</p>
            <p className="mt-1 text-sm text-cream/55">Be the first verified Citizen on this board.</p>
            <Link to="/survival" className="btn btn-gold mt-4">Play GARRI SURVIVAL</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-cream/45">
                  <th className="px-4 py-2 font-normal">Rank</th>
                  <th className="px-2 py-2 font-normal">Citizen</th>
                  <th className="px-2 py-2 text-right font-normal">Level</th>
                  <th className="px-2 py-2 text-right font-normal">XP</th>
                  <th className="px-2 py-2 text-right font-normal">Score</th>
                  <th className="px-2 py-2 text-right font-normal">Games</th>
                  <th className="px-4 py-2 text-right font-normal">Wins</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const you = r.citizenId === citizen?.id
                  return (
                    <tr key={r.citizenId} className={`border-t border-cream/5 ${you ? 'bg-gold/10' : ''}`}>
                      <td className={`px-4 py-3 font-display ${r.rank <= 3 ? 'text-gold' : 'text-cream/40'}`}>{r.rank}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <AvatarBadge avatar={r.avatar} size={28} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="max-w-[10rem] truncate font-bold">{r.name}</span>
                              {you && <span className="chip bg-gold text-ink">You</span>}
                            </div>
                            <Link to="/score/$gameId" params={{ gameId: r.bestGameId }} className="font-mono text-[10px] text-cream/40 hover:text-gold">{r.bestGameId}</Link>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">{r.level}</td>
                      <td className="px-2 py-3 text-right text-cream/70">{formatNumber(r.xp)}</td>
                      <td className="px-2 py-3 text-right font-display text-gold">{formatNumber(r.score)}</td>
                      <td className="px-2 py-3 text-right text-cream/70">{r.games}</td>
                      <td className="px-4 py-3 text-right text-cream/70">{r.wins}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-cream/45">
        Boards rank each Citizen’s best verified run in the period. Runs are replayed by the GARRI server; unusual runs wait for a moderator before they count.
      </p>
    </PageShell>
  )
}
