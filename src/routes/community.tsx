import { Link, createFileRoute } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/PageShell'
import { StateBadge } from '@/components/StateBadge'
import { FUTURE_GAMES, SEASONS, TOWN_EVENTS } from '@/data/fixtures'
import { DISTRICTS, QUESTS, SECRETS, questState } from '@/game/content'
import { CURRENT_SEASON, SOCIALS } from '@/lib/config'
import { communityAction, computeMetrics, questPeriodKey, useTown } from '@/lib/store'
import { formatNumber } from '@/lib/progression'
import { getTownPulse } from '@/server/town.functions'

export const Route = createFileRoute('/community')({
  component: Community,
  head: () => ({ meta: [{ title: 'Community Hub · Seasons & Events · GARRI' }] }),
})

function useCountdown(iso: string) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  if (now === null) return null
  const ms = Math.max(0, new Date(iso).getTime() - now)
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms / 3600000) % 24), m: Math.floor((ms / 60000) % 60) }
}

function useTownPulse() {
  const [pulse, setPulse] = useState<Awaited<ReturnType<typeof getTownPulse>> | null>(null)
  useEffect(() => { getTownPulse().then(setPulse).catch(() => {}) }, [])
  return pulse
}

function Community() {
  const { citizen, games } = useTown()
  const left = useCountdown(CURRENT_SEASON.endsAt)
  const pulse = useTownPulse()
  const found = new Set(citizen?.secrets ?? [])
  const m = citizen ? computeMetrics(citizen, games) : null
  const communityQuests = QUESTS.filter((q) => q.category === 'community')

  return (
    <PageShell kicker="COMMUNITY HUB" title="Seasons & Events" icon="🥁" accent="#a3322c">
      <section className="rise relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-laterite via-kola to-night p-6 sm:p-8">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full border-[20px] border-gold/20" />
        <div className="relative">
          <StateBadge state="CLAIMABLE" label="Live season" />
          <h2 className="mt-3 font-display text-3xl font-black sm:text-4xl">{CURRENT_SEASON.short}</h2>
          <p className="mt-2 max-w-lg text-cream/85">Dry winds, high stakes. Harmattan runs pay 1.5×, seasonal quests are open and the season’s top Citizens qualify for the Town Champion collectible.</p>
          <div className="mt-5 flex gap-3">
            {left ? (['d', 'h', 'm'] as const).map((k) => (
              <div key={k} className="rounded-2xl bg-ink/50 px-4 py-3 text-center">
                <div className="font-display text-2xl">{left[k]}</div>
                <div className="text-[10px] uppercase tracking-widest text-cream/60">{k === 'd' ? 'days' : k === 'h' ? 'hours' : 'mins'}</div>
              </div>
            )) : <div className="h-16 w-56 animate-pulse rounded-2xl bg-ink/40" />}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Town pulse">
        {[
          ['🪪', 'Citizens', pulse?.citizens],
          ['✅', 'Verified games', pulse?.verifiedGames],
          ['☀️', 'Verified today', pulse?.gamesToday],
          ['🥣', 'Cups of garri fried', pulse?.garriMade],
        ].map(([icon, k, v]) => (
          <div key={k as string} className="panel p-4">
            <div className="text-xl">{icon}</div>
            <div className="mt-1 font-display text-xl">{v == null ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-cream/10" /> : formatNumber(v as number)}</div>
            <div className="text-[10px] uppercase tracking-widest text-cream/50">{k}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <a href={SOCIALS.x} target="_blank" rel="noopener noreferrer" onClick={() => communityAction('x')} className="panel flex items-center gap-4 p-5 transition hover:border-gold/60 active:scale-[0.99]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream text-2xl font-black text-ink">𝕏</span>
          <div className="min-w-0 flex-1"><div className="font-display text-sm">GARRI ON X</div><div className="text-xs text-cream/55">@Garrionchain · announcements, seasons and Arena champions</div></div>
          {citizen?.community.includes('x') && <StateBadge state="CLAIMED" label="Visited" />}
        </a>
        <a href={SOCIALS.telegram} target="_blank" rel="noopener noreferrer" onClick={() => communityAction('telegram')} className="panel flex items-center gap-4 p-5 transition hover:border-gold/60 active:scale-[0.99]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#2aabee] text-cream"><Send /></span>
          <div className="min-w-0 flex-1"><div className="font-display text-sm">GARRI TELEGRAM</div><div className="text-xs text-cream/55">Talk with Citizens and the GARRI team</div></div>
          {citizen?.community.includes('telegram') && <StateBadge state="CLAIMED" label="Visited" />}
        </a>
      </section>

      {citizen && m && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Community quests</h2>
            <Link to="/quests" className="text-xs text-gold underline">Quest Board →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {communityQuests.map((q) => {
              const st = questState(q, m, !!citizen.questClaims[questPeriodKey(q)])
              return (
                <div key={q.id} className="panel flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{q.title}</div>
                    <div className="text-xs text-cream/60">{q.desc}</div>
                  </div>
                  <StateBadge state={st} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 font-display text-lg">Town events</h2>
          <div className="space-y-3">
            {TOWN_EVENTS.map((e) => (
              <div key={e.id} className="panel flex gap-4 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold/15 text-2xl">{e.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{e.name}</span>
                    <StateBadge state={e.status === 'Live' ? 'COMPLETED' : 'LOCKED'} label={e.status} />
                  </div>
                  <div className="text-xs text-gold">{e.when}</div>
                  <p className="mt-1 text-sm text-cream/70">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-lg">Seasons</h2>
            <div className="panel divide-y divide-cream/5">
              {SEASONS.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div><div className="font-bold">{s.name}</div><div className="text-xs text-cream/50">{s.range}</div></div>
                  <StateBadge state={s.status === 'LIVE' ? 'CLAIMABLE' : 'LOCKED'} label={s.status} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-display text-lg">Town secrets</h2>
            <div className="panel space-y-2 p-4">
              {SECRETS.map((s) => (
                <div key={s.id} className="flex gap-3 text-sm">
                  <span className={`text-xl ${found.has(s.id) ? '' : 'opacity-30 grayscale'}`}>{found.has(s.id) ? s.icon : '❔'}</span>
                  <span className={found.has(s.id) ? 'text-cream' : 'text-cream/60'}>{found.has(s.id) ? <b>{s.name}</b> : <i>“{s.hint}”</i>}</span>
                </div>
              ))}
              <div className="pt-2 text-xs text-cream/45">Explore {DISTRICTS.length} districts and watch for a glint on the ground.</div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">Coming to the Game District</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FUTURE_GAMES.map((g) => (
            <div key={g.id} className="panel relative p-4">
              <div className="absolute right-3 top-3"><StateBadge state="LOCKED" label="Soon" /></div>
              <div className="text-3xl">{g.icon}</div>
              <div className="mt-2 font-display text-sm">{g.name}</div>
              <p className="mt-1 text-xs text-cream/60">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>


    </PageShell>
  )
}
