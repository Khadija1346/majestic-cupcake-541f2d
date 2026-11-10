import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { NeedCitizen, PageShell } from '@/components/PageShell'
import { useTown } from '@/lib/store'
import { farmAction, getFarm } from '@/server/farm.functions'

export const Route = createFileRoute('/farm')({
  component: FarmPage,
  head: () => ({ meta: [{ title: 'FARM DISTRICT · GARRI: Rise of the Town' }] }),
})

type Farm = Awaited<ReturnType<typeof getFarm>>

function FarmPage() {
  const { citizen, ready } = useTown()
  const [farm, setFarm] = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const reload = async () => {
    try {
      setError('')
      setFarm(await getFarm())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your farm.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(clock)
  }, [])

  const act = async (action: 'plant' | 'water' | 'harvest' | 'process', plotId?: string) => {
    const key = plotId ? `${action}:${plotId}` : action
    if (busy) return
    setBusy(key)
    setError('')
    try {
      setFarm(await farmAction({ data: { action, plotId } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That farm action could not be completed.')
    } finally {
      setBusy(null)
    }
  }

  if (ready && !citizen) return <PageShell kicker="FARM DISTRICT" title="CASSAVA FIELDS" icon="🌱"><NeedCitizen /></PageShell>

  return (
    <PageShell kicker="FARM DISTRICT" title="CASSAVA FIELDS" icon="🌱" accent="#8bbf62">
      {!ready || loading ? (
        <div className="panel h-48 animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Cassava stems', farm?.seeds ?? 0, '🌿'],
              ['Cassava tubers', farm?.cassava ?? 0, '🥔'],
              ['Garri produced', farm?.garri ?? 0, '🥣'],
              ['Active plots', farm?.plots.filter((p) => p.state === 'growing').length ?? 0, '🪴'],
            ].map(([label, value, icon]) => (
              <div key={String(label)} className="panel p-4">
                <div className="text-2xl">{icon}</div>
                <div className="mt-2 font-display text-2xl font-black text-gold">{value}</div>
                <div className="mt-1 text-xs text-cream/60">{label}</div>
              </div>
            ))}
          </div>

          <section className="panel mt-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-xs tracking-[0.2em] text-[#a8d47d]">YOUR FARM</div>
                <h2 className="mt-1 font-display text-xl font-bold">Four plots. One growing business.</h2>
              </div>
              <span className="chip bg-palm/20 text-[#a8d47d]">Progress saves automatically</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {farm?.plots.map((plot, index) => {
                const remaining = plot.readyAt ? Math.max(0, Date.parse(plot.readyAt) - now) : 0
                const isReady = plot.state === 'growing' && remaining === 0
                const minutes = Math.ceil(remaining / 60000)
                return (
                  <div key={plot.id} className="rounded-2xl border border-cream/10 bg-ink/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-display text-sm font-bold">Plot {index + 1}</div>
                      <span className={`chip ${plot.state === 'empty' ? 'bg-cream/10 text-cream/60' : isReady ? 'bg-palm/20 text-[#a8d47d]' : 'bg-gold/15 text-gold'}`}>
                        {plot.state === 'empty' ? 'Empty soil' : isReady ? 'Ready' : 'Growing'}
                      </span>
                    </div>
                    <div className="my-5 grid h-24 place-items-center rounded-xl bg-[#315b35]/40 text-5xl">
                      {plot.state === 'empty' ? '🟫' : isReady ? '🌾' : plot.wateredAt ? '🌱💧' : '🌱'}
                    </div>
                    {plot.state === 'empty' ? (
                      <button className="btn btn-gold w-full" disabled={!!busy || !farm || farm.seeds < 1} onClick={() => act('plant', plot.id)}>
                        {busy === `plant:${plot.id}` ? 'Planting…' : 'Plant cassava stem'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-center text-xs text-cream/65">
                          {isReady ? 'Your cassava is ready for harvest.' : `Estimated time remaining: about ${minutes} min`}
                        </div>
                        {!plot.wateredAt && !isReady && (
                          <button className="btn btn-ghost w-full" disabled={!!busy} onClick={() => act('water', plot.id)}>
                            {busy === `water:${plot.id}` ? 'Watering…' : '💧 Water crop · grow faster'}
                          </button>
                        )}
                        <button className="btn btn-gold w-full" disabled={!isReady || !!busy} onClick={() => act('harvest', plot.id)}>
                          {busy === `harvest:${plot.id}` ? 'Harvesting…' : 'Harvest cassava'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel mt-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <div className="font-display text-xs tracking-[0.2em] text-gold">PROCESSING SHED</div>
              <h2 className="mt-1 font-display text-lg font-bold">Turn cassava into garri</h2>
              <p className="mt-1 text-sm text-cream/60">Use 3 harvested cassava tubers to produce 1 in-game garri unit.</p>
            </div>
            <button className="btn btn-gold shrink-0" disabled={!farm || farm.cassava < 3 || !!busy} onClick={() => act('process')}>
              {busy === 'process' ? 'Processing…' : '🥣 Process garri'}
            </button>
          </section>

          <p className="mt-4 text-center text-xs text-cream/45">
            Crop growth and farm stock are saved on the town server. These are in-game resources, not withdrawable tokens or cash rewards.
          </p>
        </>
      )}
      {error && <div role="alert" className="panel mt-4 border-kola/60 p-4 text-sm text-[#ffc4b8]">{error}</div>}
    </PageShell>
  )
}
