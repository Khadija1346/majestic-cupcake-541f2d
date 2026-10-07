import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NeedCitizen, PageShell } from '@/components/PageShell'
import { ScoreCard } from '@/components/ScoreCard'
import { ProgressBar, StateBadge } from '@/components/StateBadge'
import { ACTIONS, EVENTS, MODES, SLOTS, act, choose, newGame, scoreRun, type SurvivalState } from '@/game/survival'
import { applySnapshot, errorMessage, useTown } from '@/lib/store'
import { dayKey, formatNumber } from '@/lib/progression'
import type { GameRecord, SurvivalMode } from '@/lib/types'
import { startRun, submitRun } from '@/server/survival.functions'

export const Route = createFileRoute('/survival')({
  component: SurvivalPage,
  head: () => ({ meta: [{ title: 'GARRI SURVIVAL · Game District' }] }),
})

const RUN_KEY = 'garri.survival.run.v2'

interface Saved {
  runId: string
  run: SurvivalState
}

function SurvivalPage() {
  const { citizen, games, ready } = useTown()
  const [saved, setSaved] = useState<Saved | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'starting' | 'submitting' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const submitted = useRef<string | null>(null)
  const run = saved?.run ?? null
  const result: GameRecord | null = gameId ? (games.find((g) => g.gameId === gameId) ?? null) : null

  // Resume an unfinished (or unsubmitted) run after refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RUN_KEY)
      if (raw) setSaved(JSON.parse(raw))
    } catch {}
  }, [])
  useEffect(() => {
    if (saved && !gameId) localStorage.setItem(RUN_KEY, JSON.stringify(saved))
    else localStorage.removeItem(RUN_KEY)
  }, [saved, gameId])

  // Finished: the server replays the whole run and scores it — the browser never sends a score.
  const submit = useCallback(async (s: Saved) => {
    submitted.current = s.runId
    setPhase('submitting')
    setErr(null)
    try {
      const res = await submitRun({ data: { runId: s.runId, actions: s.run.actions } })
      applySnapshot(res.snapshot)
      setGameId(res.gameId)
      setPhase('idle')
    } catch (e) {
      setErr(errorMessage(e))
      setPhase('error')
    }
  }, [])
  useEffect(() => {
    if (!saved || saved.run.status === 'playing' || gameId || !citizen || submitted.current === saved.runId) return
    submit(saved)
  }, [saved, gameId, citizen, submit])

  const start = async (mode: SurvivalMode) => {
    setPhase('starting')
    setErr(null)
    try {
      const r = await startRun({ data: { mode } })
      submitted.current = null
      setGameId(null)
      setSaved({ runId: r.runId, run: newGame(r.mode, r.seed) })
      setPhase('idle')
    } catch (e) {
      setErr(errorMessage(e))
      setPhase('error')
    }
  }
  const reset = () => { setSaved(null); setGameId(null); setErr(null); setPhase('idle'); submitted.current = null }
  const setRun = (r: SurvivalState) => setSaved((cur) => (cur ? { ...cur, run: r } : cur))

  if (ready && !citizen) return <PageShell kicker="GAME DISTRICT" title="GARRI SURVIVAL" icon="🔥"><NeedCitizen /></PageShell>
  if (!ready) return <PageShell kicker="GAME DISTRICT" title="GARRI SURVIVAL" icon="🔥" accent="#d4552a"><div className="h-72 animate-pulse rounded-3xl bg-cream/5" /></PageShell>

  return (
    <PageShell kicker="GAME DISTRICT" title="GARRI SURVIVAL" icon="🔥" accent="#d4552a">
      {err && (
        <div role="alert" className="panel mb-6 flex flex-wrap items-center gap-3 border-kola/60 p-4 text-sm">
          <span className="text-xl">⚠️</span>
          <span className="min-w-0 flex-1 text-[#ffc4b8]">{err}</span>
          {saved && saved.run.status !== 'playing' && !gameId && /network|fetch|reach|busy|failed to/i.test(err) && (
            <button className="btn btn-gold !py-2 text-sm" onClick={() => submit(saved)}>Retry verification</button>
          )}
          <button className="btn btn-ghost !py-2 text-sm" onClick={reset}>Back to modes</button>
        </div>
      )}
      {!run && <ModeSelect onStart={start} starting={phase === 'starting'} games={games} />}
      {run && run.status === 'playing' && <Game run={run} setRun={setRun} onQuit={reset} />}
      {run && run.status !== 'playing' && !result && phase === 'submitting' && (
        <div className="panel mx-auto max-w-md p-8 text-center" aria-live="polite">
          <Loader2 className="mx-auto animate-spin text-gold" size={36} />
          <h2 className="mt-4 font-display text-lg">Verifying your run…</h2>
          <p className="mt-2 text-sm text-cream/65">The town ledger is replaying all {run.actions.length} of your choices to confirm your score.</p>
        </div>
      )}
      {run && run.status !== 'playing' && result && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-5xl">{run.status === 'won' ? '🏆' : '🕯️'}</div>
            <div className="mt-2 font-display text-[10px] tracking-[0.35em] text-gold">GAME COMPLETED</div>
            <h2 className="mt-1 font-display text-2xl">{run.status === 'won' ? `You survived ${run.maxDays} days!` : `You fell on day ${run.day}`}</h2>
            {run.causeOfEnd && <p className="text-cream/60">Cause: {run.causeOfEnd}</p>}
            <p className="mt-1 text-sm text-cream/60">
              {run.stats.garriMade} cups made · {run.stats.garriSold} sold · {run.stats.helped} neighbours helped · Rep +{result.reputationEarned}
            </p>
          </div>
          <ScoreCard record={result} verification={result.verification} />
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn btn-gold" onClick={reset}>Play again</button>
            <Link to="/score/$gameId" params={{ gameId: result.gameId }} className="btn btn-ghost">Open public score page</Link>
            <Link to="/quests" className="btn btn-ghost">Check quests</Link>
            <Link to="/" className="btn btn-ghost">Back to town</Link>
          </div>
        </div>
      )}
    </PageShell>
  )
}

