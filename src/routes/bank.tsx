import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, Copy, Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/PageShell'
import { StateBadge } from '@/components/StateBadge'
import { GARRI_TOKEN, HOLDER_TIERS, HOLD_AND_EARN, ROBINHOOD_CHAIN } from '@/lib/config'
import { linkCitizenWallet, refreshCitizenBalance, unlinkCitizenWallet } from '@/lib/citizenWallet'
import { useTown } from '@/lib/store'
import { formatDateTime, formatNumber } from '@/lib/progression'
import { connectWallet, disconnectWallet, shortAddr, switchToRobinhood, useWallet } from '@/lib/wallet'
import { readBalance } from '@/server/wallet.functions'

export const Route = createFileRoute('/bank')({
  component: Bank,
  head: () => ({ meta: [{ title: 'GARRI Bank · Wallet & Hold & Earn' }] }),
})

type Bal = { status: 'idle' | 'loading' | 'ok' | 'error'; value?: string; at?: string; error?: string }
type HoldState = 'LOCKED' | 'ELIGIBLE' | 'PENDING' | 'CLAIMED'

const fmtGarri = (v: string) => {
  const n = Number(v)
  return n >= 1 ? formatNumber(Math.floor(n)) : n > 0 ? n.toFixed(4) : '0'
}

