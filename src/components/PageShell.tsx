import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTown } from '@/lib/store'
import { levelFromXp } from '@/lib/progression'
import { AvatarBadge } from './Avatar'
import { Toasts } from './Toasts'

export function PageShell({
  kicker,
  title,
  icon,
  children,
  accent = '#f2b632',
}: {
  kicker: string
  title: string
  icon: string
  children: ReactNode
  accent?: string
}) {
  const { citizen } = useTown()
  return (
    <div className="adire-bg min-h-dvh pb-24">
      <Toasts />
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-night/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="btn btn-ghost !px-3 !py-2 text-sm">
            <ArrowLeft size={16} /> Town
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[10px] tracking-[0.25em] text-cream/50">GARRI · RISE OF THE TOWN</div>
          </div>
          {citizen && (
            <Link to="/citizen" className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-cream/5">
              <div className="text-right leading-tight">
                <div className="max-w-28 truncate text-sm font-bold">{citizen.name}</div>
                <div className="text-[10px] text-gold">LV {levelFromXp(citizen.xp)}</div>
              </div>
              <AvatarBadge avatar={citizen.avatar} size={36} />
            </Link>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <div className="rise mb-8 flex items-end gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl"
            style={{ background: `${accent}22`, boxShadow: `inset 0 0 0 2px ${accent}55` }}
          >
            {icon}
          </div>
          <div>
            <div className="font-display text-xs tracking-[0.3em]" style={{ color: accent }}>
              {kicker}
            </div>
            <h1 className="font-display text-3xl font-black leading-none sm:text-4xl">{title}</h1>
          </div>
        </div>
        <div className="zigzag-rule mb-8" />
        {children}
      </div>
    </div>
  )
}

export function NeedCitizen() {
  return (
    <div className="panel rise mx-auto max-w-md p-8 text-center">
      <div className="text-5xl">🪪</div>
      <h2 className="mt-4 font-display text-xl">You are not a Citizen yet</h2>
      <p className="mt-2 text-cream/70">Walk into town and create your GARRI ID to unlock this place.</p>
      <Link to="/" className="btn btn-gold mt-6">
        Enter the Town
      </Link>
    </div>
  )
}
