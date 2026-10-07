import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/PageShell'
import { ScoreCard, type ShareableScore } from '@/components/ScoreCard'
import { getPublicGame } from '@/server/town.functions'
import type { VerificationStatus } from '@/lib/types'

export const Route = createFileRoute('/score/$gameId')({
  component: ScorePage,
  head: ({ params }) => ({ meta: [{ title: `Game ${params.gameId} · GARRI Score Card` }] }),
})

type Found = ShareableScore & { verification: VerificationStatus }

function ScorePage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState<Found | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    setGame(undefined)
    setFailed(false)
    getPublicGame({ data: { gameId } })
      .then((g) => live && setGame(g as Found | null))
      .catch(() => live && (setFailed(true), setGame(null)))
    return () => { live = false }
  }, [gameId])

  return (
    <PageShell kicker="GAME ID VERIFICATION" title="Score Card" icon="🎫">
      <form
        onSubmit={(e) => { e.preventDefault(); const q = query.trim().toUpperCase(); if (q) navigate({ to: '/score/$gameId', params: { gameId: q } }) }}
        className="mx-auto mb-8 flex max-w-md gap-2"
      >
        <label htmlFor="game-lookup" className="sr-only">Game ID</label>
        <input id="game-lookup" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Look up a Game ID, e.g. GRS-…"
          className="min-w-0 flex-1 rounded-xl border border-cream/15 bg-ink/50 px-4 py-3 font-mono uppercase outline-none focus:border-gold" />
        <button className="btn btn-gold !px-4" aria-label="Search"><Search size={18} /></button>
      </form>

      {game === undefined ? (
        <div className="mx-auto h-[520px] max-w-md animate-pulse rounded-[1.75rem] bg-cream/5" aria-label="Loading score card" />
      ) : game ? (
        <ScoreCard record={game} verification={game.verification} />
      ) : (
        <div className="panel mx-auto max-w-md p-8 text-center">
          <div className="text-4xl">{failed ? '📡' : '🔍'}</div>
          <h2 className="mt-3 font-display text-lg">{failed ? 'Couldn’t reach the ledger' : 'Game ID not found'}</h2>
          <p className="mt-2 text-sm text-cream/65">
            {failed
              ? 'Check your connection and try again.'
              : <><span className="font-mono">{gameId}</span> isn’t on the GARRI ledger. Only runs opened and verified by the server get a Game ID.</>}
          </p>
          <Link to="/arena" className="btn btn-ghost mt-5">Browse the Arena</Link>
        </div>
      )}
    </PageShell>
  )
}
