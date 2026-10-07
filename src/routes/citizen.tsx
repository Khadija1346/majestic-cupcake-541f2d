import { Link, createFileRoute } from '@tanstack/react-router'
import { AvatarBadge, OUTFITS } from '@/components/Avatar'
import { NeedCitizen, PageShell } from '@/components/PageShell'
import { ProgressBar, StateBadge } from '@/components/StateBadge'
import { ACHIEVEMENTS, NFTS, QUESTS, nftState } from '@/game/content'
import { MODES } from '@/game/survival'
import { CURRENT_SEASON } from '@/lib/config'
import { computeMetrics, signOutCitizen, updateAvatar, useTown } from '@/lib/store'
import { formatDateTime, formatNumber, levelProgress, rankForLevel } from '@/lib/progression'
import { shortAddr } from '@/lib/wallet'

export const Route = createFileRoute('/citizen')({
  component: CitizenPage,
  head: () => ({ meta: [{ title: 'Your House · GARRI ID' }] }),
})

function CitizenPage() {
  const { citizen, games, ready, referrals, invitedBy } = useTown()
  const mine = games
  if (ready && !citizen) return <PageShell kicker="PLAYER HOUSE" title="Your House" icon="🏠"><NeedCitizen /></PageShell>
  if (!citizen) return <PageShell kicker="PLAYER HOUSE" title="Your House" icon="🏠"><div /></PageShell>

  const lp = levelProgress(citizen.xp)
  const m = computeMetrics(citizen, games)
  const unlocked = new Set(citizen.achievements.map((a) => a.id))
  const seasonQuests = QUESTS.filter((q) => q.period === 'season')
  const seasonStart = new Date(CURRENT_SEASON.startsAt).getTime()
  const seasonEnd = new Date(CURRENT_SEASON.endsAt).getTime()
  const seasonPct = Math.max(0, Math.min(1, (Date.now() - seasonStart) / (seasonEnd - seasonStart)))
  const eligibleNfts = NFTS.filter((n) => ['CLAIMABLE', 'CLAIMED'].includes(nftState(n, m, !!citizen.nftClaims[n.id]))).length
  const rank = (r: number | null) => (r ? `#${r}` : 'Not ranked')

  return (
    <PageShell kicker="PLAYER HOUSE" title="Your House" icon="🏠" accent="#e8d2a6">
      {/* GARRI ID card */}
      <div className="rise relative overflow-hidden rounded-[1.75rem] border border-gold/40 bg-gradient-to-br from-adire via-indigo to-night p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[18px] border-gold/15" />
        <div className="absolute bottom-0 right-0 h-full w-1/3 opacity-30 adire-bg" />
        <div className="relative flex flex-wrap items-center gap-5">
          <AvatarBadge avatar={citizen.avatar} size={96} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[10px] tracking-[0.35em] text-gold">GARRI ID · CITIZEN</div>
            <div className="font-display text-3xl font-black">{citizen.name}</div>
            <div className="font-mono text-sm text-cream/60">{citizen.garriId}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip bg-gold text-ink">Level {lp.level}</span>
              <span className="chip bg-cream/10">{rankForLevel(lp.level)}</span>
              <span className="chip bg-cream/10">Since {new Date(citizen.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
              {citizen.status === 'flagged' && <StateBadge state="FLAGGED" label="Under moderator review" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cream/60">
              <span>Wallet: {citizen.wallet ? <span className="font-mono text-cream">{shortAddr(citizen.wallet.address)}</span> : <Link to="/bank" className="text-gold underline">Link at the Bank</Link>}</span>
              <span>Referral code: <span className="font-mono text-cream">{citizen.referralCode}</span></span>
            </div>
          </div>
        </div>
        <div className="relative mt-5">
          <div className="mb-1 flex justify-between text-xs text-cream/60"><span>XP</span><span>{formatNumber(lp.current)} / {formatNumber(lp.needed)} to level {lp.level + 1}</span></div>
          <ProgressBar value={lp.current} max={lp.needed} />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total XP', formatNumber(citizen.xp), '⭐'],
          ['Reputation', citizen.reputation, '🤝'],
          ['Games played', m.gamesPlayed, '🎮'],
          ['Wins', m.wins, '🏆'],
          ['Quests claimed', m.questsClaimed, '📜'],
          ['Achievements', `${m.achievements}/${ACHIEVEMENTS.length}`, '🏅'],
          ['Best score', formatNumber(m.bestScore), '🔥'],
          ['Reward Points', formatNumber(citizen.rewardPoints), '🎟️'],
          ['Season rank', rank(citizen.ranks.season), '🏟️'],
          ['All-time rank', rank(citizen.ranks.all), '👑'],
          ['NFT eligibility', `${eligibleNfts}/${NFTS.length}`, '🖼️'],
          ['Referrals', `${referrals.filter((r) => r.status !== 'PENDING' && !r.flagged).length} qualified${invitedBy ? ` · you: ${invitedBy.status.toLowerCase()}` : ''}`, '🏘️'],
        ].map(([k, v, icon], i) => (
          <div key={k as string} className="rise panel p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="text-xl">{icon}</div>
            <div className="mt-1 font-display text-xl">{v}</div>
            <div className="text-[10px] uppercase tracking-widest text-cream/50">{k}</div>
          </div>
        ))}
      </div>

      {/* Season progress */}
      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-[10px] tracking-[0.3em] text-gold">SEASON PROGRESS</div>
            <div className="font-display">{CURRENT_SEASON.name}</div>
          </div>
          <div className="text-right text-xs text-cream/60">{m.gamesSeason} runs · {m.seasonQuestsClaimed} season-period quests claimed · rank {rank(citizen.ranks.season)}</div>
        </div>
        <div className="mt-3"><ProgressBar value={seasonPct * 100} max={100} color="var(--color-laterite)" /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {seasonQuests.map((q) => {
            const v = Math.min(q.metric(m), q.target)
            return (
              <div key={q.id} className="rounded-xl bg-ink/40 p-3 text-sm">
                <div className="font-bold">{q.title}</div>
                <div className="mt-1"><ProgressBar value={v} max={q.target} /></div>
                <div className="mt-1 text-right text-[11px] text-cream/50">{formatNumber(v)} / {formatNumber(q.target)}</div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 font-display text-lg">Achievements</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const got = unlocked.has(a.id)
              return (
                <div key={a.id} className={`rounded-2xl border p-3 ${got ? 'border-gold/40 bg-gold/10' : 'border-cream/10 bg-ink/30 opacity-60'}`}>
                  <div className={`text-2xl ${got ? '' : 'grayscale'}`}>{got || !a.hidden ? a.icon : '❔'}</div>
                  <div className="mt-1 text-sm font-bold">{got || !a.hidden ? a.name : 'Secret'}</div>
                  <div className="text-[11px] text-cream/55">{got || !a.hidden ? a.desc : 'Explore the town to find out.'}</div>
                </div>
              )
            })}
          </div>
        </section>
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-lg">Inventory</h2>
            <div className="panel grid grid-cols-4 gap-2 p-3">
              {citizen.inventory.map((it) => (
                <div key={it.id} title={it.name} className="grid aspect-square place-items-center rounded-xl bg-ink/40 text-center">
                  <div>
                    <div className="text-2xl">{it.icon}</div>
                    <div className="px-1 text-[9px] leading-tight text-cream/60">{it.name}</div>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 8 - citizen.inventory.length) }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl border border-dashed border-cream/10" />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg">NFT collection</h2>
              <Link to="/gallery" className="text-xs text-gold underline">Gallery →</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {NFTS.map((n) => (
                <span key={n.id} className={`chip ${citizen.nftClaims[n.id] ? 'bg-gold/20 text-gold' : nftState(n, m, false) === 'CLAIMABLE' ? 'bg-gold text-ink' : 'bg-cream/5 text-cream/40'}`}>{n.glyph} {n.name}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-display text-lg">Outfit</h2>
            <div className="flex flex-wrap gap-2">
              {OUTFITS.map((c) => (
                <button key={c} onClick={() => updateAvatar({ ...citizen.avatar, outfit: c })} aria-label={`Outfit ${c}`}
                  className={`h-9 w-9 rounded-full ring-2 ${citizen.avatar.outfit === c ? 'ring-gold' : 'ring-cream/10'}`} style={{ background: c }} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">Recent games</h2>
        {mine.length === 0 ? (
          <div className="panel p-6 text-center text-cream/60">No runs yet. <Link to="/survival" className="text-gold underline">Play GARRI SURVIVAL</Link></div>
        ) : (
          <div className="panel divide-y divide-cream/5">
            {mine.slice(0, 10).map((g) => (
              <Link key={g.gameId} to="/score/$gameId" params={{ gameId: g.gameId }} className="flex items-center gap-3 px-4 py-3 hover:bg-cream/5">
                <span className="text-xl">{g.won ? '🏆' : '🕯️'}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{MODES[g.mode].name} · {g.daysSurvived}/{g.maxDays} days</div>
                  <div className="font-mono text-[11px] text-cream/40">{g.gameId} · {formatDateTime(g.playedAt)}</div>
                </div>
                <StateBadge state={g.verification.toUpperCase()} />
                <span className="font-display text-gold">{formatNumber(g.score)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 text-center">
        <button
          onClick={() => {
            const warn = citizen.wallet
              ? 'Sign out of this device? You can restore your Citizen anytime with your linked wallet.'
              : 'Sign out of this device? You have no linked wallet, so you will NOT be able to restore this Citizen. Link a wallet at the Bank first.'
            if (confirm(warn)) signOutCitizen()
          }}
          className="text-xs text-cream/35 underline"
        >
          Sign out of this device
        </button>
      </div>
    </PageShell>
  )
}
