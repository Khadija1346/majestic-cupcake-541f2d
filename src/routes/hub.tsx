import { createFileRoute } from '@tanstack/react-router'
import { Check, Copy, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { NeedCitizen, PageShell } from '@/components/PageShell'
import { StateBadge } from '@/components/StateBadge'
import { REFERRAL_RULES } from '@/lib/config'
import { claimReferral, computeMetrics, useTown } from '@/lib/store'
import { levelFromXp } from '@/lib/progression'

export const Route = createFileRoute('/hub')({
  component: CitizenHub,
  head: () => ({ meta: [{ title: 'Citizen Hub · Referrals · GARRI' }] }),
})

const RULES = [
  'A referral is PENDING the moment a new Citizen creates a GARRI ID with your code.',
  `It becomes QUALIFIED only after they complete the town tutorial, finish ${REFERRAL_RULES.minGames} GARRI SURVIVAL game and reach level ${REFERRAL_RULES.minLevel} — checked by the GARRI server.`,
  'It becomes REWARDED when you claim it here. Each referral can be rewarded exactly once.',
  'Self-referrals, repeat Citizens on one device and bulk sign-ups from one network are held for moderator review.',
  `Rewards are +${REFERRAL_RULES.reward.xp} XP, +${REFERRAL_RULES.reward.rep} Reputation and +${REFERRAL_RULES.reward.rp} Reward Points. Referral rewards are never $GARRI transfers.`,
]

function CitizenHub() {
  const { citizen, games, ready, referrals, invitedBy } = useTown()
  const [copied, setCopied] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<number | null>(null)
  if (ready && !citizen) return <PageShell kicker="CITIZEN HUB" title="Citizen Hub" icon="🪪"><NeedCitizen /></PageShell>
  if (!citizen) return <PageShell kicker="CITIZEN HUB" title="Citizen Hub" icon="🪪"><div /></PageShell>

  const m = computeMetrics(citizen, games)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${citizen.referralCode}` : ''
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text) } catch { return }
    setCopied(key)
    setTimeout(() => setCopied(null), 1600)
  }
  const shareText = `Join me in GARRI: Rise of the Town — a Nigerian-inspired browser game. Use my Citizen code ${citizen.referralCode}`

  // This Citizen's own status as someone who was referred
  const steps = [
    { label: 'Created GARRI ID', done: true },
    { label: 'Completed tutorial', done: citizen.tutorial.done },
    { label: `Played ${REFERRAL_RULES.minGames} GARRI SURVIVAL game`, done: m.gamesPlayed >= REFERRAL_RULES.minGames },
    { label: `Reached level ${REFERRAL_RULES.minLevel}`, done: levelFromXp(citizen.xp) >= REFERRAL_RULES.minLevel },
  ]
  const count = (s: string) => referrals.filter((r) => r.status === s).length
  const claim = async (id: number) => { setClaiming(id); await claimReferral(id); setClaiming(null) }

  return (
    <PageShell kicker="CITIZEN HUB" title="Citizen Hub" icon="🪪" accent="#1f8a5b">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rise panel p-6">
          <div className="font-display text-[10px] tracking-[0.3em] text-gold">YOUR CITIZEN CODE</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 rounded-2xl border-2 border-dashed border-gold/50 bg-ink/40 px-4 py-4 text-center font-mono text-2xl font-black tracking-[0.2em] text-gold">
              {citizen.referralCode}
            </div>
            <button onClick={() => copy(citizen.referralCode, 'code')} className="btn btn-ghost !p-4" aria-label="Copy code">
              {copied === 'code' ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button onClick={() => copy(link, 'link')} className="btn btn-ghost text-sm">{copied === 'link' ? <Check size={14} /> : <Copy size={14} />} Invite link</button>
            <a className="btn btn-ghost text-sm" target="_blank" rel="noreferrer" href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`}>𝕏 Share</a>
            <a className="btn btn-ghost text-sm" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`}><Send size={14} /> Telegram</a>
          </div>

          <h3 className="mt-6 font-display text-sm">Your referrals</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {(['PENDING', 'QUALIFIED', 'REWARDED'] as const).map((s) => (
              <div key={s} className="rounded-xl bg-ink/40 p-3">
                <div className="font-display text-2xl">{count(s)}</div>
                <StateBadge state={s} />
              </div>
            ))}
          </div>
          {referrals.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-cream/15 p-5 text-center text-sm text-cream/55">NO REFERRALS YET. Share your code — neighbours appear here the moment they join.</div>
          ) : (
            <ul className="mt-3 divide-y divide-cream/5 rounded-xl bg-ink/30">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{r.name}</div>
                    <div className="font-mono text-[10px] text-cream/40">{r.garriId} · joined {new Date(r.createdAt).toLocaleDateString('en-GB')}</div>
                  </div>
                  {r.flagged ? <StateBadge state="FLAGGED" label="Under review" /> : <StateBadge state={r.status} />}
                  {r.status === 'QUALIFIED' && !r.flagged && (
                    <button onClick={() => claim(r.id)} disabled={claiming === r.id} className="btn btn-gold !px-3 !py-1.5 text-xs">
                      {claiming === r.id ? <Loader2 size={14} className="animate-spin" /> : 'Claim'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-cream/50">Counts come straight from the GARRI server ledger, so they can’t be inflated from a single device.</p>
        </section>

        <section className="space-y-6">
          {invitedBy && (
            <div className="rise panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-cream/50">You were invited with</div>
                  <div className="font-mono text-lg font-bold">{invitedBy.code}</div>
                </div>
                <StateBadge state={invitedBy.flagged ? 'FLAGGED' : invitedBy.status} label={invitedBy.flagged ? 'Under review' : undefined} />
              </div>
              {invitedBy.flagged && <p className="mt-2 text-sm text-[#ffb4a8]">A moderator will review this referral before it can qualify.</p>}
              <ol className="mt-4 space-y-2">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${s.done ? 'bg-palm' : 'bg-cream/10'}`}>{s.done ? '✓' : ''}</span>
                    <span className={s.done ? '' : 'text-cream/60'}>{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="rise panel p-6" style={{ animationDelay: '80ms' }}>
            <h3 className="font-display text-sm">How referrals qualify</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-cream/75">
              {RULES.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="text-gold">◆</span>{r}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
