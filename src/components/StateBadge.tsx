const STYLES: Record<string, string> = {
  LOCKED: 'bg-cream/10 text-cream/50',
  IN_PROGRESS: 'bg-adire/40 text-[#b9c3ff]',
  COMPLETED: 'bg-palm/25 text-[#8fe3b5]',
  CLAIMABLE: 'bg-gold text-ink animate-pulse',
  CLAIMED: 'bg-cream/15 text-cream',
  PENDING: 'bg-adire/40 text-[#b9c3ff]',
  QUALIFIED: 'bg-palm/25 text-[#8fe3b5]',
  REWARDED: 'bg-gold text-ink',
  RECORDED: 'bg-adire/40 text-[#b9c3ff]',
  VERIFIED: 'bg-palm/25 text-[#8fe3b5]',
  FLAGGED: 'bg-kola/40 text-[#ffb4a8]',
  DEMO: 'bg-cream/10 text-cream/60',
}

const ICONS: Record<string, string> = { LOCKED: '🔒', CLAIMED: '✓', CLAIMABLE: '★', COMPLETED: '●' }

export function StateBadge({ state, label }: { state: string; label?: string }) {
  return (
    <span className={`chip ${STYLES[state] ?? STYLES.LOCKED}`}>
      {ICONS[state] && <span>{ICONS[state]}</span>}
      {label ?? state.replace('_', ' ')}
    </span>
  )
}

export function ProgressBar({ value, max, color = 'var(--color-gold)' }: { value: number; max: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-cream/10">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
