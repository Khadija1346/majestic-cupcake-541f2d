import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/PageShell'
import { StateBadge } from '@/components/StateBadge'
import { useTown } from '@/lib/store'

export const Route = createFileRoute('/market')({
  component: Market,
  head: () => ({ meta: [{ title: 'Oja Market · GARRI' }] }),
})

const STALLS = [
  { icon: '🧵', name: 'Adire Cloth Stall', desc: 'Cosmetic outfits for your Citizen — paid with Reward Points.' },
  { icon: '🥘', name: 'Mama Put Kitchen', desc: 'Survival boosts: start a run with extra food or water.' },
  { icon: '🛠️', name: 'Blacksmith', desc: 'Better farm tools that change your Survival strategy.' },
  { icon: '🏺', name: 'Curio Trader', desc: 'Trade found secrets and collectibles with other Citizens.' },
]

function Market() {
  const { citizen } = useTown()
  return (
    <PageShell kicker="OJA" title="The Market" icon="🧺" accent="#d4552a">
      <div className="panel mb-6 p-5 text-cream/80">
        Mama Nkechi is still arranging the stalls. The market opens to Citizens next season — your Reward Points
        {citizen ? <b className="text-gold"> ({citizen.rewardPoints} RP)</b> : null} will be spendable here on in-game items only.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {STALLS.map((s, i) => (
          <div key={s.name} className="rise panel flex gap-4 p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-laterite/25 text-3xl">{s.icon}</div>
            <div>
              <div className="flex items-center gap-2"><span className="font-display text-sm">{s.name}</span><StateBadge state="LOCKED" label="Next season" /></div>
              <p className="mt-1 text-sm text-cream/65">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
