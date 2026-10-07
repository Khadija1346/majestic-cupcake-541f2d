/**
 * Non-custodial wallet bridge (EIP-1193). GARRI never sees keys — it only
 * asks the user's own wallet for their public address, a free ownership
 * signature, and (later) transactions the user approves themselves.
 * Balances are read on-chain from Robinhood Chain's public RPC.
 */
import { useSyncExternalStore } from 'react'
import { ROBINHOOD_CHAIN } from './config'

interface Eip1193 {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, fn: (...args: any[]) => void) => void
  removeListener?: (event: string, fn: (...args: any[]) => void) => void
}

export function getProvider(): Eip1193 | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null
}

/** Human-readable messages for common wallet errors. */
export function walletError(e: any): string {
  const code = e?.code ?? e?.data?.originalError?.code
  if (code === 4001 || /reject|denied|cancel/i.test(e?.message ?? '')) return 'You rejected the request in your wallet. Nothing was shared.'
  if (code === -32002) return 'Your wallet already has a request open — check the wallet window.'
  if (code === 4100) return 'Your wallet hasn’t authorised this site yet. Connect first.'
  if (code === 4902) return `${ROBINHOOD_CHAIN.name} isn’t in your wallet yet.`
  return e?.message ? String(e.message).slice(0, 180) : 'The wallet request failed. Please try again.'
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

// ─── shared wallet state ───────────────────────────────────────────────────
const DISCONNECTED_KEY = 'garri.wallet.disconnected'

interface WalletState {
  ready: boolean
  hasProvider: boolean
  address: string | null
  chainId: number | null
  busy: 'connect' | 'switch' | 'sign' | null
  error: string | null
}

let ws: WalletState = { ready: false, hasProvider: false, address: null, chainId: null, busy: null, error: null }
const SERVER_WS = ws
const subs = new Set<() => void>()
const setWs = (p: Partial<WalletState>) => {
  ws = { ...ws, ...p }
  subs.forEach((l) => l())
}

let watching = false
function watch() {
  if (watching || typeof window === 'undefined') return
  watching = true
  const p = getProvider()
  setWs({ ready: true, hasProvider: !!p })
  if (!p) return
  const silent = localStorage.getItem(DISCONNECTED_KEY) === '1'
  Promise.all([p.request({ method: 'eth_accounts' }), p.request({ method: 'eth_chainId' })])
    .then(([a, c]) => setWs({ address: silent ? null : ((a as string[])[0]?.toLowerCase() ?? null), chainId: parseInt(c as string, 16) }))
    .catch(() => {})
  p.on?.('accountsChanged', (a: string[]) => {
    if (localStorage.getItem(DISCONNECTED_KEY) === '1') return
    setWs({ address: a[0]?.toLowerCase() ?? null })
  })
  p.on?.('chainChanged', (c: string) => setWs({ chainId: parseInt(c, 16) }))
}

export function useWallet() {
  const s = useSyncExternalStore(
    (l) => {
      watch()
      subs.add(l)
      return () => subs.delete(l)
    },
    () => ws,
    () => SERVER_WS,
  )
  return { ...s, onChain: s.chainId === ROBINHOOD_CHAIN.chainId }
}

export async function connectWallet() {
  const p = getProvider()
  if (!p) {
    setWs({ error: 'No browser wallet found. Open GARRI in your wallet’s browser or install a wallet extension.' })
    return null
  }
  setWs({ busy: 'connect', error: null })
  try {
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
    if (!accounts?.length) throw new Error('No account was shared.')
    localStorage.removeItem(DISCONNECTED_KEY)
    const chainId = parseInt((await p.request({ method: 'eth_chainId' })) as string, 16)
    const address = accounts[0].toLowerCase()
    setWs({ address, chainId, busy: null })
    return address
  } catch (e) {
    setWs({ busy: null, error: walletError(e) })
    return null
  }
}

/** Forgets the connection in this app. (Wallets keep their own site permissions.) */
export function disconnectWallet() {
  localStorage.setItem(DISCONNECTED_KEY, '1')
  getProvider()
    ?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
    .catch(() => {})
  setWs({ address: null, error: null })
}

export async function switchToRobinhood() {
  const p = getProvider()
  if (!p) return
  setWs({ busy: 'switch', error: null })
  try {
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ROBINHOOD_CHAIN.chainIdHex }] })
    } catch (e: any) {
      if (e?.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e
      await p.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: ROBINHOOD_CHAIN.chainIdHex,
            chainName: ROBINHOOD_CHAIN.name,
            nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
            rpcUrls: [ROBINHOOD_CHAIN.rpcUrl],
          },
        ],
      })
    }
    const chainId = parseInt((await p.request({ method: 'eth_chainId' })) as string, 16)
    setWs({ chainId, busy: null })
  } catch (e) {
    setWs({ busy: null, error: walletError(e) })
  }
}

/** Free, off-chain ownership signature (personal_sign). Returns null if rejected. */
export async function signMessage(address: string, message: string) {
  const p = getProvider()
  if (!p) return null
  setWs({ busy: 'sign', error: null })
  try {
    const hex = '0x' + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, '0')).join('')
    const sig = (await p.request({ method: 'personal_sign', params: [hex, address] })) as `0x${string}`
    setWs({ busy: null })
    return sig
  } catch (e) {
    setWs({ busy: null, error: walletError(e) })
    return null
  }
}

export function setWalletError(error: string | null) {
  setWs({ error })
}
