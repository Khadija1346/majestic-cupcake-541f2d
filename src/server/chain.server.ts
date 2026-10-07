/** Reads public $GARRI data straight from Robinhood Chain's RPC. */
import { GARRI_TOKEN, ROBINHOOD_CHAIN } from '@/lib/config'

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(ROBINHOOD_CHAIN.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Robinhood Chain RPC responded ${res.status}`)
  const json = (await res.json()) as { result?: string; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result ?? '0x'
}

let cachedDecimals: number | null = null

/** Returns the balance as a decimal string in whole-token units (e.g. "1234.5"). */
export async function garriBalanceOf(address: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid wallet address.')
  const padded = address.toLowerCase().slice(2).padStart(64, '0')
  const call = (data: string) => rpc('eth_call', [{ to: GARRI_TOKEN.address, data }, 'latest'])
  const [rawBal, rawDec] = await Promise.all([
    call('0x70a08231' + padded),
    cachedDecimals === null ? call('0x313ce567').catch(() => null) : Promise.resolve(null),
  ])
  if (cachedDecimals === null) cachedDecimals = rawDec && rawDec !== '0x' ? Number(BigInt(rawDec)) : GARRI_TOKEN.decimals
  const wei = rawBal && rawBal !== '0x' ? BigInt(rawBal) : 0n
  const base = 10n ** BigInt(cachedDecimals)
  const whole = wei / base
  const frac = (wei % base).toString().padStart(cachedDecimals, '0').replace(/0+$/, '').slice(0, 6)
  return frac ? `${whole}.${frac}` : whole.toString()
}