function ModeSelect({ onStart, starting, games: all }: { onStart: (m: SurvivalMode) => void; starting: boolean; games: GameRecord[] }) {
  const games = all.filter((g) => g.verification !== 'flagged')
  const playedDaily = games.some((g) => g.mode === 'daily' && dayKey(new Date(g.playedAt)) === dayKey())
  return (
    <div className="space-y-8">
      <div className="rise grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="panel p-6">
          <h2 className="font-display text-xl">Fry, sell, survive.</h2>
          <p className="mt-2 text-cream/75">
            Each day has a morning, afternoon and evening. Farm cassava, ferment it overnight, fry it into garri, then eat or sell it at the market.
            Watch your health, food, water and energy — every night the town takes its toll. Events will test you. Kindness builds reputation.
          </p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            {['🌱 Farm', '🔪 Ferment', '🍳 Fry', '🧺 Sell'].map((s, i) => (
              <div key={s} className="rounded-xl bg-ink/40 px-2 py-3">
                <div className="text-lg">{s.split(' ')[0]}</div>
                <div className="font-bold">{s.split(' ')[1]}</div>
                <div className="text-cream/40">Step {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-6">
          <div className="text-xs uppercase tracking-widest text-cream/50">Your record</div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <Stat k="Runs" v={games.length} />
            <Stat k="Wins" v={games.filter((g) => g.won).length} />
            <Stat k="Best" v={formatNumber(Math.max(0, ...games.map((g) => g.score)))} />
          </div>
          {games[0] && (
            <Link to="/score/$gameId" params={{ gameId: games[0].gameId }} className="mt-3 flex items-center justify-between rounded-xl bg-ink/40 px-3 py-2 text-xs hover:bg-ink/60">
              <span className="font-mono text-cream/60">Last: {games[0].gameId}</span>
              <StateBadge state={games[0].verification.toUpperCase()} />
            </Link>
          )}
          <Link to="/arena" className="btn btn-ghost mt-4 w-full">View Arena leaderboards</Link>
          <p className="mt-3 text-[11px] text-cream/45">Every run is opened by the GARRI server and replayed move-by-move when you finish. Only verified runs enter the Arena.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(MODES) as SurvivalMode[]).map((m, i) => (
          <button key={m} onClick={() => onStart(m)} disabled={starting} style={{ animationDelay: `${i * 80}ms` }}
            className="rise panel group p-6 text-left transition enabled:hover:-translate-y-1 enabled:hover:border-gold/70 disabled:opacity-60">
            <div className="flex items-center justify-between">
              <span className="text-3xl">{m === 'classic' ? '☀️' : m === 'harmattan' ? '🌪️' : '📅'}</span>
              <span className="chip bg-gold/15 text-gold">×{MODES[m].mult} score</span>
            </div>
            <div className="mt-4 font-display text-lg">{MODES[m].name}</div>
            <p className="mt-1 text-sm text-cream/65">{MODES[m].tagline}</p>
            {m === 'daily' && playedDaily && <p className="mt-2 text-xs text-gold">Played today — replays still count for practice and XP.</p>}
            <div className="mt-4 flex items-center gap-2 font-bold text-gold group-hover:underline">{starting ? <><Loader2 size={16} className="animate-spin" /> Opening run…</> : 'Start run →'}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-xl bg-ink/40 py-3">
      <div className="font-display text-xl">{v}</div>
      <div className="text-[10px] uppercase tracking-widest text-cream/50">{k}</div>
    </div>
  )
}

const WEATHER = { sunny: '☀️ Sunny', rain: '🌧️ Rain', harmattan: '🌫️ Harmattan' }

function Game({ run, setRun, onQuit }: { run: SurvivalState; setRun: (s: SurvivalState) => void; onQuit: () => void }) {
  const event = run.eventId ? EVENTS.find((e) => e.id === run.eventId)! : null
  const ready = run.batches.filter((d) => d <= run.day).length
  const fermenting = run.batches.length - ready
  const preview = useMemo(() => scoreRun(run).score, [run])

  return (
    <div className="space-y-5">
      {/* Day bar */}
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <div className="font-display text-2xl">Day {run.day}<span className="text-cream/40">/{run.maxDays}</span></div>
        <div className="flex gap-1">
          {SLOTS.map((s, i) => (
            <span key={s} className={`chip ${i === run.slot ? 'bg-gold text-ink' : i < run.slot ? 'bg-cream/10 text-cream/40 line-through' : 'bg-cream/10 text-cream/70'}`}>{s}</span>
          ))}
        </div>
        <span className="chip bg-adire/40 text-cream">{WEATHER[run.weather]}</span>
        <span className="chip bg-palm/30 text-cream">Garri ₦{run.price}/cup</span>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-widest text-cream/50">Score so far</div>
          <div className="font-display text-gold">{formatNumber(preview)}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Vitals & stock */}
        <div className="space-y-4">
          <div className="panel space-y-3 p-4">
            <Meter label="Health" icon="❤️" v={run.hp} color="#e5484d" />
            <Meter label="Food" icon="🍲" v={run.satiety} color="#f2b632" />
            <Meter label="Water" icon="💧" v={run.water} color="#4aa3e0" />
            <Meter label="Energy" icon="⚡" v={run.energy} color="#8fe3b5" />
          </div>
          <div className="panel grid grid-cols-3 gap-2 p-4 text-center">
            <Stock icon="₦" label="Naira" v={formatNumber(run.naira)} />
            <Stock icon="🥔" label="Cassava" v={run.cassava} />
            <Stock icon="🥣" label="Garri" v={run.garri} />
            <Stock icon="🫙" label="Fermenting" v={fermenting} />
            <Stock icon="✅" label="Ready" v={ready} />
            <Stock icon="🤝" label="Rep" v={run.rep} />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {ACTIONS.map((a) => {
              const reason = a.can(run) ?? (run.energy < a.energy ? 'Too tired' : null)
              return (
                <button key={a.id} disabled={!!reason || !!event} onClick={() => setRun(act(run, a.id))}
                  className="panel group flex flex-col items-start gap-1 p-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-gold/70 disabled:opacity-40">
                  <div className="flex w-full items-center justify-between">
                    <span className="text-2xl">{a.icon}</span>
                    {a.energy > 0 && <span className="chip bg-ink/50 text-[#8fe3b5]">⚡{a.energy}</span>}
                  </div>
                  <div className="text-sm font-bold leading-tight">{a.name}</div>
                  <div className="text-[11px] leading-tight text-cream/55">{reason ?? a.blurb}</div>
                </button>
              )
            })}
          </div>
          <div className="panel max-h-72 overflow-y-auto p-4">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-cream/50">Town diary</div>
            <ul className="space-y-1.5 text-sm">
              {run.log.slice(0, 30).map((l, i) => (
                <li key={run.log.length - i} className={`${i === 0 ? 'rise' : ''} flex gap-2 ${l.tone === 'good' ? 'text-[#c9f0d9]' : l.tone === 'bad' ? 'text-[#ffb4a8]' : 'text-cream/75'}`}>
                  <span className="shrink-0 font-mono text-xs text-cream/35">D{l.day}</span>{l.text}
                </li>
              ))}
            </ul>
          </div>
          <button onClick={() => { if (confirm('Abandon this run? It will not be scored.')) onQuit() }} className="text-xs text-cream/40 underline">Abandon run</button>
        </div>
      </div>

      {event && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="panel pop w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-laterite to-kola px-6 py-5">
              <div className="text-4xl">{event.icon}</div>
              <div className="mt-2 font-display text-xl">{event.title}</div>
            </div>
            <div className="p-6">
              <p className="text-cream/85">{event.text}</p>
              <div className="mt-5 space-y-2">
                {event.choices.map((c) => (
                  <button key={c.id} onClick={() => setRun(choose(run, c.id))} className="btn btn-ghost w-full !justify-between text-left">
                    <span>{c.label}</span>
                    <span className="text-xs font-normal text-cream/55">{c.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Meter({ label, icon, v, color }: { label: string; icon: string; v: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-bold">{icon} {label}</span>
        <span className={v <= 25 ? 'font-bold text-[#ff8f80]' : 'text-cream/60'}>{v}</span>
      </div>
      <ProgressBar value={v} max={100} color={color} />
    </div>
  )
}

function Stock({ icon, label, v }: { icon: string; label: string; v: string | number }) {
  return (
    <div className="rounded-xl bg-ink/40 py-2">
      <div className="text-lg font-black">{icon === '₦' ? <span className="text-gold">₦</span> : icon}</div>
      <div className="font-display text-sm">{v}</div>
      <div className="text-[9px] uppercase tracking-widest text-cream/45">{label}</div>
    </div>
  )
}