function Bank() {
  const { citizen, rewards, ready } = useTown()
  const w = useWallet()
  const [bal, setBal] = useState<Bal>({ status: 'idle' })
  const [busy, setBusy] = useState<'link' | 'refresh' | 'unlink' | null>(null)
  const [copied, setCopied] = useState(false)

  const linked = citizen?.wallet ?? null
  const linkedHere = !!linked && w.address === linked.address
  const shownAddress = w.address ?? linked?.address ?? null

  // Public on-chain read for a connected wallet that isn't the linked one
  const readConnected = async (addr: string) => {
    setBal({ status: 'loading' })
    try {
      const r = await readBalance({ data: { address: addr } })
      setBal({ status: 'ok', value: r.balance, at: r.checkedAt })
    } catch (e: any) {
      setBal({ status: 'error', error: e?.message ?? 'Couldn’t read the balance.' })
    }
  }
  useEffect(() => {
    if (w.address && w.address !== linked?.address) readConnected(w.address)
    else setBal({ status: 'idle' })
  }, [w.address, linked?.address])

  const balance: Bal = linked && (!w.address || linkedHere)
    ? linked.balance !== null ? { status: 'ok', value: linked.balance, at: linked.checkedAt ?? undefined } : { status: busy === 'refresh' ? 'loading' : 'idle' }
    : bal
  const value = balance.status === 'ok' ? Number(balance.value) : null
  const tier = value !== null ? [...HOLDER_TIERS].reverse().find((t) => value >= t.min)! : null

  const doLink = async () => { setBusy('link'); await linkCitizenWallet(w.address); setBusy(null) }
  const doRefresh = async () => {
    setBusy('refresh')
    if (linked && (!w.address || linkedHere)) await refreshCitizenBalance()
    else if (w.address) await readConnected(w.address)
    setBusy(null)
  }
  const doUnlink = async () => {
    if (!confirm('Unlink this wallet from your GARRI ID? Holder status resets until you link again.')) return
    setBusy('unlink'); await unlinkCitizenWallet(); setBusy(null)
  }

  // Hold & Earn state — computed only from real data
  const heldDays = linked?.holdingSince ? Math.floor((Date.now() - new Date(linked.holdingSince).getTime()) / 86400000) : 0
  const pendingRewards = rewards.filter((r) => r.status === 'pending')
  const claimedRewards = rewards.filter((r) => r.status === 'claimed')
  const sum = (rs: typeof rewards) => rs.reduce((a, r) => a + Number(r.amount), 0)
  const linkedValue = linked?.balance ? Number(linked.balance) : 0
  const criteria = [
    { label: 'Wallet linked to your GARRI ID (signature)', ok: !!linked },
    { label: `Holding ≥ ${formatNumber(HOLD_AND_EARN.minBalance)} GARRI (read on-chain)`, ok: linkedValue >= HOLD_AND_EARN.minBalance },
    { label: `Held for ${HOLD_AND_EARN.minHoldingDays}+ days across balance checks`, ok: heldDays >= HOLD_AND_EARN.minHoldingDays, note: linked?.holdingSince ? `${heldDays} day${heldDays === 1 ? '' : 's'} so far` : undefined },
  ]
  const eligible = criteria.every((c) => c.ok)
  const holdState: HoldState = pendingRewards.length ? 'PENDING' : claimedRewards.length ? 'CLAIMED' : eligible ? 'ELIGIBLE' : 'LOCKED'

  return (
    <PageShell kicker="GARRI BANK" title="Wallet & Hold & Earn" icon="🏦" accent="#2f3f9e">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Wallet */}
        <section className="rise panel overflow-hidden" aria-labelledby="wallet-h">
          <div className="bg-gradient-to-br from-adire to-indigo p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div id="wallet-h" className="font-display text-[10px] tracking-[0.3em] text-garri">NON-CUSTODIAL WALLET</div>
              {w.address && <StateBadge state={w.onChain ? 'VERIFIED' : 'FLAGGED'} label={w.onChain ? ROBINHOOD_CHAIN.name : 'Wrong network'} />}
            </div>
            <div className="mt-4 text-xs uppercase tracking-widest text-cream/60">GARRI balance</div>
            <div className="font-display text-4xl font-black text-gold" aria-live="polite">
              {balance.status === 'ok' ? fmtGarri(balance.value!) : balance.status === 'loading' ? <span className="inline-block h-9 w-40 animate-pulse rounded bg-cream/10" /> : '—'}
            </div>
            <div className="mt-1 text-sm text-cream/60">
              {balance.status === 'ok'
                ? `Read live from ${ROBINHOOD_CHAIN.name}${balance.at ? ` · ${formatDateTime(balance.at)}` : ''}`
                : balance.status === 'error' ? balance.error
                : shownAddress ? 'Tap refresh to read your balance on-chain' : 'Connect your wallet to read your on-chain balance'}
            </div>
          </div>
          <div className="space-y-3 p-6">
            {!w.address ? (
              <>
                <button onClick={() => connectWallet()} disabled={w.busy === 'connect' || (w.ready && !w.hasProvider)} className="btn btn-gold w-full py-4">
                  {w.busy === 'connect' ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} {w.busy === 'connect' ? 'Waiting for your wallet…' : 'Connect wallet'}
                </button>
                {w.ready && !w.hasProvider && <p className="text-center text-sm text-cream/60">No browser wallet detected. Open this page in your wallet’s browser or install a wallet extension that supports {ROBINHOOD_CHAIN.name}.</p>}
                {linked && <p className="text-center text-xs text-cream/50">Linked wallet {shortAddr(linked.address)} — connect it to refresh or sign.</p>}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-ink/40 px-4 py-3">
                  <span className="font-mono" title={w.address}>{shortAddr(w.address)}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={doRefresh} disabled={!!busy} className="text-xs text-gold underline disabled:opacity-40" aria-label="Refresh balance">
                      <RefreshCw size={14} className={`inline ${busy === 'refresh' || balance.status === 'loading' ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button onClick={disconnectWallet} className="text-xs text-cream/50 underline">Disconnect</button>
                  </div>
                </div>
                {!w.onChain && (
                  <button onClick={switchToRobinhood} disabled={w.busy === 'switch'} className="btn btn-gold w-full">
                    {w.busy === 'switch' && <Loader2 size={16} className="animate-spin" />} Switch to {ROBINHOOD_CHAIN.name}
                  </button>
                )}
                {citizen && !linkedHere && (
                  <button onClick={doLink} disabled={!!busy || !!w.busy} className="btn btn-ghost w-full">
                    {busy === 'link' || w.busy === 'sign' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {w.busy === 'sign' ? 'Confirm the signature in your wallet…' : linked ? 'Switch linked wallet to this one' : 'Verify & link to my GARRI ID'}
                  </button>
                )}
                {linkedHere && (
                  <div className="flex items-center justify-between rounded-xl bg-palm/20 px-4 py-2 text-sm">
                    <span><ShieldCheck size={14} className="mr-1 inline" /> Linked to {citizen?.name}</span>
                    <button onClick={doUnlink} disabled={!!busy} className="text-xs text-cream/50 underline">Unlink</button>
                  </div>
                )}
              </>
            )}
            {w.error && <div role="alert" className="rounded-xl bg-kola/30 px-4 py-2 text-sm text-[#ffc4b8]">{w.error}</div>}
            {!citizen && ready && <p className="text-xs text-cream/55">Create a GARRI ID in town to link your wallet and track holder status.</p>}
            <p className="text-xs text-cream/45">GARRI never asks for your seed phrase, secret recovery phrase or private keys, and never holds your funds. Linking only asks for a free signature that proves the wallet is yours.</p>
          </div>
        </section>

        {/* Holder status */}
        <section className="space-y-6">
          <div className="rise panel p-6" style={{ animationDelay: '60ms' }}>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-cream/50">Holder status</div>
              <StateBadge state={linked && linkedValue >= 1 ? 'VERIFIED' : 'LOCKED'} label={linked ? (linkedValue >= 1 ? 'Holder · verified' : 'Not holding') : 'Wallet not linked'} />
            </div>
            <div className="mt-2 font-display text-2xl" style={{ color: tier?.color ?? '#8a86b8' }}>{tier?.name ?? 'Not connected'}</div>
            <div className="text-xs text-cream/50">Holding tier</div>
            <div className="mt-4 space-y-2">
              {HOLDER_TIERS.slice(1).map((t) => (
                <div key={t.id} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${tier?.id === t.id ? 'bg-gold/15 ring-1 ring-gold/40' : 'bg-ink/30'}`}>
                  <span style={{ color: t.color }}>{t.name}</span>
                  <span className="text-cream/60">≥ {formatNumber(t.min)} GARRI</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Hold & Earn */}
      <section className="rise panel mt-8 overflow-hidden" aria-labelledby="he-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream/10 bg-gradient-to-r from-indigo to-night px-6 py-4">
          <div>
            <div className="font-display text-[10px] tracking-[0.3em] text-gold">HOLD & EARN</div>
            <h2 id="he-h" className="font-display text-lg">Reward eligibility</h2>
          </div>
          <StateBadge state={holdState === 'LOCKED' ? 'LOCKED' : holdState === 'ELIGIBLE' ? 'QUALIFIED' : holdState === 'PENDING' ? 'PENDING' : 'CLAIMED'} label={holdState} />
        </div>
        {!HOLD_AND_EARN.active && (
          <div className="mx-6 mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
            <div className="font-display text-sm text-gold">REWARD SYSTEM READY</div>
            <div className="mt-1 text-xs font-bold tracking-widest text-cream/80">AWAITING OFFICIAL GARRI REWARD CONFIGURATION</div>
            <p className="mt-2 text-xs text-cream/55">Eligibility is tracked from real on-chain balances today. No amounts, APY or distributions are shown until the GARRI team publishes the official programme.</p>
          </div>
        )}
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['GARRI balance', linked?.balance != null ? fmtGarri(linked.balance) : '—'],
                ['Holder status', linked ? (linkedValue >= 1 ? 'Holder' : 'Not holding') : 'Not linked'],
                ['Holding tier', linked?.balance != null ? [...HOLDER_TIERS].reverse().find((t) => linkedValue >= t.min)!.name : '—'],
                ['Reward eligibility', holdState === 'LOCKED' ? 'Locked' : 'Eligible'],
                ['Pending rewards', pendingRewards.length ? `${formatNumber(sum(pendingRewards))} GARRI` : '0'],
                ['Claimed rewards', claimedRewards.length ? `${formatNumber(sum(claimedRewards))} GARRI` : '0'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-ink/40 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-widest text-cream/50">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <ul className="space-y-2 text-sm">
              {criteria.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${c.ok ? 'bg-palm' : 'bg-cream/10'}`}>{c.ok ? '✓' : ''}</span>
                  <span className={c.ok ? '' : 'text-cream/60'}>{c.label}{c.note && <span className="block text-xs text-cream/45">{c.note}</span>}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-cream/45">{HOLD_AND_EARN.poolDescription} No fixed APR and no guaranteed returns. Snapshot cadence: {HOLD_AND_EARN.snapshotCadence}.</p>
            {!citizen && ready && <Link to="/" className="btn btn-ghost mt-3 text-sm">Create a GARRI ID</Link>}
          </div>
        </div>
        <div className="grid gap-6 border-t border-cream/10 p-6 md:grid-cols-2">
          <div>
            <h3 className="font-display text-sm">Available rewards</h3>
            {pendingRewards.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-cream/15 p-5 text-center text-sm text-cream/55">NO REWARDS AVAILABLE YET.</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {pendingRewards.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-xl bg-ink/40 px-3 py-2 text-sm">
                    <span>{r.programme}</span><span className="font-bold text-gold">{formatNumber(Number(r.amount))} GARRI</span><StateBadge state="PENDING" />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-display text-sm">Reward history</h3>
            {claimedRewards.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-cream/15 p-5 text-center text-sm text-cream/55">No reward transactions yet. Every distribution will link to its {ROBINHOOD_CHAIN.name} transaction.</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {claimedRewards.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink/40 px-3 py-2 text-sm">
                    <span>{r.programme}</span><span className="font-bold">{formatNumber(Number(r.amount))} GARRI</span>
                    {r.txHash && <span className="font-mono text-xs text-cream/50">{shortAddr(r.txHash)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Separation of value types */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg">Your values, kept separate</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['⭐', 'XP', citizen ? formatNumber(citizen.xp) : '—', 'Levels you up. In-game only.'],
            ['🤝', 'Reputation', citizen ? citizen.reputation : '—', 'Standing in town. In-game only.'],
            ['🎟️', 'Reward Points', citizen ? formatNumber(citizen.rewardPoints) : '—', 'Earned from quests. Non-transferable.'],
            ['🖼️', 'NFTs', citizen ? `${Object.keys(citizen.nftClaims).length} eligible` : '—', 'Eligibility only. Nothing minted yet.'],
            ['🪙', '$GARRI', linked?.balance != null ? fmtGarri(linked.balance) : '—', 'On-chain token. Read from your wallet.'],
          ].map(([icon, k, v, note]) => (
            <div key={k as string} className="panel p-4">
              <div className="text-xl">{icon}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-cream/50">{k}</div>
              <div className="font-display text-lg">{v}</div>
              <div className="mt-1 text-[11px] text-cream/45">{note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel mt-8 p-6">
        <h2 className="font-display text-sm">Token details</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-cream/50">Contract</dt>
            <dd className="flex items-center gap-2 break-all font-mono text-xs">{GARRI_TOKEN.address}
              <button onClick={() => { navigator.clipboard.writeText(GARRI_TOKEN.address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) }} aria-label="Copy contract">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </dd></div>
          <div><dt className="text-cream/50">Network</dt><dd>{ROBINHOOD_CHAIN.name} · Chain ID {ROBINHOOD_CHAIN.chainId}</dd></div>
          <div><dt className="text-cream/50">Gas</dt><dd>{ROBINHOOD_CHAIN.nativeCurrency.symbol}</dd></div>
          <div className="sm:col-span-3"><dt className="text-cream/50">RPC</dt><dd className="flex items-center gap-1 break-all font-mono text-xs">{ROBINHOOD_CHAIN.rpcUrl}</dd></div>
        </dl>
      </section>
    </PageShell>
  )
}
