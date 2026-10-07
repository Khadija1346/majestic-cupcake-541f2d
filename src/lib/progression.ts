/** XP needed to *reach* a level. L1 = 0, L2 = 100, L3 = 300, L5 = 1000, L10 = 4500. */
export function xpForLevel(level: number) {
  return 50 * level * (level - 1)
}

export function levelFromXp(xp: number) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  return level
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp)
  const floor = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, current: xp - floor, needed: next - floor, pct: (xp - floor) / (next - floor) }
}

const RANKS = [
  { min: 1, name: 'Newcomer' },
  { min: 2, name: 'Resident' },
  { min: 4, name: 'Citizen' },
  { min: 6, name: 'Market Trader' },
  { min: 9, name: 'Elder' },
  { min: 13, name: 'Chief' },
  { min: 20, name: 'Town Legend' },
]

export function rankForLevel(level: number) {
  return [...RANKS].reverse().find((r) => level >= r.min)!.name
}

export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
