import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { NeedCitizen, PageShell } from '@/components/PageShell'
import { ProgressBar, StateBadge } from '@/components/StateBadge'
import { NFTS, nftState, type NftDef } from '@/game/content'
import { ROBINHOOD_CHAIN } from '@/lib/config'
import { computeMetrics, reserveNft, useTown } from '@/lib/store'
import { formatNumber } from '@/lib/progression'

export const Route = createFileRoute('/gallery')({
  component: Gallery,
  head: () => ({ meta: [{ title: 'NFT Gallery · GARRI Citizen Collection' }] }),
})

function NftArt({ nft, dim }: { nft: NftDef; dim: boolean }) {
  const [a, b, c] = nft.palette
  return (
    <svg viewBox="0 0 200 240" className={`w-full ${dim ? 'opacity-40 grayscale' : ''}`}>
      <defs>
        <linearGradient id={`g-${nft.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        <pattern id={`p-${nft.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="6" fill="none" stroke={c} strokeOpacity=".25" strokeWidth="1.5" />
          <path d="M0 0l6 6M24 0l-6 6M0 24l6-6M24 24l-6-6" stroke={c} strokeOpacity=".2" />
        </pattern>
      </defs>
      <rect width="200" height="240" rx="18" fill={`url(#g-${nft.id})`} />
      <rect width="200" height="240" rx="18" fill={`url(#p-${nft.id})`} />
      <circle cx="100" cy="105" r="62" fill={c} opacity=".15" />
      <circle cx="100" cy="105" r="48" fill="none" stroke={c} strokeWidth="3" strokeDasharray="4 6" />
      <text x="100" y="128" textAnchor="middle" fontSize="64" fill={c}>{nft.glyph}</text>
      <rect x="16" y="190" width="168" height="34" rx="10" fill="#0b0a1f" opacity=".55" />
      <text x="100" y="212" textAnchor="middle" fontSize="13" fontWeight="800" fill={c} style={{ fontFamily: 'Unbounded' }}>{nft.name.toUpperCase()}</text>
      <text x="18" y="28" fontSize="10" fontWeight="700" fill={c} opacity=".8" style={{ fontFamily: 'Unbounded' }}>{nft.tier.toUpperCase()}</text>
    </svg>
  )
}

function Gallery() {
  const { citizen, games, ready } = useTown()
  const [claiming, setClaiming] = useState<string | null>(null)
  if (ready && !citizen) return <PageShell kicker="NFT GALLERY" title="Citizen Collection" icon="🖼️"><NeedCitizen /></PageShell>
  if (!citizen) return <PageShell kicker="NFT GALLERY" title="Citizen Collection" icon="🖼️"><div /></PageShell>
  const m = computeMetrics(citizen, games)

  const stateOf = (n: NftDef) => nftState(n, m, !!citizen.nftClaims[n.id])
  const claimable = NFTS.filter((n) => stateOf(n) === 'CLAIMABLE').length
  const claim = async (n: NftDef) => { setClaiming(n.id); await reserveNft(n.id); setClaiming(null) }

  return (
    <PageShell kicker="NFT GALLERY" title="Citizen Collection" icon="🖼️" accent="#f2b632">
      <div className="panel mb-8 flex flex-wrap items-center gap-4 p-5">
        <div className="text-3xl">⛓️</div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm">Mint not yet open · awaiting official GARRI NFT contract</div>
          <p className="text-sm text-cream/65">
            Earn eligibility now by playing. Claiming records your eligibility on the GARRI ledger — nothing is minted until the official collection launches on {ROBINHOOD_CHAIN.name}, where you’ll mint to your own wallet.
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-display text-xl text-gold">{claimable}</div>
          <div className="text-[10px] uppercase tracking-widest text-cream/50">{claimable ? 'Claimable now' : 'No claimable NFTs yet'}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {NFTS.map((n, i) => {
          const st = stateOf(n)
          const v = Math.min(n.metric(m), n.target)
          return (
            <div key={n.id} className="rise panel overflow-hidden p-3" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="relative">
                <NftArt nft={n} dim={st === 'LOCKED'} />
                <div className="absolute right-3 top-3"><StateBadge state={st} label={st === 'CLAIMED' ? 'Claimed · not minted' : undefined} /></div>
                {st === 'LOCKED' && <div className="absolute inset-0 grid place-items-center text-5xl">🔒</div>}
              </div>
              <div className="p-2 pt-4">
                <div className="font-display">{n.name}</div>
                <p className="mt-1 text-sm text-cream/65">{n.desc}</p>
                <div className="mt-3 rounded-xl bg-ink/40 p-3 text-sm">
                  <div className="text-[10px] uppercase tracking-widest text-cream/50">Requirement</div>
                  <div>{st === 'LOCKED' ? `Reach level ${n.minLevel} to begin. ` : ''}{n.requirement}</div>
                  {st === 'IN_PROGRESS' && (
                    <div className="mt-2">
                      <ProgressBar value={v} max={n.target} />
                      <div className="mt-1 text-right text-xs text-cream/50">
                        {n.id === 'champion' ? (m.seasonRank ? `Season rank #${m.seasonRank}` : 'Not ranked this season') : `${formatNumber(v)} / ${formatNumber(n.target)}`}
                        {n.serverGated ? ' · server-tracked' : ''}
                      </div>
                      {n.claimOpensAt && v >= n.target && <div className="mt-1 text-xs text-gold">Requirement met · claims open {new Date(n.claimOpensAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>}
                    </div>
                  )}
                </div>
                {st === 'CLAIMABLE' && (
                  <button onClick={() => claim(n)} disabled={claiming === n.id} className="btn btn-gold mt-3 w-full">
                    {claiming === n.id ? <Loader2 size={16} className="animate-spin" /> : 'Claim eligibility'}
                  </button>
                )}
                {st === 'CLAIMED' && (() => {
                  const c = citizen.nftClaims[n.id]
                  return (
                    <div className="mt-3 text-center text-xs text-cream/55">
                      Eligibility claimed {new Date(c.at).toLocaleDateString('en-GB')} · {c.mintTx ? 'minted' : 'not minted yet'}
                      <div className="mt-1"><StateBadge state={c.review === 'verified' ? 'VERIFIED' : c.review === 'flagged' ? 'FLAGGED' : 'PENDING'} label={c.review === 'verified' ? 'Verified by moderators' : c.review === 'flagged' ? 'Flagged' : 'Awaiting verification'} /></div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}
