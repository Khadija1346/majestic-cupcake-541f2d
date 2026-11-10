import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import { farmStates } from '../../db/schema'
import { requireCitizenId } from './session.server'

const GROWTH_MS = 15 * 60 * 1000
const WATERED_GROWTH_MS = 8 * 60 * 1000
const PLOT_IDS = ['plot-1', 'plot-2', 'plot-3', 'plot-4'] as const

type Plot = {
  id: string
  state: 'empty' | 'growing'
  plantedAt: string | null
  wateredAt: string | null
  readyAt: string | null
}

type FarmRow = typeof farmStates.$inferSelect

function emptyPlots(): Plot[] {
  return PLOT_IDS.map((id) => ({ id, state: 'empty', plantedAt: null, wateredAt: null, readyAt: null }))
}

function view(row: FarmRow) {
  return {
    plots: row.plots,
    seeds: row.seeds,
    cassava: row.cassava,
    garri: row.garri,
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

async function ensureFarm(citizenId: string) {
  await db.insert(farmStates).values({
    citizenId,
    plots: emptyPlots(),
    seeds: 3,
    cassava: 0,
    garri: 0,
  }).onConflictDoNothing()
  const [row] = await db.select().from(farmStates).where(eq(farmStates.citizenId, citizenId)).limit(1)
  if (!row) throw new Error('Your farm could not be loaded. Please try again.')
  return row
}

export const getFarm = createServerFn({ method: 'GET' }).handler(async () => {
  const citizenId = await requireCitizenId()
  return view(await ensureFarm(citizenId))
})

export const farmAction = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    action: z.enum(['plant', 'water', 'harvest', 'process']),
    plotId: z.string().max(16).optional(),
  }))
  .handler(async ({ data }) => {
    const citizenId = await requireCitizenId()

    // Optimistic version checks prevent two rapid taps from spending the same stock twice.
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await ensureFarm(citizenId)
      const plots = row.plots.map((plot) => ({ ...plot }))
      let seeds = row.seeds
      let cassava = row.cassava
      let garri = row.garri
      const now = new Date()
      const nowIso = now.toISOString()

      if (data.action === 'process') {
        if (cassava < 3) throw new Error('You need 3 cassava tubers to process garri.')
        cassava -= 3
        garri += 1
      } else {
        const plot = plots.find((item) => item.id === data.plotId)
        if (!plot) throw new Error('Choose a valid farm plot.')

        if (data.action === 'plant') {
          if (plot.state !== 'empty') throw new Error('This plot already has a crop growing.')
          if (seeds < 1) throw new Error('You need a cassava stem to plant.')
          seeds -= 1
          plot.state = 'growing'
          plot.plantedAt = nowIso
          plot.wateredAt = null
          plot.readyAt = new Date(now.getTime() + GROWTH_MS).toISOString()
        } else if (data.action === 'water') {
          if (plot.state !== 'growing' || !plot.readyAt) throw new Error('There is no growing crop to water here.')
          if (plot.wateredAt) throw new Error('This crop has already been watered.')
          plot.wateredAt = nowIso
          const acceleratedReadyAt = now.getTime() + WATERED_GROWTH_MS
          plot.readyAt = new Date(Math.min(Date.parse(plot.readyAt), acceleratedReadyAt)).toISOString()
        } else if (data.action === 'harvest') {
          if (plot.state !== 'growing' || !plot.readyAt || Date.parse(plot.readyAt) > now.getTime()) {
            throw new Error('The cassava is not ready yet. Give it more time to grow.')
          }
          cassava += 3
          // A healthy harvest returns one stem, allowing the farm loop to continue.
          seeds += 1
          plot.state = 'empty'
          plot.plantedAt = null
          plot.wateredAt = null
          plot.readyAt = null
        }
      }

      const updated = await db.update(farmStates)
        .set({ plots, seeds, cassava, garri, version: row.version + 1, updatedAt: nowIso })
        .where(and(eq(farmStates.citizenId, citizenId), eq(farmStates.version, row.version)))
        .returning()

      if (updated.length) return view(updated[0])
    }

    throw new Error('Your farm was updated somewhere else. Refresh and try again.')
  })
