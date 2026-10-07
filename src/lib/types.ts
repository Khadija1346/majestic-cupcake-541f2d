export type SurvivalMode = 'classic' | 'harmattan' | 'daily'

export interface Avatar {
  outfit: string
  cap: 'fila' | 'gele' | 'none'
  skin: string
}

export interface InventoryItem {
  id: string
  name: string
  icon: string
  qty: number
}

export interface Citizen {
  id: string
  garriId: string
  name: string
  avatar: Avatar
  createdAt: string
  xp: number
  reputation: number
  rewardPoints: number
  referralCode: string
  tutorial: { moved: boolean; talkedElder: boolean; visitedBoard: boolean; done: boolean }
  visited: string[]
  secrets: string[]
  npcsTalked: string[]
  achievements: { id: string; at: string }[]
  inventory: InventoryItem[]
  community: string[]
  questClaims: Record<string, string>
  /** NFT id → eligibility claim. Nothing is minted until `mintTx` is set by a real mint. */
  nftClaims: Record<string, { at: string; review: ReviewStatus; mintTx: string | null }>
  /** Wallet ownership proven by signature. Balance is read on-chain by the server. */
  wallet: { address: string; connectedAt: string; balance: string | null; checkedAt: string | null; holdingSince: string | null } | null
  status: 'active' | 'flagged'
  /** Server-derived — never written by the client. */
  qualifiedReferrals: number
  ranks: Record<LeaderboardPeriod, number | null>
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'season' | 'all'
export type ReviewStatus = 'pending' | 'verified' | 'flagged'
export type VerificationStatus = ReviewStatus

export interface GameRecord {
  gameId: string
  citizenId?: string
  citizenName: string
  garriId: string
  game: 'survival'
  mode: SurvivalMode
  score: number
  xp: number
  won: boolean
  daysSurvived: number
  maxDays: number
  garriMade: number
  reputationEarned: number
  playedAt: string
  verification: VerificationStatus
  reviewNote?: string | null
}

export type QuestState = 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMABLE' | 'CLAIMED'
export type NftState = 'LOCKED' | 'IN_PROGRESS' | 'CLAIMABLE' | 'CLAIMED'
export type ReferralState = 'PENDING' | 'QUALIFIED' | 'REWARDED'

export interface ReferralRow {
  id: number
  name: string
  garriId: string
  status: ReferralState
  flagged: boolean
  createdAt: string
}

export interface RewardEntry {
  id: number
  programme: string
  amount: string
  status: 'pending' | 'claimed'
  txHash: string | null
  createdAt: string
}

export interface TownEvent {
  icon: string
  title: string
  body?: string
}

/** Everything the server sends back about the signed-in Citizen. */
export interface CitizenSnapshot {
  citizen: Citizen
  games: GameRecord[]
  referrals: ReferralRow[]
  /** This Citizen's own referral (when they joined with a code). */
  invitedBy: { code: string; status: ReferralState; flagged: boolean } | null
  rewards: RewardEntry[]
  events: TownEvent[]
}
