import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/PageShell'
import {
  adminAccess,
  adminDecide,
  getStaffStatus,
  modActivity,
  modGames,
  modOverview,
  modReviewGame,
  requestModAccess,
} from '@/server/mod.functions'

export const Route = createFileRoute('/moderator')({
  component: ModeratorOffice,
  head: () => ({ meta: [{ title: 'Moderator Office · GARRIVERSE' }] }),
})

declare global {
  interface Window {
    netlifyIdentity?: {
      init: () => void
      open: (tab?: 'login' | 'signup') => void
      close: () => void
      logout: () => void
      on: (event: string, callback: (...args: any[]) => void) => void
    }
  }
}

type StaffStatus = {
  signedIn: boolean
  email?: string
  role?: 'admin' | 'moderator' | 'none'
  request?: { status: string; createdAt: string } | null
}

function ModeratorOffice() {
  const [staff, setStaff] = useState<StaffStatus | null>(null)
  const [overview, setOverview] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [pendingGames, setPendingGames] = useState<any[]>([])
  const [access, setAccess] = useState<any>(null)
  const [garriId, setGarriId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setError('')
    try {
      const status = await getStaffStatus() as StaffStatus
      setStaff(status)
      if (status.signedIn && status.role !== 'none') {
        const [stats, log, games] = await Promise.all([modOverview(), modActivity(), modGames({ data: { status: 'pending' } })])
        setOverview(stats)
        setActivity(log)
        setPendingGames(games)
        if (status.role === 'admin') setAccess(await adminAccess())
      } else {
        setOverview(null)
        setActivity([])
        setPendingGames([])
        setAccess(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Moderator Office.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    const boot = () => {
      if (!window.netlifyIdentity) return
      window.netlifyIdentity.init()
      window.netlifyIdentity.on('login', () => { window.netlifyIdentity?.close(); if (alive) void refresh() })
      window.netlifyIdentity.on('logout', () => { if (alive) void refresh() })
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-garri-identity]')
    if (window.netlifyIdentity) boot()
    else if (existing) existing.addEventListener('load', boot, { once: true })
    else {
      const script = document.createElement('script')
      script.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js'
      script.async = true
      script.dataset.garriIdentity = 'true'
      script.onload = boot
      script.onerror = () => setError('Netlify Identity widget could not load. Check your connection and try again.')
      document.head.appendChild(script)
    }
    void refresh()
    return () => { alive = false }
  }, [])

  const submitRequest = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await requestModAccess({ data: { garriId: garriId.trim() || undefined, note: note.trim() || undefined } })
      setMessage(result.status === 'approved' ? 'Your staff access is already approved.' : 'Access request sent. The game administrator must approve it.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit access request.')
    } finally { setBusy(false) }
  }

  const reviewGame = async (gameId: string, decision: 'verified' | 'flagged') => {
    setBusy(true); setError(''); setMessage('')
    try {
      await modReviewGame({ data: { gameId, decision, note: note.trim() || undefined } })
      setMessage(decision === 'verified' ? 'Game run verified.' : 'Game run flagged and removed from verified rankings.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not review this game run.')
    } finally { setBusy(false) }
  }

  const decide = async (requestId: number, approve: boolean) => {
    setBusy(true); setError(''); setMessage('')
    try {
      await adminDecide({ data: { requestId, approve } })
      setMessage(approve ? 'Moderator access granted.' : 'Request declined.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this request.')
    } finally { setBusy(false) }
  }

  const login = () => {
    if (window.netlifyIdentity) window.netlifyIdentity.open('login')
    else setError('Identity is still loading. Please wait a moment and try again.')
  }

  return (
    <PageShell kicker="GARRIVERSE OPERATIONS" title="Moderator Office" icon="🛡️" accent="#8064c8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="panel overflow-hidden">
          <div className="border-b border-cream/10 bg-gradient-to-r from-indigo to-night p-6">
            <div className="text-[10px] font-display tracking-[0.3em] text-gold">SECURE STAFF CONSOLE</div>
            <h2 className="mt-2 font-display text-xl">GARRI Game Operations</h2>
            <p className="mt-2 max-w-2xl text-sm text-cream/65">Staff identity is verified by Netlify Identity. Moderator permissions are checked again on every server action; a Citizen account cannot grant itself staff access.</p>
          </div>
          <div className="space-y-4 p-6">
            {loading ? <p className="text-sm text-cream/60">Checking staff session…</p> : !staff?.signedIn ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-display">Sign in to continue</h3><p className="mt-1 text-xs text-cream/55">Use the staff email invited by the game administrator.</p></div>
                <button onClick={login} className="btn btn-gold">Sign in securely</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="text-xs text-cream/50">SIGNED IN AS</div><div className="font-bold">{staff.email}</div><div className="mt-1 text-xs uppercase tracking-widest text-gold">{staff.role}</div></div>
                <button onClick={() => window.netlifyIdentity?.logout()} className="btn btn-ghost">Sign out</button>
              </div>
            )}
            {staff?.signedIn && staff.role === 'none' && (
              <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
                <h3 className="font-display">Request moderator access</h3>
                <p className="mt-1 text-xs text-cream/60">Submitting a request does not grant access. The administrator reviews and approves each request.</p>
                <label className="mt-4 block text-xs text-cream/60">GARRI ID (optional)</label>
                <input value={garriId} onChange={e => setGarriId(e.target.value)} maxLength={20} className="input mt-1 w-full" placeholder="Your Citizen ID" />
                <label className="mt-3 block text-xs text-cream/60">Why do you need access? (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={280} rows={3} className="input mt-1 w-full" placeholder="Briefly describe your role…" />
                <button disabled={busy} onClick={() => void submitRequest()} className="btn btn-gold mt-3 w-full disabled:opacity-50">{busy ? 'Submitting…' : 'Submit access request'}</button>
                {staff.request && <p className="mt-3 text-sm text-gold">Request status: {staff.request.status.toUpperCase()}</p>}
              </div>
            )}
            {staff?.signedIn && staff.role !== 'none' && overview && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Pending game reviews', overview.games.pending],
                  ['Verified games', overview.games.verified],
                  ['Flagged games', overview.games.flagged],
                  ['Total Citizens', overview.citizens.total],
                  ['Flagged Citizens', overview.citizens.flagged],
                  ['Referrals on hold', overview.referrals.held],
                  ['Pending NFT reviews', overview.nfts.pending],
                  ...(staff.role === 'admin' ? [['Access requests', overview.requests]] : []),
                ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-ink/40 p-4"><div className="font-display text-2xl text-gold">{value ?? 0}</div><div className="mt-1 text-[10px] uppercase tracking-widest text-cream/55">{label}</div></div>)}
              </div>
            )}
          </div>
        </section>

        {staff?.signedIn && staff.role !== 'none' && (
          <section className="panel p-6">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg">Game verification queue</h2><p className="mt-1 text-xs text-cream/55">Review pending runs before they enter verified leaderboards.</p></div><span className="chip bg-gold/15 text-gold">{pendingGames.length} pending</span></div>
            <label className="mt-4 block text-xs text-cream/60">Review note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={280} className="mt-1 w-full rounded-xl border border-cream/15 bg-ink/50 px-3 py-3 text-sm outline-none focus:border-gold" placeholder="Reason for this review…" />
            <div className="mt-4 space-y-3">
              {pendingGames.length === 0 ? <p className="rounded-xl bg-ink/30 p-4 text-sm text-cream/55">No pending game runs need review.</p> : pendingGames.map((game: any) => <div key={game.gameId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink/40 p-4"><div className="min-w-0"><div className="font-bold">{game.name} <span className="font-mono text-xs text-gold">{game.garriId}</span></div><div className="mt-1 text-xs text-cream/55">{game.mode} · score {Number(game.score).toLocaleString()} · {new Date(game.playedAt).toLocaleString()}</div><div className="text-[10px] text-cream/40">Run {game.gameId}</div></div><div className="flex gap-2"><button disabled={busy} onClick={() => void reviewGame(game.gameId, 'verified')} className="btn btn-gold !px-3 !py-2 text-xs">Verify</button><button disabled={busy} onClick={() => void reviewGame(game.gameId, 'flagged')} className="btn btn-ghost !px-3 !py-2 text-xs">Flag</button></div></div>)}
            </div>
          </section>
        )}

        {staff?.signedIn && staff.role === 'admin' && access && (
          <section className="panel p-6">
            <h2 className="font-display text-lg">Administrator · Access requests</h2>
            <div className="mt-4 space-y-3">
              {access.requests.filter((r: any) => r.status === 'pending').length === 0 ? <p className="text-sm text-cream/55">No pending access requests.</p> : access.requests.filter((r: any) => r.status === 'pending').map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink/40 p-4">
                  <div><div className="font-bold">{r.email}</div><div className="text-xs text-cream/55">{r.garriId || 'No GARRI ID'} · {r.note || 'No note supplied'}</div></div>
                  <div className="flex gap-2"><button disabled={busy} onClick={() => void decide(r.id, true)} className="btn btn-gold !px-3 !py-2">Approve</button><button disabled={busy} onClick={() => void decide(r.id, false)} className="btn btn-ghost !px-3 !py-2">Decline</button></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {staff?.signedIn && staff.role !== 'none' && (
          <section className="panel p-6">
            <h2 className="font-display text-lg">Recent staff activity</h2>
            {activity.length === 0 ? <p className="mt-3 text-sm text-cream/55">No moderator actions recorded yet.</p> : <div className="mt-3 divide-y divide-cream/10">{activity.slice(0, 12).map((item: any) => <div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><b>{item.action}</b><div className="text-xs text-cream/50">{item.targetType} · {item.targetId} · {item.actor}</div></div><time className="text-xs text-cream/45">{new Date(item.at).toLocaleString()}</time></div>)}</div>}
          </section>
        )}

        {message && <div role="status" className="rounded-xl border border-palm/30 bg-palm/10 p-4 text-sm">{message}</div>}
        {error && <div role="alert" className="rounded-xl border border-kola/40 bg-kola/20 p-4 text-sm text-[#ffc4b8]">{error}</div>}
        <div className="flex flex-wrap gap-3"><a href="/world3d-babylon" className="btn btn-ghost">← Return to GARRIVERSE</a><a href="https://t.me/Defi_deeja2" target="_blank" rel="noreferrer" className="btn btn-ghost">Contact Game Admin</a></div>
      </div>
    </PageShell>
  )
}
