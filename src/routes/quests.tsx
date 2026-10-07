import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NeedCitizen, PageShell } from '@/components/PageShell'
import { ProgressBar, StateBadge } from '@/components/StateBadge'
import { QUESTS, questState, type QuestCategory } from '@/game/content'
import { claimQuest, computeMetrics, questPeriodKey, useTown } from '@/lib/store'
import { formatNumber } from '@/lib/progression'

export const Route = createFileRoute('/quests')({
  component: QuestBoard,
  head: () => ({ meta: [{ title: 'Quest Board · GARRI' }] }),
})

const CATS: { id: QuestCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📜' },
  { id: 'daily', label: 'Daily', icon: '☀️' },
  { id: 'weekly', label: 'Weekly', icon: '📅' },
  { id: 'seasonal', label: 'Seasonal', icon: '🌪️' },
  { id: 'community', label: 'Community', icon: '🥁' },
  { id: 'exploration', label: 'Exploration', icon: '🧭' },
  { id: 'game', label: 'Game', icon: '🎮' },
  { id: 'achievement', label: 'Achievement', icon: '🏅' },
]

const ORDER = { CLAIMABLE: 0, IN_PROGRESS: 1, COMPLETED: 2, LOCKED: 3, CLAIMED: 4 }

function QuestBoard() {
  const { citizen, games, ready } = useTown()
  const [cat, setCat] = useState<QuestCategory | 'all'>('all')
  const [claiming, setClaiming] = useState<string | null>(null)
  const claim = async (q: (typeof QUESTS)[number]) => { setClaiming(q.id); await claimQuest(q); setClaiming(null) }

  const list = useMemo(() => {
    if (!citizen) return []
    const m = computeMetrics(citizen, games)
    return QUESTS.filter((q) => cat === 'all' || q.category === cat)
      .map((q) => ({ q, m, state: questState(q, m, !!citizen.questClaims[questPeriodKey(q)]) }))
      .sort((a, b) => ORDER[a.state] - ORDER[b.state])
  }, [citizen, games, cat])

  if (ready && !citizen) return <PageShell kicker="CENTRAL PLAZA" title="Quest Board" icon="📜"><NeedCitizen /></PageShell>
  if (!citizen) return <PageShell kicker="CENTRAL PLAZA" title="Quest Board" icon="📜"><div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-[1.25rem] bg-cream/5" />)}</div></PageShell>

  return (
    <PageShell kicker="CENTRAL PLAZA" title="Quest Board" icon="📜">
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition ${cat === c.id ? 'bg-gold text-ink' : 'bg-cream/5 text-cream/70 hover:bg-cream/10'}`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map(({ q, m, state }, i) => {
          const v = Math.min(q.metric(m), q.target)
          return (
            <div key={q.id} style={{ animationDelay: `${i * 40}ms` }}
              className={`rise panel relative overflow-hidden p-5 ${state === 'CLAIMABLE' ? 'ring-2 ring-gold' : ''} ${state === 'LOCKED' || state === 'CLAIMED' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold/80">{q.category}</div>
                  <div className="font-display text-base">{q.title}</div>
                </div>
                <StateBadge state={state} />
              </div>
              <p className="mt-2 text-sm text-cream/70">{state === 'LOCKED' ? `Unlocks at level ${q.minLevel}.` : q.desc}</p>
              {state !== 'LOCKED' && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-cream/50">
                    <span>Progress</span>
                    <span>{formatNumber(v)} / {formatNumber(q.target)}</span>
                  </div>
                  <ProgressBar value={v} max={q.target} />
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {q.reward.xp > 0 && <span className="chip bg-gold/15 text-gold">+{q.reward.xp} XP</span>}
                  <span className="chip bg-palm/25 text-[#8fe3b5]">+{q.reward.rep} Rep</span>
                  <span className="chip bg-adire/40 text-[#b9c3ff]">+{q.reward.rp} RP</span>
                </div>
                {state === 'CLAIMABLE' && (
                  <button onClick={() => claim(q)} disabled={claiming === q.id} className="btn btn-gold !py-2 text-sm">
                    {claiming === q.id ? <Loader2 size={16} className="animate-spin" /> : 'Claim'}
                  </button>
                )}
                {state === 'COMPLETED' && q.claimOpensAt && (
                  <span className="text-right text-[11px] text-cream/50">Claims open<br />{new Date(q.claimOpensAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-center text-xs text-cream/45">
        Progress and claims are checked by the GARRI server. Daily quests reset at 00:00 UTC, weekly on Monday. XP, Reputation and Reward Points (RP) are in-game progress — they are not tokens.
      </p>
    </PageShell>
  )
}
