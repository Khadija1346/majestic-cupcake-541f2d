/** Wallet ↔ GARRI ID flows: link (prove ownership) and restore on a new device. */
import * as walletApi from '@/server/wallet.functions'
import { errorMessage, ledger } from './store'
import { connectWallet, setWalletError, signMessage } from './wallet'

async function signed(address: string | null, purpose: 'link' | 'restore') {
  const addr = address ?? (await connectWallet())
  if (!addr) return null
  try {
    const ch = await walletApi.walletChallenge({ data: { address: addr, purpose } })
    const signature = await signMessage(addr, ch.message)
    return signature ? { nonce: ch.nonce, signature } : null
  } catch (e) {
    setWalletError(errorMessage(e))
    return null
  }
}

export async function linkCitizenWallet(address: string | null) {
  const s = await signed(address, 'link')
  if (!s) return false
  return ledger('wallet:link', () => walletApi.linkWallet({ data: s }))
}

export async function restoreCitizenWithWallet(address: string | null) {
  const s = await signed(address, 'restore')
  if (!s) return false
  return ledger('wallet:restore', () => walletApi.restoreWithWallet({ data: s }))
}

export const refreshCitizenBalance = () => ledger('wallet:refresh', () => walletApi.refreshBalance())
export const unlinkCitizenWallet = () => ledger('wallet:unlink', () => walletApi.unlinkWallet())
