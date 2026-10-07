/**
 * Single source of truth for chain, token and reward-program configuration.
 * Reward rules are data, not promises: change them here (and later, from the
 * server) without touching UI code.
 */
export const GARRI_TOKEN = {
  symbol: 'GARRI',
  address: '0xdDDF7AB756C35b4d0537825497e6932780710241',
  decimals: 18, // confirmed on-chain at read time via decimals()
} as const

export const ROBINHOOD_CHAIN = {
  name: 'Robinhood Chain',
  chainId: 4663,
  chainIdHex: '0x' + (4663).toString(16),
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
} as const

export const SOCIALS = {
  x: 'https://x.com/Garrionchain',
  telegram: 'https://t.me/GARRIONCHAIN',
} as const

/** The Game Administrator grants moderator access. Contacting them does not grant it. */
export const GAME_ADMIN = {
  handle: 'Defi_deeja',
  telegram: 'https://t.me/Defi_deeja2',
} as const

/** Holder tiers are computed from a real, wallet-read $GARRI balance only. */
export const HOLDER_TIERS = [
  { id: 'none', name: 'Visitor', min: 0, color: '#8a86b8' },
  { id: 'holder', name: 'Holder', min: 1, color: '#f7e3b0' },
  { id: 'trader', name: 'Market Trader', min: 100_000, color: '#f2b632' },
  { id: 'chief', name: 'Town Chief', min: 1_000_000, color: '#d4552a' },
] as const

/**
 * Hold & Earn programme rules. `active: false` until the GARRI team publishes
 * a live programme. No APR, no guaranteed returns — eligibility only.
 *
 * To go live: set `active: true` and connect the official distribution so it
 * writes entries to the `reward_ledger` table (pending → claimed with tx hash).
 * The Bank page, Moderator Office and Citizen profile already read from there.
 */
export const HOLD_AND_EARN = {
  active: false,
  programme: 'hold-and-earn-s1',
  minHoldingDays: 7,
  minBalance: 1,
  snapshotCadence: 'Weekly (to be confirmed)',
  poolDescription: 'Programme pool and distribution rules are set by the GARRI team and published before launch.',
}

/** Reward Points are an in-game, non-transferable score. They are not $GARRI. */
export const REWARD_POINTS = {
  transferable: false,
  conversionToGarri: null as null | { rate: number; opensAt: string },
}

export const CURRENT_SEASON = {
  id: 's1',
  name: 'Season 1 · Harmattan Harvest',
  short: 'Harmattan Harvest',
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-12-31T23:59:59Z',
}

/** A referral qualifies once the new Citizen has done all of this. */
export const REFERRAL_RULES = {
  tutorial: true,
  minGames: 1,
  minLevel: 2,
  /** In-game reward for the referrer when a referral is claimed. Never $GARRI. */
  reward: { xp: 150, rep: 3, rp: 50 },
}

/** Server-side Survival verification thresholds. Runs outside these wait for a moderator. */
export const VERIFICATION_RULES = {
  /** Faster than this per recorded choice looks automated. */
  minMsPerAction: 600,
  /** Scores at or above this are checked by a moderator before ranking. */
  reviewScoreAbove: 12_000,
  maxActions: 400,
  /** Unsubmitted runs expire after this long. */
  runTtlHours: 24,
  maxRunsPerDay: 150,
}
