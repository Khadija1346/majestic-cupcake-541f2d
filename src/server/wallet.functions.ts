import { randomBytes } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { verifyMessage } from 'viem'
import { z } from 'zod'
import { db } from '../../db/index'
import { citizens, walletChallenges } from '../../db/schema'
import { HOLD_AND_EARN, ROBINHOOD_CHAIN } from '@/lib/config'
import { leaderboard } from './leaderboard.server'
import { garriBalanceOf } from './chain.server'
import { loadCitizen, mutateCitizen, snapshot } from './citizen.server'
import { requireCitizenId, sessionCitizenId, startSession } from './session.server'

const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid wallet address.').transform((a) => a.toLowerCase())

/** Public on-chain read — anyone's balance is public data. */
export const readBalance = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ address: Address }))
  .handler(async ({ data }) => {
    try {
      return { balance: await garriBalanceOf(data.address), checkedAt: new Date().toISOString() }
    } catch (e) {
      console.error('balance read failed', e)
      throw new Error('Couldn’t reach Robinhood Chain to read the balance. Try again shortly.')
    }
  })

/**
 * Issues a one-time message to sign. Signing proves the wallet is yours; it
 * costs no gas and gives GARRI no access to your funds.
 */
export const walletChallenge = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ address: Address, purpose: z.enum(['link', 'restore']) }))
  .handler(async ({ data }) => {
    const citizenId = data.purpose === 'link' ? await requireCitizenId() : null
    const loaded = citizenId ? await loadCitizen(citizenId) : null
    const nonce = randomBytes(16).toString('hex')
    const issued = new Date()
    const message = [
      'GARRI: Rise of the Town',
      data.purpose === 'link'
        ? `Link this wallet to Citizen ${loaded?.citizen.name} (${loaded?.citizen.garriId}).`
        : 'Restore my Citizen on this device.',
      '',
      `Wallet: ${data.address}`,
      `Network: ${ROBINHOOD_CHAIN.name} (${ROBINHOOD_CHAIN.chainId})`,
      `Nonce: ${nonce}`,
      `Issued: ${issued.toISOString()}`,
      '',
      'Signing is free and does not send a transaction or share your keys.',
    ].join('\n')
    await db.insert(walletChallenges).values({
      nonce,
      address: data.address,
      purpose: data.purpose,
      citizenId,
      message,
      expiresAt: new Date(issued.getTime() + 10 * 60_000).toISOString(),
    })
    return { nonce, message }
  })

async function consumeChallenge(nonce: string, signature: `0x${string}`, purpose: 'link' | 'restore') {
  const used = await db
    .update(walletChallenges)
    .set({ usedAt: new Date().toISOString() })
    .where(and(eq(walletChallenges.nonce, nonce), eq(walletChallenges.purpose, purpose), isNull(walletChallenges.usedAt), gt(walletChallenges.expiresAt, new Date().toISOString())))
    .returning()
  const ch = used[0]
  if (!ch) throw new Error('This signature request expired. Please try again.')
  const valid = await verifyMessage({ address: ch.address as `0x${string}`, message: ch.message, signature }).catch(() => false)
  if (!valid) throw new Error('Signature didn’t match this wallet.')
  return ch
}

async function applyBalance(citizenId: string, address: string) {
  let balance: string | null = null
  try {
    balance = await garriBalanceOf(address)
  } catch (e) {
    console.error('balance read failed', e)
  }
  const now = new Date().toISOString()
  return mutateCitizen(citizenId, (c) => {
    if (balance === null) return null
    const holding = Number(balance) >= HOLD_AND_EARN.minBalance
    return {
      patch: {
        garriBalance: balance,
        balanceCheckedAt: now,
        holdingSince: holding ? (c.wallet?.holdingSince ?? now) : null,
      },
    }
  })
}

const Sig = z.string().regex(/^0x[0-9a-fA-F]+$/) as unknown as z.ZodType<`0x${string}`>

export const linkWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ nonce: z.string().length(32), signature: Sig }))
  .handler(async ({ data }) => {
    const citizenId = await requireCitizenId()
    const ch = await consumeChallenge(data.nonce, data.signature, 'link')
    if (ch.citizenId !== citizenId) throw new Error('This signature was issued for a different Citizen.')
    const [owner] = await db.select({ id: citizens.id }).from(citizens).where(eq(citizens.walletAddress, ch.address)).limit(1)
    if (owner && owner.id !== citizenId) throw new Error('This wallet is already linked to another Citizen.')
    const now = new Date().toISOString()
    const { events } = await mutateCitizen(citizenId, (c) =>
      c.wallet?.address === ch.address
        ? null
        : { patch: { walletAddress: ch.address, walletLinkedAt: now, garriBalance: null, balanceCheckedAt: null, holdingSince: null } },
    )
    const bal = await applyBalance(citizenId, ch.address)
    return snapshot(citizenId, [{ icon: '🏦', title: 'Wallet linked', body: 'Your GARRI ID now follows this wallet.' }, ...events, ...bal.events])
  })

export const unlinkWallet = createServerFn({ method: 'POST' }).handler(async () => {
  const citizenId = await requireCitizenId()
  await mutateCitizen(citizenId, () => ({ patch: { walletAddress: null, walletLinkedAt: null, garriBalance: null, balanceCheckedAt: null, holdingSince: null } }))
  return snapshot(citizenId, [{ icon: '🔌', title: 'Wallet unlinked' }])
})

export const refreshBalance = createServerFn({ method: 'POST' }).handler(async () => {
  const citizenId = await requireCitizenId()
  const loaded = await loadCitizen(citizenId)
  const w = loaded?.citizen.wallet
  if (!w) throw new Error('Link a wallet first.')
  if (w.checkedAt && Date.now() - new Date(w.checkedAt).getTime() < 10_000) return snapshot(citizenId)
  const res = await applyBalance(citizenId, w.address)
  return snapshot(citizenId, res.events)
})

/** Restores a Citizen on a new device by proving ownership of its linked wallet. */
export const restoreWithWallet = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ nonce: z.string().length(32), signature: Sig }))
  .handler(async ({ data }) => {
    const ch = await consumeChallenge(data.nonce, data.signature, 'restore')
    const [owner] = await db.select({ id: citizens.id }).from(citizens).where(eq(citizens.walletAddress, ch.address)).limit(1)
    if (!owner) throw new Error('No Citizen is linked to this wallet yet.')
    if ((await sessionCitizenId()) !== owner.id) await startSession(owner.id)
    return snapshot(owner.id, [{ icon: '🔑', title: 'Citizen restored', body: 'Welcome back to town.' }])
  })

export const getLeaderboard = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ period: z.enum(['daily', 'weekly', 'season', 'all']) }))
  .handler(async ({ data }) => {
    const me = await sessionCitizenId()
    const res = await leaderboard(data.period, { citizenId: me })
    return { ...res, updatedAt: new Date().toISOString() }
  })
