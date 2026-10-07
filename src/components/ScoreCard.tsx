import { Link } from '@tanstack/react-router'
import { Check, Copy, Send, Trophy } from 'lucide-react'
import { useState } from 'react'
import { MODES } from '@/game/survival'
import { formatDateTime, formatNumber } from '@/lib/progression'
import type { GameRecord } from '@/lib/types'
import { StateBadge } from './StateBadge'

export type ShareableScore = Pick<GameRecord, 'gameId' | 'citizenName' | 'garriId' | 'score' | 'xp' | 'mode' | 'playedAt' | 'daysSurvived' | 'maxDays' | 'won'> & {
  reviewNote?: string | null
}

export function scoreUrl(r: ShareableScore) {
  return `${window.location.origin}/score/${r.gameId}`
}

const VERIFY = {
  pending: { state: 'PENDING', label: 'Pending · moderator review', note: 'The server replayed this run and it is genuine, but it is waiting for a moderator before it can be ranked.' },
  verified: { state: 'VERIFIED', label: 'Verified', note: 'Replayed move-by-move and confirmed by the GARRI server. Eligible for the Arena.' },
  flagged: { state: 'FLAGGED', label: 'Flagged', note: 'A moderator flagged this run. It does not count on any leaderboard.' },
} as const

export function ScoreCard({ record, verification }: { record: ShareableScore; verification: keyof typeof VERIFY }) {
  const [copied, setCopied] = useState(false)
  const v = VERIFY[verification]
  const mode = MODES[record.mode]
  const text = `I scored ${formatNumber(record.score)} in GARRI SURVIVAL (${mode.name}) and ${record.won ? 'survived' : 'lasted'} ${record.daysSurvived}/${record.maxDays} days. Game ID ${record.gameId}. Can you beat me? @Garrionchain`

  const share = (to: 'x' | 'tg') => {
    const url = scoreUrl(record)
    const href = to === 'x'
      ? `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
      : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scoreUrl(record))
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="pop mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-[1.75rem] border-2 border-gold/60 bg-gradient-to-b from-indigo to-night shadow-[0_30px_80px_-20px_rgba(242,182,50,0.35)]">
        <div className="absolute inset-0 opacity-40 adire-bg" />
        <div className="relative">
          <div className={`flex items-center justify-between px-6 py-3 ${record.won ? 'bg-gold text-ink' : 'bg-laterite text-cream'}`}>
            <span className="font-display text-xs tracking-[0.3em]">GARRI SURVIVAL</span>
            <span className="font-display text-xs">{record.won ? 'SURVIVED' : 'FELL'}</span>
          </div>
          <div className="px-6 pb-6 pt-5">
            <div className="text-xs uppercase tracking-widest text-cream/50">Citizen</div>
            <div className="font-display text-2xl">{record.citizenName}</div>
            <div className="font-mono text-xs text-cream/50">{record.garriId}</div>

            <div className="my-5 text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-gold">Score</div>
              <div className="font-display text-6xl font-black leading-none text-gold drop-shadow-[0_4px_0_rgba(0,0,0,0.4)]">{formatNumber(record.score)}</div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['XP earned', `+${formatNumber(record.xp)}`],
                ['Game mode', mode.name],
                ['Survival result', `${record.won ? 'Survived' : 'Fell'} · ${record.daysSurvived}/${record.maxDays} days`],
                ['Played', formatDateTime(record.playedAt)],
              ].map(([k, val]) => (
                <div key={k} className="rounded-xl bg-ink/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-cream/50">{k}</dt>
                  <dd className="font-bold">{val}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-xl border border-dashed border-cream/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-cream/50">Game ID</div>
              <div className="font-mono text-base font-bold tracking-wider">{record.gameId}</div>
              <div className="mt-2"><StateBadge state={v.state} label={v.label} /></div>
              <p className="mt-1.5 text-xs text-cream/50">{record.reviewNote && verification !== 'verified' ? record.reviewNote : v.note}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => share('x')} className="btn btn-ghost"><span className="font-black">𝕏</span> Share to X</button>
        <button onClick={() => share('tg')} className="btn btn-ghost"><Send size={16} /> Telegram</button>
        <button onClick={copy} className="btn btn-ghost">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy score link'}</button>
        <Link to="/arena" className="btn btn-gold"><Trophy size={16} /> Leaderboard</Link>
      </div>
    </div>
  )
}
