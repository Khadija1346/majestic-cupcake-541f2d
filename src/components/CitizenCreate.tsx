import { Loader2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { restoreCitizenWithWallet } from '@/lib/citizenWallet'
import { createCitizen, legacyCitizen, useTown } from '@/lib/store'
import type { Avatar } from '@/lib/types'
import { useWallet } from '@/lib/wallet'
import { AvatarBadge, OUTFITS, SKINS } from './Avatar'

export function CitizenCreate() {
  const { offline } = useTown()
  const wallet = useWallet()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<Avatar>({ outfit: OUTFITS[0], skin: SKINS[2], cap: 'fila' })
  const [referral, setReferral] = useState('')
  const [legacy, setLegacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) setReferral(ref.toUpperCase())
    const old = legacyCitizen()
    if (old) {
      setName(old.name)
      setAvatar(old.avatar)
      setLegacy(true)
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const n = name.trim()
    if (n.length < 3 || n.length > 18) return setError('Pick a name between 3 and 18 characters.')
    if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) return setError('Use letters, numbers, spaces, dots, dashes or underscores.')
    if (referral && !/^GARRI-[A-Z0-9]{3,12}$/.test(referral.trim().toUpperCase()))
      return setError('Referral codes look like GARRI-DEEJA.')
    setBusy(true)
    const err = await createCitizen({ name: n, avatar, referral: referral || null })
    setBusy(false)
    if (err) setError(err)
  }

  const restore = async () => {
    setError(null)
    const ok = await restoreCitizenWithWallet(wallet.address)
    if (!ok && !wallet.error) setError('Couldn’t restore a Citizen with that wallet.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm sm:items-center">
      <form onSubmit={submit} className="panel rise max-h-[96dvh] w-full max-w-lg overflow-y-auto">
        <div className="relative overflow-hidden bg-gradient-to-br from-laterite via-kola to-indigo px-6 pb-6 pt-7">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[14px] border-gold/30" />
          <div className="absolute -right-2 top-8 h-20 w-20 rounded-full border-[6px] border-dashed border-cream/25" />
          <div className="font-display text-[10px] tracking-[0.35em] text-garri">WELCOME TO THE TOWN</div>
          <h1 className="mt-2 font-display text-3xl font-black leading-[0.95] text-cream sm:text-4xl">
            GARRI:
            <br />
            RISE OF THE TOWN
          </h1>
          <p className="mt-3 max-w-xs text-sm text-cream/85">
            Become a Citizen. Your GARRI ID carries your level, reputation, scores and collection across every game in town.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <AvatarBadge avatar={avatar} size={72} />
            <label className="flex-1">
              <span className="text-xs font-bold uppercase tracking-widest text-cream/60">Citizen name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
                maxLength={18}
                placeholder="e.g. Adaeze"
                className="mt-1 w-full rounded-xl border border-cream/15 bg-ink/50 px-4 py-3 text-lg font-bold outline-none focus:border-gold"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-cream/60">Ankara outfit</div>
            <div className="flex flex-wrap gap-2">
              {OUTFITS.map((c) => (
                <button type="button" key={c} onClick={() => setAvatar({ ...avatar, outfit: c })} aria-label={`Outfit ${c}`}
                  className={`h-9 w-9 rounded-full ring-2 transition ${avatar.outfit === c ? 'scale-110 ring-gold' : 'ring-cream/10'}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-cream/60">Skin</div>
              <div className="flex gap-2">
                {SKINS.map((c) => (
                  <button type="button" key={c} onClick={() => setAvatar({ ...avatar, skin: c })} aria-label={`Skin ${c}`}
                    className={`h-8 w-8 rounded-full ring-2 ${avatar.skin === c ? 'ring-gold' : 'ring-cream/10'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-cream/60">Headwear</div>
              <div className="flex gap-1">
                {(['fila', 'gele', 'none'] as const).map((c) => (
                  <button type="button" key={c} onClick={() => setAvatar({ ...avatar, cap: c })}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold capitalize ${avatar.cap === c ? 'bg-gold text-ink' : 'bg-cream/10'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-cream/60">Referral code (optional)</span>
            <input
              value={referral}
              onChange={(e) => { setReferral(e.target.value.toUpperCase()); setError(null) }}
              placeholder="GARRI-NAME"
              maxLength={18}
              className="mt-1 w-full rounded-xl border border-cream/15 bg-ink/50 px-4 py-2.5 font-mono tracking-wider outline-none focus:border-gold"
            />
            <span className="mt-1 block text-xs text-cream/50">Self-referrals and repeat sign-ups are held for moderator review.</span>
          </label>

          {legacy && (
            <div className="rounded-xl bg-adire/30 px-4 py-2 text-xs text-cream/75">
              We found your Citizen from the preview build on this device. Its progress was only stored in this browser and can’t be verified, so your name and look carry over and your verified journey starts now.
            </div>
          )}
          {offline && <div role="alert" className="rounded-xl bg-kola/30 px-4 py-2 text-sm text-[#ffc4b8]">Can’t reach the town ledger right now. Check your connection and try again.</div>}
          {(error || wallet.error) && <div role="alert" className="rounded-xl bg-kola/30 px-4 py-2 text-sm text-[#ffc4b8]">{error ?? wallet.error}</div>}

          <button disabled={busy} className="btn btn-gold w-full py-4 font-display text-base disabled:opacity-60">
            {busy ? <><Loader2 size={18} className="animate-spin" /> Registering your GARRI ID…</> : 'Create my GARRI ID'}
          </button>
          <button type="button" onClick={restore} disabled={!!wallet.busy} className="btn btn-ghost w-full text-sm">
            {wallet.busy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />} Already a Citizen? Restore with your linked wallet
          </button>
        </div>
      </form>
    </div>
  )
}
